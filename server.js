require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs');
const { syncProjectToSfmc, isSfmcConfigured, createDataExtension, createFormAsset } = require('./lib/sfmc');

const port = process.env.PORT || 8000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Variables SUPABASE_URL ou SUPABASE_KEY manquantes dans .env');
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

// ── Parse URL helper ─────────────────────────────────────────────────
function parseUrl(reqUrl) {
    const qIdx = reqUrl.indexOf('?');
    const pathname = qIdx >= 0 ? reqUrl.substring(0, qIdx) : reqUrl;
    const search = qIdx >= 0 ? reqUrl.substring(qIdx) : '';
    const params = new URLSearchParams(search);
    return { pathname, params };
}

http.createServer(async (req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const { pathname, params } = parseUrl(req.url);

    // ── API: List schools ────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/schools') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(SCHOOLS));
    }

    // ── API: Get a single school config ──────────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/school/')) {
        const schoolId = decodeURIComponent(pathname.replace('/api/school/', ''));
        const school = SCHOOLS.find(s => s.id === schoolId);
        if (!school) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'School not found' }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(school));
    }

    // ── API: Save project ────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/save') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { projectName, html, css, projectData } = data;

                console.log(`\n💾 Sauvegarde projet: "${projectName}"`);

                if (!projectName) {
                    res.writeHead(400);
                    return res.end('Project name is required');
                }

                const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>${css}</style>
</head>
<body>${html}</body>
</html>`;

                const supaResult = await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
                    project_name: projectName,
                    html: fullHtml,
                    css: css,
                    project_data: JSON.stringify(projectData)
                });

                if (supaResult && supaResult.code) {
                    console.log(`❌ Erreur Supabase:`, supaResult);
                    res.writeHead(500);
                    return res.end('Erreur Supabase: ' + JSON.stringify(supaResult));
                }

                console.log(`✅ Projet "${projectName}" sauvegardé avec succès!`);

                // Save project into SFMC Content
                let sfmcResult = { skipped: true, action: 'skipped' };
                if (isSfmcConfigured()) {
                    try {
                        sfmcResult = await syncProjectToSfmc({ projectName, fullHtml });
                        console.log(
                            `☁️  SFMC sync: ${sfmcResult.action}` +
                            (sfmcResult.name ? ` → "${sfmcResult.name}"` : '') +
                            (sfmcResult.id ? ` (id=${sfmcResult.id})` : '')
                        );
                    } catch (sfmcErr) {
                        console.error('⚠️  SFMC sync failed:', sfmcErr.code || '', sfmcErr.message, sfmcErr.payload || '');
                        sfmcResult = {
                            skipped: false,
                            action: 'failed',
                            error: sfmcErr.message,
                            code: sfmcErr.code,
                            status: sfmcErr.status,
                            details: sfmcErr.payload
                        };
                    }
                } else {
                    console.log('⏭️  SFMC sync skipped (env vars not configured).');
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Project saved!', projectName, sfmc: sfmcResult }));

            } catch (e) {
                console.log(`❌ Erreur catch:`, e.message);
                res.writeHead(500);
                res.end('Error: ' + e.message);
            }
        });
        return;
    }

    // ── API: Save component ──────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/api/components') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { school_id, name, category, content } = data;

                if (!school_id || !name || !content) {
                    res.writeHead(400);
                    return res.end('Missing required fields');
                }

                // Use a custom request to get the inserted data (representation)
                const supaResult = await supabaseRequest('POST', '/components', {
                    school_id,
                    name,
                    category: category || 'Custom Components',
                    content
                }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

                console.log('📡 Résultat Supabase (Save Component):', JSON.stringify(supaResult));

                let newComponent;
                if (!supaResult || (Array.isArray(supaResult) && supaResult.length === 0)) {
                    console.warn('⚠️ Supabase did not return representation. Using fallback.');
                    newComponent = {
                        id: Date.now(), // Fallback ID if DB doesn't return one
                        school_id,
                        name,
                        category: category || `${school_id.toUpperCase()} Components`,
                        content
                    };
                } else {
                    newComponent = Array.isArray(supaResult) ? supaResult[0] : supaResult;
                }

                // ☁️ SYNC TO SFMC
                const { syncComponentToSfmc, isSfmcConfigured } = require('./lib/sfmc');
                let sfmcResult = { skipped: true };
                
                if (isSfmcConfigured()) {
                    try {
                        sfmcResult = await syncComponentToSfmc({ schoolId: school_id, name, content });
                        console.log(`☁️ SFMC Component sync: ${sfmcResult.action} → ${name}`);
                    } catch (sfmcErr) {
                        console.error(`⚠️ SFMC Component sync failed:`, sfmcErr.message);
                    }
                }

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
            const schoolId = decodeURIComponent(pathname.replace('/api/components/', ''));
            const result = await supabaseRequest('GET', `/components?school_id=eq.${encodeURIComponent(schoolId)}`);
            
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

            // Fetch project
            const result = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&limit=1`);
            
            if (!result || result.length === 0) {
                res.writeHead(404);
                return res.end('Project not found');
            }

            const project = result[0];
            let html = project.html;

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