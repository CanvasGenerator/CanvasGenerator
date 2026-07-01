const { syncComponentToSfmc, isSfmcConfigured, createDataExtension, createFormAsset, syncProjectToSfmc } = require('../lib/sfmc');
const { supabaseRequest, buildStoredHtml, buildProjectNameFromSource } = require('../lib/api-shared');
const { handleSchoolsRoute, readSchoolsForApi } = require('./schools');
const { listBlocks, getDefaultBlockIds } = require('../blocks/registry');
const {
    syncLegacyProjectToContent,
    handleContentRoute,
    listMigratedDashboardPages,
    getCurrentVersionForLegacyProject,
    getStructuredProjectForLegacyProject,
    updatePageLifecycle,
    isMissingContentSchemaError,
    getPublicationSettings,
    resolvePublicPageByHostPath
} = require('./content');
const { cleanHtmlForSfmc } = require('../lib/htmlCleaner');

/**
 * Extrait le contenu <body> d'un document HTML complet.
 * Utile pour pouvoir reconstruire le <head> avec des balises SEO à jour.
 */
function extractBodyContent(fullHtml) {
    const match = String(fullHtml || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : fullHtml;
}

/**
 * Tente de créer un job dans integration_jobs.
 * Si la table n'existe pas (env local), exécute le traitement en ligne directement.
 */
async function enqueueOrProcessInline({ projectName, fullHtml, css, projectData, properties, source }) {
    try {
        await supabaseRequest('POST', '/integration_jobs', {
            target:       'sfmc',
            action:       'sync_project',
            status:       'pending',
            payload:      { projectName, html: fullHtml },
            metadata:     { source, enqueuedBy: 'router.js' },
            scheduled_at: new Date().toISOString()
        });
        return { skipped: false, action: 'queued' };
    } catch (e) {
        if (!isMissingContentSchemaError(e)) {
            console.error('Failed to create integration job:', e.message);
            return { skipped: false, action: 'job_failed', error: e.message };
        }
        // ── Fallback local : table absente, traitement immédiat ──────────────
        console.warn('⚠️  [FALLBACK] integration_jobs absente — traitement synchrone en cours...');
        try {
            const cleaned = cleanHtmlForSfmc(fullHtml);
            await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                html_sfmc: cleaned
            });
            await syncLegacyProjectToContent({ projectName, html: fullHtml, html_sfmc: cleaned, css, projectData, properties });
            if (isSfmcConfigured()) await syncProjectToSfmc({ projectName, fullHtml: cleaned });
            return { skipped: false, action: 'processed_inline' };
        } catch (syncErr) {
            console.error('Inline processing failed:', syncErr.message);
            return { skipped: false, action: 'inline_failed', error: syncErr.message };
        }
    }
}

// ── Translation group ID ──────────────────────────────────────────────────
function generateGroupId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function resolveOrCreateGroupId(projectName) {
    try {
        const existing = await supabaseRequest(
            'GET',
            `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=page_group_id&limit=1`
        );
        if (existing?.[0]?.page_group_id) return existing[0].page_group_id;
    } catch (e) {
        console.warn('resolveOrCreateGroupId fetch failed:', e.message);
    }
    const groupId = generateGroupId();
    try {
        await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
            page_group_id:        groupId,
            is_original_language: true
        });
    } catch (e) {
        console.warn('resolveOrCreateGroupId patch failed:', e.message);
    }
    return groupId;
}

// ── Helpers for Declinaison ───────────────────────────────────────────────
const BRAND_HEADER_SELECTORS = [
    'header-efap', 'header-brassart', 'mh-header',
    'footer-efap', 'footer-brassart', 'mf-footer'
];
const BRAND_CAROUSEL_SELECTORS = [
    'mc2a-section', 'mc2b-section', 'mc2c-section',
    'mcva-section', 'mcd-colored-zone', 'mc3c-section', 'mce-section', 'mcb-gray-zone'
];

function patchCssString(css, { colorHeader, primary, secondary, colorCarousel }) {
    if (!css) return css;
    css = css.replace(/var\(--brand-header,\s*[^)]+\)/g, `var(--brand-header, ${colorHeader})`);
    css = css.replace(/var\(--brand-primary,\s*[^)]+\)/g, `var(--brand-primary, ${primary})`);
    css = css.replace(/var\(--brand-secondary,\s*[^)]+\)/g, `var(--brand-secondary, ${secondary})`);
    css = css.replace(/var\(--brand-carousel,\s*[^)]+\)/g, `var(--brand-carousel, ${colorCarousel})`);
    for (const cls of BRAND_HEADER_SELECTORS) {
        css = css.replace(
            new RegExp(`(\\.${cls}\\s*\\{[^}]*?)(background(?:-color)?\\s*:\\s*)([^;!}]+)`, 'gs'),
            (match, prefix, prop, val) => {
                if (val.trim().startsWith('var(')) return match;
                return `${prefix}${prop}var(--brand-header, ${colorHeader})`;
            }
        );
    }
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

