const { supabaseRequest } = require('../../lib/supabase');
const { syncComponentToSfmc, isSfmcConfigured } = require('../../lib/sfmc');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { school_id, name, content, category } = req.body || {};
        
        if (!school_id || !name || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Use a custom request to get the inserted data (representation)
        const supaResult = await supabaseRequest('POST', '/components', {
            school_id,
            name,
            category: category || 'Custom Components',
            content
        }, { 'Prefer': 'resolution=merge-duplicates,return=representation' });

        console.log('📡 Résultat Supabase (Save Component):', JSON.stringify(supaResult));

        let newComponent;
        if (!supaResult || (Array.isArray(supaResult) && supaResult.length === 0)) {
            console.warn('⚠️ Supabase did not return representation. Using fallback.');
            newComponent = {
                id: Date.now(), // Fallback ID if DB doesn't return one
                school_id,
                name,
                category: category || `${school_id.toUpperCase()} Components`,
                content
            };
        } else {
            newComponent = Array.isArray(supaResult) ? supaResult[0] : supaResult;
        }

        // ☁️ SYNC TO SFMC
        let sfmcResult = { skipped: true };
        
        if (isSfmcConfigured()) {
            try {
                sfmcResult = await syncComponentToSfmc({ schoolId: school_id, name, content });
                console.log(`☁️ SFMC Component sync: ${sfmcResult.action} → ${name}`);
            } catch (sfmcErr) {
                console.error(`⚠️ SFMC Component sync failed:`, sfmcErr.message);
            }
        }

        return res.status(200).json({ message: 'Component saved successfully', sfmc: sfmcResult, component: newComponent });
    } catch (e) {
        console.log(`❌ Erreur catch components:`, e.message);
        return res.status(500).json({ error: e.message });
    }
};
