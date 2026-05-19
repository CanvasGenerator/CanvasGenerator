const { supabaseRequest } = require('../lib/supabase');
const { syncComponentToSfmc, isSfmcConfigured, createDataExtension, createFormAsset, syncProjectToSfmc } = require('../lib/sfmc');
const { readSchools, findSchoolById } = require('../lib/schools');

module.exports = async function handler(req, res) {
    // Ensure CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Vercel rewrites: /api/(.*) -> /api/router?path=/api/$1
    const pathname = req.query.path || req.url.split('?')[0];

    try {
        // ==========================================
        // 1. Pages API (Dashboard)
        // ==========================================
        if (req.method === 'GET' && pathname === '/api/pages') {
            const result = await supabaseRequest('GET', '/Projects?select=project_name,properties,created_at&order=created_at.desc');
            const pages = (result || []).map(p => {
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
                    updated_at:   p.created_at
                };
            });
            return res.status(200).json(pages);
        }

        if (req.method === 'POST' && pathname === '/api/pages/duplicate') {
            const { sourceProjectName, newTitle, newLanguage } = req.body || {};
            // Backwards compatibility with alternative variable names if used elsewhere
            const srcName = sourceProjectName || req.body?.projectName;
            const targetName = newTitle || req.body?.newProjectName;
            
            if (!srcName || !targetName) return res.status(400).json({ error: 'Missing parameters' });
            
            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(srcName)}&limit=1`);
            if (!result || result.length === 0) return res.status(404).json({ error: 'Source project not found' });
            
            const originalProject = result[0];
            const newProps = { ...originalProject.properties };
            if (newLanguage) newProps.language = newLanguage;
            
            const insertResult = await supabaseRequest('POST', '/Projects', {
                project_name: targetName,
                html: originalProject.html,
                css: originalProject.css,
                project_data: originalProject.project_data,
                properties: newProps
            }, { 'Prefer': 'return=representation' });

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
            const { projectName } = req.body || {};
            if (!projectName) return res.status(400).json({ error: 'projectName required' });
            await supabaseRequest('DELETE', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`);
            return res.status(200).json({ message: 'Page deleted' });
        }

        // ==========================================
        // 2. Components API
        // ==========================================
        if (req.method === 'POST' && pathname === '/api/components') {
            const { school_id, name, content, category } = req.body || {};
            const supaResult = await supabaseRequest('POST', '/components', {
                school_id, name, content, category: category || 'Custom Components'
            }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
            
            const newComponent = Array.isArray(supaResult) ? supaResult[0] : (supaResult || { id: Date.now(), school_id, name, content, category });
            let sfmcResult = { skipped: true };
            if (isSfmcConfigured()) {
                try { sfmcResult = await syncComponentToSfmc({ schoolId: school_id, name, content }); } catch (e) {}
            }
            return res.status(200).json({ message: 'Component saved', sfmc: sfmcResult, component: newComponent });
        }

        if (req.method === 'GET' && pathname.startsWith('/api/components/')) {
            const schoolId = decodeURIComponent(pathname.replace('/api/components/', ''));
            const result = await supabaseRequest('GET', `/components?school_id=eq.${encodeURIComponent(schoolId)}`);
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
        // 6. General API (School, Project, Save)
        // ==========================================
        if (req.method === 'GET' && pathname === '/api/schools') {
            return res.status(200).json(readSchools());
        }
        if (req.method === 'GET' && pathname.startsWith('/api/school/')) {
            const s = findSchoolById(pathname.replace('/api/school/', ''));
            return s ? res.status(200).json(s) : res.status(404).json({ error: 'Not found' });
        }
        if (req.method === 'GET' && pathname === '/api/projects') {
            return res.status(200).json(await supabaseRequest('GET', '/Projects?select=project_name,created_at') || []);
        }
        if (req.method === 'GET' && pathname.startsWith('/api/project/')) {
            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(pathname.replace('/api/project/', ''))}&limit=1`);
            return result?.length ? res.status(200).json(result[0]) : res.status(404).json({ error: 'Not found' });
        }
        if (req.method === 'POST' && pathname === '/api/save') {
            const { projectName, html, css, projectData, properties } = req.body || {};
            
            const seoTags = properties ? `
                <meta name="description" content="${properties.seoDescription || ''}">
                <meta name="keywords" content="${properties.keywords || ''}">
                <link rel="canonical" href="${properties.canonical || ''}">
                ${properties.schemaLd ? `<script type="application/ld+json">${properties.schemaLd}</script>` : ''}
            ` : '';

            const title = properties?.seoTitle || properties?.title || projectName;
            const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>${seoTags}<style>${css}</style></head><body>${html}</body></html>`;
            
            await supabaseRequest('POST', '/Projects?on_conflict=project_name', { 
                project_name: projectName, 
                html: fullHtml, 
                css, 
                project_data: JSON.stringify(projectData),
                properties: properties || {}
            });
            return res.status(200).json({ message: 'Saved' });
        }

        // ==========================================
        // 7. Preview API
        // ==========================================
        if (req.method === 'GET' && pathname.startsWith('/preview/')) {
            const projectName = decodeURIComponent(pathname.replace('/preview/', ''));
            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
            
            if (!result || result.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            const project = result[0];
            let html = project.html;

            const schoolMatch = projectName.match(/^school-([a-z0-9-]+)_+/i);
            if (schoolMatch) {
                const schoolId = schoolMatch[1];
                let SCHOOLS = [];
                try { SCHOOLS = require('../schools.json'); } catch(e) {}
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
