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

function buildStoredHtml({ projectName, html = '', css = '', properties = {} }) {
    if (isFullHtmlDocument(html)) return html;

    const title = properties?.seoTitle || properties?.title || projectName || '';
    const seoTags = properties ? `
                <meta name="description" content="${escapeHtml(properties.seoDescription || '')}">
                <meta name="keywords" content="${escapeHtml(properties.keywords || '')}">
                ${properties.canonical ? `<link rel="canonical" href="${escapeHtml(properties.canonical)}">` : ''}
                ${properties.schemaLd ? `<script type="application/ld+json">${properties.schemaLd}</script>` : ''}
            ` : '';

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title>${seoTags}<style>${css}</style></head><body>${html}</body></html>`;
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
    slugify
};
