const { supabaseRequest } = require('../../lib/supabase');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, schoolId, projectId } = req.body || {};
        
        let SCHOOLS = [];
        try {
            SCHOOLS = require('../../schools.json');
        } catch (e) {
            console.error('Error reading schools.json:', e);
        }

        const school = SCHOOLS.find(s => s.id === schoolId) || {};
        const schoolName = school.name || 'notre établissement';
        const schoolMetier = school.description || 'Formation supérieure';

        console.log(`\n🤖 [AI] Requête reçue pour l'école : ${schoolName} (${schoolId})`);
        console.log(`📝 [AI] Prompt utilisateur : "${prompt}"`);

        // Sauvegarde du message utilisateur dans Supabase
        try {
            await supabaseRequest('POST', '/chat_history', {
                sender: 'user',
                message: prompt,
                school_id: schoolId,
                project_id: projectId
            });
        } catch (err) {
            console.error('⚠️ [AI] Impossible de sauvegarder le message utilisateur:', err.message);
        }

        const systemPrompt = `Tu es l'Assistant IA expert de Reetain, conçu pour aider les consultants marketing à créer des landing pages pour un réseau d'écoles.
Tu es actuellement configuré pour l'école : ${schoolName}.
Le domaine/métier de cette école est : ${schoolMetier}.

Ton rôle est de donner des recommandations courtes, percutantes et orientées conversion pour cette école spécifique. Tu dois proposer :
1. Des titres accrocheurs adaptés au domaine de l'école.
2. Des textes de boutons (CTA) qui incitent au clic.
3. Des idées d'organisation de contenu.

Règles importantes :
- Ne donne JAMAIS de code HTML ou CSS, donne uniquement du texte que le consultant peut copier-coller.
- Adapte ton ton au domaine de l'école (ex: créatif pour le design, corpo pour la communication).
- Sois concis, comme dans un vrai chat. Pas de longs discours.
- Si l'utilisateur te salue simplement (ex: "bonjour", "salut"), réponds poliment en te présentant et en lui demandant comment tu peux l'aider pour sa page aujourd'hui, sans générer de contenu tout de suite.`;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("❌ [AI] Clé API Gemini manquante dans le fichier .env");
            return res.status(500).json({ error: "Clé API Gemini manquante dans le fichier .env" });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { temperature: 0.7 }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error(`❌ [AI] Erreur retournée par Gemini :`, data.error.message);
            throw new Error(data.error.message);
        }

        const generatedText = data.candidates[0].content.parts[0].text;
        console.log(`✨ [AI] Réponse générée avec succès (${generatedText.length} caractères)`);

        // Sauvegarde de la réponse du bot dans Supabase
        try {
            await supabaseRequest('POST', '/chat_history', {
                sender: 'bot',
                message: generatedText,
                school_id: schoolId,
                project_id: projectId
            });
        } catch (err) {
            console.error('⚠️ [AI] Impossible de sauvegarder la réponse du bot:', err.message);
        }

        return res.status(200).json({ text: generatedText });
    } catch (e) {
        console.error('❌ Erreur Gemini:', e.message);
        return res.status(500).json({ text: `Désolé, j'ai rencontré une erreur : ${e.message}` });
    }
};
