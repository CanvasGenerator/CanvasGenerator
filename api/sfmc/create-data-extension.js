const { createDataExtension } = require('../../lib/sfmc');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { name, fields } = req.body || {};
        if (!name || !fields) {
            return res.status(400).json({ error: 'Missing name or fields' });
        }
        
        const result = await createDataExtension({ name, fields });
        return res.status(200).json(result);
    } catch (e) {
        console.error('❌ Error creating DE:', e.message);
        return res.status(500).json({ error: e.message, payload: e.payload });
    }
};
