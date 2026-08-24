/**
 * Dimensions par défaut des logos — SOURCE UNIQUE DE VÉRITÉ.
 * ───────────────────────────────────────────────────────────────
 * Modifier ces deux constantes suffit à changer la taille par défaut de TOUS
 * les logos de TOUS les headers (EFAP, BRASSART, 3W ACADEMY, écoles restantes,
 * Master Template). Aucune valeur n'est dupliquée dans les blocs : ils importent
 * `logoDefaultSize()` ci-dessous.
 *
 * IMPORTANT — ce sont des VALEURS PAR DÉFAUT, pas un verrouillage :
 *   • La règle générée cible la CLASSE simple du logo (.hdr-logo-img, .mh-logo img…)
 *     SANS `!important`.
 *   • L'éditeur GrapesJS est configuré en `componentFirst: true` : quand
 *     l'utilisateur modifie Largeur/Hauteur dans le panneau « Style & Propriétés »,
 *     GrapesJS écrit une règle par ID (#abc { width: 80px }), PLUS spécifique, qui
 *     l'emporte donc sur ce défaut. La personnalisation manuelle est préservée et
 *     persiste à la sauvegarde/rechargement.
 *   • Les règles responsive scopées (`.header-x .hdr-logo-img` sous @media), à deux
 *     classes, restent elles aussi prioritaires sur ce défaut mono-classe → le
 *     comportement Desktop / Tablette / Mobile n'est pas cassé.
 *
 * `object-fit: contain` garde le logo NON déformé si l'utilisateur fixe ensuite
 * une largeur ET une hauteur.
 */
export const LOGO_DEFAULT_WIDTH = 'auto'; // largeur libre → aucune déformation
export const LOGO_DEFAULT_HEIGHT = 56;    // px

/**
 * Règle CSS de dimension par défaut d'un logo, pour un ou plusieurs sélecteurs.
 * @param {string} selector  ex. '.hdr-logo-img' ou '.mh-logo svg, .mh-logo img'
 * @returns {string} règle CSS prête à injecter dans le <style> d'un bloc.
 */
export function logoDefaultSize(selector = '.hdr-logo-img') {
    const w = LOGO_DEFAULT_WIDTH === 'auto' ? 'auto' : `${LOGO_DEFAULT_WIDTH}px`;
    const h = LOGO_DEFAULT_HEIGHT === 'auto' ? 'auto' : `${LOGO_DEFAULT_HEIGHT}px`;
    return `${selector} { `
        + `height: ${h}; width: ${w}; `
        + `max-width: 100%; object-fit: contain; display: block; }`;
}
