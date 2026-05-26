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
    isMissingContentSchemaError
} = require('./content');
const { cleanHtmlForSfmc } = require('../lib/htmlCleaner');

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
            const result = await supabaseRequest('GET', '/Projects?select=project_name,properties,created_at&order=created_at.desc');
            const legacyPages = (result || []).map(p => {
                const props = p.properties || {};
                const schoolMatch = (p.project_name || '').match(/^school-([a-z0-9-]+)_+/i);
                const school = schoolMatch ? schoolMatch[1].toUpperCase() : '—';
                const parts  = (p.project_name || '').replace(/^school-[a-z0-9-]+_+/i, '').split(/_+/);
                return {
                    project_name: p.project_name,
                    title:        props.title || parts[0] || p.project_name,
                    school,
                    lang:         parts[1] || 'FR',
                    seoTitle:     props.seoTitle || '',
                    seoDescription: props.seoDescription || '',
                    updated_at:   p.created_at,
                    source:       'legacy',
                    status:       props.status || 'draft'
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
            structuredPages.forEach(page => merged.set(page.project_name, page));

            return res.status(200).json([...merged.values()].sort((a, b) => {
                return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            }));
        }

        if (req.method === 'POST' && pathname === '/api/pages/duplicate') {
            const { sourceProjectName, newTitle, newLanguage } = req.body || {};
            // Backwards compatibility with alternative variable names if used elsewhere
            const srcName = sourceProjectName || req.body?.projectName;
            const targetName = buildProjectNameFromSource(srcName, newTitle || req.body?.newProjectName, newLanguage);
            
            if (!srcName || !targetName) return res.status(400).json({ error: 'Missing parameters' });
            
            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(srcName)}&limit=1`);
            if (!result || result.length === 0) return res.status(404).json({ error: 'Source project not found' });
            
            const originalProject = result[0];
            const newProps = { ...originalProject.properties };
            if (newLanguage) newProps.language = newLanguage;
            
            const insertResult = await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                project_name: targetName,
                html: originalProject.html,
                css: originalProject.css,
                project_data: originalProject.project_data,
                properties: newProps
            }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

            if (isSfmcConfigured()) {
                try {
                    await syncProjectToSfmc({ projectName: targetName, fullHtml: originalProject.html });
                } catch (sfmcErr) {
                    console.error('SFMC duplicate sync failed:', sfmcErr.message);
                }
            }

            return res.status(200).json({ message: 'Project duplicated', project: insertResult ? insertResult[0] : null });
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
            // Re-using logic from generate.js
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

            // Keep the raw editor HTML for auditing/rollback/post-processing
            const properties = Object.assign({}, rawProperties || {});
            properties.rawHtml = html;

            // Build the stored/optimized HTML (includes SEO tags, CSS inlined, etc.)
            const fullHtml = buildStoredHtml({ projectName, html, css, properties });

            console.log(`\n🧹 [SEO] Nettoyage du HTML pour SFMC (Vercel Route)...`);
            const cleanedHtmlForSfmc = cleanHtmlForSfmc(fullHtml);
            console.log(`✅ [SEO] Nettoyage terminé (Taille originale: ${fullHtml.length} octets -> Taille nettoyée: ${cleanedHtmlForSfmc.length} octets)`);

            await supabaseRequest('POST', '/Projects?on_conflict=project_name', { 
                project_name: projectName, 
                html: fullHtml, 
                html_sfmc: cleanedHtmlForSfmc,
                css, 
                project_data: typeof projectData === 'string' ? projectData : JSON.stringify(projectData || {}),
                properties: properties || {}
            });

            const contentSync = await syncLegacyProjectToContent({
                projectName,
                html: fullHtml,
                html_sfmc: cleanedHtmlForSfmc,
                css,
                projectData,
                properties
            });

            // Instead of synchronously calling SFMC (which blocks the user),
            // enqueue an integration job so a background worker can post-process
            // and send the OPTIMIZED `fullHtml` to SFMC. This keeps the save fast.
            let sfmcResult = { skipped: true, action: 'skipped' };
            if (isSfmcConfigured()) {
                try {
                    await supabaseRequest('POST', '/integration_jobs', {
                        target: 'sfmc',
                        action: 'sync_project',
                        status: 'pending',
                        payload: { projectName },
                        metadata: { source: 'save-api', enqueuedBy: 'router.js' },
                        scheduled_at: new Date().toISOString()
                    });
                    sfmcResult = { skipped: false, action: 'queued' };
                } catch (e) {
                    console.error('Failed to create SFMC integration job:', e.message);
                    sfmcResult = { skipped: false, action: 'job_failed', error: e.message };
                }
            }

            return res.status(200).json({ message: 'Saved', sfmc: sfmcResult, content: contentSync });
        }

        if (req.method === 'POST' && pathname === '/api/save-seo') {
            const { projectName, properties: rawProperties } = req.body || {};
            if (!projectName) return res.status(400).json({ error: 'projectName required' });

            console.log(`\n🔧 [SEO-SETTINGS] Mise à jour SEO pour "${projectName}" (Vercel Route)`);

            let project = await getStructuredProjectForLegacyProject(projectName).catch(e => {
                if (!isMissingContentSchemaError(e)) console.warn('Structured project load unavailable:', e.message);
                return null;
            });

            if (!project) {
                const existing = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
                if (!existing || existing.length === 0) {
                    return res.status(404).json({ error: 'Projet introuvable' });
                }
                project = existing[0];
            }

            const mergedProperties = { ...(project.properties || {}), ...(rawProperties || {}) };

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

            const baseHtml = mergedProperties.rawHtml || project.html_sfmc || project.html || '';
            const freshHtml = buildStoredHtml({
                projectName,
                html: baseHtml,
                css: project.css || '',
                properties: mergedProperties
            });

            const cleanedHtml = cleanHtmlForSfmc(freshHtml);

            await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                html: freshHtml,
                html_sfmc: cleanedHtml,
                properties: mergedProperties
            });

            const contentSync = await syncLegacyProjectToContent({
                projectName,
                html: freshHtml,
                html_sfmc: cleanedHtml,
                css: project.css || '',
                projectData: project.project_data,
                properties: mergedProperties
            });

            let sfmcResult = { skipped: true, action: 'skipped' };
            if (isSfmcConfigured()) {
                try {
                    await supabaseRequest('POST', '/integration_jobs', {
                        target: 'sfmc',
                        action: 'sync_project',
                        status: 'pending',
                        payload: { projectName },
                        metadata: { source: 'save-seo-api', enqueuedBy: 'router.js' },
                        scheduled_at: new Date().toISOString()
                    });
                    sfmcResult = { skipped: false, action: 'queued' };
                } catch (e) {
                    console.error('Failed to create SFMC integration job:', e.message);
                    sfmcResult = { skipped: false, action: 'job_failed', error: e.message };
                }
            }

            return res.status(200).json({ message: 'SEO saved', sfmc: sfmcResult, content: contentSync, projectName });
        }

        if (req.method === 'GET' && pathname === '/api/seo-history') {
            const projectName = req.query.projectName;
            if (!projectName) return res.status(400).json({ error: 'projectName required' });

            const result = await supabaseRequest('GET', `/seo_history?project_name=eq.${encodeURIComponent(projectName)}&order=created_at.desc&limit=5`);
            return res.status(200).json(result || []);
        }

        // ==========================================
        // 7. Preview API
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
                const schools = await readSchoolsForApi();
                const school = schools.find(s => s.id === schoolId);
                
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
                    html = html.replace('</head>', `${brandStyles}</head>`);
                }
            }

            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(html);
        }

        return res.status(404).json({ error: 'API route not found: ' + pathname });

    } catch (e) {
        console.error('?O API Router Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
