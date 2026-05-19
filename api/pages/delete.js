const { supabaseRequest } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { projectName } = req.body || {};
        if (!projectName) {
            return res.status(400).json({ error: 'projectName is required' });
        }

        console.log(`\n🗑️ Suppression page: "${projectName}"`);
        await supabaseRequest('DELETE', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`);
        return res.status(200).json({ message: 'Page deleted' });
    } catch (e) {
        console.error('❌ /api/pages delete error:', e.message);
        return res.status(500).json({ error: e.message });
    }
};
