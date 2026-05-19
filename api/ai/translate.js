module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { html, targetLang } = req.body || {};
        
        if (!html || !targetLang) {
            return res.status(400).json({ error: 'html and targetLang are required' });
        }

        // Call Gemini Translation API
        const apiKey = process.env.GEMINI_API_KEY_TRANSLATION;
        if (!apiKey) {
            throw new Error("Clé API de traduction manquante dans l'environnement (GEMINI_API_KEY_TRANSLATION).");
        }

        const prompt = `Translate the following HTML content faithfully into ${targetLang}. 
Preserve all HTML structure, tags, attributes, classes, and IDs exactly as they are. 
Only translate the human-readable text content. 
Adapt the formulations naturally to the target language (do not do a word-for-word translation). 
Return ONLY the raw translated HTML code without any markdown formatting, backticks, or extra text.

HTML to translate:
${html}`;

        console.log(`\n🤖 [AI] Demande de traduction vers ${targetLang} (Serverless)...`);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Erreur API Gemini');
        }

        const data = await response.json();
        let translatedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || html;
        
        // Nettoyage des backticks si l'IA en ajoute quand même
        translatedHtml = translatedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '').trim();

        return res.status(200).json({ html: translatedHtml });
    } catch (e) {
        console.error('❌ /api/ai/translate error:', e.message);
        return res.status(500).json({ error: e.message });
    }
};
