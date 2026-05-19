const { createFormAsset } = require('../../lib/sfmc');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { name, schoolId, html, css, ampscript } = req.body || {};
        if (!name || !schoolId || !html) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = await createFormAsset({ name, schoolId, html, css, ampscript });
        return res.status(200).json(result);
    } catch (e) {
        console.error('❌ Error creating Form Asset:', e.message);
        return res.status(500).json({ error: e.message, payload: e.payload });
    }
};
