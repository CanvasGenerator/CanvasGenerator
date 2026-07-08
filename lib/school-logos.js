/**
 * Logos des écoles — HARDCODÉS dans l'app (dev-only).
 * ───────────────────────────────────────────────────────────────
 * Objectif : à la déclinaison (ou save d'une page école), le logo de l'école
 * est injecté AUTOMATIQUEMENT dans le header/footer — aucune action côté client.
 *
 * Format : SVG monochrome en fill="currentColor" → il devient BLANC dans le
 * header (fond couleur) et NOIR dans le footer (fond blanc) via l'héritage CSS.
 *
 * ⚠️ Ce sont des logos "texte" propres (placeholders fidèles au nom).
 * Pour un rendu pixel-perfect, remplacer la valeur SVG de chaque école ici
 * par le vrai tracé de marque — c'est le SEUL fichier à éditer.
 *
 * Clé = id de l'école (même id que schools.json / le préfixe school-<id>__).
 */

// Génère un logo texte SVG (viewBox proportionnel → mis à l'échelle par la hauteur CSS).
function textLogo(label, { width = 220, family = "Georgia, 'Times New Roman', serif", size = 30, spacing = 2, weight = 700 } = {}) {
    return `<svg viewBox="0 0 ${width} 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">`
        + `<text x="0" y="30" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="currentColor">${label}</text></svg>`;
}

const SCHOOL_LOGOS = {
    'efap':        textLogo('EFAP', { width: 150, spacing: 6 }),
    'brassart':    textLogo('BRASSART', { width: 300, family: "Arial, sans-serif", spacing: 3 }),
    'icart':       textLogo('ICART', { width: 190, spacing: 5 }),
    'cread':       textLogo('CREAD', { width: 200, family: "Arial, sans-serif", weight: 800, spacing: 3 }),
    'esec':        textLogo('ÉSEC', { width: 160, spacing: 4 }),
    'ifa-paris':   textLogo('IFA Paris', { width: 240, spacing: 1 }),
    'mopa':        textLogo('MOPA', { width: 170, family: "Arial, sans-serif", weight: 800, spacing: 3 }),
    'ecole-bleue': textLogo('École Bleue', { width: 300, spacing: 1 }),
    'efj':         textLogo('EFJ', { width: 120, spacing: 6 }),
    '3wa':         textLogo('3W ACADEMY', { width: 320, family: "Arial, sans-serif", weight: 800, spacing: 2 }),
};

/** Retourne le logo SVG d'une école (ou null si inconnue). */
function getSchoolLogo(schoolId) {
    if (!schoolId) return null;
    return SCHOOL_LOGOS[String(schoolId).toLowerCase()] || null;
}

module.exports = { SCHOOL_LOGOS, getSchoolLogo };
