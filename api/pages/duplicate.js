const { supabaseRequest } = require('../../lib/supabase');
const { syncProjectToSfmc, isSfmcConfigured } = require('../../lib/sfmc');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { sourceProjectName, newTitle } = req.body || {};
        if (!sourceProjectName || !newTitle) {
            return res.status(400).json({ error: 'sourceProjectName and newTitle are required' });
        }

        // Fetch source
        const result = await supabaseRequest(
            'GET',
            `/Projects?project_name=eq.${encodeURIComponent(sourceProjectName)}&limit=1`
        );
        if (!Array.isArray(result) || result.length === 0) {
            return res.status(404).json({ error: 'Source project not found' });
        }
        const source = result[0];

        // Build new project_name: replace display-part only
        const schoolMatch = sourceProjectName.match(/^(school-[a-z0-9-]+)__/);
        const schoolPrefix = schoolMatch ? schoolMatch[1] : 'school-unknown';
        const langMatch = sourceProjectName.match(/__([A-Z]{2})$/);
        const lang = langMatch ? langMatch[1] : 'FR';
        const newProjectName = `${schoolPrefix}__${newTitle}__${lang}`;

        // Copy properties but clear the title so it shows the new name
        const sourceProps = source.properties || {};
        const newProps = { ...sourceProps, title: newTitle };

        await supabaseRequest('POST', '/Projects?on_conflict=project_name', {
            project_name: newProjectName,
            html:         source.html,
            css:          source.css,
            project_data: source.project_data,
            properties:   newProps
        });

        // Sync duplicated page to SFMC
        if (isSfmcConfigured()) {
            try {
                await syncProjectToSfmc({ projectName: newProjectName, fullHtml: source.html });
            } catch (sfmcErr) {
                console.error('⚠️  SFMC duplicate sync failed:', sfmcErr.message);
            }
        }

        return res.status(200).json({ message: 'Page duplicated!', newProjectName });
    } catch (e) {
        console.error('❌ /api/pages/duplicate error:', e.message);
        return res.status(500).json({ error: e.message });
    }
};
