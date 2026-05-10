require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs');
const { syncProjectToSfmc, isSfmcConfigured } = require('./lib/sfmc');

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

async function supabaseRequest(method, endpoint, body = null) {
    const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
    console.log(`📡 Supabase ${method} → ${url}`);
    if (body) console.log(`📦 Body envoyé:`, JSON.stringify(body).substring(0, 200) + '...');

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : ''
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    console.log(`✅ Supabase réponse status: ${response.status}`);

    if (response.status === 204 || response.status === 201) {
        console.log(`✅ Supabase OK (pas de contenu retourné)`);
        return null;
    }

    const result = await response.json();
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

                const supaResult = await supabaseRequest('POST', '/Projects', {
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

                const supaResult = await supabaseRequest('POST', '/components', {
                    school_id,
                    name,
                    category: category || 'Custom Components',
                    content
                });

                if (supaResult && supaResult.code) {
                    console.log(`❌ Erreur Supabase Components:`, supaResult);
                    res.writeHead(500);
                    return res.end('Erreur Supabase: ' + JSON.stringify(supaResult));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Component saved successfully' }));
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