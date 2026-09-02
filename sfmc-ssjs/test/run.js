/** Lance toute la suite. Sortie non nulle si un seul controle echoue. */
'use strict';
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const etapes = [
    ['Synchro du JS de cascade', ['../../scripts/sync-cascade-js.js', '--check']],
    ['Lint AMPscript',           ['lint-ampscript.js']],
    ['Import des blocs',         ['test-modules.js']],
    ['Inliner',                  ['test-inliner.js']],
    ['Cascade navigateur',       ['test-cascade.js']],
    ['Longueur du telephone',    ['test-telephone.js']],
    ['Recherche indicatif',      ['test-recherche-indicatif.js']],
    ['Sous-evenements',          ['test-ateliers.js']],
    ['Champs requis',            ['test-requis.js']],
    ['Envoi au socle',           ['test-envoi.js']],
    ['Confirmation',             ['test-confirmation.js']],
];

let echecs = 0;
for (const [nom, args] of etapes) {
    process.stdout.write(`\n── ${nom} ${'─'.repeat(Math.max(0, 46 - nom.length))}\n`);
    try {
        execFileSync(process.execPath, [path.join(__dirname, args[0]), ...args.slice(1)],
            { stdio: 'inherit' });
    } catch (e) { echecs++; }
}
console.log(echecs ? `\n✗ ${echecs} etape(s) en echec\n` : '\n✓ toutes les etapes passent\n');
process.exit(echecs ? 1 : 0);
