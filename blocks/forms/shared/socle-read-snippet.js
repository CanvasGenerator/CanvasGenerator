/**
 * Snippet de LECTURE Salesforce Core
 * ───────────────────────────────────────────────────────────────
 * À injecter, une seule fois, APRÈS le formulaire dans chaque bloc.
 *
 * Sur la page PUBLIÉE : l'inliner (lib/socle-inliner.js, appelé par lib/sfmc.js)
 * remplace `%%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%` par le code réel
 * du socle (SocleConfig + Socle + SocleRead + handler). La page devient
 * autonome — AUCUNE dépendance à un Content Block, AUCUN changement d'org.
 *
 * Le handler lit les value sets Salesforce et remplit les <select> par leur
 * attribut `name` : Country · StudyLevel · VousEtes · Campus. Si Salesforce est
 * indisponible (ou dans le builder GrapesJS, qui n'exécute pas ce <script>), les
 * options STATIQUES déjà présentes servent de repli — le formulaire reste
 * utilisable.
 *
 * Le <div> est masqué : il ne porte que la logique, jamais d'affichage.
 * NE JAMAIS le remettre à l'intérieur d'un <select> ni AVANT le formulaire :
 * le script a besoin que les <select> existent déjà dans le DOM.
 */
/**
 * L'école courante, telle que le builder la connaît AU MOMENT DE CONSTRUIRE
 * le bloc. `registerBlocks(editor)` s'exécute après le chargement de l'école
 * (js/app.js), donc `window.CURRENT_SCHOOL` est déjà renseigné ici.
 */
function ecoleCourante() {
    try {
        const s = (typeof window !== 'undefined' && window.CURRENT_SCHOOL) || null;
        return s ? String(s.id || '') : '';
    } catch (e) { return ''; }
}

/**
 * Le snippet de lecture, avec l'école figée dedans.
 *
 * ⚠ Pourquoi une variable AMPscript et pas un champ caché : le socle lit
 * `RequestParameter("SchoolId")` puis `("Marque")`, c'est-à-dire la QUERY
 * STRING. Or un `<input type="hidden">` n'est pas un paramètre de requête tant
 * que le formulaire n'est pas soumis — au premier affichage d'une page publiée,
 * les deux sont vides, et les listes campus/programmes sortaient vides.
 *
 * Un Content Block ne prend pas de paramètre, mais il PARTAGE la portée
 * AMPscript de la page qui l'inclut. Poser `@LPB_ECOLE` juste avant l'include
 * suffit donc, et c'est la troisième source que le socle consulte.
 *
 * Même raisonnement pour le TYPE de formulaire et le TYPE d'événement, posés
 * ici depuis le 30/08. Ils ne venaient que de la query string, ce qui obligeait
 * à composer l'URL à la main : sans eux, AUCUNE date d'événement ne remontait,
 * et une page brochure se voyait appliquer la règle de spécialité des autres
 * formulaires. Le bloc, lui, connaît son propre type — il n'avait qu'à le dire.
 *
 * Sans école connue (mode Master, ou école non chargée), on n'émet rien : le
 * socle retombe sur son comportement dégradé, listes vides et options
 * statiques en repli.
 */
export function socleReadSnippet({ formType = '', eventType = '' } = {}) {
    /* Guillemets et antislashs interdits : ces valeurs partent dans une chaine
       AMPscript. Elles viennent du code des blocs, pas d'une saisie, mais la
       garde coute une ligne. */
    const propre = (v) => String(v || '').replace(/["\\]/g, '');

    const poses = [];
    const ecole = ecoleCourante();
    if (ecole)     poses.push(`SET @LPB_ECOLE = "${propre(ecole)}"`);
    if (formType)  poses.push(`SET @LPB_TYPE_FORM = "${propre(formType)}"`);
    if (eventType) poses.push(`SET @LPB_TYPE_EVT = "${propre(eventType)}"`);

    if (!poses.length) return SOCLE_READ_SNIPPET;

    /* DANS le conteneur masqué, pas devant lui. AMPscript ne regarde que
       l'ordre du texte — être avant l'include suffit — alors que le builder,
       lui, AFFICHE tout ce qui traîne hors d'un bloc masqué. Le préambule
       s'écrivait donc en clair au-dessus du formulaire, dans le canevas comme
       sur la page publiée avant exécution. */
    return SOCLE_READ_SNIPPET.replace(RE_INCLUDE_SNIPPET,
        (inclus) => `%%[ ${poses.join(' ')} ]%%\n            ${inclus}`);
}

/* Le PREMIER include du snippet ci-dessous. Le préambule se pose devant lui :
   une variable AMPscript vaut pour toute la page, mais seulement à partir de
   l'endroit où elle est écrite. */
const RE_INCLUDE_SNIPPET = /%%=ContentBlockByKey\("LPB_[A-Za-z_]+"\)=%%/;

export const SOCLE_READ_SNIPPET = `
        <!-- SOCLE SALESFORCE CORE — deux blocs, deux moments.

             LECTURE : remplit les listes depuis le CRM à l'affichage.
             ÉCRITURE : n'agit QUE si \`submitted=true\` est posté. Le
             formulaire se poste à lui-même (shared/envoi-socle.js), et ce
             bloc-ci est ce qui reçoit la soumission — sans lui, le POST
             n'écrirait rien, en silence.

             L'écriture vient EN PREMIER : elle doit avoir créé le compte avant
             que la lecture ne rende la page de réponse.

             Inertes dans le builder, repli statique si Salesforce est muet. -->
        <div class="socle-read-snippet" style="display:none !important" aria-hidden="true" data-gjs-droppable="false" data-gjs-selectable="false">
            %%=ContentBlockByKey("LPB_Form_Handler_AG")=%%
            %%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%
        </div>`;
