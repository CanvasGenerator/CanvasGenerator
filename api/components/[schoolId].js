const { supabaseRequest } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const schoolId = req.query.schoolId;
        if (!schoolId) {
            return res.status(400).json({ error: 'schoolId is required' });
        }

        const result = await supabaseRequest('GET', `/components?school_id=eq.${encodeURIComponent(schoolId)}`);
        
        return res.status(200).json(result || []);
    } catch (e) {
        console.log(`❌ Erreur catch get components:`, e.message);
        return res.status(500).json({ error: e.message });
    }
};
