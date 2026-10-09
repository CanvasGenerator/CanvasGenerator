const { supabaseRequest } = require('./supabase');
const { completerLiensFooter } = require('./footer-liens');
const { ajouterCssLogosEn } = require('./school-blocks');
const { ajouterCssConsentement } = require('./css-consentement');

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isFullHtmlDocument(html = '') {
    return /^\s*(<!doctype\s+html[^>]*>\s*)?<html[\s>]/i.test(String(html || ''));
}

function extractBodyContent(fullHtml) {
    // ⚠️ Utiliser un regex GREEDY ([\ s\S]*) et non paresseux (?)
    // pour capturer jusqu'au DERNIER </body> — le bloc <script> GrapesJS
    // est injecté en fin de body et serait perdu avec un match non-greedy
    // si des composants contiennent des balises </body> internes.
    const match = String(fullHtml || '').match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1] : fullHtml;
}

/**
 * Retire un bloc de code personnalisé déjà injecté (entre repères) d'un HTML.
 * Évite la double-injection lors des ré-enregistrements / déclinaisons.
 */
function stripCustomCode(str = '', zone) {
    const re = new RegExp(`<!-- custom-${zone}:start -->[\\s\\S]*?<!-- custom-${zone}:end -->`, 'g');
    return String(str || '').replace(re, '');
}

/** Enveloppe le code personnalisé dans des repères (ou chaîne vide si absent). */
function wrapCustomCode(code, zone) {
    const c = String(code || '').trim();
    if (!c) return '';
    return `<!-- custom-${zone}:start -->${c}<!-- custom-${zone}:end -->`;
}

/**
 * Config campus de la page, lue par le runtime des composants campus
 * (Nos Campus, Carrousel 3 – Campus) sur la page servie hors éditeur.
 * ⚠️ MÊME sortie que server.js (buildCampusRuntimeTag) : sans cette balise côté
 * Vercel, l'aperçu et la page publiée n'avaient aucune sélection ni école, donc
 * plus aucune resynchro campus alors qu'elle fonctionnait en local.
 */
