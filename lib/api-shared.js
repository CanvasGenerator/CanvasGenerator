const { supabaseRequest } = require('./supabase');

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
    const match = String(fullHtml || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
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

function buildStoredHtml({ projectName, html = '', css = '', properties = {} }) {
    // If it's already a full document, extract the body so we can rebuild the head with fresh SEO
    let bodyContent = isFullHtmlDocument(html) ? extractBodyContent(html) : html;
    // Anti-doublon : retirer un éventuel code déjà injecté précédemment
    bodyContent = stripCustomCode(bodyContent, 'body');

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

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${headCode}<title>${escapeHtml(title)}</title>${seoTags}<style>${css}</style></head><body>${bodyContent}${bodyCode}</body></html>`;
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

module.exports = {
    supabaseRequest,
    escapeHtml,
    buildStoredHtml,
    buildProjectNameFromSource,
    getQueryParam,
    requireField,
    slugify,
    ensureFormAnchors,
    extractFormIds,
    extractBodyContent
};
