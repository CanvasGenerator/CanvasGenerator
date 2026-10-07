/**
 * FAQ multilingue : une base par langue.
 *
 * Chaque question de la table `faq` porte une `language` (FR, EN…). Une
 * question EN créée par traduction garde un lien vers sa question FR d'origine
 * (`source_faq_id`). Ce lien sert uniquement :
 *   • à ne pas retraduire ce qui l'a déjà été ;
 *   • à basculer un bloc FAQ FR vers ses équivalents EN lors de la
 *     duplication d'une page vers l'anglais.
 * Une fois créée, la question EN vit sa vie : la modifier ou la supprimer ne
 * touche jamais la base FR, et on peut ajouter des questions EN sans
 * équivalent FR.
 *
 * Les associations école ↔ question (`school_page_faq`) restent les mêmes
 * pour toutes les langues : une école a des questions FR ET des questions EN.
 */

const { supabaseRequest } = require('./supabase');
const { translateStrings } = require('./translate');
const { writeWithAudit } = require('./audit');

const DEFAULT_FAQ_LANG = 'FR';
const FAQ_FIELDS = 'id,question,answer,language,source_faq_id';

function normalizeFaqLang(lang) {
    const value = String(lang || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(value) ? value : '';
}

/** Toute la banque, ou seulement une langue. */
async function listFaqs(lang) {
    const language = normalizeFaqLang(lang);
    const filter = language ? `&language=eq.${encodeURIComponent(language)}` : '';
    const rows = await supabaseRequest('GET', `/faq?select=${FAQ_FIELDS},created_at${filter}&order=created_at.asc`);
    return Array.isArray(rows) ? rows : [];
}

/**
 * `auditFields` : champs updated_by_* / updated_at fournis par audit.auditFields(req).
 * Ecrits via writeWithAudit, qui retombe sans auteur si la migration 009 manque.
 */
async function createFaq({ question, answer, language, source_faq_id, ...auditFields }) {
    const payload = { question, answer, language: normalizeFaqLang(language) || DEFAULT_FAQ_LANG, ...auditFields };
    if (source_faq_id) payload.source_faq_id = source_faq_id;
    const result = await writeWithAudit('POST', '/faq', payload, { 'Prefer': 'return=representation' });
    return Array.isArray(result) ? result[0] : result;
}

/**
 * Supprime une question. Ses traductions sont d'abord détachées
 * (source_faq_id → null) : quel que soit le ON DELETE de la clé étrangère,
 * supprimer une question FR ne supprime ni ne bloque jamais la base EN.
 */
async function deleteFaq(id) {
    await supabaseRequest('PATCH', `/faq?source_faq_id=eq.${encodeURIComponent(id)}`, { source_faq_id: null });
    await supabaseRequest('DELETE', `/faq?id=eq.${encodeURIComponent(id)}`);
}

/**
 * Associations d'une école, filtrées sur une langue si demandé.
 * `faq!inner` fait du filtre sur la langue un vrai filtre de lignes (sinon
 * PostgREST renverrait les associations avec `faq: null`).
 */
async function listSchoolFaqLinks(schoolId, lang) {
    const language = normalizeFaqLang(lang);
    const embed = language ? `faq!inner(${FAQ_FIELDS})` : `faq(${FAQ_FIELDS})`;
    const filter = language ? `&faq.language=eq.${encodeURIComponent(language)}` : '';
    const rows = await supabaseRequest(
        'GET',
        `/school_page_faq?school_id=eq.${encodeURIComponent(schoolId)}&select=id,faq_id,page_type,sort_order,${embed}${filter}&order=sort_order.asc,created_at.asc`
    );
    return Array.isArray(rows) ? rows : [];
}

/** Questions à afficher pour une école (+ page_type) dans une langue. */
async function renderSchoolFaqs(schoolId, { pageType, lang } = {}) {
    const schoolRows = await supabaseRequest('GET', `/Schools?id=eq.${encodeURIComponent(schoolId)}&select=show_faq&limit=1`).catch(() => []);
    const school = Array.isArray(schoolRows) ? schoolRows[0] : null;
    if (school && school.show_faq === false) return [];

    let links = await listSchoolFaqLinks(schoolId, lang || DEFAULT_FAQ_LANG);
    if (pageType) links = links.filter(l => l.page_type === pageType);
    return links.map(l => l.faq).filter(Boolean);
}

/**
 * Remplit la base <to> d'une école à partir de sa base <from> :
 *   1. pour chaque question <from> liée à l'école, réutilise sa traduction
 *      existante (source_faq_id) ou la crée via Gemini ;
 *   2. rattache la traduction à l'école avec le même page_type / sort_order.
 * Idempotent : relancer ne crée ni doublon de question ni doublon de lien.
 */
async function translateSchoolFaqs(schoolId, { from = 'FR', to = 'EN', apiKey } = {}) {
    const sourceLang = normalizeFaqLang(from);
    const targetLang = normalizeFaqLang(to);
    if (!sourceLang || !targetLang || sourceLang === targetLang) {
        const err = new Error('Langues source/cible invalides.');
        err.status = 400;
        throw err;
    }

    const sourceLinks = await listSchoolFaqLinks(schoolId, sourceLang);
    const sourceFaqs = sourceLinks.map(l => l.faq).filter(Boolean);
    if (!sourceFaqs.length) return { translated: 0, reused: 0, linked: 0, alreadyLinked: 0, total: 0 };

    // Traductions déjà présentes en base (toutes écoles confondues).
    const ids = [...new Set(sourceFaqs.map(f => f.id))];
    const existing = await supabaseRequest(
        'GET',
        `/faq?select=${FAQ_FIELDS}&language=eq.${encodeURIComponent(targetLang)}&source_faq_id=in.(${ids.map(encodeURIComponent).join(',')})`
    );
    const translationBySource = new Map((Array.isArray(existing) ? existing : []).map(f => [f.source_faq_id, f]));

    const missing = sourceFaqs.filter(f => !translationBySource.has(f.id))
        .filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i);
    const reused = ids.length - missing.length;

    if (missing.length) {
        if (!apiKey) {
            const err = new Error('Clé API de traduction manquante (GEMINI_API_KEY_TRANSLATION).');
            err.status = 500;
            throw err;
        }
        const strings = missing.flatMap(f => [f.question, f.answer]);
        const translated = await translateStrings(strings, targetLang, apiKey, globalThis.fetch, 40);
        for (let i = 0; i < missing.length; i++) {
            const created = await createFaq({
                question: translated[i * 2],
                answer: translated[i * 2 + 1],
                language: targetLang,
                source_faq_id: missing[i].id
            });
            if (created) translationBySource.set(missing[i].id, created);
        }
    }

    // Rattacher les traductions à l'école (sans doublon).
    const targetLinks = await listSchoolFaqLinks(schoolId, targetLang);
    const linkedKeys = new Set(targetLinks.map(l => `${l.faq_id}|${l.page_type}`));
    let linked = 0;
    let alreadyLinked = 0;
    for (const link of sourceLinks) {
        const translation = link.faq && translationBySource.get(link.faq.id);
        if (!translation) continue;
        const key = `${translation.id}|${link.page_type}`;
        if (linkedKeys.has(key)) { alreadyLinked += 1; continue; }
        await supabaseRequest('POST', '/school_page_faq', {
            school_id: schoolId,
            faq_id: translation.id,
            page_type: link.page_type,
            sort_order: link.sort_order
        });
        linkedKeys.add(key);
        linked += 1;
    }

    return { translated: missing.length, reused, linked, alreadyLinked, total: ids.length };
}

