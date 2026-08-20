/**
 * ============================================================================
 *  SYNCHRONISE LE JS DE CASCADE : picklist-handler.ssjs -> .ampscript
 * ============================================================================
 *  Le handler AMPscript emet `window.SOCLE_DATA` mais ne contient pas le code
 *  qui le consomme. Ce code — remplissage des <select>, cascade, ordre des
 *  champs, resolution du PTAT — vit dans le dernier bloc <script> de
 *  `picklist-handler.ssjs`, ou il est testable en Node.
 *
 *  Pourquoi une recopie et non une inclusion : AMPscript n'a aucun mecanisme
 *  d'include. Recopier a la main garantissait la derive ; ce script la rend
 *  impossible. A relancer apres toute modification du JS de cascade :
 *
 *      node scripts/sync-cascade-js.js          verifie et corrige
 *      node scripts/sync-cascade-js.js --check  echoue si desynchronise (CI)
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'sfmc-ssjs', 'socle');
const SRC = path.join(DIR, 'picklist-handler.ssjs');
const DST = path.join(DIR, 'picklist-handler.ampscript');
const DEBUT = '<!-- ===== JS DE CASCADE — genere par scripts/sync-cascade-js.js ===== -->';
const FIN   = '<!-- ===== fin JS DE CASCADE ===== -->';

const blocs = [...fs.readFileSync(SRC, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!blocs.length) {
    console.error('✗ Aucun bloc <script> navigateur trouve dans picklist-handler.ssjs');
    process.exit(1);
}
const cascade = blocs[blocs.length - 1][1];

for (const attendu of ['rafraichirCascade', 'appliquerOrdre', 'window.SOCLE_DATA']) {
    if (!cascade.includes(attendu)) {
        console.error(`✗ Le bloc extrait ne contient pas "${attendu}" — mauvais bloc ?`);
        process.exit(1);
    }
}

const bloc = `${DEBUT}\n<script>${cascade}</script>\n${FIN}\n`;
let dst = fs.readFileSync(DST, 'utf8');
const re = new RegExp(DEBUT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + FIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?');

const sortie = re.test(dst) ? dst.replace(re, bloc) : dst.replace(/\s*$/, '\n\n' + bloc);

if (sortie === dst) { console.log('✓ JS de cascade deja synchronise'); process.exit(0); }
if (process.argv.includes('--check')) {
    console.error('✗ picklist-handler.ampscript est DESYNCHRONISE. Lancer : node scripts/sync-cascade-js.js');
    process.exit(1);
}
fs.writeFileSync(DST, sortie);
console.log(`✓ JS de cascade recopie (${Math.round(cascade.length / 1024)} Ko)`);
