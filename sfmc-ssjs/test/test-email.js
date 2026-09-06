'use strict';
/* ============================================================================
 *  FORMAT DE L'ADRESSE E-MAIL — la regle du socle, executee telle quelle
 * ============================================================================
 *  `type="email"` laisse passer « nom@domaine » ; Salesforce le refuse, et un
 *  refus de CreateSalesforceObject tue la page. Retour du 06/09. On teste la
 *  fonction REELLE du socle, extraite du fichier, pas une copie.
 * ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const F = path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs');
const src = fs.readFileSync(F, 'utf8');

function extraire(nom) {
    const i = src.indexOf('function ' + nom + '(');
    if (i < 0) throw new Error('fonction introuvable dans le socle : ' + nom);
    let prof = 0, j = src.indexOf('{', i);
    for (; j < src.length; j++) {
        if (src[j] === '{') prof++;
        else if (src[j] === '}') { prof--; if (prof === 0) break; }
    }
    return src.substring(i, j + 1);
}
const regle = /var\s+EMAIL_FORMAT\s*=\s*(\/.*?\/[a-z]*);/.exec(src);
if (!regle) throw new Error('EMAIL_FORMAT introuvable dans le socle');

const code = 'var EMAIL_FORMAT = ' + regle[1] + ';\n' + extraire('erreurFormatEmail');

function verifier(valeur, langue) {
    const ctx = { langueAffichage: () => langue || 'fr', resultat: null, champ: { value: valeur } };
    vm.runInNewContext(code + '\nresultat = erreurFormatEmail(champ);', ctx);
    return ctx.resultat;
}

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + '\n      ' + e.message); } }
function egal(a, b, m) { if (a !== b) throw new Error((m || '') + ' — attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }

test('Une adresse normale passe', () => {
    ['prenom.nom@domaine.fr', 'a@b.co', 'x_y+tag@sub.domaine.com', 'MAJ@DOMAINE.FR'].forEach((v) => egal(verifier(v), '', v));
});
test('Sans extension : refuse — c est le cas qui tuait la page', () => {
    egal(verifier('mauvais.format@test') !== '', true, 'nom@domaine sans extension accepte');
});
test('Extension d une lettre, espace, double @, vide apres @ : refuses', () => {
    ['a@b.c', 'pre nom@domaine.fr', 'a@@b.fr', 'a@', '@domaine.fr', 'a@b.'].forEach((v) => egal(verifier(v) !== '', true, v + ' accepte'));
});
test('Champ vide : silence, c est `required` qui parle', () => {
    egal(verifier(''), ''); egal(verifier('   '), '');
});
test('Espaces autour : toleres, l adresse est nettoyee', () => {
    egal(verifier('  prenom.nom@domaine.fr  '), '');
});
test('Le message suit la langue de la page', () => {
    egal(/Adresse e-mail invalide/.test(verifier('a@b', 'fr')), true, 'message FR');
    egal(/Invalid email address/.test(verifier('a@b', 'en')), true, 'message EN');
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
echecs.forEach((e) => console.log('  ✗ ' + e));
if (echecs.length) process.exit(1);
