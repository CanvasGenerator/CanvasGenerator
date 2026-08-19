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
export const SOCLE_READ_SNIPPET = `
        <!-- LECTURE SALESFORCE CORE — remplit les listes depuis le CRM à la
             publication. Inerte dans le builder, repli statique si SF absent. -->
        <div class="socle-read-snippet" style="display:none !important" aria-hidden="true" data-gjs-droppable="false" data-gjs-selectable="false">
            %%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%
        </div>`;
