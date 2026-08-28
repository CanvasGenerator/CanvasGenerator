/**
 * Blocs de formulaire retirés de la palette
 * ───────────────────────────────────────────────────────────────
 * DÉSACTIVATION, pas suppression : le code des blocs reste entier et testé,
 * seule leur inscription dans le BlockManager est sautée. Retirer un id de
 * cette liste suffit à faire réapparaître le bloc, sans rien réécrire.
 *
 * Pourquoi les variantes anglaises : le besoin exprimé ne couvre aujourd'hui
 * que la brochure et la candidature en anglais. Les autres formulaires EN
 * existent, fonctionnent, mais n'ont pas de page à servir — les laisser dans
 * la palette invite à publier des formulaires que personne n'a validés.
 *
 * ⚠ À garder cohérent avec `blocks/registry.js`, qui porte le même genre de
 * drapeau `enabled` mais ne pilote QUE le sélecteur de blocs par défaut de
 * school-selector.html. Le builder, lui, ne lit jamais ce registre : c'est
 * ce fichier-ci qui fait foi pour la palette.
 */

export const BLOCS_DESACTIVES = [
    'form-jpo-en',
    'form-atelier-en',
    'form-stage-en',
    'form-immersion-en'
];

/**
 * Inscrit un bloc, sauf s'il est désactivé.
 *
 * Même signature que `editor.BlockManager.add`, pour que le remplacement se
 * lise comme l'original sur le site d'appel.
 *
 * @returns {object|null} le bloc ajouté, ou null s'il est désactivé.
 */
export function ajouterBloc(editor, id, definition) {
    if (BLOCS_DESACTIVES.indexOf(id) !== -1) return null;
    return editor.BlockManager.add(id, definition);
}