function patchComponentTree(components, colorVars) {
    if (!Array.isArray(components)) return components;
    return components.map(comp => {
        const c = { ...comp };
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
        if (Array.isArray(comp.components)) {
            c.components = patchComponentTree(comp.components, colorVars);
        }
        return c;
    });
}

function hexToRgb(hex) {
    if (!hex) return '0,0,0';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0,0,0';
}


module.exports = async function handler(req, res) {
    // Ensure CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Vercel rewrites: /api/(.*) -> /api/router?path=/api/$1
    const pathname = req.query.path || req.url.split('?')[0];

    try {
        if (await handleSchoolsRoute(req, res, pathname)) return;
        if (await handleContentRoute(req, res, pathname)) return;

        if (req.method === 'GET' && pathname === '/api/blocks') {
            return res.status(200).json({
                blocks: listBlocks({ schoolId: req.query.schoolId }),
                defaultBlockIds: getDefaultBlockIds()
            });
        }

        // ==========================================
        // 1. Pages API (Dashboard)
        // ==========================================
        if (req.method === 'GET' && pathname === '/api/pages') {
            const result = await supabaseRequest('GET',     '/Projects?select=project_name,properties,created_at,is_original_language,page_group_id&order=created_at.desc');
            const legacyPages = (result || []).map(p => {
                const props = p.properties || {};
                const schoolMatch = (p.project_name || '').match(/^school-([a-z0-9-]+)_+/i);
                const school = schoolMatch ? schoolMatch[1].toUpperCase() : '—';
                const parts  = (p.project_name || '').replace(/^school-[a-z0-9-]+_+/i, '').split(/_+/);

                // ── Translation tracking from properties ──────────────────────
                const isOriginal = p.is_original_language !== false; // default true if not set
                const pageGroupId = p.page_group_id || null;

                return {
                    project_name:        p.project_name,
                    title:               props.title || parts[0] || p.project_name,
                    school,

                    lang:         parts[1] || 'FR',
                    seoTitle:     props.seoTitle || '',
                    seoDescription: props.seoDescription || '',
                    keywords:     props.keywords || '',
                    canonical:    props.canonical || '',
                    schemaLd:     props.schemaLd || '',
                    updated_at:   p.created_at,
                    source:       'legacy',
                    status:       props.status || 'draft',
                    is_original_language: isOriginal,
                    page_group_id:        pageGroupId,
                    publication:  props.publication || { active: true, redirectUrl: '' }
                };
            });

            let structuredPages = [];
            try {
                structuredPages = await listMigratedDashboardPages();
            } catch (e) {
                if (isMissingContentSchemaError(e)) {
                    console.info('Structured content schema not installed yet; dashboard is using legacy Projects only.');
                } else {
                    console.warn('Structured dashboard pages unavailable, using legacy only:', e.message);
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

            // ── DEBUG: log the full payload so it shows in Network tab ────────
            console.log('[/api/pages] returning', pages.length, 'pages');
            console.log('[/api/pages] sample:', JSON.stringify(pages.slice(0, 2), null, 2));

            return res.status(200).json(pages);
        }

        if (req.method === 'POST' && pathname === '/api/pages/duplicate') {
            const { sourceProjectName, newTitle, newLanguage } = req.body || {};
            const srcName  = sourceProjectName || req.body?.projectName;
            const targetName = buildProjectNameFromSource(srcName, newTitle || req.body?.newProjectName, newLanguage);

            if (!srcName || !targetName) return res.status(400).json({ error: 'Missing parameters' });

            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(srcName)}&limit=1`);
            if (!result || result.length === 0) return res.status(404).json({ error: 'Source project not found' });

            const originalProject = result[0];

            // Récupérer ou générer le group_id de la source
            const groupId = await resolveOrCreateGroupId(srcName);

            // Build props for the translated copy
            const newProps = {
                ...(originalProject.properties || {}),
                is_original_language: false,
                page_group_id:        groupId,
            };
            if (newLanguage) newProps.language = newLanguage;

            const insertResult = await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                project_name: targetName,
                html:         originalProject.html,
                css:          originalProject.css,
                project_data: originalProject.project_data,
                properties:   newProps,
                page_group_id:  groupId
            }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

            if (isSfmcConfigured()) {
                try {
                    await syncProjectToSfmc({ projectName: targetName, fullHtml: originalProject.html });
                } catch (sfmcErr) {
                    console.error('SFMC duplicate sync failed:', sfmcErr.message);
                }
            }

            return res.status(200).json({
                message:  'Project duplicated',
                project:  insertResult ? insertResult[0] : null,
                // ── NEW: expose translation metadata in the response ──────────
                translation_info: {
                    source_project_name: srcName,
                    new_project_name:    targetName,
                    is_original_language: false,
                    page_group_id:       groupId,
                    target_language:     newLanguage || null,
                }
            });
        }

        if (req.method === 'POST' && pathname === '/api/pages/delete') {
            const { projectName, action = 'trash', reason = '' } = req.body || {};
            if (!projectName) return res.status(400).json({ error: 'projectName required' });
            const result = await updatePageLifecycle(projectName, action, reason);
            if (!result) return res.status(404).json({ error: 'Page not found' });
            return res.status(200).json(result);
        }

        // ==========================================
        // 2. Components API
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/components') {
            const { school_id, name, content, category, properties } = req.body || {};
            const normalizedSchoolId = String(school_id || '').toLowerCase();

            const supaResult = await supabaseRequest('POST', '/Component', {
                school_id: normalizedSchoolId,
                name,
                content,
                category: category || 'Custom Components',
                properties: properties || {}
            }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

            const newComponent = Array.isArray(supaResult) ? supaResult[0] : (supaResult || { id: Date.now(), school_id: normalizedSchoolId, name, content, category });
            const sfmcResult = { skipped: true, action: 'disabled' };
            return res.status(200).json({ message: 'Component saved', sfmc: sfmcResult, component: newComponent });
        }

        if (req.method === 'GET' && pathname.startsWith('/api/components/')) {
            const schoolId = decodeURIComponent(pathname.replace('/api/components/', '')).toLowerCase();
            const result = await supabaseRequest('GET', `/Component?school_id=eq.${encodeURIComponent(schoolId)}`);
            return res.status(200).json(result || []);
        }

        // ==========================================
        // 3. Forms API
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/forms/save-to-supabase') {
            const result = await supabaseRequest('POST', '/Forms', req.body || {}, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
            return res.status(200).json(result);
        }

        if (pathname.startsWith('/api/forms/')) {
            const id = pathname.replace('/api/forms/', '');
            if (req.method === 'GET') {
                const result = await supabaseRequest('GET', `/Forms?school_id=eq.${encodeURIComponent(id)}&order=created_at.desc`);
                return res.status(200).json(result || []);
            } else if (req.method === 'DELETE') {
                await supabaseRequest('DELETE', `/Forms?id=eq.${encodeURIComponent(id)}`);
                return res.status(200).json({ message: 'Deleted' });
            }
        }

        // ==========================================
        // 4. SFMC API
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/sfmc/create-data-extension') {
            return res.status(200).json(await createDataExtension(req.body));
        }
        if (req.method === 'POST' && pathname === '/api/sfmc/create-form-asset') {
            return res.status(200).json(await createFormAsset(req.body));
        }

        // ==========================================
        // 5. AI API
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/ai/generate') {
            let SCHOOLS = [];
            try { SCHOOLS = require('../schools.json'); } catch(e) {}
            const { prompt, schoolId, projectId } = req.body || {};
            const school = SCHOOLS.find(s => s.id === schoolId) || {};

            try { await supabaseRequest('POST', '/chat_history', { sender: 'user', message: prompt, school_id: schoolId, project_id: projectId }); } catch(e) {}

            const systemPrompt = `Tu es l'Assistant IA expert de Reetain... Ecole: ${school.name || 'notre établissement'}. Domaine: ${school.description || ''}. Donne des recos courtes.`;
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, generationConfig: { temperature: 0.7 } })
            });
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur AI";
            try { await supabaseRequest('POST', '/chat_history', { sender: 'bot', message: text, school_id: schoolId, project_id: projectId }); } catch(e) {}
            return res.status(200).json({ text });
        }

        if (req.method === 'GET' && pathname === '/api/ai/history') {
            const data = await supabaseRequest('GET', `/chat_history?school_id=eq.${encodeURIComponent(req.query.schoolId)}&order=created_at.asc`);
            return res.status(200).json(data || []);
        }

        if (req.method === 'POST' && pathname === '/api/ai/translate') {
            const { html, targetLang } = req.body || {};
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY_TRANSLATION}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `Translate to ${targetLang}. Preserve HTML. Text: ${html}` }] }] })
            });
            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text || html;
            return res.status(200).json({ html: text.replace(/^```html\s*/i, '').replace(/\s*```$/i, '').trim() });
        }

        // ==========================================
        // 6. FAQ API
        // ==========================================

        // GET /api/faq/render?school_id=X&page_type=Y — FAQs filtrées pour le rendu live
        if (req.method === 'GET' && pathname === '/api/faq/render') {
            const school_id = req.query.school_id;
            const page_type = req.query.page_type;
            if (!school_id) return res.status(400).json({ error: 'school_id requis' });
            const schoolRows = await supabaseRequest('GET', `/Schools?id=eq.${encodeURIComponent(school_id)}&select=show_faq&limit=1`).catch(() => []);
            const school = Array.isArray(schoolRows) ? schoolRows[0] : null;
            if (school && school.show_faq === false) return res.status(200).json([]);
            let url = `/school_page_faq?school_id=eq.${encodeURIComponent(school_id)}&order=sort_order.asc,created_at.asc&select=faq_id,sort_order,faq(id,question,answer)`;
            if (page_type) url += `&page_type=eq.${encodeURIComponent(page_type)}`;
            const rows = await supabaseRequest('GET', url).catch(() => []);
            const faqs = (Array.isArray(rows) ? rows : []).map(r => r.faq).filter(Boolean);
            return res.status(200).json(faqs);
        }

        // GET /api/faq — toute la banque de questions
        if (req.method === 'GET' && pathname === '/api/faq') {
            const result = await supabaseRequest('GET', '/faq?order=created_at.asc');
            return res.status(200).json(result || []);
        }

        // POST /api/faq — créer une question
        if (req.method === 'POST' && pathname === '/api/faq') {
            const { question, answer } = req.body || {};
            if (!question || !answer) return res.status(400).json({ error: 'question et answer requis' });
            const result = await supabaseRequest('POST', '/faq', { question, answer }, { 'Prefer': 'return=representation' });
            return res.status(200).json(Array.isArray(result) ? result[0] : result);
        }

        // PUT /api/faq/:id — modifier une question
        if (req.method === 'PUT' && pathname.startsWith('/api/faq/') && !pathname.startsWith('/api/faq/school/') && pathname !== '/api/faq/render') {
            const id = decodeURIComponent(pathname.replace('/api/faq/', ''));
            const { question, answer } = req.body || {};
            if (!question || !answer) return res.status(400).json({ error: 'question et answer requis' });
            const result = await supabaseRequest('PATCH', `/faq?id=eq.${encodeURIComponent(id)}`, { question, answer, updated_at: new Date().toISOString() }, { 'Prefer': 'return=representation' });
            return res.status(200).json(Array.isArray(result) ? result[0] : result);
        }

        // DELETE /api/faq/:id — supprimer une question
        if (req.method === 'DELETE' && pathname.startsWith('/api/faq/') && !pathname.startsWith('/api/faq/school/') && pathname !== '/api/faq/render') {
            const id = decodeURIComponent(pathname.replace('/api/faq/', ''));
            await supabaseRequest('DELETE', `/faq?id=eq.${encodeURIComponent(id)}`);
            return res.status(200).json({ message: 'FAQ supprimée' });
        }

        // GET /api/faq/school/:schoolId — associations d'une école
        if (req.method === 'GET' && pathname.startsWith('/api/faq/school/') && !pathname.slice('/api/faq/school/'.length).includes('/')) {
            const schoolId = decodeURIComponent(pathname.replace('/api/faq/school/', ''));
            const rows = await supabaseRequest('GET', `/school_page_faq?school_id=eq.${encodeURIComponent(schoolId)}&select=id,faq_id,page_type,sort_order,faq(id,question,answer)&order=sort_order.asc`).catch(() => []);
            return res.status(200).json(Array.isArray(rows) ? rows : []);
        }

        // POST /api/faq/school/:schoolId — ajouter une association
        if (req.method === 'POST' && pathname.startsWith('/api/faq/school/')) {
            const schoolId = decodeURIComponent(pathname.replace('/api/faq/school/', ''));
            const { faq_id, page_type = 'general', sort_order = 0 } = req.body || {};
            if (!faq_id) return res.status(400).json({ error: 'faq_id requis' });
            const result = await supabaseRequest('POST', '/school_page_faq', { school_id: schoolId, faq_id, page_type, sort_order }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
            return res.status(200).json(Array.isArray(result) ? result[0] : result);
        }

        // DELETE /api/faq/school/:schoolId/:linkId — supprimer une association
        if (req.method === 'DELETE' && pathname.startsWith('/api/faq/school/')) {
            const parts = pathname.replace('/api/faq/school/', '').split('/');
            const linkId = parts[1];
            if (!linkId) return res.status(400).json({ error: 'linkId requis' });
            await supabaseRequest('DELETE', `/school_page_faq?id=eq.${encodeURIComponent(linkId)}`);
            return res.status(200).json({ message: 'Association supprimée' });
        }

        // ==========================================
        // 7. General API (Project, Save)
        // ==========================================
        if (req.method === 'GET' && pathname === '/api/projects') {
            return res.status(200).json(await supabaseRequest('GET', '/Projects?select=project_name,created_at') || []);
        }

        if (req.method === 'GET' && pathname.startsWith('/api/project/')) {
            const projectName = pathname.replace('/api/project/', '');
            const structured = await getStructuredProjectForLegacyProject(projectName).catch(e => {
                if (!isMissingContentSchemaError(e)) console.warn('Structured project load unavailable:', e.message);
                return null;
            });
            if (structured) return res.status(200).json(structured);

            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
            return result?.length ? res.status(200).json(result[0]) : res.status(404).json({ error: 'Not found' });
        }

        if (req.method === 'POST' && pathname === '/api/save') {
            const { projectName, html, css, projectData, properties: rawProperties } = req.body || {};
            if (!projectName) return res.status(400).json({ error: 'projectName required' });

            const properties = Object.assign({}, rawProperties || {});
            properties.rawHtml = html;

            // ── Résoudre les flags de traduction ──────────────────────────────
            const existingRow = await supabaseRequest(
                'GET',
                `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=is_original_language,page_group_id&limit=1`
            ).catch(() => null);
            const existingRecord = existingRow?.[0];

            if (properties.is_original_language === false) {
                // Traduction : récupérer le group_id de la page source
                if (existingRecord?.page_group_id) {
                    properties.page_group_id = existingRecord.page_group_id;
                } else if (properties.page_group_id) {
                    properties.page_group_id = await resolveOrCreateGroupId(properties.page_group_id);
                }
            } else {
                // Page originale : conserver ou générer un group_id
                properties.is_original_language = true;
                properties.page_group_id = existingRecord?.page_group_id || generateGroupId();
            }

            // ── Construire le HTML lisible pour l'aperçu (rapide, juste du texte) ──
            const fullHtml = buildStoredHtml({ projectName, html, css, properties });

            // ── Sauvegarde immédiate en BD (sans nettoyage lourd ni sync structurée) ──
            await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                project_name:         projectName,
                html:                 fullHtml,
                html_sfmc:            null, // sera rempli par le cron (ou en ligne si table absente)
                css,
                project_data:         typeof projectData === 'string' ? projectData : JSON.stringify(projectData || {}),
                properties:           properties,
                is_original_language: properties.is_original_language !== false,
                page_group_id:        properties.page_group_id || null
            });

            // ── Log into seo_history (matching server.js behavior) ──
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

            // ── Mise en file d'attente (ou traitement inline si table absente) ──
            const jobResult = await enqueueOrProcessInline({
                projectName, fullHtml, css, projectData, properties,
                source: 'save-api'
            });

            return res.status(200).json({
                message: 'Saved',
                sfmc:    jobResult,
                content: { queued: jobResult.action === 'queued', inline: jobResult.action === 'processed_inline' },
                translation_info: {
                    is_original_language: properties.is_original_language,
                    page_group_id:        properties.page_group_id || null,
                }
            });
        }

        if (req.method === 'POST' && pathname === '/api/save-seo') {
            const { projectName, properties: rawProperties } = req.body || {};
            if (!projectName) return res.status(400).json({ error: 'projectName required' });

            console.log(`\n🔧 [SEO-SETTINGS] Mise à jour SEO pour "${projectName}"`);

            // ── Récupérer le projet existant ─────────────────────────────────────
            const existing = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
            if (!existing || existing.length === 0) {
                return res.status(404).json({ error: 'Projet introuvable' });
            }
            const project = existing[0];
            const mergedProperties = { ...(project.properties || {}), ...(rawProperties || {}) };

            // ── 1. Écrire dans seo_history (source de vérité pour les valeurs SEO) ──
            // On utilise Prefer: return=representation pour forcer un vrai INSERT (pas de merge-duplicates
            // car seo_history n'a pas de contrainte unique sur project_name).
            const seoHistoryProps = { ...mergedProperties };
            delete seoHistoryProps.rawHtml;
            delete seoHistoryProps.page_group_id;
            delete seoHistoryProps.is_original_language;

            await supabaseRequest('POST', '/seo_history', {
                project_name: projectName,
                properties:   seoHistoryProps,
                saved_by:     req.headers['x-user'] || null
            }, { Prefer: 'return=minimal' });
            console.log(`🗄️  [SEO-SETTINGS] Historique SEO enregistré pour "${projectName}"`);

            // ── 2. Reconstruire le HTML avec les nouvelles balises SEO ────────────
            const rawBodyHtml = mergedProperties.rawHtml
                || extractBodyContent(project.html || '');
            const freshHtml = buildStoredHtml({
                projectName,
                html:       rawBodyHtml,
                css:        project.css || '',
                properties: mergedProperties
            });

            // ── 3. Mettre à jour Projects (html + properties) ─────────────────────
            await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                html:       freshHtml,
                html_sfmc:  null,
                properties: mergedProperties
            });

            // ── 4. Mise en file d'attente SFMC ────────────────────────────────────
            const jobResult = await enqueueOrProcessInline({
                projectName,
                fullHtml:    freshHtml,
                css:         project.css || '',
                projectData: project.project_data,
                properties:  mergedProperties,
                source:      'save-seo-api'
            });

            return res.status(200).json({ message: 'SEO saved', sfmc: jobResult, content: { queued: jobResult.action === 'queued', inline: jobResult.action === 'processed_inline' }, projectName });
        }

        if (req.method === 'GET' && pathname === '/api/seo-history') {
            const projectName = req.query.projectName;
            if (!projectName) return res.status(400).json({ error: 'projectName required' });
            const result = await supabaseRequest('GET', `/seo_history?project_name=eq.${encodeURIComponent(projectName)}&order=created_at.desc&limit=5`);
            return res.status(200).json(result || []);
        }

        // ==========================================
        // 7. Déclinaison API (dupliquer master vers plusieurs écoles)
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/decline') {
            const { masterProjectName, schoolIds, projectDisplayName } = req.body || {};

            if (!masterProjectName || !Array.isArray(schoolIds) || schoolIds.length === 0) {
                return res.status(400).json({ error: 'masterProjectName et schoolIds[] requis' });
            }

            // Charger le projet master
            const masterResult = await supabaseRequest(
                'GET',
                `/Projects?project_name=eq.${encodeURIComponent(masterProjectName)}&limit=1`
            );
            if (!masterResult || masterResult.length === 0) {
                return res.status(404).json({ error: 'Projet master introuvable : ' + masterProjectName });
            }
            const master = masterResult[0];
            const baseHtml = master.html || '';
            const baseCss  = master.css  || '';

            // Charger la liste des écoles (Supabase ou fallback JSON)
            const schools = await readSchoolsForApi();

            const displayName = (projectDisplayName || masterProjectName)
                .replace(/^school-[a-z0-9-]+_+/i, '') // retirer éventuel préfixe école
                .trim();

            const results = [];

            for (const schoolId of schoolIds) {
                const school = schools.find(s => s.id === schoolId.toLowerCase());
                const targetProjectName = `school-${schoolId.toLowerCase()}_${displayName}`;

                try {
                    // Injecter les couleurs de marque de l'école dans le HTML copié
                    let schoolHtml = baseHtml;
                    if (school) {
                        const primary   = school.color || '#3b82f6';
                        const secondary = school.secondaryColor || '#2563eb';
                        const brandStyles = `<style id="brand-variables">\n    :root {\n        --brand-primary: ${primary};\n        --brand-secondary: ${secondary};\n    }\n</style>`;
                        // Remplacer un éventuel style brand-variables existant, ou injecter avant </head>
                        if (schoolHtml.includes('id="brand-variables"')) {
                            schoolHtml = schoolHtml.replace(/<style id="brand-variables"[^>]*>[\s\S]*?<\/style>/i, brandStyles);
                        } else {
                            schoolHtml = schoolHtml.replace('</head>', `${brandStyles}\n</head>`);
                        }
                    }

                    const newProperties = {
                        ...(master.properties || {}),
                        school: schoolId.toLowerCase(),
                        declinedFrom: masterProjectName,
                        declinedAt: new Date().toISOString(),
                    };

                    await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                        project_name: targetProjectName,
                        html:         schoolHtml,
                        css:          baseCss,
                        project_data: master.project_data || null,
                        properties:   newProperties,
                    }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

                    results.push({ schoolId, projectName: targetProjectName, status: 'ok' });
                } catch (err) {
                    console.error(`[/api/decline] Erreur pour ${schoolId}:`, err.message);
                    results.push({ schoolId, projectName: targetProjectName, status: 'error', error: err.message });
                }
            }

            return res.status(200).json({
                message: `Déclinaison terminée (${results.filter(r => r.status === 'ok').length}/${schoolIds.length} succès)`,
                results,
            });
        }

        // ==========================================
        // 8. Preview API
        // ==========================================
        if (req.method === 'GET' && pathname.startsWith('/preview/')) {
            const projectName = decodeURIComponent(pathname.replace('/preview/', ''));
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
                    return res.status(404).json({ error: 'Project not found' });
                }
                html = result[0].html;
            }

            const schoolMatch = projectName.match(/^school-([a-z0-9-]+)_+/i);
            if (schoolMatch) {
                const schoolId = schoolMatch[1];
                const schools  = await readSchoolsForApi();
                const school   = schools.find(s => s.id === schoolId);

                if (school) {
                    const primary   = school.color || '#3b82f6';
                    const secondary = school.secondaryColor || (schoolId === 'efap' ? '#1a1a1a' : '#2563eb');
                    const brandStyles = `
                        <style id="brand-variables-preview">
                            :root {
                                --brand-primary: ${primary};
                                --brand-secondary: ${secondary};
                            }
                        </style>
                    `;
                    html = html.replace('</head>', `${brandStyles}</head>`);
                }
            }

            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(html);
        }

        if (req.method === 'GET' && !pathname.startsWith('/api/') && !pathname.includes('.')) {
            const resolved = await resolvePublicPageByHostPath({
                host: req.headers.host,
                path: pathname
            });
            if (resolved?.page) {
                if (resolved.page.status !== 'published') {
                    return res.status(404).send('Page not found');
                }

                const publication = getPublicationSettings(resolved.page);
                if (publication.active === false) {
                    if (publication.redirectUrl) {
                        res.writeHead(302, { Location: publication.redirectUrl });
                        return res.end();
                    }
                    return res.status(410).send('Page temporarily unavailable');
                }

                if (!resolved.version?.html) {
                    return res.status(404).send('Page version not found');
                }

                res.setHeader('Content-Type', 'text/html');
                return res.status(200).send(resolved.version.html);
            }
        }
        // ==========================================
        // 9. Déclinaison API (dupliquer master vers plusieurs écoles)
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/decline') {
            try {
                const { masterProjectName, schoolIds, projectDisplayName } = req.body || {};
                if (!masterProjectName || !Array.isArray(schoolIds) || schoolIds.length === 0) {
                    return res.status(400).json({ error: 'masterProjectName et schoolIds[] requis' });
                }

                // 1. Charger le projet master depuis Supabase
                const masterRows = await supabaseRequest('GET',
                    `/Projects?project_name=eq.${encodeURIComponent(masterProjectName)}&limit=1`);
                if (!masterRows || masterRows.length === 0) {
                    return res.status(404).json({ error: 'Master project not found' });
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
                
                // Extraire la langue
                const langMatch = masterProjectName.match(/__([A-Z]{2})$/i);
                const lang = langMatch ? langMatch[1] : 'FR';

                // 3. Pour chaque école cible
                for (const schoolId of schoolIds) {
                    try {
                        const school = allSchools.find(s => s.id === schoolId.toLowerCase());
                        if (!school) throw new Error(`École "${schoolId}" introuvable`);

                        const schoolName     = school.name || schoolId;
                        const schoolFullName = school.fullName || school.full_name || schoolName;
                        const schoolLogo     = school.logo || '';
                        const primary        = school.color || '#374151';
                        const secondary      = school.secondaryColor || school.secondary_color || '#1a1a1a';
                        const colorHeader    = school.colorHeader || primary;
                        const colorCarousel  = school.colorCarousel || primary;
                        const rgb            = hexToRgb(primary);

                        // Remplacer les placeholders texte dans le HTML
                        let schoolHtml = masterBodyHtml
                            .replace(/NOM_ECOLE/g, schoolName)
                            .replace(/NOM_COMPLET_ECOLE/g, schoolFullName)
                            .replace(/LOGO_ECOLE/g, schoolLogo);

                        // Patcher les balises <style> inline dans le HTML body
                        const colorVarsForHtml = { colorHeader, primary, secondary, colorCarousel };
                        schoolHtml = schoolHtml.replace(
                            /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
                            (_, open, cssContent, close) =>
                                open + patchCssString(cssContent, colorVarsForHtml) + close
                        );

                        // Injecter les CSS vars de l'école en tête du CSS
                        const schoolVars = `:root { --brand-primary: ${primary}; --brand-secondary: ${secondary}; --brand-primary-rgb: ${rgb}; --brand-header: ${colorHeader}; --brand-carousel: ${colorCarousel}; }\n`;
                        // Règles directes à la FIN du CSS pour overrider toute valeur hardcodée
                        const headerOverrides = `\n/* Déclinaison couleur header/footer/carousel → ${schoolId} */\n.mh-header, .header-efap, .header-brassart { background-color: ${colorHeader} !important; background: ${colorHeader} !important; }\n.footer-efap, .footer-brassart, .mf-footer { background-color: ${colorHeader} !important; background: ${colorHeader} !important; }\n.mc2a-section, .mc2b-section, .mc2c-section, .mcva-section, .mcd-colored-zone, .mc3c-section, .mce-section, .mcb-gray-zone { background-color: ${colorCarousel} !important; background: ${colorCarousel} !important; }\n`;
                        const schoolCss  = schoolVars + patchCssString(masterCss, colorVarsForHtml) + headerOverrides;

                        // Construire les propriétés du projet décliné
                        const newProjectName = `school-${schoolId.toLowerCase()}__${displayName.replace(/^school-[a-z0-9-]+_+/i, '').trim()}__${lang}`;
                        const newProps = {
                            ...masterProps,
                            school: schoolId.toLowerCase(),
                            seoTitle: `${schoolName} – ${displayName.replace(/^school-[a-z0-9-]+_+/i, '').trim()}`,
                            title:    `${schoolName} – ${displayName.replace(/^school-[a-z0-9-]+_+/i, '').trim()}`
                        };

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
                        projectDataStr = projectDataStr
                            .replace(/NOM_ECOLE/g, schoolName)
                            .replace(/NOM_COMPLET_ECOLE/g, schoolFullName)
                            .replace(/LOGO_ECOLE/g, schoolLogo);

                        // 2. Remplacement des logos placehold.co dans les src d'images
                        if (schoolLogo) {
                            projectDataStr = projectDataStr.replace(
                                /https?:\/\/placehold\.co\/[^"]*(?:LOGO|logo)[^"]*/g,
                                schoolLogo
                            );
                        }

                        // 3. Post-process les styles GrapesJS
                        let finalProjectData;
                        try {
                            finalProjectData = JSON.parse(projectDataStr);

                            const MASTER_PRIMARY_COLORS = new Set([
                                '#1a1a1a', '#1f2937', '#374151', '#e69b35', '#9b26b6', '#111111', '#000000'
                            ]);
                            const BRAND_BG_PROPS = new Set([
                                'background', 'background-color',
                                'border-color', 'border-bottom-color', 'border-top-color',
                                'border-left-color', 'border-right-color'
                            ]);
                            const HEADER_SELECTORS = new Set([
                                '.header-efap', '.header-brassart', '.mh-header',
                                '.footer-efap', '.footer-brassart'
                            ]);

                            if (Array.isArray(finalProjectData.styles)) {
                                finalProjectData.styles = finalProjectData.styles.map(rule => {
                                    if (!rule.style) return rule;
                                    const newStyle = { ...rule.style };
                                    let changed = false;

                                    const selectorStr = Array.isArray(rule.selectors)
                                        ? rule.selectors.map(s => typeof s === 'string' ? s : (s && s.name ? `.${s.name}` : '')).join('')
                                        : '';
                                    const isHeaderSelector = HEADER_SELECTORS.has(selectorStr);

                                    Object.keys(newStyle).forEach(prop => {
                                        const val = String(newStyle[prop] || '');
                                        if (!val) return;

                                        if (isHeaderSelector && (prop === 'background' || prop === 'background-color')) {
                                            newStyle[prop] = `var(--brand-header, ${colorHeader})`;
                                            changed = true;
                                            return;
                                        }

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

                            if (!Array.isArray(finalProjectData.styles)) finalProjectData.styles = [];
                            finalProjectData.styles = finalProjectData.styles.filter(r => {
                                const sel = r.selectors;
                                return !(Array.isArray(sel) && sel.length === 1 && sel[0] === ':root');
                            });
                            finalProjectData.styles.unshift({
                                selectors: [':root'],
                                style: {
                                    '--brand-primary':     primary,
                                    '--brand-secondary':   secondary,
                                    '--brand-primary-rgb': rgb,
                                    '--brand-header':      colorHeader,
                                    '--brand-carousel':    colorCarousel
                                }
                            });

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

                        // Synchroniser dans le système structuré
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
                    } catch (e) {
                        results.errors.push({ schoolId, message: e.message });
                        console.error(`❌ [decline] ${schoolId}:`, e.message);
                    }
                }

                return res.status(200).json({
                    message: `Déclinaison terminée (${results.success.length}/${schoolIds.length} succès)`,
                    success: results.success,
                    errors: results.errors
                });
            } catch (e) {
                console.error('❌ Erreur /api/decline:', e.message);
                return res.status(500).json({ error: e.message });
            }
        }

        return res.status(404).json({ error: 'API route not found: ' + pathname });

    } catch (e) {
        console.error('API Router Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
