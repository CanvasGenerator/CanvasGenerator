/**
 * ============================================================================
 *  RECHERCHE DANS LA LISTE DES INDICATIFS
 * ============================================================================
 *  Retour client du 02/09 : trouver le bon indicatif en tapant un chiffre
 *  (`+34`) ou des lettres (`ES`).
 *
 *  On teste `scoreIndicatif` TELLE QU'ELLE EST dans le socle — extraite du
 *  fichier, pas recopiee — sur un echantillon des 201 valeurs reelles de
 *  l'org. Les entrees sont triees par pays, comme le <select> l'est en
 *  production (fonction `trier`) : le tri d'origine sert de rupture d'egalite,
 *  donc le tester dans le desordre donnerait de faux resultats.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs');
const src = fs.readFileSync(SRC, 'utf8');

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

const code = ['cleRecherche', 'paysDuLibelle', 'scoreIndicatif'].map(extraire).join('\n');

/* Extrait des valeurs REELLES de `Account.IndicatifPick__c`, relevees dans
   LPB_Dico_Traductions. Les +1xxx sont la a dessein : ce sont eux qui
   enterraient « +1 (Canada / USA) » avant que l'exact ne prime le prefixe. */
const INDICATIFS = [
    ['1',    'Canada / USA'],
    ['1242', 'Bahamas'],
    ['1246', 'Barbade'],
    ['1268', 'Antigua-et-Barbuda'],
    ['1473', 'Grenade'],
    ['1876', 'Jamaïque'],
    ['20',   'Égypte'],
    ['212',  'Maroc'],
    ['213',  'Algérie'],
    ['33',   'France'],
    ['34',   'Espagne'],
    ['358',  'Finlande'],
    ['372',  'Estonie'],
    ['39',   'Italie'],
    ['49',   'Allemagne'],
    ['596',  'Martinique'],
    ['880',  'Bangladesh'],
    ['971',  'Emirats arabes unis'],
].map(([code, pays]) => ({ code, pays, texte: '+' + code + ' (' + pays + ')' }));

/* Trie par pays : c'est l'etat du <select> en production. */
INDICATIFS.sort((a, b) => a.pays.localeCompare(b.pays, 'fr', { sensitivity: 'base' }));

const bac = { entrees: INDICATIFS, chercher: null };
vm.runInNewContext(code + `
    chercher = function (q) {
        var out = [];
        for (var i = 0; i < entrees.length; i++) {
            var s = scoreIndicatif(q, entrees[i].code, entrees[i].pays);
            if (s !== -1) out.push({ e: entrees[i], s: s, i: i });
        }
        out.sort(function (a, b) { return (a.s - b.s) || (a.i - b.i); });
        return out.map(function (x) { return x.e.texte; });
    };`, bac);

const chercher = bac.chercher;

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + '\n      ' + e.message); } }

function premier(q, attendu) {
    const r = chercher(q);
    if (r[0] !== attendu) {
        throw new Error(`« ${q} » -> 1er resultat « ${r[0] || '(aucun)'} », attendu « ${attendu} »`
            + `\n      liste : ${r.slice(0, 5).join(' · ')}`);
    }
}
function aucun(q) {
    const r = chercher(q);
    if (r.length) throw new Error(`« ${q} » -> ${r.length} resultat(s), aucun attendu : ${r.slice(0, 3).join(' · ')}`);
}

console.log('\n── Recherche d\'indicatif ─────────────────────────\n');

test('Les deux exemples du retour client', () => {
    /* Le retour dit textuellement : « en tapant un chiffre (ex : +34) ou en
       tapant des lettres (ex : ES) ». Ces deux cas-la doivent marcher. */
    premier('+34', '+34 (Espagne)');
    premier('ES',  '+34 (Espagne)');
});

test('Le code se cherche avec ou sans le +', () => {
    premier('34',  '+34 (Espagne)');
    premier('+34', '+34 (Espagne)');
    premier('33',  '+33 (France)');
    premier(' +33 ', '+33 (France)');
});

test('Un code EXACT passe devant ses prefixes [REGRESSION]', () => {
    /* Sans cette regle, « 1 » enterre « +1 (Canada / USA) » sous les
       indicatifs caribeens en +1xxx : mesure faite sur les 201 valeurs de
       l'org, la Jamaique sortait premiere. */
    premier('1', '+1 (Canada / USA)');
    const r = chercher('1');
    if (r.length < 5) throw new Error('les +1xxx doivent rester proposes, obtenu ' + r.length);
});

test('Le nom de pays se cherche, accents et casse indifferents', () => {
    premier('maroc',  '+212 (Maroc)');
    premier('MAROC',  '+212 (Maroc)');
    premier('egypte', '+20 (Égypte)');
    premier('Égypte', '+20 (Égypte)');
    premier('algerie', '+213 (Algérie)');
});

test('A egalite, l ordre alphabetique tranche', () => {
    /* « MAR » prefixe Maroc ET Martinique. Le <select> etant trie par pays,
       Maroc doit sortir premier — c'est la rupture d'egalite par l'index. */
    premier('MAR', '+212 (Maroc)');
});

test('Une saisie de 2 lettres ne cherche QUE par prefixe [REGRESSION]', () => {
    /* Sinon « DE » remonte Bangladesh, Barbade, Finlande, Grenade... 11 pays
       sur l'org, aucun n'etant l'Allemagne. Sur deux lettres la saisie est
       presque toujours une abreviation. */
    const r = chercher('DE');
    for (const t of r) {
        if (!/\((D|de)/.test(t) && !/\(De/.test(t)) {
            // tout resultat doit avoir un pays COMMENCANT par « de »
            if (!/^\+\d+ \([Dd][Ee]/.test(t)) {
                throw new Error(`« DE » ne doit remonter que des pays commencant par DE, obtenu « ${t} »`);
            }
        }
    }
    if (r.some((t) => /Bangladesh|Barbade|Finlande|Grenade/.test(t))) {
        throw new Error('le « contient » s applique encore sur 2 lettres : ' + r.join(' · '));
    }
});

test('A partir de 3 lettres, le « contient » reprend', () => {
    premier('pagn', '+34 (Espagne)');   // ESPAGNE contient PAGN
});

test('Une saisie sans correspondance ne rend rien', () => {
    aucun('zzz');
    aucun('999999');
});

test('⚠ Les codes ISO ne sont PAS cherchables — limite assumee', () => {
    /* « DE » pour Allemagne, « IT » pour Italie : ces codes ne figurent nulle
       part dans les donnees de l'org, les libelles ne portent que le nom du
       pays. Ce test FIXE la limite pour qu'elle ne soit pas prise pour un bug,
       et il echouera le jour ou une colonne ISO sera ajoutee a
       LPB_Mapping_Indicatifs — ce sera alors le signal de le mettre a jour. */
    const r = chercher('DE');
    if (r.some((t) => /Allemagne/.test(t))) {
        throw new Error('l Allemagne est trouvee par « DE » : une source ISO a ete ajoutee, '
            + 'mettre ce test a jour (la limite est levee, tant mieux)');
    }
    premier('allem', '+49 (Allemagne)');   // le nom, lui, fonctionne
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) {
    echecs.forEach((e) => console.error('  ✗ ' + e + '\n'));
    process.exit(1);
}
