const { supabaseRequest } = require('../lib/supabase');
const { syncProjectToSfmc, isSfmcConfigured } = require('../lib/sfmc');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { projectName, html, css, projectData } = req.body || {};

        if (!projectName) {
            return res.status(400).json({ error: 'Project name is required' });
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

        // created_at is intentionally not sent: on first insert the DB default
        // sets it; on upsert (merge-duplicates) the existing value is preserved.
        await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
            project_name: projectName,
            html: fullHtml,
            css,
            project_data: JSON.stringify(projectData)
        });

        // Save project into SFMC Content Builder.
        let sfmcResult = { skipped: true, action: 'skipped' };
        if (isSfmcConfigured()) {
            try {
                sfmcResult = await syncProjectToSfmc({ projectName, fullHtml });
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
        }

        return res.status(200).json({ message: 'Project saved!', projectName, sfmc: sfmcResult });
    } catch (e) {
        if (e.code === 'ENV_MISSING') {
            return res.status(500).json({ error: 'Server misconfigured: Supabase credentials missing' });
        }
        if (e.code === 'SUPABASE_HTTP_ERROR') {
            return res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({
                error: 'Supabase rejected the request',
                details: e.payload
            });
        }
        return res.status(500).json({ error: e.message });
    }
};
