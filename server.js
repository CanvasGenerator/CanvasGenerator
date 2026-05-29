require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const { syncProjectToSfmc, isSfmcConfigured, createDataExtension, createFormAsset } = require('./lib/sfmc');
const {
    handleContentRoute,
    syncLegacyProjectToContent,
    listMigratedDashboardPages,
    getCurrentVersionForLegacyProject,
    getStructuredProjectForLegacyProject,
    updatePageLifecycle,
    isMissingContentSchemaError,
    getPublicationSettings,
    resolvePublicPageByHostPath
} = require('./api/content');
const { handleSchoolsRoute } = require('./api/schools');
const { listBlocks, getDefaultBlockIds } = require('./blocks/registry');
const { cleanHtmlForSfmc } = require('./lib/htmlCleaner');

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

function buildStoredHtml({ projectName, html = '', css = '', properties = {} }) {
    const title = properties?.seoTitle || properties?.title || projectName || '';
    const desc = properties?.seoDescription || '';
    const keywords = properties?.keywords || '';
    const canonical = properties?.canonical || '';
    const schemaLd = properties?.schemaLd || '';

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
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    ${seoTags}
    <style>${css}</style>
</head>
<body>${html}</body>
</html>`;
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
        emoji: school.emoji || '🏫',
        deleted: Boolean(school.deleted),
        defaultBlocks: Array.isArray(school.defaultBlocks)
            ? school.defaultBlocks
            : Array.isArray(school.default_blocks)
                ? school.default_blocks
                : []
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
        color_light: school.colorLight,
        emoji: school.emoji,
        default_blocks: school.defaultBlocks,
        deleted: school.deleted
    };
}

async function readSchoolsForApi() {
    const baseSchools = SCHOOLS.map(normalizeSchool);
    try {
        const schools = await supabaseRequest('GET', '/Schools?select=*&order=name.asc');
        if (Array.isArray(schools)) {
            const merged = new Map(baseSchools.map(school => [school.id, school]));
            schools.map(normalizeSchool).forEach(school => {
                if (school.deleted) merged.delete(school.id);
                else merged.set(school.id, school);
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

                const { projectName, html, css, projectData, properties, is_original_language, page_group_id, source_project_name } = data;

                console.log(`\n💾 Sauvegarde projet: "${projectName}"`);

                if (!projectName) {
                    res.writeHead(400);
                    return res.end('Project name is required');
                }

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
                    await supabaseRequest('POST', '/seo_history', {
                        project_name: projectName,
                        properties: properties || {},
                        saved_by: req.headers['x-user'] || null
                    });
                } catch (histErr) {
                    console.warn('⚠️  Impossible d\'enregistrer l\'historique SEO:', histErr.message || histErr);
                }

                const contentSync = await syncLegacyProjectToContent({
                    projectName,
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

                // 3. Tâche en arrière-plan (non-bloquante) pour le nettoyage et l'envoi SFMC
                (async () => {
                    try {
                        console.log(`\n🧹 [BACKGROUND] Nettoyage du HTML pour SFMC...`);
                        const cleanedHtmlForSfmc = cleanHtmlForSfmc(fullHtml);
                        console.log(`✅ [BACKGROUND] Nettoyage terminé (Taille originale: ${fullHtml.length} octets -> Taille nettoyée: ${cleanedHtmlForSfmc.length} octets)`);

                        // Mise à jour de Supabase (Projects) avec html_sfmc
                        await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                            html_sfmc: cleanedHtmlForSfmc
                        });

                        // Mise à jour de page_versions avec html_sfmc
                        if (contentSync && contentSync.versionId) {
                            await supabaseRequest('PATCH', `/page_versions?id=eq.${encodeURIComponent(contentSync.versionId)}`, {
                                html_sfmc: cleanedHtmlForSfmc
                            });
                        }

                        if (isSfmcConfigured()) {
                            console.log(`☁️  [BACKGROUND] Envoi de la version HTML nettoyée à SFMC...`);
                            const sfmcResult = await syncProjectToSfmc({ projectName, fullHtml: cleanedHtmlForSfmc });
                            console.log(
                                `☁️  [BACKGROUND] SFMC sync: ${sfmcResult.action}` +
                                (sfmcResult.name ? ` → "${sfmcResult.name}"` : '') +
                                (sfmcResult.id ? ` (id=${sfmcResult.id})` : '')
                            );
                        } else {
                            console.log('⏭️  [BACKGROUND] SFMC sync skipped (env vars not configured).');
                        }
                    } catch (bgError) {
                        console.error(`❌ [BACKGROUND] Erreur lors de la tâche asynchrone:`, bgError);
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

                // Save new properties to seo_history for auditing / revert
                try {
                    await supabaseRequest('POST', '/seo_history', {
                        project_name: projectName,
                        properties: mergedProperties,
                        saved_by: req.headers['x-user'] || null
                    });
                    console.log(`🗄️  [SEO-SETTINGS] Historique SEO enregistré pour "${projectName}"`);
                } catch (histErr) {
                    console.warn('⚠️  Impossible d\'enregistrer l\'historique SEO:', histErr.message || histErr);
                }

                // 2. Reconstruire le HTML complet avec les nouvelles propriétés SEO
                const baseHtml = mergedProperties.rawHtml || project.html_sfmc || project.html || '';
                const freshHtml = buildStoredHtml({
                    projectName,
                    html: baseHtml,
                    css: project.css || '',
                    properties: mergedProperties
                });

                // 3. Sauvegarder immédiatement → puis répondre à l'utilisateur
                await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                    html: freshHtml,
                    properties: mergedProperties
                });

                console.log(`✅ [SEO-SETTINGS] Propriétés SEO de "${projectName}" mises à jour dans Supabase!`);

                // 4. Réponse immédiate au navigateur (la popup peut se fermer)
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'SEO saved! Background sync started.', projectName }));

                // 5. Tâche en arrière-plan : nettoyage + SFMC + page_versions
                (async () => {
                    try {
                        console.log(`\n🧹 [BACKGROUND/SEO] Nettoyage HTML pour SFMC...`);
                        const cleanedHtml = cleanHtmlForSfmc(freshHtml);
                        console.log(`✅ [BACKGROUND/SEO] Nettoyage terminé (${freshHtml.length} → ${cleanedHtml.length} octets)`);

                        // Mise à jour html_sfmc dans Projects
                        await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                            html_sfmc: cleanedHtml
                        });

                        // Synchronisation avec la table page_versions (Content API)
                        const contentSync = await syncLegacyProjectToContent({
                            projectName,
                            html: freshHtml,
                            html_sfmc: cleanedHtml,
                            css: project.css || '',
                            projectData: project.project_data,
                            properties: mergedProperties
                        });

                        if (isSfmcConfigured()) {
                            console.log(`☁️  [BACKGROUND/SEO] Envoi vers SFMC...`);
                            const sfmcResult = await syncProjectToSfmc({ projectName, fullHtml: cleanedHtml });
                            console.log(`☁️  [BACKGROUND/SEO] SFMC sync: ${sfmcResult.action}` +
                                (sfmcResult.name ? ` → "${sfmcResult.name}"` : '') +
                                (sfmcResult.id   ? ` (id=${sfmcResult.id})`  : ''));
                        } else {
                            console.log('⏭️  [BACKGROUND/SEO] SFMC skipped (non configuré).');
                        }
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
            const result = await supabaseRequest('GET', '/Projects?select=project_name,created_at');
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
                '/Projects?select=project_name,properties,created_at,is_original_language,page_group_id&order=created_at.desc'
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
                        : existing?.page_group_id
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
                
                // Call Gemini Translation API
                const apiKey = process.env.GEMINI_API_KEY_TRANSLATION;
                if (!apiKey) {
                    throw new Error("Clé API de traduction manquante dans l'environnement (GEMINI_API_KEY_TRANSLATION).");
                }

                const prompt = `Translate the following HTML content faithfully into ${targetLang}. 
Preserve all HTML structure, tags, attributes, classes, and IDs exactly as they are. 
Only translate the human-readable text content. 
Adapt the formulations naturally to the target language (do not do a word-for-word translation). 
Return ONLY the raw translated HTML code without any markdown formatting, backticks, or extra text.

HTML to translate:
${html}`;

                console.log(`\n🤖 [AI] Demande de traduction vers ${targetLang}...`);
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.2 }
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error?.message || 'Erreur API Gemini');
                }

                const data = await response.json();
                let translatedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || html;
                
                // Nettoyage des backticks si l'IA en ajoute quand même
                translatedHtml = translatedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '').trim();

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
    if (req.method === 'GET' && pathname.startsWith('/preview/')) {
        try {
            const projectName = decodeURIComponent(pathname.replace('/preview/', ''));
            console.log(`\n👁️ Aperçu projet: "${projectName}"`);

            let html = '';
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

            // Extract school ID from project name (school-xxx__name)
            const schoolMatch = projectName.match(/^school-([a-z0-9-]+)__/);
            if (schoolMatch) {
                const schoolId = schoolMatch[1];
                const school = SCHOOLS.find(s => s.id === schoolId);
                
                if (school) {
                    const primary = school.color || '#3b82f6';
                    const secondary = school.secondaryColor || (schoolId === 'efap' ? '#1a1a1a' : '#2563eb');
                    
                    const brandStyles = `
                        <style id="brand-variables-preview">
                            :root {
                                --brand-primary: ${primary};
                                --brand-secondary: ${secondary};
                            }
                        </style>
                    `;
                    // Inject brand styles into the head
                    html = html.replace('</head>', `${brandStyles}</head>`);
                }
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
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
                return res.end(resolved.version.html);
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
                res.writeHead(200, { 'Content-Type': 'text/html' });
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

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(error.code == 'ENOENT' ? 404 : 500);
            res.end(error.code == 'ENOENT' ? 'File not found' : 'Server error');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

}).listen(port, () => {
    console.log(`✅ Serveur lancé sur http://localhost:${port}/`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
    console.log(`📚 Dashboard: http://localhost:${port}/`);
    console.log(`🔨 Builder direct: http://localhost:${port}/?school=efap`);
});
