require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const { syncProjectToSfmc, unpublishProjectFromSfmc, isSfmcConfigured, createDataExtension, createFormAsset, uploadImageFromDataUrl, replaceInlineImagesWithSfmcUrls, listCampuses, upsertCampus, deleteCampus, customerKeyFor, assetNameFor, findAssetIdByCustomerKey, sfmcFetch } = require('./lib/sfmc');
const { enqueueOrProcessInline } = require('./lib/sfmc-sync');
const {
    handleContentRoute,
    syncLegacyProjectToContent,
    listMigratedDashboardPages,
    getCurrentVersionForLegacyProject,
    getStructuredProjectForLegacyProject,
    getBilingualHtmlForProject,
    updatePageLifecycle,
    isMissingContentSchemaError,
    getPublicationSettings,
    resolvePublicPageByHostPath
} = require('./api/content');
const { handleSchoolsRoute } = require('./api/schools');
const cronHandler = require('./api/cron');
const { listBlocks, getDefaultBlockIds } = require('./blocks/registry');
const { cleanHtmlForSfmc } = require('./lib/htmlCleaner');
const { getSchoolLogo } = require('./lib/school-logos');
const { normalizeBranding, fontStackById } = require('./js/fonts');
const { translateHtml } = require('./lib/translate');
const { renderSchoolHeaderHtml, renderSchoolFooterHtml } = require('./lib/school-blocks');
const { ensureFormAnchors, extractFormIds, slugify } = require('./lib/api-shared');

const port = process.env.PORT || 8000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY manquantes dans .env');
    process.exit(1);
}

