/**
 * ============================================================================
 *  TESTS DE L'INLINER
 * ============================================================================
 *  L'inliner decide de ce qui part reellement sur la page publiee. Une erreur
 *  ici ne se voit pas au build : elle se voit en production, sur une page qui
 *  ne fait rien.
 * ============================================================================
 */
'use strict';
const { inlineSocleBlocks, FICHIERS_META } = require('../../lib/socle-inliner');
const { poserEcoleSurLaPage } = require('../../lib/ecole-page');
const { buildAssetPayload } = require('../../lib/sfmc');

let ok = 0; const echecs = [];
/* Certains tests sont asynchrones (buildAssetPayload). On empile les promesses
   et on attend tout avant le bilan, sinon un echec passerait inapercu. */
const enCours = [];
function test(nom, fn) {
    try {
        const r = fn();
        if (r && typeof r.then === 'function') {
            enCours.push(r.then(() => { ok++; },
                                (e) => { echecs.push(`${nom}\n      ${e.message}`); }));
        } else { ok++; }
    } catch (e) { echecs.push(`${nom}\n      ${e.message}`); }
}
function vrai(c, msg) { if (!c) throw new Error(msg); }

const cle = (k) => `%%=ContentBlockByKey("${k}")=%%`;

test('Les deux cles du builder sont resolues', () => {
    const r = inlineSocleBlocks(cle('LPB_Form_Handler_AG') + '\n' + cle('LPB_Picklist_Handler_AG'));
    vrai(r.blocs.includes('LPB_Form_Handler_AG'), 'handler d\'ecriture non inline');
    vrai(r.blocs.includes('LPB_Picklist_Handler_AG'), 'handler de lecture non inline');
});

test('La page publiee embarque l\'ecriture ET la lecture', () => {
    const r = inlineSocleBlocks(cle('LPB_Form_Handler_AG') + '\n' + cle('LPB_Picklist_Handler_AG'));
    vrai(r.html.includes('Application_Requested__c'), 'logique d\'ecriture absente');
    vrai(r.html.includes('window.SOCLE_DATA'), 'payload de lecture absent');
});

/* Sans ce JS, la page recoit les donnees et ne fait rien. Panne silencieuse
   rencontree en cours de projet : l'inliner routait vers l'AMPscript, qui ne
   contenait pas encore le consommateur. */
test('Le JS de cascade part avec la page [REGRESSION]', () => {
    const r = inlineSocleBlocks(cle('LPB_Picklist_Handler_AG'));
    for (const attendu of ['rafraichirCascade', 'appliquerOrdre', 'autorise']) {
        vrai(r.html.includes(attendu), `${attendu} absent de la page publiee`);
    }
});

test('Une cle hors socle n\'est pas touchee', () => {
    const r = inlineSocleBlocks(cle('MonBloc_Maison_AG'));
    vrai(r.html.includes(cle('MonBloc_Maison_AG')), 'cle metier alteree');
});

/* Coller de l'AMPscript dans un bloc <script> produit du JavaScript invalide,
   donc une page morte. Le refus doit etre explicite, pas silencieux. */
test('AMPscript n\'est jamais injecte dans un bloc SSJS', () => {
    const sauve = FICHIERS_META.LPB_Socle_Config_AG;
    FICHIERS_META.LPB_Socle_Config_AG = { fichier: 'picklist-handler.ampscript', langage: 'ampscript' };
    FICHIERS_META.LPB_Form_Handler_AG = { fichier: 'handler-form.ssjs', langage: 'ssjs' };
    try {
        const r = inlineSocleBlocks(cle('LPB_Form_Handler_AG'));
        vrai(r.refuses.includes('LPB_Socle_Config_AG'), 'inclusion non refusee');
        vrai(!r.html.includes('window.SOCLE_DATA'), 'AMPscript injecte dans le script');
    } finally {
        FICHIERS_META.LPB_Socle_Config_AG = sauve;
        FICHIERS_META.LPB_Form_Handler_AG = { fichier: 'handler-form.ampscript', langage: 'ampscript' };
    }
});

/* ⚠ Ce test passe par buildAssetPayload, le VRAI point d'entree de la
   publication, et non par les deux fonctions enchainees a la main : le bug
   etait precisement dans leur enchainement. lib/sfmc.js repartait du HTML
   ORIGINAL pour inliner, jetant en silence ce que le prelude venait de poser.
   Les pages publiees n'ont donc jamais porte @LPB_ECOLE ni les types — une page
   JPO restait sans aucune date — alors que le journal annoncait « ecole posee ».

   Une premiere version de ce test appelait poserEcoleSurLaPage puis
   inlineSocleBlocks directement : elle passait AVANT correction, puisqu'elle
   composait justement les deux dans le bon ordre. */
test('Le prelude survit a la publication [REGRESSION]', async () => {
    const page = '<form>'
        + '<input type="hidden" name="Marque" value="">'
        + '<input type="hidden" name="TypeFormulaire" value="evenement">'
        + '<input type="hidden" name="TypeEvenement" value="JPO">'
        + '</form>' + cle('LPB_Picklist_Handler_AG');

    const payload = await buildAssetPayload({
        projectName: 'school-efap__page-jpo', fullHtml: page,
    });
    const h = payload.content;
    vrai(h.includes('window.SOCLE_DATA'), 'socle non inline');
    vrai(h.includes('SET @LPB_ECOLE = "efap"'), 'ecole perdue a la publication');
    vrai(h.includes('SET @LPB_TYPE_FORM = "evenement"'), 'type de formulaire perdu');
    vrai(h.includes('SET @LPB_TYPE_EVT = "JPO"'), 'type d\'evenement perdu');
});

test('Le prelude reprend les types dans les champs caches de la page', () => {
    const bro = '<input type="hidden" name="Marque" value="">'
        + '<input type="hidden" name="TypeFormulaire" value="brochure">'
        + cle('LPB_Picklist_Handler_AG');
    const h = poserEcoleSurLaPage(bro, 'efap').html;
    vrai(/SET @LPB_TYPE_FORM = "brochure"/.test(h), 'type brochure non repris');
    vrai(!/@LPB_TYPE_EVT/.test(h), 'type d\'evenement invente sur une brochure');
    vrai(poserEcoleSurLaPage(h, 'efap').prelude === false, 'prelude pose deux fois');
});

test('Un HTML sans cle ressort inchange', () => {
    const src = '<p>rien a inliner</p>';
    const r = inlineSocleBlocks(src);
    vrai(r.html === src && r.inline === false, 'HTML modifie sans raison');
});

Promise.all(enCours).then(() => {
    console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
    if (echecs.length) { echecs.forEach((e) => console.error('  ✗ ' + e + '\n')); process.exit(1); }
});
