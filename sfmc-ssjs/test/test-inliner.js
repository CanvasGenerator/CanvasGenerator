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

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(`${nom}\n      ${e.message}`); } }
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

test('Un HTML sans cle ressort inchange', () => {
    const src = '<p>rien a inliner</p>';
    const r = inlineSocleBlocks(src);
    vrai(r.html === src && r.inline === false, 'HTML modifie sans raison');
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) { echecs.forEach((e) => console.error('  ✗ ' + e + '\n')); process.exit(1); }
