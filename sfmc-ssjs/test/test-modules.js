/**
 * ============================================================================
 *  TOUS LES BLOCS S'IMPORTENT VRAIMENT
 * ============================================================================
 *  Un module casse ne se voit pas au build : il se voit dans le builder, sur
 *  une page blanche, avec une erreur qui designe le mot SUIVANT et jamais la
 *  cause.
 *
 *  Le piege recurrent : un ACCENT GRAVE dans un commentaire HTML place a
 *  l'interieur d'un template literal. Il ferme la chaine, et tout ce qui suit
 *  devient du code. Ecrit trois fois dans ce projet, trouve trois fois en
 *  production.
 *
 *  ⚠ `node --check` ne suffit PAS : il analyse ces fichiers comme du CommonJS
 *  et n'y voit rien. Seul un import ES reel leve l'erreur — c'est tout l'objet
 *  de ce controle.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', '..', 'blocks');

/** Tous les .js sous blocks/, recursivement. */
function modules(dossier, out = []) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
        const p = path.join(dossier, e.name);
        if (e.isDirectory()) modules(p, out);
        else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
}

(async () => {
    const fichiers = modules(RACINE);
    const echecs = [];

    for (const f of fichiers) {
        try {
            await import('file://' + f);
        } catch (e) {
            /* Un module qui refuse de se charger pour une dependance absente du
               contexte Node (window, document…) n'est pas notre sujet : on ne
               traque que les erreurs de SYNTAXE. */
            if (e instanceof SyntaxError) {
                echecs.push(`${path.relative(RACINE, f)}\n      ${e.message}`);
            }
        }
    }

    console.log(`\n  ${fichiers.length - echecs.length} module(s) importe(s), ${echecs.length} echec(s)\n`);
    if (echecs.length) {
        echecs.forEach((e) => console.error('  ✗ ' + e + '\n'));
        console.error('  Cause la plus frequente : un accent grave dans un commentaire,');
        console.error('  a l\'interieur d\'un template literal.\n');
        process.exit(1);
    }
})();
