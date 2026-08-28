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
 * Sans école connue (mode Master, ou école non chargée), on n'émet rien : le
 * socle retombe sur son comportement dégradé, listes vides et options
 * statiques en repli.
 */
export function socleReadSnippet() {
    const ecole = ecoleCourante();
    const prelude = ecole
        ? `
        %%[ SET @LPB_ECOLE = "${ecole.replace(/"/g, '')}" ]%%`
        : '';
    return prelude + SOCLE_READ_SNIPPET;
}

export const SOCLE_READ_SNIPPET = `
        <!-- LECTURE SALESFORCE CORE — remplit les listes depuis le CRM à la
             publication. Inerte dans le builder, repli statique si SF absent. -->
        <div class="socle-read-snippet" style="display:none !important" aria-hidden="true" data-gjs-droppable="false" data-gjs-selectable="false">
            %%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%
        </div>`;
