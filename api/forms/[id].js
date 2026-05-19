const { supabaseRequest } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({ error: 'id parameter is missing' });
    }

    if (req.method === 'GET') {
        try {
            // Here 'id' is actually the 'schoolId' based on the frontend call
            const result = await supabaseRequest('GET', `/Forms?school_id=eq.${encodeURIComponent(id)}&order=created_at.desc`);
            return res.status(200).json(result || []);
        } catch (e) {
            console.error('❌ Error fetching forms:', e.message);
            return res.status(500).json({ error: e.message });
        }
    } 
    else if (req.method === 'DELETE') {
        try {
            // Here 'id' is the primary key of the form
            await supabaseRequest('DELETE', `/Forms?id=eq.${encodeURIComponent(id)}`);
            return res.status(200).json({ message: 'Deleted' });
        } catch (e) {
            console.error('❌ Error deleting form:', e.message);
            return res.status(500).json({ error: e.message });
        }
    } 
    else {
        res.setHeader('Allow', 'GET, DELETE');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
};
