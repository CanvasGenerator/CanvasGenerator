const { supabaseRequest } = require('../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        console.log(`\n📋 CMS: Récupération de toutes les pages (Serverless)`);
        const result = await supabaseRequest(
            'GET',
            '/Projects?select=project_name,properties,created_at&order=created_at.desc'
        );

        if (!Array.isArray(result)) {
            console.error("Supabase returned an error or non-array:", result);
            return res.status(500).json({ error: result.message || 'Failed to fetch pages' });
        }

        const pages = result.map(p => {
            const props = p.properties || {};
            // derive school from prefix school-<id>__
            const schoolMatch = (p.project_name || '').match(/^school-([a-z0-9-]+)__/);
            const school = schoolMatch ? schoolMatch[1].toUpperCase() : '—';
            const parts  = (p.project_name || '').replace(/^school-[a-z0-9-]+__/, '').split('__');
            const displayName = parts[0] || p.project_name;
            const lang = parts[1] || 'FR';
            return {
                project_name: p.project_name,
                title:        props.title || displayName,
                school,
                lang,
                seoTitle:     props.seoTitle || '',
                updated_at:   p.created_at
            };
        });
        
        return res.status(200).json(pages);
    } catch (e) {
        console.error('❌ /api/pages error:', e.message);
        return res.status(500).json({ error: e.message });
    }
};