/**
 * Équivalents d'une liste de questions dans une autre langue, dans le même
 * ordre. Sert à la duplication d'une page FR → EN : le bloc FAQ reprend les
 * questions de la base EN au lieu d'une traduction IA du texte de la page.
 * Renvoie { faqs: [...équivalents trouvés], missing: [ids sans équivalent] }.
 */
async function mapFaqsToLang(faqIds, lang) {
    const targetLang = normalizeFaqLang(lang);
    const ids = (Array.isArray(faqIds) ? faqIds : []).map(String).filter(Boolean);
    if (!targetLang || !ids.length) return { faqs: [], missing: ids };

    const inList = ids.map(encodeURIComponent).join(',');
    const [translations, originals] = await Promise.all([
        supabaseRequest('GET', `/faq?select=${FAQ_FIELDS}&language=eq.${encodeURIComponent(targetLang)}&source_faq_id=in.(${inList})`),
        // Questions déjà dans la langue cible : conservées telles quelles.
        supabaseRequest('GET', `/faq?select=${FAQ_FIELDS}&language=eq.${encodeURIComponent(targetLang)}&id=in.(${inList})`)
    ]);
    const bySource = new Map((Array.isArray(translations) ? translations : []).map(f => [f.source_faq_id, f]));
    const byId = new Map((Array.isArray(originals) ? originals : []).map(f => [f.id, f]));

    const faqs = [];
    const missing = [];
    for (const id of ids) {
        const match = byId.get(id) || bySource.get(id);
        if (match) faqs.push(match);
        else missing.push(id);
    }
    return { faqs, missing };
}

