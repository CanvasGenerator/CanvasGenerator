/**
 * ============================================================================
 *  L'ÉCOLE DE LA PAGE, POSÉE À LA PUBLICATION
 * ============================================================================
 *  Le socle de lecture a besoin de savoir de quelle école relève la page :
 *  sans elle, pas de préfixe campus, donc listes campus et programmes VIDES.
 *
 *  Le builder fige déjà l'école dans le HTML au moment où il construit le bloc
 *  formulaire (`socleReadSnippet()` et `buildHiddenFields()`). Mais cela ne
 *  vaut que pour les blocs insérés APRÈS ce correctif : une page enregistrée
 *  avant porte encore `value=""` et aucun préambule, et la simple
 *  réouverture-réenregistrement ne la répare pas — GrapesJS resérialise l'arbre
 *  stocké tel quel.
 *
 *  Ce module rattrape ces pages-là, au dernier moment, à la publication. Le nom
 *  du projet porte l'école (`school-efap__ma-page`), donc l'information est
 *  disponible sans rien demander à personne.
 *
 *  Idempotent par construction : si le builder a déjà fait le travail, on ne
 *  touche à rien. Les deux chemins peuvent donc coexister sans se marcher
 *  dessus, et le jour où toutes les pages auront été reprises, ce module
 *  deviendra silencieux sans qu'il faille le retirer.
 * ============================================================================
 */

/* Le socle de LECTURE. C'est avant lui que la variable doit être posée : un
   Content Block partage la portée AMPscript de la page qui l'inclut, mais une
   variable posée APRÈS l'include arriverait trop tard. */
const CLE_SOCLE_LECTURE = 'LPB_Picklist_Handler_AG';

const RE_INCLUDE = /%%=\s*ContentBlockByKey\(\s*["']LPB_Picklist_Handler_AG["']\s*\)\s*=%%/;

/* `value=""` seulement : une valeur déjà posée n'est jamais écrasée. */
const RE_MARQUE_VIDE = /(<input\b[^>]*\bname=["']Marque["'][^>]*\bvalue=["'])(["'])/i;

/**
 * Pose l'école sur le HTML d'une page, si elle n'y est pas déjà.
 *
 * @param {string} html   HTML complet de la page
 * @param {string} ecole  identifiant de l'école ("efap"), déduit du projet
 * @returns {{html: string, prelude: boolean, marque: boolean}}
 *          `prelude` et `marque` disent ce qui a réellement été ajouté.
 */
function poserEcoleSurLaPage(html, ecole) {
    const resultat = { html, prelude: false, marque: false };

    const id = String(ecole || '').trim();
    if (!id || id === 'unknown') return resultat;
    if (typeof html !== 'string' || !html) return resultat;

    // Guillemets interdits : la valeur part dans une chaîne AMPscript.
    const propre = id.replace(/["\\]/g, '');
    if (!propre) return resultat;

    let out = html;

    /* 1. Le préambule AMPscript, devant le premier include du socle de lecture.
          Une seule fois : les variables AMPscript sont à portée de page, un
          second SET n'apporterait rien et brouillerait la lecture. */
    if (!out.includes('@LPB_ECOLE') && RE_INCLUDE.test(out)) {
        out = out.replace(RE_INCLUDE, (inclus) =>
            `%%[ SET @LPB_ECOLE = "${propre}" ]%%\n        ${inclus}`);
        resultat.prelude = true;
    }

    /* 2. Le champ caché `Marque`, pour la SOUMISSION. Le socle d'écriture y lit
          l'école pour résoudre la marque du consentement et la campagne.
          Plusieurs formulaires sur une page ? Tous reçoivent la même école. */
    if (RE_MARQUE_VIDE.test(out)) {
        let n = 0;
        out = out.replace(new RegExp(RE_MARQUE_VIDE.source, 'gi'), (m, avant, apres) => {
            n++;
            return `${avant}${propre}${apres}`;
        });
        resultat.marque = n > 0;
    }

    resultat.html = out;
    return resultat;
}

module.exports = { poserEcoleSurLaPage, CLE_SOCLE_LECTURE };
