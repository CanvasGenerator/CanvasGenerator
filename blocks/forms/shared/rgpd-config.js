/**
 * RGPD config — source centrale
 * ─────────────────────────────────────────────────────────────────
 * Interface async intentionnelle : quand la source sera décidée
 * (DE SFMC, API CRM, table BDD…) il suffit de remplacer le corps
 * de fetchRgpdConfig() sans toucher aux formulaires.
 *
 * Priorité actuelle :
 *   1. window.CURRENT_SCHOOL  (admin école dans le LP Builder)
 *   2. Valeurs mock par défaut
 */

const MOCK_DEFAULTS = {
    fr: {
        text: "J'accepte d'être contacté(e) par l'école pour les finalités décrites",
        url:  '#privacy-policy',
        linkLabel: 'ici',
    },
    en: {
        text: 'I agree to be contacted by the school for the purposes described',
        url:  '#privacy-policy',
        linkLabel: 'here',
    },
};

/**
 * Récupère la config RGPD pour une école et une langue données.
 *
 * @param {string} [lang='fr']    - 'fr' | 'en'
 * @param {string} [schoolId]     - identifiant école (non utilisé en mock, prévu pour l'API)
 * @returns {Promise<{ text: string, url: string, linkLabel: string }>}
 */
export async function fetchRgpdConfig(lang = 'fr', schoolId) {
    /* ── TODO : remplacer ce bloc par un appel API/DE réel ─────────
     *
     * Exemple futur (API REST) :
     *   const res = await fetch(`/api/rgpd?school=${schoolId}&lang=${lang}`);
     *   return res.json();
     *
     * Exemple futur (DE SFMC via AMPscript) :
     *   return window.__SFMC_RGPD__?.[schoolId]?.[lang] ?? MOCK_DEFAULTS[lang];
     *
     * ────────────────────────────────────────────────────────────── */

    const school   = (typeof window !== 'undefined' ? window.CURRENT_SCHOOL : null) || {};
    const defaults = MOCK_DEFAULTS[lang] || MOCK_DEFAULTS.fr;

    return {
        text:      (lang === 'fr' && school.rgpdText) ? school.rgpdText : defaults.text,
        url:       school.rgpdUrl || defaults.url,
        linkLabel: defaults.linkLabel,
    };
}