function buildCampusRuntimeTag(properties = {}, school = '') {
    const ids = Array.isArray(properties.campusIds) ? properties.campusIds : [];
    const apiBase = process.env.PUBLIC_APP_URL || process.env.VERCEL_URL
        ? (process.env.PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`)
        : '';
    return `<script data-lp-campus-config>window.__LP_CAMPUS_IDS=${JSON.stringify(ids)};`
        + `window.__LP_API_BASE=${JSON.stringify(apiBase)};`
        + `window.__LP_SCHOOL=${JSON.stringify(school || '')};</script>`;
}

function buildStoredHtml({ projectName, html = '', css = '', properties = {} }) {
    // If it's already a full document, extract the body so we can rebuild the head with fresh SEO
    let bodyContent = isFullHtmlDocument(html) ? extractBodyContent(html) : html;
    // Anti-doublon : retirer un éventuel code déjà injecté précédemment
    bodyContent = stripCustomCode(bodyContent, 'body');
    // Anti-doublon : la config campus d'un enregistrement précédent est dans le body
    // repris tel quel (le head, lui, est reconstruit à chaque fois).
    bodyContent = bodyContent.replace(/<script data-lp-campus-config>[\s\S]*?<\/script>/gi, '');

    const title = properties?.seoTitle || properties?.title || projectName || '';
    const seoTags = properties ? `
                <meta name="description" content="${escapeHtml(properties.seoDescription || '')}">
                <meta name="keywords" content="${escapeHtml(properties.keywords || '')}">
                ${properties.canonical ? `<link rel="canonical" href="${escapeHtml(properties.canonical)}">` : ''}
                ${properties.schemaLd ? `<script type="application/ld+json">${properties.schemaLd}</script>` : ''}
            ` : '';

    // Code marketing personnalisé (GTM, Analytics, pixels…) — inséré tel quel, non échappé.
    const headCode = wrapCustomCode(properties.customHeadCode, 'head');
    const bodyCode = wrapCustomCode(properties.customBodyCode, 'body');

    // École déduite du nom de projet (`school-<id>__…`) → runtime campus scopé.
    const schoolMatch = /^school-([a-z0-9-]+)__/i.exec(projectName || '');
    const campusTag = buildCampusRuntimeTag(properties, schoolMatch ? schoolMatch[1].toLowerCase() : '');

    return finaliserPage(relaxFaqSectionHeights(
        `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${headCode}<title>${escapeHtml(title)}</title>${seoTags}${campusTag}<style>${css}</style></head><body>${bodyContent}${bodyCode}</body></html>`
    ));
}

/**
 * Neutralise les HAUTEURS FIGÉES posées sur une section FAQ (accordéon).
 *
 * Toutes les sections sont redimensionnables dans l'éditeur : tirer la poignée
 * du bas écrit `#<id>{height:392px}` dans le CSS de la page. Comme l'éditeur
 * n'affiche qu'une réponse ouverte, la hauteur paraît suffisante — mais en
 * ligne, déplier les autres réponses fait déborder le contenu hors de la
 * section, qui chevauche le bloc suivant (footer). Une hauteur fixe n'a aucun
 * sens sur un accordéon : on retire `height` / `max-height` des règles ciblant
 * ces sections (y compris dans les media queries), en laissant `min-height`
 * (qui n'écrête rien) et sans jamais toucher à `line-height`.
 *
 * Idempotent. Appliqué à l'enregistrement ET au service des pages déjà en base.
 */
function relaxFaqSectionHeights(html) {
    const source = String(html || '');
    if (!/ma-faq-section|ma-section/i.test(source)) return source;

    const ids = [];
    const tags = source.match(/<section\b[^>]*>/gi) || [];
    for (const tag of tags) {
        if (!/ma-faq-section|\bma-section\b/i.test(tag)) continue;
        const id = (tag.match(/\sid=["']([^"']+)["']/i) || [])[1];
        if (id && !ids.includes(id)) ids.push(id);
    }
    if (!ids.length) return source;

    let out = source;
    for (const id of ids) {
        // Chaque bloc de déclarations `#id{…}` (plusieurs si media queries).
        const blockRe = new RegExp(`(#${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{)([^}]*)(\\})`, 'gi');
        out = out.replace(blockRe, (full, open, decls, close) => {
            // `(^|;)` avant `height` → « line-height » n'est jamais capturé.
            const cleaned = decls
                .replace(/(^|;)\s*(?:max-)?height\s*:[^;}]*/gi, '$1')
                .replace(/;{2,}/g, ';')
                .replace(/^\s*;+/, '');
            return open + cleaned + close;
        });
    }
    return out;
}

/**
 * Garde-fou responsive des blocs deux colonnes, carrousel et onglets admission.
 *
 * Le Style Manager écrit `#<id>{height:195px; width:900px}` quand on règle un
 * bloc en vue desktop. En tablette/mobile les colonnes s'empilent : le contenu
 * dépasse alors la hauteur figée et passe SOUS le bloc suivant (texte « école
 * classée… » recouvert par « Comment intégrer… », recette BRASSART 10/2026),
 * ou la largeur figée déborde de l'écran. Les règles `#id` battent le CSS des
 * blocs, d'où les `!important`, limités à ≤ 1024px et à ces seuls blocs.
 *
 * Toutes largeurs : une carte de carrousel à largeur figée est centrée dans
 * son emplacement au lieu d'être collée à gauche.
 *
 * Miroir : RESPONSIVE_GUARD_CSS dans js/app.js (canvas + export côté éditeur).
 */
const RESPONSIVE_GUARD_CSS = [
    // Onglets mobiles des Onglets Admission : générés à l'exécution (LP) ou à la
    // conversion SFMC, ils n'existent pas à l'enregistrement → GrapesJS retire
    // leurs règles de l'export. Style de base ici, en :where() (spécificité
    // nulle) pour que le CSS propre à la page garde toujours la main.
    ':where(.mta-mob-tab){display:none}',
    '@media (max-width:768px){:where(.mta-mob-tab){display:block;padding:16px 20px;cursor:pointer;background:#bd2bf3;border-bottom:1px solid #000}:where(.mta-mob-tab[data-tab="2"]){background:#8a3ffc}:where(.mta-mob-tab) :where(.mta-tab-hd-sub){display:block;font-size:11px;margin-bottom:3px;color:rgba(255,255,255,.9)}:where(.mta-mob-tab) :where(.mta-tab-hd-title){display:block;font-size:14px;font-weight:700;color:#fff}:where(.mta-mob-tab.mta-active){background:var(--brand-background,#fff);border-bottom-color:#e0e0e0}:where(.mta-mob-tab.mta-active) :where(.mta-tab-hd-sub),:where(.mta-mob-tab.mta-active) :where(.mta-tab-hd-title){color:var(--brand-text,#1a1a1a)}}',
    '.carrous-card{min-width:0}.carrous-card>.card-inner{max-width:100%;margin-left:auto;margin-right:auto}',
    // Étapes des onglets admission : un texte élargi / figé au Style Manager
    // (#id{width:494px;height:45px}) déformait toute la grille (colonnes
    // inégales, texte écrasé ou rogné). Tailles figées de la grille, des étapes
    // et des textes neutralisées ; hauteur selon le contenu. Hors mobile :
    // 3 colonnes ÉGALES comme le bloc d'origine (une 2e grille de 2 étapes reste
    // alignée sous la 1re — ESEC), 4 colonnes dès 4 étapes (EFAP international),
    // 1 seule colonne si la grille n'a qu'une étape (ICART EN, refaite à la main).
    // !important sur la grille : dans le canvas de l'éditeur, le CSS de la page
    // est chargé APRÈS ce garde-fou (hors mobile seulement, sa règle 1fr reste).
    '.integration .etapes-grille,.integration .etape{width:auto!important;height:auto!important;max-width:100%}',
    '.integration .etape>div:not(.etape-icone){min-width:0;flex:1 1 0}.integration .etape-texte{max-width:100%;height:auto!important}',
    '@media (min-width:769px){.integration .etapes-grille{grid-template-columns:repeat(3,minmax(0,1fr))!important}.integration .etapes-grille:has(>.etape:nth-child(4)){grid-template-columns:repeat(4,minmax(0,1fr))!important}.integration .etapes-grille:not(:has(>.etape:nth-child(2))){grid-template-columns:minmax(0,1fr)!important}}',
    '@media (max-width:1024px){',
    '.two-col-section,.two-col-section .col-container,.two-col-section .col-text,.two-col-section .col-image{height:auto!important;max-height:none!important}',
    '.two-col-section .col-container,.two-col-section .col-text,.two-col-section .col-image{width:auto!important;max-width:100%!important;min-width:0!important}',
    '.two-col-section img,.two-col-section .col-text *{max-width:100%!important}',
    '.carrous-card{height:auto!important}',
    '.carrous-card>.card-inner{width:auto!important;height:100%!important}',
    '.carrous-card>.card-inner>:not(img){width:auto!important;max-width:100%!important;height:auto!important}',
    '.mta-section,.mta-wrapper,.integration,.integration .onglets{height:auto!important;max-height:none!important;max-width:100%!important}',
    '.mta-wrapper>.mta-headers,.mta-tab-hd{width:auto!important;height:auto!important;max-width:100%!important}',
    '}'
].join('');

// `=""` : forme laissée par le nettoyeur SFMC (cheerio) — sans elle, un HTML
// déjà nettoyé gardait l'ancien garde-fou EN PLUS du nouveau.
const RESPONSIVE_GUARD_RE = /<style data-lp-responsive-guard(?:="")?>[\s\S]*?<\/style>/gi;
const RESPONSIVE_GUARD_CLASSES = /two-col-section|carrous-card|mta-section|class="[^"]*\bintegration\b/i;

/**
 * Pose (ou remet à jour) le garde-fou juste avant </head>, APRÈS le CSS de la
 * page. Idempotent : l'ancienne version est retirée avant insertion, donc une
 * évolution des règles s'applique aussi aux pages déjà en base. Sans <head>
 * (fragment) ou sans bloc concerné, le HTML est renvoyé inchangé.
 */
function addResponsiveGuard(html) {
    const source = String(html || '').replace(RESPONSIVE_GUARD_RE, '');
    if (!RESPONSIVE_GUARD_CLASSES.test(source) || !/<\/head>/i.test(source)) return source;
    return source.replace(/<\/head>/i, `<style data-lp-responsive-guard>${RESPONSIVE_GUARD_CSS}</style></head>`);
}

// ── Ancres de formulaires ────────────────────────────────────────────
// Chaque <form> d'une page doit porter un id stable pour permettre les
// liens directs `page#form_id` (affichés dans le dashboard CMS).
// Dérivation déterministe : id existant > NomFormulaire caché > classe connue > position.
const FORM_CLASS_ID_MAP = {
    'brf-form':     'form-brochure',
    'jpo-form':     'form-evenement',
    'imf-form':     'form-immersion',
    'cnd-form':     'form-candidature',
    'pc-form':      'form-precandidature',
    'wbc-form':     'form-webconference',
    'sfmc-form':    'form-sfmc',
    'sf-core-form': 'form-salesforce'
};

function deriveFormId(formTag, formInner, index) {
    const nomFormulaire = formInner.match(/name=["']NomFormulaire["'][^>]*value=["']([^"']+)["']/i)
        || formInner.match(/value=["']([^"']+)["'][^>]*name=["']NomFormulaire["']/i);
    if (nomFormulaire && nomFormulaire[1]) {
        const slug = slugify(nomFormulaire[1]);
        if (slug) return slug.startsWith('form') ? slug : `form-${slug}`;
    }
    const classMatch = formTag.match(/class=["']([^"']*)["']/i);
    if (classMatch) {
        for (const cls of classMatch[1].split(/\s+/)) {
            if (FORM_CLASS_ID_MAP[cls]) return FORM_CLASS_ID_MAP[cls];
        }
    }
    return `form-${index + 1}`;
}

/**
 * Garantit un attribut id sur chaque <form> du HTML (document complet ou body).
 * Retourne { html, formIds } — même dérivation partout (save, preview, public),
 * donc les ancres restent stables pour une page donnée.
 */
function ensureFormAnchors(html) {
    const source = String(html || '');
    const formIds = [];
    if (!/<form[\s>]/i.test(source)) return { html: source, formIds };

    const used = new Set();
    const result = source.replace(/(<form\b[^>]*>)([\s\S]*?<\/form>)/gi, (match, formTag, rest, offset, full) => {
        const existingId = formTag.match(/\sid=["']([^"']+)["']/i);
        let id;
        if (existingId && existingId[1].trim()) {
            id = existingId[1].trim();
        } else {
            id = deriveFormId(formTag, rest, formIds.length);
        }
        // Dédoublonner si plusieurs formulaires identiques sur la page
        let unique = id, n = 2;
        while (used.has(unique)) unique = `${id}-${n++}`;
        used.add(unique);
        formIds.push(unique);

        if (existingId) {
            if (existingId[1].trim() === unique) return match;
            return formTag.replace(existingId[0], ` id="${unique}"`) + rest;
        }
        return formTag.replace(/^<form\b/i, `<form id="${unique}"`) + rest;
    });

    return { html: result, formIds };
}

/** Liste les ids de formulaires d'un HTML sans le modifier. */
function extractFormIds(html) {
    return ensureFormAnchors(html).formIds;
}

function buildProjectNameFromSource(sourceProjectName, newTitle, newLanguage) {
    if (!sourceProjectName || !newTitle) return newTitle;
    if (/^school-[a-z0-9-]+__.+__[A-Z]{2}$/i.test(newTitle)) return newTitle;

    const schoolMatch = sourceProjectName.match(/^(school-[a-z0-9-]+)__/i);
    const schoolPrefix = schoolMatch ? schoolMatch[1] : 'school-unknown';
    const langMatch = sourceProjectName.match(/__([A-Z]{2})$/i);
    const lang = (newLanguage || (langMatch ? langMatch[1] : 'FR')).toUpperCase();
    return `${schoolPrefix}__${newTitle}__${lang}`;
}

function getQueryParam(req, name) {
    return req.query?.[name] || new URLSearchParams((req.url || '').split('?')[1] || '').get(name);
}

function requireField(body, field) {
    if (!body || body[field] === undefined || body[field] === null || body[field] === '') {
        const err = new Error(`${field} is required`);
        err.status = 400;
        throw err;
    }
    return body[field];
}

function slugify(value = '') {
    return String(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Finitions d'une page enregistrée ou servie : garde-fou responsive des blocs
 * (addResponsiveGuard) + liens du footer restés en « # » complétés avec ceux
 * de l'école (lib/footer-liens.js). Idempotent.
 */
function finaliserPage(html) {
    return ajouterCssConsentement(ajouterCssLogosEn(completerLiensFooter(addResponsiveGuard(html))));
}

module.exports = {
    supabaseRequest,
    escapeHtml,
    buildStoredHtml,
    relaxFaqSectionHeights,
    addResponsiveGuard,
    finaliserPage,
    buildProjectNameFromSource,
    getQueryParam,
    requireField,
    slugify,
    ensureFormAnchors,
    extractFormIds,
    extractBodyContent
};