// ── Load schools config ─────────────────────────────────────────────
const schoolsPath = path.join(__dirname, 'schools.json');
let SCHOOLS = [];
try {
    SCHOOLS = JSON.parse(fs.readFileSync(schoolsPath, 'utf-8'));
    console.log(`📚 ${SCHOOLS.length} écoles chargées depuis schools.json`);
} catch (e) {
    console.error('❌ Impossible de lire schools.json:', e.message);
    process.exit(1);
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

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

// Sélecteurs dont le background doit prendre --brand-header lors d'une déclinaison
// NOTE: Les footers (footer-efap, footer-brassart, mf-footer, df-*) sont
// INTENTIONNELLEMENT absents : le footer doit rester TOUJOURS fond blanc/noir,
// quelle que soit l'école ou la template déclinée.
const BRAND_HEADER_SELECTORS = [
    'header-efap', 'header-brassart', 'mh-header'
];
const BRAND_CAROUSEL_SELECTORS = [
    'mc2a-section', 'mc2b-section', 'mc2c-section',
    'mcva-section', 'mcd-colored-zone', 'mc3c-section', 'mce-section', 'mcb-gray-zone'
];

/**
/**
 * Rend les URLs d'assets ABSOLUES depuis la racine ("/assets/…").
 * Le HTML stocké peut contenir des chemins RELATIFS ("assets/…") qui cassent dès que
 * la page n'est plus servie à la racine (ex. "/preview/<nom>" → "/preview/assets/…"
 * → 404 → logos header/footer invisibles). Appliqué à la volée au service pour
 * réparer aussi les pages déjà sauvegardées. Idempotent, sans effet sur http(s).
 */
function rewriteAssetsToRoot(html) {
    return String(html || '')
        .replace(/((?:src|srcset|href)\s*=\s*["'])\.?\/?assets\//gi, '$1/assets/')
        .replace(/url\((\s*['"]?)\.?\/?assets\//gi, 'url($1/assets/');
}

// Feuille Google Fonts des familles additionnelles proposées dans l'éditeur.
const GOOGLE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Lato:wght@400;700;900&family=Montserrat:wght@400;600;800&family=Open+Sans:wght@400;600;800&family=Oswald:wght@400;700&family=Poppins:wght@400;600;800&family=Raleway:wght@400;700&family=Roboto:wght@400;700;900&display=swap';

/**
 * Garantit le chargement des polices (Gotham/Space Grotesk via /css/fonts.css +
 * Google Fonts) dans le HTML servi. Injecte les <link> avant </head> UNIQUEMENT
 * si absents → répare les pages sauvegardées avant l'ajout des polices, sans
 * doublonner celles qui les contiennent déjà.
 */
function ensureFontLinks(html) {
    const s = String(html || '');
    if (/css\/fonts\.css/i.test(s)) return s;
    const links = `<link href="${GOOGLE_FONTS_HREF}" rel="stylesheet"><link rel="stylesheet" href="/css/fonts.css">`;
    return /<\/head>/i.test(s) ? s.replace(/<\/head>/i, links + '</head>') : links + s;
}

/**
 * Aperçu dashboard en PLEINE LARGEUR (comme un vrai navigateur) + plafonne les
 * logos de header en mobile. Les espacements entre blocs (px) et le texte restent
 * intacts. ⚠️ Route /preview/ UNIQUEMENT (jamais les pages publiques). Idempotent.
 */
function injectPreviewViewport(html) {
    const s = String(html || '');
    if (/id="preview-viewport"/.test(s)) return s;
    // Pleine largeur + format code pays / logos mobile. Logos cappés en MOBILE uniquement.
    const style = `<style id="preview-viewport">`
        + `html{background:#e9e9ec;}`
        + `body{width:100%;margin-left:auto;margin-right:auto;background:#ffffff;}`
        + `[class*="-phone-prefix-wrap"]{width:92px!important;flex-shrink:0!important;}`
        + `.jpo-flag{display:none!important;}`
        + `@media(max-width:768px){.mh-logo img,.mh-logo svg,.hdr-logo-img,.dh-logo-img,.ft-logo-img,#logo img,#logo svg{max-height:40px!important;height:auto!important;width:auto!important;}`
        + `[class*="header-efap"] .hdr-logo-img,[class*="dh-efap"] .dh-logo-img,[class*="footer-efap"] .ft-logo-img,[class*="header-brassart"] .hdr-logo-img,[class*="dh-brassart"] .dh-logo-img,[class*="footer-brassart"] .ft-logo-img,[class*="header-ifa"] .hdr-logo-img,[class*="dh-ifa"] .dh-logo-img,[class*="footer-ifa"] .ft-logo-img{max-height:30px!important;}}`
        + `</style>`;
    return /<\/head>/i.test(s) ? s.replace(/<\/head>/i, style + '</head>') : style + s;
}

/**
 * Corrige l'ancrage interne (#id) sur les pages qui portent un `<base href="/">`.
 *
 * Le `<base href="/">` (injecté pour réparer les chemins d'assets relatifs) casse
 * les liens d'ancre : le navigateur résout `href="#footer"` par rapport à la base
 * → il NAVIGUE vers `/#footer` (racine) au lieu de défiler vers le bloc de la page.
 *
 * On réinjecte un mini-script (idempotent) qui intercepte les clics sur les liens
 * dont le href BRUT commence par `#` et fait un scrollIntoView vers l'élément
 * (par id, sinon par name). Neutralise l'effet du <base> SANS toucher aux assets
 * ni au HTML des blocs. Sans effet si aucune ancre n'existe (comportement natif).
 */
function injectAnchorScrollFix(html) {
    const s = String(html || '');
    if (/id="anchor-scroll-fix"/.test(s)) return s;
    const script = `<script id="anchor-scroll-fix">`
        + `(function(){function h(e){try{var a=e.target&&e.target.closest&&e.target.closest('a');`
        + `if(!a)return;var href=a.getAttribute('href')||'';`
        + `var i=href.indexOf('#');if(i<0)return;`
        // On n'intercepte que les ancres de la PAGE COURANTE : href="#id" (i===0)
        // ou href="<chemin-courant>#id" (ancres réécrites par anchorLinksToPagePath).
        + `var path=href.slice(0,i);if(path&&path!==location.pathname)return;`
        // On neutralise le <base href="/"> : sans ça une ancre orpheline (#id sans
        // cible) ou un href="#" placeholder ferait filer à la racine (localhost/#id).
        // On reste sur la page, comme l'aperçu de l'éditeur (canvas iframe sans <base>).
        + `e.preventDefault();`
        + `var id=decodeURIComponent(href.slice(i+1));`
        + `if(!id){window.scrollTo({top:0,behavior:'smooth'});return;}`
        + `var t=document.getElementById(id)||document.getElementsByName(id)[0];`
        + `if(!t)return;`
        + `t.scrollIntoView({behavior:'smooth',block:'start'});`
        + `if(window.history&&history.replaceState){history.replaceState(null,'','#'+id);}`
        + `}catch(_){}}document.addEventListener('click',h,true);})();`
        + `</script>`;
    return /<\/body>/i.test(s) ? s.replace(/<\/body>/i, script + '</body>') : s + script;
}

/**
 * Préfixe les liens d'ancre (`href="#id"`) par le chemin de la page courante.
 *
 * Avec un `<base href="/">`, le navigateur résout `href="#id"` par rapport à la
 * base → l'URL affichée (survol) et la navigation pointent vers `localhost/#id`
 * (racine) au lieu de la page. En réécrivant en `href="<pagePath>#id"` l'ancre
 * reste sur la page courante (ex. /preview/<nom-projet>#id), comme l'éditeur.
 *
 * Ne touche PAS aux `href="#"` nus (placeholder, gérés par injectAnchorScrollFix),
 * ni aux liens absolus (http, /, //). Idempotent : n'ajoute pas deux fois le chemin.
 */
function anchorLinksToPagePath(html, pagePath) {
    if (!pagePath) return String(html || '');
    const base = pagePath.replace(/#.*$/, '');
    return String(html || '').replace(
        /(\shref\s*=\s*(["']))#([^"'\s][^"']*)\2/gi,
        (m, _pre, q, frag) => ` href=${q}${base}#${frag}${q}`
    );
}

/**
 * Patche une chaîne CSS :
 *  - Met à jour les fallbacks var(--brand-*, OLD) avec les nouvelles couleurs
 *  - Remplace les background-color hardcodés dans les blocs header/footer
 */
function patchCssString(css, { colorHeader, primary, secondary, colorCarousel }) {
    if (!css) return css;
    // 1. Mettre à jour les fallbacks var()
    css = css.replace(/var\(--brand-header,\s*[^)]+\)/g, `var(--brand-header, ${colorHeader})`);
    css = css.replace(/var\(--brand-primary,\s*[^)]+\)/g, `var(--brand-primary, ${primary})`);
    css = css.replace(/var\(--brand-secondary,\s*[^)]+\)/g, `var(--brand-secondary, ${secondary})`);
    css = css.replace(/var\(--brand-carousel,\s*[^)]+\)/g, `var(--brand-carousel, ${colorCarousel})`);
    // 2. Pour chaque sélecteur header/footer, remplacer les background hardcodés
    for (const cls of BRAND_HEADER_SELECTORS) {
        css = css.replace(
            new RegExp(`(\\.${cls}\\s*\\{[^}]*?)(background(?:-color)?\\s*:\\s*)([^;!}]+)`, 'gs'),
            (match, prefix, prop, val) => {
                if (val.trim().startsWith('var(')) return match;
                return `${prefix}${prop}var(--brand-header, ${colorHeader})`;
            }
        );
    }
    // 3. Pour chaque sélecteur carousel, remplacer les background hardcodés
    for (const cls of BRAND_CAROUSEL_SELECTORS) {
        css = css.replace(
            new RegExp(`(\\.${cls}\\s*\\{[^}]*?)(background(?:-color)?\\s*:\\s*)([^;!}]+)`, 'gs'),
            (match, prefix, prop, val) => {
                if (val.trim().startsWith('var(')) return match;
                return `${prefix}${prop}var(--brand-carousel, ${colorCarousel})`;
            }
        );
    }
    return css;
}

/**
 * Construit un bloc <style> contenant toutes les CSS vars de l'école
 * (--brand-primary, --brand-header, --brand-carousel, rôles de couleurs…).
 * Miroir côté serveur de injectBrandVariables() dans js/app.js.
 * Utilisé par la route /preview/ pour que les blocs affichent les bonnes
 * couleurs de l'école au lieu des fallbacks hardcodés.
 */
function buildBrandCssVarsForPreview(school) {
    if (!school) return '';
    const primary       = school.color || '#3b82f6';
    const secondary     = school.secondaryColor || school.secondary_color || '#1a1a1a';
    const colorHeader   = school.colorHeader   || school.color_header   || primary;
    const colorCarousel = school.colorCarousel || school.color_carousel || primary;
    const headerText    = school.headerTextColor || school.header_text_color || '#ffffff';
    const rgb           = hexToRgb(primary);

    // Calcul de bandeColor (identique à app.js)
    let bandeColor = primary;
    if (school.id === 'brassart') bandeColor = '#bc0b5d';
    if (school.id === 'efap')     bandeColor = '#1a1a1a';
    if (school.id === 'cread')    bandeColor = '#d4af37';

    const branding = normalizeBranding(school.branding, school);
    const c        = branding.colors || {};
    const schoolFont = fontStackById(branding.defaultFont) || "'Gotham', Arial, sans-serif";

    const colorsVarsArray = Object.entries(c).map(([key, val]) =>
        `--brand-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${val};`
    );

    const css = `
:root {
  --brand-primary:     ${c.primary     || primary};
  --brand-secondary:   ${c.secondary   || secondary};
  --brand-primary-rgb: ${rgb};
  --brand-header:      ${colorHeader};
  --brand-header-text: ${headerText};
  --brand-carousel:    ${colorCarousel};
  --bande-color:       ${bandeColor};
  --brand-font:        ${schoolFont};
  --brand-background:  ${c.background  || '#ffffff'};
  --brand-surface:     ${c.surface     || '#f5f5f5'};
  --brand-text:        ${c.text        || '#1a1a1a'};
  --brand-muted:       ${c.mutedText   || '#6b7280'};
  --brand-border:      ${c.border      || '#e5e7eb'};
  --brand-accent:      ${c.accent      || secondary};
  --brand-button-bg:   ${c.buttonBackground || primary};
  --brand-button-hover:${c.buttonHover || primary};
  --brand-button-text: ${c.buttonText  || '#ffffff'};
  --brand-link:        ${c.link        || primary};
  --brand-link-hover:  ${c.linkHover   || primary};
  --brand-success:     ${c.success     || '#16a34a'};
  --brand-warning:     ${c.warning     || '#f59e0b'};
  --brand-error:       ${c.error       || '#dc2626'};
  ${colorsVarsArray.join('\n  ')}
}
/* PREVIEW – override couleur hardcodée du SEUL header générique master
   (aligné sur injectBrandVariables() de l'éditeur, qui ne force que .mh-header).
   .header-efap / .header-brassart ne sont PAS forcés : ces headers de marque
   conservent la couleur réglée par défaut, exactement comme dans l'aperçu éditeur. */
.mh-header {
  background-color: ${colorHeader} !important;
  background:       ${colorHeader} !important;
}
.mc2a-section,.mc2b-section,.mc2c-section,.mcva-section,
.mcd-colored-zone,.mc3c-section,.mce-section,.mcb-gray-zone {
  background-color: ${colorCarousel} !important;
  background:       ${colorCarousel} !important;
}
`;
    return `<style id="brand-variables-preview">${css}</style>`;
}

/**
 * Parcourt récursivement l'arbre de composants GrapesJS et patche
 * le contenu des balises <style> inline.
 */
function patchComponentTree(components, colorVars) {
    if (!Array.isArray(components)) return components;
    return components.map(comp => {
        const c = { ...comp };
        // Balise <style> : le CSS est dans comp.content ou dans le premier enfant textnode
        if (comp.tagName === 'style') {
            if (typeof comp.content === 'string' && comp.content.trim()) {
                c.content = patchCssString(comp.content, colorVars);
            } else if (Array.isArray(comp.components) && comp.components.length > 0) {
                const children = [...comp.components];
                if (typeof children[0].content === 'string') {
                    children[0] = { ...children[0], content: patchCssString(children[0].content, colorVars) };
                }
                c.components = children;
            }
        }
        // Récursion sur les enfants
        if (Array.isArray(comp.components)) {
            c.components = patchComponentTree(comp.components, colorVars);
        }
        return c;
    });
}

function extractBodyContent(fullHtml) {
    const match = String(fullHtml || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : fullHtml;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0,0,0';
}

function stripCustomCode(str = '', zone) {
    const re = new RegExp(`<!-- custom-${zone}:start -->[\\s\\S]*?<!-- custom-${zone}:end -->`, 'g');
    return String(str || '').replace(re, '');
}
function wrapCustomCode(code, zone) {
    const c = String(code || '').trim();
    return c ? `<!-- custom-${zone}:start -->${c}<!-- custom-${zone}:end -->` : '';
}

function buildCampusRuntimeTag(properties = {}, school = '') {
    const ids = Array.isArray(properties.campusIds) ? properties.campusIds : [];
    const apiBase = process.env.PUBLIC_APP_URL || process.env.VERCEL_URL
        ? (process.env.PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`)
        : '';
    return `<script>window.__LP_CAMPUS_IDS=${JSON.stringify(ids)};window.__LP_API_BASE=${JSON.stringify(apiBase)};window.__LP_SCHOOL=${JSON.stringify(school || '')};</script>`;
}

function buildStoredHtml({ projectName, html = '', css = '', properties = {} }) {
    const title = properties?.seoTitle || properties?.title || projectName || '';
    const desc = properties?.seoDescription || '';
    const keywords = properties?.keywords || '';
    const canonical = properties?.canonical || '';
    const schemaLd = properties?.schemaLd || '';
    // École déduite du nom de projet (`school-<id>__…`) → runtime campus scopé.
    const schoolMatch = /^school-([a-z0-9-]+)__/i.exec(projectName || '');
    const pageSchool = schoolMatch ? schoolMatch[1].toLowerCase() : '';
    const campusTag = buildCampusRuntimeTag(properties, pageSchool);
    const headCode = wrapCustomCode(properties.customHeadCode, 'head');
    const bodyCode = wrapCustomCode(properties.customBodyCode, 'body');
    // anti-doublon : retirer un éventuel code déjà injecté
    html = stripCustomCode(stripCustomCode(html, 'head'), 'body');

    if (isFullHtmlDocument(html)) {
        // Parse with Cheerio to update the head without losing the body
        const $ = cheerio.load(html);
        
        $('title').text(title);
        
        if ($('meta[name="description"]').length) {
            $('meta[name="description"]').attr('content', desc);
        } else {
            $('head').append(`\n    <meta name="description" content="${escapeHtml(desc)}">`);
        }
        
        if ($('meta[name="keywords"]').length) {
            $('meta[name="keywords"]').attr('content', keywords);
        } else {
            $('head').append(`\n    <meta name="keywords" content="${escapeHtml(keywords)}">`);
        }
        
        $('link[rel="canonical"]').remove();
        if (canonical) {
            $('head').append(`\n    <link rel="canonical" href="${escapeHtml(canonical)}">`);
        }
        
        $('script[type="application/ld+json"]').remove();
        if (schemaLd) {
            $('head').append(`\n    <script type="application/ld+json">${schemaLd}</script>`);
        }

        // Config campus (sélection de la page) pour le runtime des composants
        $('script[data-lp-campus-config]').remove();
        $('head').append(`\n    ${campusTag.replace('<script>', '<script data-lp-campus-config>')}`);

        // Code marketing personnalisé (GTM, Analytics…)
        if (headCode) $('head').append(`\n    ${headCode}`);
        if (bodyCode) $('body').append(`\n    ${bodyCode}`);

        return $.html();
    }

    const seoTags = properties ? `
    <meta name="description" content="${escapeHtml(desc)}">
    <meta name="keywords" content="${escapeHtml(keywords)}">
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
    ${schemaLd ? `<script type="application/ld+json">${schemaLd}</script>` : ''}
` : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${headCode}
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    ${seoTags}
    ${campusTag}
    <style>${css}</style>
</head>
<body>${html}${bodyCode}</body>
</html>`;
}

async function applyCustomMarketingCode(projectName, properties) {
    try {
        const m = /^school-([a-z0-9-]+)__/i.exec(projectName || '');
        const schoolId = m ? m[1].toLowerCase() : null;
        let ecoleHead = '', ecoleBody = '';
        if (schoolId && schoolId !== 'master') {
            const schools = await readSchoolsForApi();
            const school = (schools || []).find(s => s.id === schoolId);
            if (school) {
                ecoleHead = school.customHeadCode || school.custom_head_code || '';
                ecoleBody = school.customBodyCode || school.custom_body_code || '';
            }
        }
        properties.customHeadCode = [ecoleHead, properties.pageHeadCode || ''].filter(Boolean).join('\n');
        properties.customBodyCode = [ecoleBody, properties.pageBodyCode || ''].filter(Boolean).join('\n');
    } catch (e) {
        console.warn('⚠️  applyCustomMarketingCode:', e.message);
    }
    return properties;
}

function normalizeSchool(school = {}) {
    return {
        id: school.id,
        name: school.name || '',
        fullName: school.fullName || school.full_name || school.name || '',
        description: school.description || '',
        contact: school.contact || '',
        baseUrl: school.baseUrl || school.base_url || '',
        color: school.color || '#3b82f6',
        secondaryColor: school.secondaryColor || school.secondary_color || '#1a1a1a',
        colorLight: school.colorLight || school.color_light || '',
        colorHeader: school.colorHeader || school.color_header || '',
        colorCarousel: school.colorCarousel || school.color_carousel || '',
        headerTextColor: school.headerTextColor || school.header_text_color || '#ffffff',
        logo: school.logo || '',
        emoji: school.emoji || '🏫',
        deleted: Boolean(school.deleted),
        defaultBlocks: Array.isArray(school.defaultBlocks)
            ? school.defaultBlocks
            : Array.isArray(school.default_blocks)
                ? school.default_blocks
                : [],
        customHeadCode: school.customHeadCode || school.custom_head_code || '',
        customBodyCode: school.customBodyCode || school.custom_body_code || '',
        // Branding : font par défaut + fonts disponibles + palette 16 rôles.
        branding: normalizeBranding(school.branding, school)
    };
}

function schoolPayload(input = {}) {
    const school = normalizeSchool(input);
    if (!school.id || !/^[a-z0-9-]+$/.test(school.id)) {
        const err = new Error('School id must contain only lowercase letters, numbers and dashes');
        err.status = 400;
        throw err;
    }
    if (!school.name.trim()) {
        const err = new Error('School name is required');
        err.status = 400;
        throw err;
    }
    return { ...school, deleted: false };
}

function schoolDbPayload(school) {
    return {
        id: school.id,
        name: school.name,
        full_name: school.fullName,
        description: school.description,
        contact: school.contact,
        base_url: school.baseUrl,
        color: school.color,
        secondary_color: school.secondaryColor,
        color_header: school.colorHeader,
        color_carousel: school.colorCarousel,
        header_text_color: school.headerTextColor || '#ffffff',
        logo: school.logo || '',
        color_light: school.colorLight,
        emoji: school.emoji,
        default_blocks: school.defaultBlocks,
        custom_head_code: school.customHeadCode || '',
        custom_body_code: school.customBodyCode || '',
        branding: school.branding || null,
        deleted: school.deleted
    };
}

async function readSchoolsForApi() {
    const baseSchools = SCHOOLS.map(normalizeSchool);
    try {
        const dbSchools = await supabaseRequest('GET', '/Schools?select=*&order=name.asc');
        if (Array.isArray(dbSchools)) {
            const merged = new Map(baseSchools.map(s => [s.id, s]));
            const baseIds = new Set(baseSchools.map(s => s.id));
            dbSchools.forEach(dbRaw => {
                const id = dbRaw.id;
                if (!id) return;
                // Le flag `deleted` ne retire que les écoles PERSONNALISÉES (créées
                // en DB). Les 10 écoles de base de schools.json sont toujours
                // présentes par défaut dans le gestionnaire, même si un ancien
                // test les a marquées supprimées en base.
                if (dbRaw.deleted) { if (!baseIds.has(id)) merged.delete(id); return; }
                // Construire un objet avec seulement les valeurs DB non-nulles/non-vides
                // pour ne pas écraser les données de schools.json avec des valeurs par défaut
                const dbOverrides = {};
                if (dbRaw.name)             dbOverrides.name           = dbRaw.name;
                if (dbRaw.full_name)        dbOverrides.fullName       = dbRaw.full_name;
                if (dbRaw.description)      dbOverrides.description    = dbRaw.description;
                if (dbRaw.contact)          dbOverrides.contact        = dbRaw.contact;
                if (dbRaw.base_url)         dbOverrides.baseUrl        = dbRaw.base_url;
                if (dbRaw.color)            dbOverrides.color          = dbRaw.color;
                if (dbRaw.secondary_color)  dbOverrides.secondaryColor = dbRaw.secondary_color;
                if (dbRaw.color_light)      dbOverrides.colorLight     = dbRaw.color_light;
                if (dbRaw.color_header)     dbOverrides.colorHeader    = dbRaw.color_header;
                if (dbRaw.color_carousel)   dbOverrides.colorCarousel  = dbRaw.color_carousel;
                if (dbRaw.header_text_color) dbOverrides.headerTextColor = dbRaw.header_text_color;
                if (dbRaw.logo)             dbOverrides.logo           = dbRaw.logo;
                if (dbRaw.emoji)            dbOverrides.emoji          = dbRaw.emoji;
                if (Array.isArray(dbRaw.default_blocks)) dbOverrides.defaultBlocks = dbRaw.default_blocks;
                if (dbRaw.custom_head_code != null) dbOverrides.customHeadCode = dbRaw.custom_head_code;
                if (dbRaw.custom_body_code != null) dbOverrides.customBodyCode = dbRaw.custom_body_code;
                if (dbRaw.show_faq != null)         dbOverrides.showFaq        = dbRaw.show_faq;
                dbOverrides.deleted = Boolean(dbRaw.deleted);
                const base = merged.get(id) || { id };
                // Branding : la valeur éditée en DB prime ; sinon on dérive des
                // couleurs de schools.json (couleurs = source de vérité).
                const colorContext = {
                    color:          base.color          || dbRaw.color,
                    secondaryColor: base.secondaryColor || dbRaw.secondary_color,
                };
                dbOverrides.branding = dbRaw.branding
                    ? normalizeBranding(dbRaw.branding, colorContext)
                    : normalizeBranding(base.branding, colorContext);
                merged.set(id, { ...base, ...dbOverrides });
            });
            return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
        }
    } catch (e) {
        console.warn('Schools DB read failed, falling back to schools.json:', e.message);
    }
    return baseSchools;
}

function renameProjectForSchool(projectName, fromSchoolId, toSchoolId) {
    return String(projectName || '').replace(
        new RegExp(`^school-${fromSchoolId}__`, 'i'),
        `school-${toSchoolId}__`
    );
}

function uniqueTransferredProjectName(baseName, existingNames) {
    if (!existingNames.has(baseName)) return baseName;

    const match = baseName.match(/^(school-[a-z0-9-]+__)(.*?)(__[A-Z]{2})$/i);
    const prefix = match ? match[1] : '';
    const title = match ? match[2] : baseName;
    const suffix = match ? match[3] : '';

    let index = 1;
    let candidate = `${prefix}${title}-transferred${suffix}`;
    while (existingNames.has(candidate)) {
        index += 1;
        candidate = `${prefix}${title}-transferred-${index}${suffix}`;
    }
    return candidate;
}

async function transferSchoolPages(fromSchoolId, toSchoolId) {
    const sourcePrefix = `school-${fromSchoolId}__`;
    const targetPrefix = `school-${toSchoolId}__`;
    const result = await supabaseRequest(
        'GET',
        `/Projects?project_name=like.${encodeURIComponent(sourcePrefix + '*')}&select=*`
    );
    const targetResult = await supabaseRequest(
        'GET',
        `/Projects?project_name=like.${encodeURIComponent(targetPrefix + '*')}&select=project_name`
    );
    const projects = Array.isArray(result) ? result : [];
    const existingNames = new Set((Array.isArray(targetResult) ? targetResult : []).map(p => p.project_name));

    for (const project of projects) {
        const baseName = renameProjectForSchool(project.project_name, fromSchoolId, toSchoolId);
        const newName = uniqueTransferredProjectName(baseName, existingNames);
        await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
            ...project,
            project_name: newName
        });
        existingNames.add(newName);
        await supabaseRequest('DELETE', `/Projects?project_name=eq.${encodeURIComponent(project.project_name)}`);
    }

    return projects.length;
}

async function supabaseRequest(method, endpoint, body = null, extraHeaders = {}) {
    const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
    console.log(`📡 Supabase ${method} → ${url}`);
    if (body) console.log(`📦 Body envoyé:`, JSON.stringify(body).substring(0, 200) + '...');

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : '',
            ...extraHeaders
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    console.log(`✅ Supabase réponse status: ${response.status}`);

    const text = await response.text();
    if (!text) {
        console.log(`✅ Supabase OK (réponse vide)`);
        return null;
    }

    const result = JSON.parse(text);
    console.log(`📬 Supabase réponse body:`, JSON.stringify(result).substring(0, 300));
    return result;
}

// ── Translation group ID ──────────────────────────────────────────────────
function generateGroupId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function resolveOrCreateGroupId(projectName) {
    // 1. Chercher si la page source a déjà un group_id en DB
    try {
        const existing = await supabaseRequest(
            'GET',
            `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=page_group_id&limit=1`
        );
        if (existing?.[0]?.page_group_id) return existing[0].page_group_id;
    } catch (e) {
        console.warn('resolveOrCreateGroupId fetch failed:', e.message);
    }
    // 2. Pas de group_id → en générer un et l'attribuer à la source
    const groupId = generateGroupId();
    try {
        await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
            page_group_id:        groupId,
            is_original_language: true
        });
        console.log(`🔑 group_id généré pour "${projectName}": ${groupId}`);
    } catch (e) {
        console.warn('resolveOrCreateGroupId patch failed:', e.message);
    }
    return groupId;
}

// ── Parse URL helper ─────────────────────────────────────────────────
function parseUrl(reqUrl) {
    const qIdx = reqUrl.indexOf('?');
    const pathname = qIdx >= 0 ? reqUrl.substring(0, qIdx) : reqUrl;
    const search = qIdx >= 0 ? reqUrl.substring(qIdx) : '';
    const params = new URLSearchParams(search);
    return { pathname, params };
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            if (!body) return resolve({});
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(e); }
        });
    });
}

