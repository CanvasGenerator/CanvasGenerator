const { supabaseRequest } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const data = req.body || {};
        // Use upsert logic: if ID is provided, update; otherwise insert.
        const result = await supabaseRequest('POST', '/Forms', data, { 
            'Prefer': 'resolution=merge-duplicates,return=representation' 
        });
        return res.status(200).json(result);
    } catch (e) {
        console.error('❌ Error saving form to Supabase:', e.message);
        return res.status(500).json({ error: e.message });
    }
};
