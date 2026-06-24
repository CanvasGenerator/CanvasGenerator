const { syncComponentToSfmc, isSfmcConfigured, createDataExtension, createFormAsset, syncProjectToSfmc } = require('../lib/sfmc');
const { supabaseRequest, buildStoredHtml, buildProjectNameFromSource } = require('../lib/api-shared');
const { handleSchoolsRoute, readSchoolsForApi } = require('./schools');
const { listBlocks, getDefaultBlockIds } = require('../blocks/registry');
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

        // ==========================================
        // FAQ API
        // ==========================================

        // Endpoint de rendu : retourne les FAQs à afficher pour une école + page_type
        // Utilisé par le composant Accordion dans les landing pages générées.
        // Vérifie aussi que show_faq=true pour l'école concernée.
        if (req.method === 'GET' && pathname === '/api/faq/render') {
            const { school_id, page_type } = req.query || {};
            if (!school_id) return res.status(400).json({ error: 'school_id requis' });

            // Vérifier que la FAQ est activée pour cette école
            const schoolRows = await supabaseRequest('GET', `/Schools?id=eq.${encodeURIComponent(school_id)}&select=show_faq&limit=1`).catch(() => []);
            const school = Array.isArray(schoolRows) ? schoolRows[0] : null;
            if (school && school.show_faq === false) return res.status(200).json([]);

            // Charger les FAQs associées à cette école + page_type, jointes à la banque globale
            let url = `/school_page_faq?school_id=eq.${encodeURIComponent(school_id)}&order=sort_order.asc,created_at.asc&select=faq_id,sort_order,faq(id,question,answer)`;
            if (page_type) url += `&page_type=eq.${encodeURIComponent(page_type)}`;
            const rows = await supabaseRequest('GET', url).catch(() => []);
            const faqs = (Array.isArray(rows) ? rows : [])
                .map(r => r.faq)
                .filter(Boolean);
            return res.status(200).json(faqs);
        }

        // Banque globale — liste toutes les FAQs
        if (req.method === 'GET' && pathname === '/api/faq') {
            const result = await supabaseRequest('GET', '/faq?order=created_at.asc');
            return res.status(200).json(result || []);
        }

        // Banque globale — créer une FAQ
        if (req.method === 'POST' && pathname === '/api/faq') {
            const { question, answer } = req.body || {};
            if (!question || !answer) return res.status(400).json({ error: 'question et answer requis' });
            const result = await supabaseRequest('POST', '/faq', { question, answer }, { 'Prefer': 'return=representation' });
            return res.status(200).json(Array.isArray(result) ? result[0] : result);
        }

        // Banque globale — modifier une FAQ
        if (req.method === 'PUT' && pathname.startsWith('/api/faq/') && !pathname.startsWith('/api/faq/school/') && pathname !== '/api/faq/render') {
            const id = pathname.replace('/api/faq/', '');
            const { question, answer } = req.body || {};
            if (!question || !answer) return res.status(400).json({ error: 'question et answer requis' });
            const result = await supabaseRequest('PATCH', `/faq?id=eq.${encodeURIComponent(id)}`, { question, answer, updated_at: new Date().toISOString() }, { 'Prefer': 'return=representation' });
            return res.status(200).json(Array.isArray(result) ? result[0] : result);
        }

        // Banque globale — supprimer une FAQ
        if (req.method === 'DELETE' && pathname.startsWith('/api/faq/') && !pathname.startsWith('/api/faq/school/') && pathname !== '/api/faq/render') {
            const id = pathname.replace('/api/faq/', '');
            await supabaseRequest('DELETE', `/faq?id=eq.${encodeURIComponent(id)}`);
            return res.status(200).json({ message: 'FAQ supprimée' });
        }

        // Associations école — liste les liaisons school_page_faq pour une école
        // Retourne aussi les détails FAQ pour l'affichage dans le modal admin
        if (req.method === 'GET' && pathname.startsWith('/api/faq/school/')) {
            const schoolId = pathname.replace('/api/faq/school/', '');
            const rows = await supabaseRequest('GET', `/school_page_faq?school_id=eq.${encodeURIComponent(schoolId)}&select=id,faq_id,page_type,sort_order,faq(id,question,answer)&order=sort_order.asc`).catch(() => []);
            return res.status(200).json(Array.isArray(rows) ? rows : []);
        }

        // Associations école — ajouter une liaison FAQ ↔ école + page_type
        if (req.method === 'POST' && pathname.startsWith('/api/faq/school/')) {
            const schoolId = pathname.replace('/api/faq/school/', '');
            const { faq_id, page_type = 'general', sort_order = 0 } = req.body || {};
            if (!faq_id) return res.status(400).json({ error: 'faq_id requis' });
            const result = await supabaseRequest('POST', '/school_page_faq', {
                school_id: schoolId, faq_id, page_type, sort_order
            }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
            return res.status(200).json(Array.isArray(result) ? result[0] : result);
        }

        // Associations école — supprimer une liaison (par id de la ligne school_page_faq)
        if (req.method === 'DELETE' && pathname.startsWith('/api/faq/school/')) {
            const parts = pathname.replace('/api/faq/school/', '').split('/');
            // DELETE /api/faq/school/:schoolId/:linkId
            const linkId = parts[1];
            if (!linkId) return res.status(400).json({ error: 'linkId requis' });
            await supabaseRequest('DELETE', `/school_page_faq?id=eq.${encodeURIComponent(linkId)}`);
            return res.status(200).json({ message: 'Association supprimée' });
        }

        // ==========================================

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
            if (lang === 'FR') {
                localStorage.setItem(`reetain-builder__${schoolId}__originalFullName`, fullName);
            }

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
        // 6. General API (Project, Save)
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
            console.log(`🗄️  [SEO-SETTINGS] Historique SEO 