function createApiResponse(res) {
    let statusCode = 200;
    return {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(payload));
        }
    };
}

http.createServer(async (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const { pathname, params } = parseUrl(req.url);

    if (pathname === '/api/schools' || pathname.startsWith('/api/schools/') || pathname.startsWith('/api/school/')) {
        try {
            req.body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
                ? await readJsonBody(req)
                : {};
            const handled = await handleSchoolsRoute(req, createApiResponse(res), pathname);
            if (handled) return;
        } catch (e) {
            res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: Cron job ─────────────────────────────────────────────
    if (pathname === '/api/cron') {
        try {
            req.body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
                ? await readJsonBody(req)
                : {};
            return await cronHandler(req, createApiResponse(res));
        } catch (e) {
            res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    if (
        pathname === '/api/organizations' ||
        pathname === '/api/entities' ||
        pathname === '/api/folders' ||
        pathname === '/api/activity' ||
        pathname === '/api/blocks' ||
        pathname.startsWith('/api/content/')
    ) {
        try {
            req.body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
                ? await readJsonBody(req)
                : {};
            if (req.method === 'GET' && pathname === '/api/blocks') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    blocks: listBlocks({ schoolId: params.get('schoolId') }),
                    defaultBlockIds: getDefaultBlockIds()
                }));
            }
            const handled = await handleContentRoute(req, createApiResponse(res), pathname);
            if (handled) return;
        } catch (e) {
            res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: List schools ────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/schools') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(await readSchoolsForApi()));
    }

    // ── API: Create school ───────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/schools') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const school = schoolPayload(JSON.parse(body || '{}'));
                const result = await supabaseRequest('POST', '/Schools?on_conflict=id', schoolDbPayload(school), {
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'School saved', school: Array.isArray(result) ? result[0] : result }));
            } catch (e) {
                res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: Get a single school config ──────────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/school/')) {
        const schoolId = decodeURIComponent(pathname.replace('/api/school/', ''));
        const schools = await readSchoolsForApi();
        const school = schools.find(s => s.id === schoolId);
        if (!school) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'School not found' }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(school));
    }

    // ── API: Update school ───────────────────────────────────────────
    if (req.method === 'PUT' && pathname.startsWith('/api/school/')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const schoolId = decodeURIComponent(pathname.replace('/api/school/', ''));
                const school = schoolPayload({ ...JSON.parse(body || '{}'), id: schoolId });
                const result = await supabaseRequest('POST', '/Schools?on_conflict=id', schoolDbPayload(school), {
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'School updated', school: Array.isArray(result) ? result[0] : result }));
            } catch (e) {
                res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: Delete school and transfer pages ────────────────────────
    if (req.method === 'DELETE' && pathname.startsWith('/api/school/')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const schoolId = decodeURIComponent(pathname.replace('/api/school/', ''));
                const { transferToSchoolId } = JSON.parse(body || '{}');
                if (!transferToSchoolId || transferToSchoolId === schoolId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'A different transferToSchoolId is required' }));
                }
                const schools = await readSchoolsForApi();
                if (!schools.some(s => s.id === transferToSchoolId)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Transfer target school not found' }));
                }
                const transferredPages = await transferSchoolPages(schoolId, transferToSchoolId);
                await supabaseRequest('POST', '/Schools?on_conflict=id', {
                    id: schoolId,
                    name: schoolId,
                    deleted: true
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'School deleted', transferredPages }));
            } catch (e) {
                res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: Save project ────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log('🔴 FULL BODY KEYS:', Object.keys(data));
                console.log('🔴 is_original_language:', data.is_original_language);
                console.log('🔴 page_group_id:', data.page_group_id);

                const { projectName, html: submittedHtml, css, projectData, properties, is_original_language, page_group_id, source_project_name, language } = data;

                console.log(`\n💾 Sauvegarde projet: "${projectName}"`);

                if (!projectName) {
                    res.writeHead(400);
                    return res.end('Project name is required');
                }

                // Ancrer les formulaires (id stable pour les liens #form_id)
                const { html, formIds } = ensureFormAnchors(submittedHtml);
                if (properties) {
                    properties.rawHtml = html;
                    properties.formIds = formIds;
                }

                // Code marketing personnalisé (école + page)
                if (properties) await applyCustomMarketingCode(projectName, properties);

                // Toute sauvegarde repasse la page en brouillon.
                if (properties) properties.status = 'draft';

                const fullHtml = buildStoredHtml({ projectName, html, css, properties });

                // ── Résoudre les flags de traduction + group_id ───────────────────────────
                let saveIsOriginal, savePageGroupId;

                // Chercher l'état actuel en DB (pour les saves successifs)
                const existingRow = await supabaseRequest(
                    'GET',
                    `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=is_original_language,page_group_id&limit=1`
                ).catch(() => null);
                const existingRecord = existingRow?.[0];

                if (is_original_language === false) {

                    saveIsOriginal = false;
                    if (existingRecord?.page_group_id) {
                        savePageGroupId = existingRecord.page_group_id;
                    } else if (source_project_name) {
                        savePageGroupId = await resolveOrCreateGroupId(source_project_name);
                    } else if (page_group_id) {
                        savePageGroupId = await resolveOrCreateGroupId(page_group_id);
                    } else {

                        savePageGroupId = null;
                    }
                } else {
                    // ── Page originale : conserver ou générer un group_id ─────────────────
                    saveIsOriginal = true;
                    if (existingRecord?.page_group_id) {
                        // Déjà un group_id → le conserver
                        savePageGroupId = existingRecord.page_group_id;
                    } else {
                        // Nouvelle page originale → générer un group_id unique
                        savePageGroupId = generateGroupId();
                        console.log(`🔑 Nouveau group_id pour "${projectName}": ${savePageGroupId}`);
                    }
                }

                // 1. Sauvegarde du HTML brut (sans html_sfmc pour l'instant)
                const supaResult = await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                    project_name:         projectName,
                    html:                 fullHtml,
                    css:                  css,
                    project_data:         typeof projectData === 'string' ? projectData : JSON.stringify(projectData || {}),
                    properties:           properties || {},
                    is_original_language: saveIsOriginal,
                    page_group_id:        savePageGroupId
                });

                if (supaResult && supaResult.code) {
                    console.log(`❌ Erreur Supabase:`, supaResult);
                    res.writeHead(500);
                    return res.end('Erreur Supabase: ' + JSON.stringify(supaResult));
                }

                console.log(`✅ Projet "${projectName}" sauvegardé avec succès dans Supabase (Legacy)!`);

                // Log into seo_history
                try {
                    const seoHistoryProps = { ...properties };
                    delete seoHistoryProps.rawHtml;
                    delete seoHistoryProps.page_group_id;
                    delete seoHistoryProps.is_original_language;

                    await supabaseRequest('POST', '/seo_history', {
                        project_name: projectName,
                        properties: seoHistoryProps,
                        saved_by: req.headers['x-user'] || null
                    });
                } catch (histErr) {
                    console.warn('⚠️  Impossible d\'enregistrer l\'historique SEO:', histErr.message || histErr);
                }

                const contentSync = await syncLegacyProjectToContent({
                    projectName,
                    language,
                    html: fullHtml,
                    css,
                    projectData,
                    properties
                });

                // 2. On libère l'utilisateur immédiatement (réponse 200)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    message: 'Project saved! Background tasks started.',
                    projectName,
                    page_id: contentSync?.pageId || null,
                    sfmc: { action: 'pending_background' },
                    content: contentSync
                }));

                // 3. Mise en file SFMC (comme Vercel) : le cron worker nettoie le HTML,
                // publie les images inline dans SFMC, remplace leurs URLs puis envoie la page.
                (async () => {
                    try {
                        const jobResult = await enqueueOrProcessInline({
                            projectName, fullHtml, css, projectData, properties,
                            source: 'server.js/save'
                        });
                        console.log(`☁️  [BACKGROUND] SFMC sync: ${jobResult.action}` + (jobResult.error ? ` (${jobResult.error})` : ''));
                    } catch (bgError) {
                        console.error(`❌ [BACKGROUND] Erreur lors de la mise en file SFMC:`, bgError);
                    }
                })();

            } catch (e) {
                console.log(`❌ Erreur catch:`, e.message);
                res.writeHead(500);
                res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Re-synchroniser SFMC après ajout/màj d'une variante de langue ──
    // Le HTML bilingue (toutes langues + switch) est reconstruit côté worker/inline.
    if (req.method === 'POST' && pathname === '/api/sfmc/resync') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { projectName } = JSON.parse(body || '{}');
                if (!projectName) { res.writeHead(400); return res.end('projectName required'); }
                const r = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=html,css&limit=1`).catch(() => null);
                const jobResult = await enqueueOrProcessInline({
                    projectName, fullHtml: r?.[0]?.html || '', css: r?.[0]?.css || '',
                    projectData: {}, properties: {}, source: 'variant-resync'
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, sfmc: jobResult }));
            } catch (e) {
                res.writeHead(500);
                res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Save SEO only (from dashboard settings button) ──────────
    if (req.method === 'POST' && pathname === '/api/save-seo') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { projectName, properties } = data;

                if (!projectName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'projectName required' }));
                }

                console.log(`\n🔧 [SEO-SETTINGS] Mise à jour SEO pour "${projectName}"`);

                // 1. Charger le projet existant : d'abord via content API structurée, puis legacy
                let project = await getStructuredProjectForLegacyProject(projectName).catch(e => {
                    if (!isMissingContentSchemaError(e)) console.warn('Structured project load unavailable:', e.message);
                    return null;
                });

                if (!project) {
                    const existing = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
                    if (!existing || existing.length === 0) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Projet introuvable' }));
                    }
                    project = existing[0];
                }

                const mergedProperties = { ...(project.properties || {}), ...properties };
                // Toute sauvegarde repasse la page en brouillon.
                mergedProperties.status = 'draft';

                // 1. Écrire dans seo_history (source de vérité — INSERT obligatoire, pas silencieux)
                const seoHistoryProps = { ...mergedProperties };
                delete seoHistoryProps.rawHtml;
                delete seoHistoryProps.page_group_id;
                delete seoHistoryProps.is_original_language;

                await supabaseRequest('POST', '/seo_history', {
                    project_name: projectName,
                    properties: seoHistoryProps,
                    saved_by: req.headers['x-user'] || null
                }, { Prefer: 'return=minimal' });
                console.log(`🗄️  [SEO-SETTINGS] Historique SEO enregistré pour "${projectName}"`);

                // 2. Reconstruire le HTML complet avec les nouvelles propriétés SEO
                await applyCustomMarketingCode(projectName, mergedProperties);
                const anchoredBody = ensureFormAnchors(
                    mergedProperties.rawHtml || extractBodyContent(project.html || '') || ''
                );
                mergedProperties.rawHtml = anchoredBody.html;
                mergedProperties.formIds = anchoredBody.formIds;
                const freshHtml = buildStoredHtml({
                    projectName,
                    html: anchoredBody.html,
                    css: project.css || '',
                    properties: mergedProperties
                });

                // 3. Sauvegarder immédiatement → puis répondre à l'utilisateur
                await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                    html: freshHtml,
                    html_sfmc: null,
                    properties: mergedProperties
                });

                console.log(`✅ [SEO-SETTINGS] Propriétés SEO de "${projectName}" mises à jour dans Supabase!`);

                // 4. Réponse immédiate au navigateur (la popup peut se fermer)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'SEO saved! Background sync started.', projectName }));

                // 5. Mise en file SFMC (comme Vercel) : traitement par le cron worker
                (async () => {
                    try {
                        const jobResult = await enqueueOrProcessInline({
                            projectName,
                            fullHtml:    freshHtml,
                            css:         project.css || '',
                            projectData: project.project_data,
                            properties:  mergedProperties,
                            source:      'server.js/save-seo'
                        });
                        console.log(`☁️  [BACKGROUND/SEO] SFMC sync: ${jobResult.action}` + (jobResult.error ? ` (${jobResult.error})` : ''));
                    } catch (bgErr) {
                        console.error(`❌ [BACKGROUND/SEO] Erreur:`, bgErr.message);
                    }
                })();

            } catch (e) {
                console.error('❌ [SEO-SETTINGS] Erreur:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: Get SEO history ─────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/seo-history') {
        try {
            const projectName = params.get('projectName');
            if (!projectName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'projectName required' }));
            }
            const result = await supabaseRequest('GET', `/seo_history?project_name=eq.${encodeURIComponent(projectName)}&order=created_at.desc&limit=5`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result || []));
        } catch (e) {
            console.error('❌ Erreur API seo-history:', e.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ── API: Save component ──────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/components') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { school_id, name, category, content, properties } = data;

                if (!school_id || !name || !content) {
                    res.writeHead(400);
                    return res.end('Missing required fields');
                }

                const normalizedSchoolId = String(school_id).toLowerCase();

                // Use a custom request to get the inserted data (representation)
                const supaResult = await supabaseRequest('POST', '/Component', {
                    school_id: normalizedSchoolId,
                    name,
                    category: category || 'Custom Components',
                    content,
                    properties: properties || {}
                }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

                console.log('📡 Résultat Supabase (Save Component):', JSON.stringify(supaResult));

                let newComponent;
                if (!supaResult || (Array.isArray(supaResult) && supaResult.length === 0)) {
                    console.warn('⚠️ Supabase did not return representation. Using fallback.');
                    newComponent = {
                        id: Date.now(), // Fallback ID if DB doesn't return one
                        school_id: normalizedSchoolId,
                        name,
                        category: category || `${normalizedSchoolId.toUpperCase()} Components`,
                        content
                    };
                } else {
                    newComponent = Array.isArray(supaResult) ? supaResult[0] : supaResult;
                }

                // SFMC sync disabled for component saves
                const sfmcResult = { skipped: true, action: 'disabled' };
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Component saved successfully', sfmc: sfmcResult, component: newComponent }));
            } catch (e) {
                console.log(`❌ Erreur catch components:`, e.message);
                res.writeHead(500);
                res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Get components by school ────────────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/components/')) {
        try {
            const schoolId = decodeURIComponent(pathname.replace('/api/components/', '')).toLowerCase();
            const result = await supabaseRequest('GET', `/Component?school_id=eq.${encodeURIComponent(schoolId)}`);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result || []));
        } catch (e) {
            console.log(`❌ Erreur catch get components:`, e.message);
            res.writeHead(500);
            res.end('Error: ' + e.message);
        }
        return;
    }

    // ── API: List all projects ───────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/projects') {
        try {
            console.log(`\n📋 Récupération de tous les projets`);
            const result = await supabaseRequest('GET', '/Projects?select=project_name,created_at,status:properties->>status');
            console.log(`📋 ${result?.length || 0} projet(s) trouvé(s)`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result || []));
        } catch (e) {
            console.log(`❌ Erreur:`, e.message);
            res.writeHead(500);
            res.end('Error: ' + e.message);
        }
        return;
    }

    // ── API: Rename project ───────────────────────────────────────────
    if (req.method === 'PATCH' && pathname === '/api/project/rename') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { oldName, newName } = JSON.parse(body);
                if (!oldName || !newName) {
                    res.writeHead(400); return res.end('Missing oldName or newName');
                }
                console.log(`\n✏️  Renommage projet: "${oldName}" → "${newName}"`);
                
                // 1. Mettre à jour la table héritée Projects
                await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(oldName)}`, { project_name: newName });
                
                // 2. Mettre à jour seo_history (historique SEO)
                try {
                    await supabaseRequest('PATCH', `/seo_history?project_name=eq.${encodeURIComponent(oldName)}`, { project_name: newName });
                } catch (seoErr) {
                    console.warn(`[Rename] Impossible de mettre à jour seo_history:`, seoErr.message);
                }

                // 3. Mettre à jour la table pages (schéma structuré)
                try {
                    const pageResult = await supabaseRequest('GET', `/pages?metadata->>legacyProjectName=eq.${encodeURIComponent(oldName)}`);
                    if (Array.isArray(pageResult) && pageResult.length > 0) {
                        const nameParts = newName.match(/^(school-[a-z0-9-]+__)(.+?)((?:__[A-Z]{2})?)$/i);
                        const newTitle = nameParts ? nameParts[2] : newName;
                        const newSlug = slugify(newTitle) || 'page';

                        for (const page of pageResult) {
                            const updatedMetadata = { ...(page.metadata || {}), legacyProjectName: newName };
                            await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(page.id)}`, {
                                title: newTitle,
                                slug: newSlug,
                                metadata: updatedMetadata,
                                updated_at: new Date().toISOString()
                            });
                        }
                        console.log(`✅ Tables de pages structurées mises à jour pour le renommage`);
                    }
                } catch (pageErr) {
                    console.warn(`[Rename] Impossible de mettre à jour les pages structurées:`, pageErr.message);
                }

                // 4. Renommer l'asset correspondant sur Salesforce Marketing Cloud (SFMC) si configuré
                if (isSfmcConfigured()) {
                    try {
                        const oldKey = customerKeyFor(oldName);
                        const newKey = customerKeyFor(newName);
                        const newAssetName = assetNameFor(newName);
                        
                        const assetId = await findAssetIdByCustomerKey(oldKey);
                        if (assetId) {
                            console.log(`☁️  SFMC: Renommage de l'asset ${assetId} ("${oldKey}" → "${newKey}")`);
                            await sfmcFetch('PATCH', `/asset/v1/content/assets/${assetId}`, {
                                name: newAssetName,
                                customerKey: newKey
                            });
                            console.log(`☁️  SFMC: Renommage asset OK`);
                        }
                    } catch (sfmcErr) {
                        console.warn(`[Rename] Impossible de renommer l'asset dans SFMC (non bloquant):`, sfmcErr.message);
                    }
                }

                console.log(`✅ Renommage OK`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                console.log(`❌ Erreur renommage:`, e.message);
                res.writeHead(500); res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Decline master template → schools ────────────────────────
    if (req.method === 'POST' && pathname === '/api/decline') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { masterProjectName, schoolIds, projectDisplayName } = JSON.parse(body);
                if (!masterProjectName || !Array.isArray(schoolIds) || schoolIds.length === 0) {
                    res.writeHead(400); return res.end('Missing masterProjectName or schoolIds');
                }

                // 1. Charger le projet master depuis Supabase
                const masterRows = await supabaseRequest('GET',
                    `/Projects?project_name=eq.${encodeURIComponent(masterProjectName)}&limit=1`);
                if (!masterRows || masterRows.length === 0) {
                    res.writeHead(404); return res.end('Master project not found');
                }
                const master = masterRows[0];

                // Extraire le nom d'affichage depuis le nom complet si non fourni
                const displayName = projectDisplayName ||
                    masterProjectName.replace(/^school-master__/, '').replace(/__[A-Z]{2}$/, '');

                // Extraire le corps HTML du document complet stocké
                const masterBodyHtml = extractBodyContent(master.html || '');
                const masterCss = master.css || '';
                const masterProps = master.properties || {};
                const masterProjectData = master.project_data || '{}';

                // 2. Charger toutes les écoles
                const allSchools = await readSchoolsForApi();

                const results = { success: [], errors: [] };

                // 3. Pour chaque école cible
                for (const schoolId of schoolIds) {
                    try {
                        const school = allSchools.find(s => s.id === schoolId);
                        if (!school) throw new Error(`École "${schoolId}" introuvable`);

                        const schoolName     = school.name || schoolId;
                        const schoolFullName = school.fullName || school.full_name || schoolName;
                        // Logo : override DB éventuel → logo hardcodé de l'école → nom
                        const schoolLogo     = school.logo || getSchoolLogo(schoolId) || schoolName;
                        const primary        = school.color || '#374151';
                        const secondary      = school.secondaryColor || school.secondary_color || '#1a1a1a';
                        const colorHeader    = school.colorHeader || primary;
                        const colorCarousel  = school.colorCarousel || primary;
                        const headerText     = school.headerTextColor || '#ffffff';
                        const rgb            = hexToRgb(primary);

                        // Remplacer les placeholders texte dans le HTML
                        let schoolHtml = masterBodyHtml
                            .replace(/NOM_ECOLE/g, schoolName)
                            .replace(/NOM_COMPLET_ECOLE/g, schoolFullName)
                            .replace(/LOGO_ECOLE/g, schoolLogo);

                        const branding = normalizeBranding(school.branding, school);
                        const schoolFont = fontStackById(branding.defaultFont);

                        // Patcher les balises <style> inline dans le HTML body
                        const colorVarsForHtml = { colorHeader, primary, secondary, colorCarousel };
                        schoolHtml = schoolHtml.replace(
                            /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
                            (_, open, cssContent, close) =>
                                open + patchCssString(cssContent, colorVarsForHtml) + close
                        );

                        // Injecter les CSS vars de l'école en tête du CSS
                        const colors = branding.colors;
                        const colorsVarsArray = Object.entries(colors).map(([key, val]) => `--brand-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${val};`);
                        const schoolVars = `:root { --brand-font: ${schoolFont}; --brand-primary-rgb: ${rgb}; --brand-header: ${colorHeader}; --brand-header-text: ${headerText}; --brand-carousel: ${colorCarousel}; ${colorsVarsArray.join(' ')} }\n`;

                        // Règles d'override complètes pour TOUS les composants master
                        // Ecrase toutes les couleurs hardcodées (#E9A036, #bd2bf3, etc.) via !important
                        // NB : header & footer NE sont PAS repeints ici — ils sont
                        // remplacés par les vrais blocs école (auto-stylés, maquette figée).
                        const brandOverrides = `
/* DÉCLINAISON ÉCOLE : ${schoolId} */
.mc2a-section,.mc2b-section,.mc2c-section,.mcva-section,.mcd-colored-zone,.mc3c-section,.mce-section,.mcb-gray-zone,.mtr-content-col,.mhc-cta-section,.mcf-section{background-color:${colorCarousel}!important;background:${colorCarousel}!important;}
.mc1-section,.mc1b-section,.mbc-section,.mbt-section,.mnc-section,.mns-section,.mna-section,.mnb-section,.malt-section,.mta-section,.mtr-section,.mbi-section{background-color:${colors.background}!important;}
.mta-step,.mta-steps-grid,.mta-pane{background-color:${colors.surface}!important;background:${colors.surface}!important;}
.mta-badge,.mtr-keyword,.mc-badge,.mbadge,.mhc-badge,.mcf-badge,.mnc-badge{background-color:${colors.secondary}!important;background:${colors.secondary}!important;color:${colors.buttonText}!important;}
.mta-tab-hd,.mta-mob-tab{background-color:${colors.primary}!important;background:${colors.primary}!important;}
.mta-tab-hd[data-tab="1"],.mta-mob-tab[data-tab="1"]{background-color:${colors.secondary}!important;background:${colors.secondary}!important;}
.mta-tab-hd[data-tab="2"],.mta-mob-tab[data-tab="2"]{background-color:${colors.accent}!important;background:${colors.accent}!important;}
.mta-tab-hd.mta-active,.mta-mob-tab.mta-active{background-color:${colors.background}!important;background:${colors.background}!important;}
.mc-cta-btn,.mc-btn,.mhc-btn,.mcf-btn,.mnc-btn,.mct-btn,.mbc-btn,.mns-btn,.form-submit,[class*="-cta-btn"],[class*="-btn-primary"]{background-color:${colors.buttonBackground}!important;background:${colors.buttonBackground}!important;color:${colors.buttonText}!important;border-color:${colors.buttonBackground}!important;}
.mc-cta-btn:hover,.mc-btn:hover,.mhc-btn:hover,.mcf-btn:hover,.mnc-btn:hover,.mct-btn:hover,.mbc-btn:hover,.mns-btn:hover,.form-submit:hover,[class*="-cta-btn"]:hover,[class*="-btn-primary"]:hover{background-color:${colors.buttonHover}!important;background:${colors.buttonHover}!important;border-color:${colors.buttonHover}!important;}
a.mf-link,a[class*="-link"]{color:${colors.link}!important;}
a.mf-link:hover,a[class*="-link"]:hover{color:${colors.linkHover}!important;}
`;
                        const schoolCss = schoolVars + patchCssString(masterCss, colorVarsForHtml) + brandOverrides;

                        // Construire les propriétés du projet décliné
                        const newProjectName = `school-${schoolId}__${displayName}__FR`;
                        const newProps = {
                            ...masterProps,
                            seoTitle: `${schoolName} – ${displayName}`,
                            title:    `${schoolName} – ${displayName}`
                        };

                        // Code marketing : école cible (commun) + code page hérité du master
                        await applyCustomMarketingCode(newProjectName, newProps);

                        // Remplacer header/footer générique du master par les VRAIS
                        // header (baseline) + footer de l'école (logos PNG maquette).
                        const schoolHeaderHtml = renderSchoolHeaderHtml(schoolId);
                        const schoolFooterHtml = renderSchoolFooterHtml(schoolId);
                        if (schoolHeaderHtml || schoolFooterHtml) {
                            try {
                                const $d = cheerio.load(schoolHtml, null, false);
                                if (schoolHeaderHtml && $d('.mh-header').length) $d('.mh-header').first().replaceWith(schoolHeaderHtml);
                                if (schoolFooterHtml && $d('.mf-footer').length) $d('.mf-footer').first().replaceWith(schoolFooterHtml);
                                schoolHtml = $d.html();
                            } catch (e) { console.warn('Swap header/footer HTML échoué:', e.message); }
                        }

                        // Construire le HTML final stocké
                        const fullHtml = buildStoredHtml({
                            projectName: newProjectName,
                            html: schoolHtml,
                            css: schoolCss,
                            properties: newProps
                        });

                        // Construire le project_data avec métadonnées + remplacement placeholders
                        // Le project_data est ce que l'éditeur GrapesJS charge réellement.
                        let parsedProjectData;
                        try { parsedProjectData = JSON.parse(masterProjectData); }
                        catch(e) { parsedProjectData = {}; }

                        // 1. Remplacement des placeholders texte (noms)
                        let projectDataStr = JSON.stringify({
                            ...parsedProjectData,
                            declinedFrom: masterProjectName,
                            declinedAt:   new Date().toISOString(),
                            schoolId
                        });
                        // Logo = SVG/HTML → échappé pour rester valide DANS la chaîne JSON
                        const schoolLogoJson = JSON.stringify(schoolLogo).slice(1, -1);
                        projectDataStr = projectDataStr
                            .replace(/NOM_ECOLE/g, schoolName)
                            .replace(/NOM_COMPLET_ECOLE/g, schoolFullName)
                            .replace(/LOGO_ECOLE/g, schoolLogoJson);

                        // 2. (Anciens gabarits) remplacer un logo placehold.co seulement si le logo est une URL
                        if (schoolLogo && /^https?:\/\//.test(schoolLogo)) {
                            projectDataStr = projectDataStr.replace(
                                /https?:\/\/placehold\.co\/[^"]*(?:LOGO|logo)[^"]*/g,
                                schoolLogo
                            );
                        }

                        // 3. Post-process les styles GrapesJS
                        // Le project_data a été sauvegardé avec les anciennes couleurs hardcodées
                        // des composants master (avant nos mises à jour). On doit donc :
                        //   a) Mettre à jour les fallbacks des var() existantes
                        //   b) Remplacer les couleurs hardcodées "master default" dans background/border
                        let finalProjectData;
                        try {
                            finalProjectData = JSON.parse(projectDataStr);

                            // 2.5 Correction des logos SVG dans le projectData
                            if (Array.isArray(finalProjectData.pages)) {
                                const fixSvgNodes = (components) => {
                                    if (!Array.isArray(components)) return;
                                    components.forEach(c => {
                                        if (c.type === 'textnode' && c.content && c.content.trim().startsWith('<svg')) {
                                            delete c.type;
                                            c.components = c.content;
                                            delete c.content;
                                        }
                                        if (c.components) fixSvgNodes(c.components);
                                    });
                                };

                                // Remplace les nœuds header/footer master par les vrais
                                // blocs école. GrapesJS parse la chaîne HTML assignée à
                                // .components au chargement (même mécanisme que fixSvgNodes).
                                const swapHeaderFooter = (components) => {
                                    if (!Array.isArray(components)) return components;
                                    return components.map(node => {
                                        if (!node || typeof node !== 'object') return node;
                                        const classes = (node.classes || []).map(c => typeof c === 'string' ? c : (c && c.name));
                                        if (schoolHeaderHtml && classes.includes('mh-header')) return { tagName: 'div', components: schoolHeaderHtml };
                                        if (schoolFooterHtml && classes.includes('mf-footer')) return { tagName: 'div', components: schoolFooterHtml };
                                        if (node.components) node.components = swapHeaderFooter(node.components);
                                        return node;
                                    });
                                };

                                finalProjectData.pages.forEach(page => {
                                    if (!page.frames) return;
                                    page.frames.forEach(frame => {
                                        if (frame.component && Array.isArray(frame.component.components)) {
                                            fixSvgNodes(frame.component.components);
                                            frame.component.components = swapHeaderFooter(frame.component.components);
                                        }
                                    });
                                });

                            const styleObj = {
                                '--brand-font':          schoolFont,
                                     '--brand-primary-rgb':   rgb,
                                     '--brand-header':        colorHeader,
                                     '--brand-header-text':   headerText,
                                     '--brand-carousel':      colorCarousel,
                                     '--brand-primary':       colors.primary,
                                     '--brand-secondary':     colors.secondary,
                                     '--brand-accent':        colors.accent,
                                     '--brand-background':    colors.background,
                                     '--brand-surface':       colors.surface,
                                     '--brand-text':          colors.text,
                                     '--brand-muted':         colors.mutedText,
                                     '--brand-border':        colors.border,
                                     '--brand-button-background': colors.buttonBackground,
                                     '--brand-button-hover':  colors.buttonHover,
                                     '--brand-button-text':   colors.buttonText,
                                     '--brand-link':          colors.link,
                                     '--brand-link-hover':    colors.linkHover
                                 };

                                 // Injecter les variables dans project_data styles (écrase les anciennes :root)
                                 if (!Array.isArray(finalProjectData.styles)) finalProjectData.styles = [];
                                 finalProjectData.styles = finalProjectData.styles.filter(r => {
                                     const sel = r.selectors || [];
                                     const selAdd = r.selectorsAdd || '';
                                     return !((Array.isArray(sel) && sel.length === 1 && sel[0] === ':root') || selAdd === ':root');
                                 });
                                 finalProjectData.styles.unshift({ selectors: [':root'], style: styleObj });
                            }

                            // Couleurs hardcodées des composants master qui doivent devenir brand-primary
                            const MASTER_PRIMARY_COLORS = new Set([
                                '#1a1a1a', '#1f2937', '#374151', '#e69b35', '#9b26b6', '#111111', '#000000', '#f3f4f6', '#ffffff'
                            ]);
                            // Propriétés CSS où la couleur doit être celle de l'école (pas le texte)
                            const BRAND_BG_PROPS = new Set([
                                'background', 'background-color',
                                'border-color', 'border-bottom-color', 'border-top-color',
                                'border-left-color', 'border-right-color'
                            ]);
                            // Sélecteurs de header/footer : background doit suivre --brand-header (pas --brand-primary)
                            const HEADER_SELECTORS = new Set([
                                '.header-efap', '.header-brassart', '.mh-header',
                                '.footer-efap', '.footer-brassart'
                            ]);

                            if (Array.isArray(finalProjectData.styles)) {
                                finalProjectData.styles = finalProjectData.styles.map(rule => {
                                    if (!rule.style) return rule;
                                    const newStyle = { ...rule.style };
                                    let changed = false;

                                    // Déterminer si ce rule cible un sélecteur de header
                                    const selectorStr = Array.isArray(rule.selectors)
                                        ? rule.selectors.map(s => typeof s === 'string' ? s : (s && s.name ? `.${s.name}` : '')).join('')
                                        : '';
                                    const isHeaderSelector = HEADER_SELECTORS.has(selectorStr);

                                    Object.keys(newStyle).forEach(prop => {
                                        const val = String(newStyle[prop] || '');
                                        if (!val) return;

                                        // c) Pour les sélecteurs de header : forcer background → var(--brand-header)
                                        if (isHeaderSelector && (prop === 'background' || prop === 'background-color')) {
                                            newStyle[prop] = `var(--brand-header, ${colorHeader})`;
                                            changed = true;
                                            return;
                                        }

                                        // a) Mettre à jour les fallbacks var(--brand-primary, OLD) → var(--brand-primary, primary)
                                        if (val.includes('var(--brand-primary')) {
                                            newStyle[prop] = val.replace(/var\(--brand-primary,\s*[^)]+\)/, `var(--brand-primary, ${primary})`);
                                            changed = true;
                                            return;
                                        }
                                        if (val.includes('var(--brand-secondary')) {
                                            newStyle[prop] = val.replace(/var\(--brand-secondary,\s*[^)]+\)/, `var(--brand-secondary, ${secondary})`);
                                            changed = true;
                                            return;
                                        }
                                        if (val.includes('var(--brand-header')) {
                                            newStyle[prop] = val.replace(/var\(--brand-header,\s*[^)]+\)/, `var(--brand-header, ${colorHeader})`);
                                            changed = true;
                                            return;
                                        }
                                        if (val.includes('var(--brand-carousel')) {
                                            newStyle[prop] = val.replace(/var\(--brand-carousel,\s*[^)]+\)/, `var(--brand-carousel, ${colorCarousel})`);
                                            changed = true;
                                            return;
                                        }

                                        // b) Remplacer les couleurs hardcodées master dans les props de fond/bordure
                                        if (BRAND_BG_PROPS.has(prop)) {
                                            const valLower = val.toLowerCase();
                                            for (const mc of MASTER_PRIMARY_COLORS) {
                                                if (valLower === mc || valLower.startsWith(mc)) {
                                                    newStyle[prop] = `var(--brand-primary, ${primary})`;
                                                    changed = true;
                                                    return;
                                                }
                                            }
                                        }
                                    });
                                    return changed ? { ...rule, style: newStyle } : rule;
                                });
                            }

                            // 5. Patcher les balises <style> inline dans l'arbre des composants GrapesJS
                            // (project_data.pages[].frames[].component) — ces styles ne sont PAS
                            // dans le tableau .styles mais directement dans le HTML des composants.
                            const colorVars = { colorHeader, primary, secondary, colorCarousel };
                            if (Array.isArray(finalProjectData.pages)) {
                                finalProjectData.pages = finalProjectData.pages.map(page => ({
                                    ...page,
                                    frames: (page.frames || []).map(frame => ({
                                        ...frame,
                                        component: frame.component ? {
                                            ...frame.component,
                                            components: patchComponentTree(frame.component.components, colorVars)
                                        } : frame.component
                                    }))
                                }));
                            }

                        } catch(e) {
                            console.error('project_data post-process error:', e.message);
                            finalProjectData = JSON.parse(projectDataStr);
                        }
                        const newProjectData = JSON.stringify(finalProjectData);

                        // Sauvegarder via upsert Supabase
                        await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                            project_name:         newProjectName,
                            html:                 fullHtml,
                            css:                  schoolCss,
                            project_data:         newProjectData,
                            properties:           newProps,
                            is_original_language: true
                        });

                        // Synchroniser dans le système structuré (donne un page_id → active
                        // les boutons historique, statut, dossier dans le dashboard)
                        try {
                            await syncLegacyProjectToContent({
                                projectName: newProjectName,
                                html:        fullHtml,
                                css:         schoolCss,
                                projectData: newProjectData,
                                properties:  newProps
                            });
                        } catch (syncErr) {
                            console.warn(`⚠️ [decline] sync content failed for ${schoolId}:`, syncErr.message);
                        }

                        results.success.push({ schoolId, projectName: newProjectName });
                        console.log(`✅ [decline] ${schoolId} → ${newProjectName}`);
                    } catch (e) {
                        results.errors.push({ schoolId, message: e.message });
                        console.error(`❌ [decline] ${schoolId}:`, e.message);
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results));
            } catch (e) {
                console.error('❌ Erreur /api/decline:', e.message);
                res.writeHead(500); res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Get project by name ─────────────────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/project/')) {
        try {
            const projectName = decodeURIComponent(pathname.replace('/api/project/', ''));
            console.log(`\n🔍 Récupération projet: "${projectName}"`);
            const structured = await getStructuredProjectForLegacyProject(projectName).catch(e => {
                if (!isMissingContentSchemaError(e)) console.warn('Structured project load unavailable:', e.message);
                return null;
            });
            if (structured) {
                console.log(`✅ Projet structuré trouvé!`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(structured));
            }

            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
            if (!result || result.length === 0) {
                console.log(`❌ Projet non trouvé`);
                res.writeHead(404);
                return res.end('Project not found');
            }
            console.log(`✅ Projet trouvé!`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result[0]));
        } catch (e) {
            console.log(`❌ Erreur:`, e.message);
            res.writeHead(500);
            res.end('Error: ' + e.message);
        }
        return;
    }

    // ── API: Create SFMC Data Extension ───────────────────────────────
    if (req.method === 'POST' && pathname === '/api/sfmc/create-data-extension') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { name, fields } = JSON.parse(body);
                if (!name || !fields) {
                    res.writeHead(400);
                    return res.end('Missing name or fields');
                }
                const result = await createDataExtension({ name, fields });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                console.error('❌ Error creating DE:', e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message, payload: e.payload }));
            }
        });
        return;
    }

    // ── API: Publication manuelle vers SFMC (bouton « Publish to SFMC ») ──
    // La sauvegarde ne fait que préparer le brouillon (html_sfmc + images) ;
    // cet endpoint publie l'asset webpage dans SFMC à la demande.
    if (req.method === 'POST' && pathname === '/api/publish-sfmc') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { projectName } = JSON.parse(body || '{}');
                if (!projectName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'projectName required' }));
                }
                if (!isSfmcConfigured()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'SFMC non configuré sur ce serveur.' }));
                }

                const projectRes = await supabaseRequest(
                    'GET',
                    `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=*&limit=1`
                );
                const project = projectRes && projectRes[0];
                if (!project) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: `Projet "${projectName}" introuvable.` }));
                }

                // html_sfmc déjà nettoyé + images publiées par la sauvegarde/cron ;
                // sinon, le préparer à la volée pour ne pas dépendre du cron.
                let htmlToSend = project.html_sfmc;
                if (!htmlToSend) {
                    htmlToSend = cleanHtmlForSfmc(project.html || '');
                    htmlToSend = await replaceInlineImagesWithSfmcUrls(htmlToSend, projectName);
                    await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                        html_sfmc: htmlToSend
                    });
                }

                console.log(`☁️  [PUBLISH] Publication manuelle vers SFMC pour "${projectName}"...`);
                const result = await syncProjectToSfmc({ projectName, fullHtml: htmlToSend });

                // Marquer la page comme publiée.
                const publishedProps = { ...(project.properties || {}), status: 'published' };
                await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                    properties: publishedProps
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Published', projectName, status: 'published', sfmc: result }));
            } catch (e) {
                console.error('❌ Error publishing to SFMC:', e.message);
                res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message, payload: e.payload }));
            }
        });
        return;
    }

    // ── API: Dépublication manuelle SFMC (bouton « Dépublier ») ──────────
    // Supprime l'asset page dans SFMC par clé exacte (avec garde-fou) et
    // repasse la page en brouillon.
    if (req.method === 'POST' && pathname === '/api/unpublish-sfmc') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { projectName } = JSON.parse(body || '{}');
                if (!projectName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'projectName required' }));
                }
                if (!isSfmcConfigured()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'SFMC non configuré sur ce serveur.' }));
                }

                const projectRes = await supabaseRequest(
                    'GET',
                    `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=properties&limit=1`
                );
                const project = projectRes && projectRes[0];
                if (!project) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: `Projet "${projectName}" introuvable.` }));
                }

                console.log(`☁️  [UNPUBLISH] Dépublication SFMC pour "${projectName}"...`);
                const result = await unpublishProjectFromSfmc({ projectName });

                // Repasser en brouillon (que l'asset ait été supprimé ou déjà absent).
                const draftProps = { ...(project.properties || {}), status: 'draft' };
                await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                    properties: draftProps
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Unpublished', projectName, status: 'draft', sfmc: result }));
            } catch (e) {
                console.error('❌ Error unpublishing from SFMC:', e.message);
                res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message, payload: e.payload }));
            }
        });
        return;
    }

    // ── API: Create SFMC Form Asset ───────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/sfmc/create-form-asset') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { name, schoolId, html, css, ampscript } = JSON.parse(body);
                const result = await createFormAsset({ name, schoolId, html, css, ampscript });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                console.error('❌ Error creating Form Asset:', e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message, payload: e.payload }));
            }
        });
        return;
    }

    // ── API: Upload Image to SFMC (une requête par image, envoyée à la
    // sauvegarde pour garder le payload de /api/save sous la limite Vercel) ──
    if (req.method === 'POST' && pathname === '/api/sfmc/upload-image') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { name, schoolId, projectName, dataUrl } = JSON.parse(body);
                const result = await uploadImageFromDataUrl({ name, schoolId, projectName, dataUrl });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                console.error('❌ Error uploading image to SFMC:', e.message);
                res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message, payload: e.payload }));
            }
        });
        return;
    }

    // ── API: Save Form to Supabase ────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/forms/save-to-supabase') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                // Use upsert logic: if ID is provided, update; otherwise insert.
                const result = await supabaseRequest('POST', '/Forms', data, { 
                    'Prefer': 'resolution=merge-duplicates,return=representation' 
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                console.error('❌ Error saving form to Supabase:', e.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: Get Forms for School ────────────────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/forms/')) {
        try {
            const schoolId = pathname.replace('/api/forms/', '');
            const result = await supabaseRequest('GET', `/Forms?school_id=eq.${schoolId}&order=created_at.desc`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            console.error('❌ Error fetching forms:', e.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ── API: Delete Form ──────────────────────────────────────────
    if (req.method === 'DELETE' && pathname.startsWith('/api/forms/')) {
        try {
            const id = pathname.replace('/api/forms/', '');
            await supabaseRequest('DELETE', `/Forms?id=eq.${id}`);
            res.writeHead(200);
            res.end('Deleted');
        } catch (e) {
            console.error('❌ Error deleting form:', e.message);
            res.writeHead(500);
            res.end(e.message);
        }
        return;
    }

    // ── API: FAQ — rendu pour une école + page_type ───────────────────
    if (req.method === 'GET' && pathname === '/api/faq/render') {
        try {
            const school_id = params.get('school_id');
            const page_type = params.get('page_type');
            if (!school_id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'school_id requis' }));
            }
            const schoolRows = await supabaseRequest('GET', `/Schools?id=eq.${encodeURIComponent(school_id)}&select=show_faq&limit=1`).catch(() => []);
            const school = Array.isArray(schoolRows) ? schoolRows[0] : null;
            if (school && school.show_faq === false) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify([]));
            }
            let url = `/school_page_faq?school_id=eq.${encodeURIComponent(school_id)}&order=sort_order.asc,created_at.asc&select=faq_id,sort_order,faq(id,question,answer)`;
            if (page_type) url += `&page_type=eq.${encodeURIComponent(page_type)}`;
            const rows = await supabaseRequest('GET', url).catch(() => []);
            const faqs = (Array.isArray(rows) ? rows : []).map(r => r.faq).filter(Boolean);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(faqs));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: FAQ — liste toute la banque ──────────────────────────────
    if (req.method === 'GET' && pathname === '/api/faq') {
        try {
            const result = await supabaseRequest('GET', '/faq?order=created_at.asc');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(result || []));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: FAQ — créer une question ─────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/faq') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { question, answer } = JSON.parse(body || '{}');
                if (!question || !answer) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'question et answer requis' }));
                }
                const result = await supabaseRequest('POST', '/faq', { question, answer }, { 'Prefer': 'return=representation' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(Array.isArray(result) ? result[0] : result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: FAQ — modifier une question ──────────────────────────────
    if (req.method === 'PUT' && pathname.startsWith('/api/faq/') && !pathname.startsWith('/api/faq/school/') && pathname !== '/api/faq/render') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const id = decodeURIComponent(pathname.replace('/api/faq/', ''));
                const { question, answer } = JSON.parse(body || '{}');
                if (!question || !answer) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'question et answer requis' }));
                }
                const result = await supabaseRequest('PATCH', `/faq?id=eq.${encodeURIComponent(id)}`, { question, answer, updated_at: new Date().toISOString() }, { 'Prefer': 'return=representation' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(Array.isArray(result) ? result[0] : result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: FAQ — supprimer une question ─────────────────────────────
    if (req.method === 'DELETE' && pathname.startsWith('/api/faq/') && !pathname.startsWith('/api/faq/school/') && pathname !== '/api/faq/render') {
        try {
            const id = decodeURIComponent(pathname.replace('/api/faq/', ''));
            await supabaseRequest('DELETE', `/faq?id=eq.${encodeURIComponent(id)}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: 'FAQ supprimée' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: FAQ — associations d'une école ───────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/faq/school/') && !pathname.includes('/', '/api/faq/school/'.length)) {
        try {
            const schoolId = decodeURIComponent(pathname.replace('/api/faq/school/', ''));
            const rows = await supabaseRequest('GET', `/school_page_faq?school_id=eq.${encodeURIComponent(schoolId)}&select=id,faq_id,page_type,sort_order,faq(id,question,answer)&order=sort_order.asc`).catch(() => []);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(Array.isArray(rows) ? rows : []));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: FAQ — ajouter une association ────────────────────────────
    if (req.method === 'POST' && pathname.startsWith('/api/faq/school/')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const schoolId = decodeURIComponent(pathname.replace('/api/faq/school/', ''));
                const { faq_id, page_type = 'general', sort_order = 0 } = JSON.parse(body || '{}');
                if (!faq_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'faq_id requis' }));
                }
                const result = await supabaseRequest('POST', '/school_page_faq', {
                    school_id: schoolId, faq_id, page_type, sort_order
                }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(Array.isArray(result) ? result[0] : result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ── API: FAQ — supprimer une association ──────────────────────────
    if (req.method === 'DELETE' && pathname.startsWith('/api/faq/school/')) {
        try {
            const parts = pathname.replace('/api/faq/school/', '').split('/');
            const linkId = parts[1];
            if (!linkId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'linkId requis' }));
            }
            await supabaseRequest('DELETE', `/school_page_faq?id=eq.${encodeURIComponent(linkId)}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: 'Association supprimée' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── AI: Generate Content ─────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/ai/generate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { prompt, schoolId, projectId } = JSON.parse(body);
                const school = SCHOOLS.find(s => s.id === schoolId) || {};
                
                const schoolName = school.name || 'notre établissement';
                const schoolMetier = school.description || 'Formation supérieure';

                console.log(`\n🤖 [AI] Requête reçue pour l'école : ${schoolName} (${schoolId})`);
                console.log(`📝 [AI] Prompt utilisateur : "${prompt}"`);

                // Sauvegarde du message utilisateur dans Supabase
                try {
                    await supabaseRequest('POST', '/chat_history', {
                        sender: 'user',
                        message: prompt,
                        school_id: schoolId,
                        project_id: projectId
                    });
                } catch (err) {
                    console.error('⚠️ [AI] Impossible de sauvegarder le message utilisateur:', err.message);
                }

                const systemPrompt = `Tu es l'Assistant IA expert de Reetain, conçu pour aider les consultants marketing à créer des landing pages pour un réseau d'écoles.
Tu es actuellement configuré pour l'école : ${schoolName}.
Le domaine/métier de cette école est : ${schoolMetier}.

Ton rôle est de donner des recommandations courtes, percutantes et orientées conversion pour cette école spécifique. Tu dois proposer :
1. Des titres accrocheurs adaptés au domaine de l'école.
2. Des textes de boutons (CTA) qui incitent au clic.
3. Des idées d'organisation de contenu.

Règles importantes :
- Ne donne JAMAIS de code HTML ou CSS, donne uniquement du texte que le consultant peut copier-coller.
- Adapte ton ton au domaine de l'école (ex: créatif pour le design, corpo pour la communication).
- Sois concis, comme dans un vrai chat. Pas de longs discours.
- Si l'utilisateur te salue simplement (ex: "bonjour", "salut"), réponds poliment en te présentant et en lui demandant comment tu peux l'aider pour sa page aujourd'hui, sans générer de contenu tout de suite.`;

                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    console.error("❌ [AI] Clé API Gemini manquante dans le fichier .env");
                    throw new Error("Clé API Gemini manquante dans le fichier .env");
                }

                console.log(`📡 [AI] Envoi de la requête à Gemini API (gemini-2.5-flash)...`);
                
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        generationConfig: { temperature: 0.7 }
                    })
                });

                const data = await response.json();
                
                if (data.error) {
                    console.error(`❌ [AI] Erreur retournée par Gemini :`, data.error.message);
                    throw new Error(data.error.message);
                }

                const generatedText = data.candidates[0].content.parts[0].text;


                console.log(`✨ [AI] Réponse générée avec succès (${generatedText.length} caractères)`);

                // Sauvegarde de la réponse du bot dans Supabase
                try {
                    await supabaseRequest('POST', '/chat_history', {
                        sender: 'bot',
                        message: generatedText,
                        school_id: schoolId,
                        project_id: projectId
                    });
                } catch (err) {
                    console.error('⚠️ [AI] Impossible de sauvegarder la réponse du bot:', err.message);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ text: generatedText }));
            } catch (e) {
                console.error('❌ Erreur Gemini:', e.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ text: `Désolé, j'ai rencontré une erreur : ${e.message}` }));
            }
        });
        return;
    }
    // ── API: Campus CRUD (source = Data Extension SFMC) ───────────────
    if (pathname.startsWith('/api/campuses')) {
        try {
            if (!isSfmcConfigured()) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'SFMC non configuré (SFMC_SUBDOMAIN / CLIENT_ID / CLIENT_SECRET)' }));
            }
            // École concernée (obligatoire) : les campus sont scindés par école.
            const school = (params.get('school') || '').toLowerCase();
            if (req.method === 'GET') {
                const result = await listCampuses(school);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result || []));
            }
            if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                    try {
                        const { id, name, slug, image_url, address, link, country, school: bSchool } = JSON.parse(body || '{}');
                        const sch = (school || bSchool || '').toLowerCase();
                        if (!sch) { res.writeHead(400); return res.end(JSON.stringify({ error: 'école (school) requise' })); }
                        if (!id || !name) {
                            res.writeHead(400); return res.end(JSON.stringify({ error: 'id et name requis' }));
                        }
                        const result = await upsertCampus({ school: sch, id, name, slug: slug || id, image_url, address, link, country });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: e.message }));
                    }
                });
                return;
            }
            if (req.method === 'PUT') {
                const campusId = decodeURIComponent(pathname.replace('/api/campuses/', ''));
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                    try {
                        const { name, slug, image_url, address, link, country, school: bSchool } = JSON.parse(body || '{}');
                        const sch = (school || bSchool || '').toLowerCase();
                        if (!sch) { res.writeHead(400); return res.end(JSON.stringify({ error: 'école (school) requise' })); }
                        if (!name) { res.writeHead(400); return res.end(JSON.stringify({ error: 'name requis' })); }
                        const result = await upsertCampus({ school: sch, id: campusId, name, slug: slug || campusId, image_url, address, link, country });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: e.message }));
                    }
                });
                return;
            }
            if (req.method === 'DELETE') {
                const campusId = decodeURIComponent(pathname.replace('/api/campuses/', ''));
                if (!school) { res.writeHead(400); return res.end(JSON.stringify({ error: 'école (school) requise' })); }
                const result = await deleteCampus(school, campusId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result));
            }
        } catch (e) {
            res.writeHead(e.status || 500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: Get single project by project_name ──────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/project/')) {
        try {
            const projectName = decodeURIComponent(pathname.replace('/api/project/', ''));
            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=project_name,properties,created_at&limit=1`);
            if (!result || result.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Project not found' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(result[0]));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // ── API: Get SEO history for a project ──────────────────────────
    if (req.method === 'GET' && pathname === '/api/seo-history') {
        try {
            const projectName = params.get('projectName');
            if (!projectName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'projectName required' }));
            }

            const records = await supabaseRequest('GET', `/seo_history?project_name=eq.${encodeURIComponent(projectName)}&order=created_at.desc`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(records || []));
        } catch (err) {
            console.error('❌ [SEO-HISTORY] Error:', err.message || err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'unknown' }));
        }
        return;
    }

    // ── AI: Get History ──────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/ai/history') {
        const schoolId = params.get('schoolId');
        if (!schoolId) {
            res.writeHead(400);
            res.end('schoolId missing');
            return;
        }

        try {
            console.log(`\n📜 [AI] Récupération de l'historique pour l'école: ${schoolId}`);
            const data = await supabaseRequest('GET', `/chat_history?school_id=eq.${encodeURIComponent(schoolId)}&order=created_at.asc`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data || []));
        } catch (e) {
            console.error("❌ [AI] Erreur lors de la récupération de l'historique:", e.message);
            res.writeHead(500);
            res.end(e.message);
        }
        return;
    }

    // ── API pages routes extracted to /api/pages/ directory ──
    // We replicate them here so local `node server.js` still works.

    // ── API: List all pages (CMS dashboard) ──────────────────────────────
    if (req.method === 'GET' && pathname === '/api/pages') {
        try {
            console.log(`\n📋 CMS: Récupération de toutes les pages`);
            const result = await supabaseRequest(
                'GET',
                '/Projects?select=project_name,html,properties,created_at,is_original_language,page_group_id&order=created_at.desc'
            );
            
            if (!Array.isArray(result)) {
                console.error("Supabase returned an error or non-array:", result);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: result.message || 'Failed to fetch pages' }));
            }

            const legacyPages = result.map(p => {
                const props = p.properties || {};
                const schoolMatch = (p.project_name || '').match(/^school-([a-z0-9-]+)__/);
                const school = schoolMatch ? schoolMatch[1].toUpperCase() : '—';
                const parts  = (p.project_name || '').replace(/^school-[a-z0-9-]+__/, '').split('__');
                const displayName = parts[0] || p.project_name;
                const lang = parts[1] || 'FR';

                const isOriginal  = p.is_original_language !== false;
                const pageGroupId = p.page_group_id || null;

                return {
                    project_name:         p.project_name,
                    title:                props.title || displayName,
                    school,
                    lang,
                    seoTitle:             props.seoTitle || '',
                    seoDescription:       props.seoDescription || '',
                    formIds:              Array.isArray(props.formIds) ? props.formIds : extractFormIds(p.html || props.rawHtml || ''),
                    updated_at:           p.created_at,
                    source:               'legacy',
                    status:               props.status || 'draft',
                    is_original_language: isOriginal,
                    page_group_id:        pageGroupId,
                    publication:  props.publication || { active: true, redirectUrl: '' }

                };
            });
            let structuredPages = [];
            try {
                structuredPages = await listMigratedDashboardPages();
            } catch (structuredErr) {
                if (isMissingContentSchemaError(structuredErr)) {
                    console.info('Structured content schema not installed yet; dashboard is using legacy Projects only.');
                } else {
                    console.warn('Structured dashboard pages unavailable, using legacy only:', structuredErr.message);
                }
            }

            const merged = new Map();
            legacyPages.forEach(page => merged.set(page.project_name, page));
            structuredPages.forEach(page => {
                const existing = merged.get(page.project_name);
                merged.set(page.project_name, {
                    ...page,
                    // Préserver les champs de traduction du legacy qui ne sont pas dans structured
                    is_original_language: page.is_original_language !== undefined
                        ? page.is_original_language
                        : existing?.is_original_language,
                    page_group_id: page.page_group_id !== undefined
                        ? page.page_group_id
                        : existing?.page_group_id,
                    formIds: Array.isArray(page.formIds)
                        ? page.formIds
                        : (existing?.formIds || [])
                });
            });
            const pages = [...merged.values()].sort((a, b) => {
                return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(pages));
        } catch (e) {
            console.error('❌ /api/pages error:', e.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }


    // ── API: Duplicate a page (CMS) ───────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/pages/duplicate') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { sourceProjectName, newTitle } = JSON.parse(body);
                if (!sourceProjectName || !newTitle) {
                    res.writeHead(400);
                    return res.end('sourceProjectName and newTitle are required');
                }

                const result = await supabaseRequest(
                    'GET',
                    `/Projects?project_name=eq.${encodeURIComponent(sourceProjectName)}&limit=1`
                );
                if (!Array.isArray(result) || result.length === 0) {
                    res.writeHead(404);
                    return res.end('Source project not found');
                }
                const source = result[0];

                const schoolMatch = sourceProjectName.match(/^(school-[a-z0-9-]+)__/);
                const schoolPrefix = schoolMatch ? schoolMatch[1] : 'school-unknown';
                const langMatch = sourceProjectName.match(/__([A-Z]{2})$/);
                const lang = langMatch ? langMatch[1] : 'FR';
                const newProjectName = `${schoolPrefix}__${newTitle}__${lang}`;

                const sourceProps = source.properties || {};
                const newProps = { ...sourceProps, title: newTitle };

                // Récupérer ou générer le group_id de la source
                const groupId = await resolveOrCreateGroupId(sourceProjectName);

                await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                    project_name:         newProjectName,
                    html:                 source.html,
                    css:                  source.css,
                    project_data:         source.project_data,
                    properties:           newProps,
                    is_original_language: false,
                    page_group_id:        groupId
                });


                if (isSfmcConfigured()) {
                    try {
                        await syncProjectToSfmc({ projectName: newProjectName, fullHtml: source.html });
                    } catch (sfmcErr) {
                        console.error('⚠️  SFMC duplicate sync failed:', sfmcErr.message);
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'Page duplicated!', newProjectName }));
            } catch (e) {
                console.error('❌ /api/pages/duplicate error:', e.message);
                res.writeHead(500);
                return res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Delete a page (CMS) ──────────────────────────────────────────
    if ((req.method === 'POST' && pathname === '/api/pages/delete') || (req.method === 'DELETE' && pathname.startsWith('/api/pages/'))) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                let projectName = '';
                let action = 'trash';
                let reason = '';
                if (req.method === 'POST') {
                    const parsed = JSON.parse(body || '{}');
                    projectName = parsed.projectName;
                    action = parsed.action || 'trash';
                    reason = parsed.reason || '';
                } else {
                    projectName = decodeURIComponent(pathname.replace('/api/pages/', ''));
                }
                
                if (!projectName) {
                    res.writeHead(400);
                    return res.end('projectName is required');
                }

                console.log(`\n🗑️ Cycle de vie page (${action}): "${projectName}"`);
                const result = await updatePageLifecycle(projectName, action, reason);
                if (!result) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Page not found' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result));
            } catch (e) {
                console.error('❌ /api/pages delete error:', e.message);
                res.writeHead(500);
                return res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── AI: Translate Page ───────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/ai/translate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { html, targetLang } = JSON.parse(body);

                // Traduction TEXTE-SEULEMENT : on n'envoie jamais le markup au LLM,
                // on ne traduit que les chaînes de texte puis on les réinjecte dans
                // le HTML intact → classes/styles préservés, design non cassé.
                console.log(`\n🤖 [AI] Demande de traduction vers ${targetLang} (texte seul, markup préservé)...`);
                const translatedHtml = await translateHtml(html, targetLang, process.env.GEMINI_API_KEY_TRANSLATION);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ html: translatedHtml }));
            } catch (e) {
                res.writeHead(500);
                res.end(e.message);
            }
        });
        return;
    }

    // ── Routing: /preview/:projectName ───────────────────────────────
    // On extrait l'école depuis le nom du projet (school-{id}__...) et on injecte
    // ses variables CSS de marque dans le HTML servi, pour que les blocs affichent
    // les couleurs de l'école et non les fallbacks hardcodés.
    if (req.method === 'GET' && pathname.startsWith('/preview/')) {
        try {
            const projectName = decodeURIComponent(pathname.replace('/preview/', ''));
            console.log(`\n👁️ Aperçu projet: "${projectName}"`);

            let html = '';
            // Page bilingue auto-portée : si ≥2 langues, l'aperçu embarque le switch
            // (clic sur .hdr-lang → bascule instantanée, sans serveur).
            const bilingual = await getBilingualHtmlForProject(projectName).catch(e => {
                if (!isMissingContentSchemaError(e)) console.warn('Bilingual preview unavailable:', e.message);
                return null;
            });

            if (bilingual?.html) {
                html = bilingual.html;
            } else {
                const structured = await getCurrentVersionForLegacyProject(projectName).catch(e => {
                    if (!isMissingContentSchemaError(e)) console.warn('Structured preview unavailable:', e.message);
                    return null;
                });

                if (structured?.version?.html) {
                    html = structured.version.html;
                } else {
                    const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
                    if (!result || result.length === 0) {
                        res.writeHead(404);
                        return res.end('Project not found');
                    }
                    html = result[0].html;
                }
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            let finalHtml = ensureFontLinks(rewriteAssetsToRoot(html));

            // Corriger tous les chemins relatifs restants (css/fonts.css, ../assets/...)
            // en forçant la racine de l'URL pour la page de preview.
            if (!finalHtml.includes('<base href=')) {
                finalHtml = finalHtml.replace(/<head>/i, '<head>\n    <base href="/">');
            }

            // ── Injection des variables CSS de l'école ────────────────────────
            // Le HTML stocké contient les couleurs résolues en hex (GrapesJS bake les
            // var() lors de l'édition). On ré-injecte le bloc :root de l'école pour que
            // les blocs utilisant var(--brand-*) affichent les bonnes couleurs.
            try {
                const schoolMatch = /^school-([a-z0-9-]+)__/i.exec(projectName);
                if (schoolMatch) {
                    const previewSchoolId = schoolMatch[1].toLowerCase();
                    const allSchools = await readSchoolsForApi();
                    const previewSchool = allSchools.find(s => s.id === previewSchoolId);
                    if (previewSchool) {
                        const brandStyleTag = buildBrandCssVarsForPreview(previewSchool);
                        // Injecter juste avant </head> (après les styles existants pour
                        // que nos vars aient la priorité sur les fallbacks des blocs).
                        if (/<\/head>/i.test(finalHtml)) {
                            finalHtml = finalHtml.replace(/<\/head>/i, brandStyleTag + '\n</head>');
                        } else {
                            finalHtml = brandStyleTag + finalHtml;
                        }
                        console.log(`🎨 Brand vars injectées pour l'école "${previewSchoolId}" dans la preview`);
                    }
                }
            } catch (brandErr) {
                console.warn('⚠️  Impossible d\'injecter les brand vars dans la preview:', brandErr.message);
            }

            // Ancres stables des formulaires (liens #form_id) — feature/PFE
            finalHtml = ensureFormAnchors(finalHtml).html;

            // Aperçu dashboard : rendu à 1280px centré + logos header compacts (comme l'éditeur).
            finalHtml = injectPreviewViewport(finalHtml);

            // Les ancres (#id) doivent rester sur la page d'aperçu, pas filer à la racine
            // (effet du <base href="/">). On les préfixe par le chemin /preview/<nom-projet>.
            finalHtml = anchorLinksToPagePath(finalHtml, `/preview/${encodeURIComponent(projectName)}`);

            // Répare l'ancrage interne (#id) cassé par le <base href="/"> ci-dessus.
            finalHtml = injectAnchorScrollFix(finalHtml);

            res.end(finalHtml);
        } catch (e) {
            console.log(`❌ Erreur Preview:`, e.message);
            res.writeHead(500);
            res.end('Error: ' + e.message);
        }
        return;
    }

    // ── Public landing URLs: school domain + page slug ────────────────
    if (req.method === 'GET' && pathname !== '/' && !path.extname(pathname)) {
        try {
            const resolved = await resolvePublicPageByHostPath({
                host: req.headers.host,
                path: pathname
            });

            if (resolved?.page) {
                if (resolved.page.status !== 'published') {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('Page not found');
                }

                const publication = getPublicationSettings(resolved.page);
                if (publication.active === false) {
                    if (publication.redirectUrl) {
                        res.writeHead(302, { Location: publication.redirectUrl });
                        return res.end();
                    }
                    res.writeHead(410, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('Page temporairement indisponible');
                }

                if (!resolved.version?.html) {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    return res.end('Page version not found');
                }

                res.writeHead(200, { 'Content-Type': 'text/html' });
let finalPublicHtml = ensureFontLinks(rewriteAssetsToRoot(resolved.version.html));

                if (!finalPublicHtml.includes('<base href=')) {
                    finalPublicHtml = finalPublicHtml.replace(/<head>/i, '<head>\n    <base href="/">');
                }

                // Ancres stables des formulaires (liens #form_id) — feature/PFE
                finalPublicHtml = ensureFormAnchors(finalPublicHtml).html;

                // Les ancres (#id) restent sur la page publiée, pas à la racine (<base href="/">).
                finalPublicHtml = anchorLinksToPagePath(finalPublicHtml, pathname);

                // Répare l'ancrage interne (#id) cassé par le <base href="/"> ci-dessus.
                finalPublicHtml = injectAnchorScrollFix(finalPublicHtml);

                return res.end(finalPublicHtml);
            }
        } catch (e) {
            if (!isMissingContentSchemaError(e)) {
                console.warn('Public landing route unavailable:', e.message);
            }
        }
    }

    // ── Routing: root → school selector, /?school=xxx → builder ──────
    if (req.method === 'GET' && pathname === '/') {
        const schoolParam = params.get('school');
        let filePath;

        if (schoolParam) {
            // If ?school=xxx → serve the builder (index.html)
            filePath = path.join(__dirname, 'index.html');
        } else {
            // No school param → serve the school selector
            filePath = path.join(__dirname, 'school-selector.html');
        }

        fs.readFile(filePath, (error, content) => {
            if (error) {
                res.writeHead(500);
                res.end('Server error');
            } else {
                res.writeHead(200, {
                    'Content-Type': 'text/html',
                    // HTML : jamais mis en cache → recharge toujours la dernière version
                    // des scripts référencés (évite d'avoir à vider le cache navigateur).
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // ── Static files ─────────────────────────────────────────────────
    let filePath = '.' + pathname;
    if (filePath === './') filePath = './school-selector.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Le code applicatif (JS/CSS/HTML/JSON) ne doit jamais être servi depuis le cache
    // navigateur, sinon une modif n'est prise en compte qu'après vidage manuel du cache.
    // Les assets lourds et figés (images, polices, vendor) peuvent rester cachés.
    const noCacheExt = ['.js', '.css', '.html', '.json'];
    const cacheHeaders = noCacheExt.includes(extname)
        ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
        : { 'Cache-Control': 'public, max-age=86400' };

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(error.code == 'ENOENT' ? 404 : 500);
            res.end(error.code == 'ENOENT' ? 'File not found' : 'Server error');
        } else {
            res.writeHead(200, { 'Content-Type': contentType, ...cacheHeaders });
            res.end(content, 'utf-8');
        }
    });

}).listen(port, () => {
    console.log(`✅ Serveur lancé sur http://localhost:${port}/`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
    console.log(`📚 Dashboard: http://localhost:${port}/`);
    console.log(`🔨 Builder direct: http://localhost:${port}/?school=efap`);
});

// ── Scheduler local : équivalent du Vercel Cron ──────────────────────
// Traite périodiquement la file integration_jobs via le cron worker
// (api/cron.js) : nettoyage HTML, publication des images inline dans SFMC,
// remplacement des URLs, puis envoi de la page vers SFMC.
const CRON_INTERVAL_MS = parseInt(process.env.CRON_INTERVAL_MS || '30000', 10);
const cronTimer = setInterval(async () => {
    try {
        const result = await cronHandler({ method: 'GET' }, {
            status() { return this; },
            json(payload) { return payload; }
        });
        if (result && result.error) {
            if (isMissingContentSchemaError({ message: result.error })) {
                console.warn('⏭️  [CRON local] Table integration_jobs absente — scheduler désactivé (traitement inline actif).');
                clearInterval(cronTimer);
            } else {
                console.error('❌ [CRON local] Erreur:', result.error);
            }
        }
    } catch (e) {
        console.error('❌ [CRON local] Erreur:', e.message);
    }
}, CRON_INTERVAL_MS);
