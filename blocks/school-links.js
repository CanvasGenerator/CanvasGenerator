/**
 * Liens par école (site web + réseaux sociaux) pour les headers & footers.
 * ───────────────────────────────────────────────────────────────
 * Source de vérité : la config école (base_url + branding.social), éditable
 * dans la gestion des écoles. app.js remplit `window.__SCHOOL_LINKS` AVANT
 * l'enregistrement des blocs (registerBlocks) à partir de /api/schools :
 *
 *     window.__SCHOOL_LINKS = { '<schoolId>': { baseUrl, social: { instagram, … } } }
 *
 * Les fonctions ci-dessous injectent ces URLs au moment de la construction
 * des blocs, pour que chaque header/footer ajouté soit DÉJÀ pré-rempli. Les
 * liens restent modifiables ensuite dans l'éditeur (trait « Lien » de l'image
 * pour le logo, composant lien pour les icônes RS).
 */

const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube'];

function escapeAttr(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function getSchoolLinks(schoolId) {
    const map = (typeof window !== 'undefined' && window.__SCHOOL_LINKS) || {};
    const entry = map[String(schoolId || '').toLowerCase()] || {};
    const social = (entry.social && typeof entry.social === 'object') ? entry.social : {};
    return { baseUrl: entry.baseUrl || '', social };
}

/**
 * Attributs à coller sur un <img> de logo pour qu'il pointe vers le site de
 * l'école. On utilise `data-href` (plugin image-link) → l'<img> est enveloppée
 * dans un <a href> à l'export, et l'URL apparaît dans le trait « Lien » de
 * l'image → 100 % modifiable. Chaîne vide si aucune URL de site n'est définie.
 */
export function logoLinkAttrs(schoolId) {
    const { baseUrl } = getSchoolLinks(schoolId);
    if (!baseUrl) return '';
    return ` data-href="${escapeAttr(baseUrl)}" data-link-target="_blank"`;
}

/** URL d'un réseau social pour une école, ou '#' si non renseignée. */
export function socialHref(schoolId, key) {
    const { social } = getSchoolLinks(schoolId);
    const v = social && social[key];
    return v ? v : '#';
}

export { SOCIAL_KEYS };
