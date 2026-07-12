/**
 * Traduction de pages qui NE CASSE PAS le design.
 *
 * Principe : on n'envoie JAMAIS le markup (balises/classes/styles) au LLM.
 * On extrait uniquement le TEXTE visible (nœuds texte + attributs traduisibles)
 * avec cheerio, on traduit ces chaînes via Gemini, puis on réinjecte les
 * traductions dans les mêmes nœuds. Le HTML (classes, id, style, structure)
 * reste rigoureusement identique → le CSS continue de matcher → design intact.
 *
 * Utilisé par server.js (local) et api/router.js (Vercel) via /api/ai/translate.
 */
const cheerio = require('cheerio');

// Contenu à NE PAS traduire (code / technique).
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'code', 'pre', 'kbd', 'samp']);
// Attributs porteurs de texte visible par l'utilisateur.
const TRANSLATABLE_ATTRS = ['placeholder', 'alt', 'title', 'aria-label', 'aria-placeholder'];
// Au moins une lettre (Unicode) → sinon on ne traduit pas (nombres, symboles, •, →…).
const HAS_LETTER = /\p{L}/u;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function isFullDocument(html) {
    return /<!doctype/i.test(html) || /<html[\s>]/i.test(html);
}

/**
 * Parcourt l'arbre et collecte les cibles traduisibles.
 * Chaque cible expose { text } (chaîne source) et apply(traduction).
 */
function collectTargets($) {
    const targets = [];

    (function walk(node) {
        const children = node.children || [];
        for (const child of children) {
            if (child.type === 'text') {
                const raw = child.data || '';
                const trimmed = raw.trim();
                if (trimmed && HAS_LETTER.test(trimmed)) {
                    // On conserve les espaces de début/fin (mise en page inline).
                    const lead = raw.slice(0, raw.length - raw.trimStart().length);
                    const trail = raw.slice(raw.trimEnd().length);
                    targets.push({ text: trimmed, apply: t => { child.data = lead + t + trail; } });
                }
            } else if (child.type === 'tag' && !SKIP_TAGS.has(child.name)) {
                walk(child);
            }
        }
    })($.root()[0]);

    // Attributs traduisibles
    TRANSLATABLE_ATTRS.forEach(attr => {
        $(`[${attr}]`).each((_, el) => {
            const val = ($(el).attr(attr) || '').trim();
            if (val && HAS_LETTER.test(val)) {
                targets.push({ text: val, apply: t => $(el).attr(attr, t) });
            }
        });
    });

    // Meta description / Open Graph (texte SEO visible dans les partages)
    $('meta[name="description"], meta[property="og:title"], meta[property="og:description"]').each((_, el) => {
        const val = ($(el).attr('content') || '').trim();
        if (val && HAS_LETTER.test(val)) {
            targets.push({ text: val, apply: t => $(el).attr('content', t) });
        }
    });

    return targets;
}

/**
 * Traduit un lot de chaînes via Gemini en JSON (structured output).
 * Renvoie un tableau de MÊME longueur/ordre que l'entrée.
 */
async function translateBatch(strings, targetLang, apiKey, fetchImpl) {
    const prompt = `You are a professional translator. Translate each element of the following JSON array of UI strings into ${targetLang}.
Rules:
- Return ONLY a JSON array of strings, with EXACTLY the same length and the same order as the input.
- Translate each element independently. Never merge, split, add or remove elements.
- Keep unchanged: numbers, URLs, email addresses, and template tokens such as {{name}}, %%field%%, {name}.
- Adapt naturally to the target language (not word-for-word).
- No markdown, no backticks, no comments.

${JSON.stringify(strings)}`;

    const response = await fetchImpl(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Erreur API Gemini');
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let arr;
    try { arr = JSON.parse(text); }
    catch (e) { throw new Error('Réponse de traduction invalide (JSON illisible).'); }
    if (!Array.isArray(arr) || arr.length !== strings.length) {
        throw new Error('Réponse de traduction incohérente (nombre de segments différent).');
    }
    return arr.map((x, i) => (typeof x === 'string' ? x : (x == null ? strings[i] : String(x))));
}

/**
 * Traduit un ensemble de chaînes uniques par lots (fiabilité + tokens).
 */
async function translateStrings(uniqueStrings, targetLang, apiKey, fetchImpl, chunkSize = 60) {
    const out = [];
    for (let i = 0; i < uniqueStrings.length; i += chunkSize) {
        const chunk = uniqueStrings.slice(i, i + chunkSize);
        out.push(...await translateBatch(chunk, targetLang, apiKey, fetchImpl));
    }
    return out;
}

/**
 * Traduit le HTML sans jamais toucher au markup.
 * @param {string} html      HTML (fragment GrapesJS OU document complet)
 * @param {string} targetLang Langue cible (ex. "EN", "ES", "English")
 * @param {string} apiKey     Clé Gemini
 * @param {function} [fetchImpl] fetch (défaut: global fetch)
 * @returns {Promise<string>} HTML traduit, markup identique
 */
async function translateHtml(html, targetLang, apiKey, fetchImpl = globalThis.fetch) {
    if (!apiKey) throw new Error("Clé API de traduction manquante (GEMINI_API_KEY_TRANSLATION).");
    if (!html || !targetLang) return html;

    const $ = cheerio.load(html, null, isFullDocument(html));
    const targets = collectTargets($);
    if (!targets.length) return html;

    // Déduplication : mêmes chaînes → une seule traduction (cohérence + moins de tokens).
    const unique = [...new Set(targets.map(t => t.text))];
    const translated = await translateStrings(unique, targetLang, apiKey, fetchImpl);
    const map = new Map(unique.map((s, i) => [s, translated[i]]));

    targets.forEach(t => t.apply(map.get(t.text) ?? t.text));
    return $.html();
}

module.exports = { translateHtml, collectTargets, isFullDocument };
