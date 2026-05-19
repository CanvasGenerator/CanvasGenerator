const { supabaseRequest } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const schoolId = req.query.schoolId;
        if (!schoolId) {
            return res.status(400).json({ error: 'schoolId missing' });
        }

        console.log(`\n📜 [AI] Récupération de l'historique pour l'école: ${schoolId}`);
        const data = await supabaseRequest('GET', `/chat_history?school_id=eq.${encodeURIComponent(schoolId)}&order=created_at.asc`);
        
        return res.status(200).json(data || []);
    } catch (e) {
        console.error("❌ [AI] Erreur lors de la récupération de l'historique:", e.message);
        return res.status(500).json({ error: e.message });
    }
};
