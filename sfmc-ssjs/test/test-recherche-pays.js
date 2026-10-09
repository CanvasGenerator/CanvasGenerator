/**
 * ============================================================================
 *  RECHERCHE DANS LA LISTE DES PAYS (champ Country)
 * ============================================================================
 *  Demande du 09/10 : sur mobile, le <select> natif ouvre la roue du systeme
 *  et ne se filtre pas au clavier — 196 pays a faire defiler. Le champ de
 *  recherche des indicatifs est repris ; seule `scorePays` differe, testee
 *  TELLE QU'ELLE EST dans le socle, sur des libelles FRANCAIS (ce que renvoie
 *  le connecteur quand l'utilisateur MC Connect est en francais) et leur
 *  valeur CRM anglaise.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs'), 'utf8');

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
const ctx = {};
vm.runInNewContext(['cleRecherche', 'scorePays'].map(extraire).join('\n') + '\nthis.scorePays = scorePays;', ctx);

/* value = anglais (CRM), texte = libelle affiche (francais), dans l'ordre du <select>. */
const PAYS = [
    ['South Africa', 'Afrique du Sud'], ['Germany', 'Allemagne'], ['Saudi Arabia', 'Arabie saoudite'],
    ['Belgium', 'Belgique'], ['Canada', 'Canada'], ['South Korea', 'Corée du Sud'],
    ['Spain', 'Espagne'], ['United States', 'États-Unis'], ['France', 'France'],
    ['Guinea-Bissau', 'Guinée-Bissau'], ['Morocco', 'Maroc'], ['Sudan', 'Soudan'], ['Tunisia', 'Tunisie'],
].map(([value, texte], i) => ({ value, texte, i }));

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + ' — ' + e.message); } }
function egal(obtenu, attendu, quoi) {
    const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
    if (a !== b) throw new Error(`${quoi} — attendu ${b}, obtenu ${a}`);
}
/** Les libelles retenus, par pertinence puis ordre du <select>, comme `rendre`. */
function resultats(q) {
    return PAYS.map((e) => ({ e, s: ctx.scorePays(q, e.texte, e.value) })).filter((r) => r.s !== -1)
        .sort((a, b) => (a.s - b.s) || (a.e.i - b.e.i)).map((r) => r.e.texte);
}

test('saisie vide : tout s affiche, dans l ordre du select', () => {
    egal(resultats(''), PAYS.map((e) => e.texte), 'liste entiere');
});
test('le debut du libelle prime, sans accent ni casse', () => {
    egal(resultats('esp'), ['Espagne'], 'esp');
    egal(resultats('ETATS'), ['États-Unis'], 'ETATS sans accent');
    egal(resultats('é'), ['Espagne', 'États-Unis'], 'un seul caractere accentue : « E », les deux pays en E');
});
test('un mot du libelle vient ensuite : « sud » trouve les deux « du Sud », puis Soudan par sa valeur Sudan', () => {
    egal(resultats('sud'), ['Afrique du Sud', 'Corée du Sud', 'Soudan'], 'sud');
});
test('« contient » seulement a partir de trois lettres', () => {
    egal(resultats('ma'), ['Maroc'], 'deux lettres : debut de mot seulement (Allemagne exclue)');
    egal(resultats('mag'), ['Allemagne'], 'trois lettres : contient');
});
test('la valeur CRM anglaise sert de repli : « spa » trouve Espagne, « ger » l Allemagne', () => {
    egal(resultats('spa'), ['Espagne'], 'spa');
    egal(resultats('ger'), ['Allemagne'], 'ger');
    egal(resultats('south'), ['Afrique du Sud', 'Corée du Sud'], 'south');
});
test('le trait d union compte comme un debut de mot', () => {
    egal(resultats('bis'), ['Guinée-Bissau'], 'bis');
});
test('rien ne correspond : liste vide, jamais une erreur', () => {
    egal(resultats('zzz'), [], 'zzz');
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) { echecs.forEach((e) => console.error('  ✗ ' + e + '\n')); process.exit(1); }