/**
 * Garantit qu'une liste de questions (souvent FR, celles d'un bloc de page)
 * existe dans la base <lang> de l'école, dans le même ordre :
 *   • équivalent déjà en base (source_faq_id, ou question déjà dans la
 *     langue) → réutilisé ;
 *   • sinon → traduit via Gemini depuis la question source et créé ;
 *   • chaque équivalent est coché pour l'école s'il ne l'est pas déjà.
 * Sert au bloc FAQ d'une page traduite : ses questions apparaissent dans le
 * sélecteur et dans l'onglet « FAQ anglais » de la fiche école, où l'équipe
 * peut ensuite les modifier ou les retirer.
 * Renvoie { faqs: [...dans l'ordre], created, linked, missing: [ids introuvables] }.
 */
async function ensureSchoolFaqsInLang(schoolId, faqIds, { lang, apiKey } = {}) {
    const targetLang = normalizeFaqLang(lang);
    if (!targetLang) {
        const err = new Error('Langue cible invalide.');
        err.status = 400;
        throw err;
    }
    const ids = [...new Set((Array.isArray(faqIds) ? faqIds : []).map(String).filter(Boolean))];
    if (!ids.length) return { faqs: [], created: 0, linked: 0, missing: [] };

    const mapped = await mapFaqsToLang(ids, targetLang);
    const found = new Map();
    ids.forEach(id => {
        const match = mapped.faqs.find(f => f.id === id || f.source_faq_id === id);
        if (match) found.set(id, match);
    });

    // Questions sans équivalent : on les traduit depuis leur source en base.
    let created = 0;
    if (mapped.missing.length) {
        const sources = await supabaseRequest(
            'GET',
            `/faq?select=${FAQ_FIELDS}&id=in.(${mapped.missing.map(encodeURIComponent).join(',')})`
        );
        const toTranslate = (Array.isArray(sources) ? sources : []).filter(f => normalizeFaqLang(f.language) !== targetLang);
        if (toTranslate.length) {
            if (!apiKey) {
                const err = new Error('Clé API de traduction manquante (GEMINI_API_KEY_TRANSLATION).');
                err.status = 500;
                throw err;
            }
            const translated = await translateStrings(toTranslate.flatMap(f => [f.question, f.answer]), targetLang, apiKey, globalThis.fetch, 40);
            for (let i = 0; i < toTranslate.length; i++) {
                const faq = await createFaq({
                    question: translated[i * 2],
                    answer: translated[i * 2 + 1],
                    language: targetLang,
                    source_faq_id: toTranslate[i].id
                });
                if (faq) { found.set(toTranslate[i].id, faq); created += 1; }
            }
        }
    }

    // Cocher les équivalents pour l'école (sans doublon).
    const links = await listSchoolFaqLinks(schoolId, targetLang);
    const linkedIds = new Set(links.map(l => l.faq_id));
    let linked = 0;
    const ordered = ids.map(id => found.get(id)).filter(Boolean);
    for (const faq of ordered) {
        if (linkedIds.has(faq.id)) continue;
        await supabaseRequest('POST', '/school_page_faq', {
            school_id: schoolId, faq_id: faq.id, page_type: 'general', sort_order: 0
        });
        linkedIds.add(faq.id);
        linked += 1;
    }

    return { faqs: ordered, created, linked, missing: ids.filter(id => !found.has(id)) };
}

module.exports = {
    ensureSchoolFaqsInLang,
    DEFAULT_FAQ_LANG,
    normalizeFaqLang,
    listFaqs,
    createFaq,
    deleteFaq,
    listSchoolFaqLinks,
    renderSchoolFaqs,
    translateSchoolFaqs,
    mapFaqsToLang
};
