/**
 * ============================================================================
 *  VALIDATION DU NUMERO DE TELEPHONE
 * ============================================================================
 *  Deux etages, testes ensemble parce qu'ils vivent dans la meme fonction :
 *
 *    1. SOCLE MINIMAL, tous pays : chiffres uniquement, longueur plausible.
 *       ⚠ Il comble un TROU REEL. Les six formulaires portent un controle
 *       `/^[0-9]{7,14}$/`, mais dans `blocks/forms/**` — inerte en page
 *       publiee (PASSATION §1.1). En production, aucune validation du
 *       telephone n'existait : des LETTRES partaient au CRM. Trouve par la
 *       recette le 02/09 sur un pays absent de la DE.
 *
 *    2. LONGUEUR PAR PAYS, si `LPB_Mapping_Indicatifs` la connait.
 *
 *  On teste la fonction REELLE du socle, extraite du fichier — pas une copie.
 * ============================================================================
 */
'use strict';
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

/* Les bornes sont lues DANS le socle : si quelqu'un les change, les messages
   attendus par les tests suivent, et un test qui parlerait encore de 5 et 15
   ne mentirait pas en silence. */
function constante(nom) {
    const m = new RegExp('var\\s+' + nom + '\\s*=\\s*(\\d+)').exec(src);
    if (!m) throw new Error('constante introuvable dans le socle : ' + nom);
    return Number(m[1]);
}
const MIN = constante('TEL_MIN_CHIFFRES');
const MAX = constante('TEL_MAX_CHIFFRES');

const code = `var TEL_MIN_CHIFFRES = ${MIN}; var TEL_MAX_CHIFFRES = ${MAX};\n`
    + [extraire('indicatifDe'), extraire('erreurLongueurTel')].join('\n');

/** Faux champ telephone : juste ce que les deux fonctions touchent. */
function champTel(valeur, indicatif) {
    const select = { value: indicatif };
    const wrap = { querySelector: (s) => (/Indicatif/.test(s) ? select : null) };
    return { value: valeur, closest: (s) => (/phone-wrap/.test(s) ? wrap : null) };
}

const TABLE = {
    '33':  { min: 9, max: 9, pays: 'France' },
    '32':  { min: 8, max: 9, pays: 'Belgique' },
    '216': { min: 8, max: 8, pays: 'Tunisie' },
};

/** `table` explicitement `null` = le socle n'a publie aucune table. */
function verifier(valeur, indicatif, table, langue) {
    const ctx = {
        D: { longueursTel: table },
        langueAffichage: () => langue || 'fr',
        document: { querySelector: () => null },
        resultat: null,
        champ: champTel(valeur, indicatif),
    };
    vm.runInNewContext(code + '\nresultat = erreurLongueurTel(champ);', ctx);
    return ctx.resultat;
}

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + '\n      ' + e.message); } }

function accepte(valeur, ind, quoi, table) {
    const r = verifier(valeur, ind, table === undefined ? TABLE : table);
    if (r) throw new Error(`${quoi}\n      « ${valeur} » (+${ind}) REFUSE : ${r}`);
}
function refuse(valeur, ind, quoi, table) {
    const r = verifier(valeur, ind, table === undefined ? TABLE : table);
    if (!r) throw new Error(`${quoi}\n      « ${valeur} » (+${ind}) accepte, alors qu'il devrait etre refuse`);
    return r;
}

console.log('\n── Validation du telephone ───────────────────────\n');
console.log(`  socle minimal : ${MIN} a ${MAX} chiffres, lu dans le socle\n`);

/* ══ 1. SOCLE MINIMAL — s'applique meme sans regle de pays ══════════════ */

test('Des LETTRES sont refusees, meme pour un pays absent de la DE [REGRESSION]', () => {
    /* Le bug remonte par la recette le 02/09 : le formulaire partait avec des
       lettres dans le portable, parce qu'aucune validation ne tournait en
       production sur un pays hors DE. */
    const r = refuse('abcdefghi', '91', 'lettres seules');   // +91 absent de TABLE
    if (!/chiffres/.test(r)) throw new Error('le message ne parle pas de chiffres : ' + r);
    refuse('06 12 ab 56 78', '91', 'lettres au milieu');
    refuse('06AB123456',     '33', 'lettres sur un pays connu');
});

test('Un numero trop court est refuse, pays connu ou non [REGRESSION]', () => {
    refuse('123',  '91', 'trois chiffres, pays absent de la DE');
    refuse('1234', '91', 'quatre chiffres, pays absent de la DE');
    accepte('12345', '91', `${MIN} chiffres : la borne basse passe`);
});

test('Un numero absurdement long est refuse', () => {
    refuse('1234567890123456', '91', `${MAX + 1} chiffres`);
    accepte('123456789012345', '91', `${MAX} chiffres : la borne haute passe`);
});

test('Les separateurs de saisie restent acceptes', () => {
    /* On ne compte que les chiffres : espaces, points, tirets, parentheses et
       un + en tete sont des habitudes de saisie, pas des erreurs. */
    accepte('06 12 34 56 78',   '33', 'espaces');
    accepte('06.12.34.56.78',   '33', 'points');
    accepte('06-12-34-56-78',   '33', 'tirets');
    accepte('(0)612345678',     '33', 'parentheses');
    accepte('+33 6 12 34 56 78', '33', 'indicatif retape');
});

/* ══ 2. LONGUEUR PAR PAYS ═══════════════════════════════════════════════ */

test('France : les saisies NORMALES passent toutes [REGRESSION]', () => {
    /* Le piege principal. Le 0 de tete est un prefixe national : sans le
       retirer, « 06 12 34 56 78 » ferait 10 chiffres contre 9 attendus, et le
       controle refuserait la facon dont ecrivent la quasi-totalite des
       candidats francais. */
    accepte('0612345678',     '33', 'numero colle');
    accepte('06 12 34 56 78', '33', 'numero espace');
    accepte('612345678',      '33', 'sans le 0');
});

test('France : un chiffre en trop ou en moins est refuse', () => {
    const r = refuse('06 12 34 56 7', '33', 'un chiffre manquant');
    if (!/9 chiffres/.test(r)) throw new Error('le message ne dit pas combien : ' + r);
    if (!/France/.test(r))     throw new Error('le message ne dit pas quel pays : ' + r);
    refuse('06 12 34 56 789', '33', 'un chiffre en trop');
});

test('Fourchette : la Belgique accepte 8 ET 9 chiffres', () => {
    accepte('12345678',  '32', '8 chiffres');
    accepte('123456789', '32', '9 chiffres');
    const r = refuse('1234567', '32', '7 chiffres');
    if (!/8 à 9/.test(r)) throw new Error('la fourchette n est pas annoncee : ' + r);
});

test('Pays absent de la DE : longueur LIBRE, dans les bornes du socle', () => {
    /* La regle qui protege les candidats. La DE ne couvre que 14 pays actifs ;
       les autres doivent passer des lors que la saisie est plausible — sans
       quoi la mise en service fermerait la porte a presque tout
       l'international. */
    accepte('123456789',      '91',  'Inde, 9 chiffres, absente de la table');
    accepte('12345678901234', '998', 'Ouzbekistan, 14 chiffres, absent de la table');
});

test('Table absente ou ligne incomplete : seul le socle minimal s applique', () => {
    if (verifier('123456789', '33', null)) throw new Error('socle sans table : ne doit rien dire');
    if (verifier('123456789', '33', {}))   throw new Error('table vide : ne doit rien dire');
    if (verifier('123456789', '33', { '33': { pays: 'France' } })) {
        throw new Error('ligne sans min/max : ne doit rien dire');
    }
    /* Mais le socle minimal, lui, s'applique toujours : */
    if (!verifier('abc', '33', null)) throw new Error('des lettres doivent etre refusees meme sans table');
});

test('Champ vide : c est `required` qui parle, pas nous', () => {
    if (verifier('', '33', TABLE)) throw new Error('un champ vide ne doit pas produire ce message');
});

test('Les messages suivent la langue de la page', () => {
    const paysEn = verifier('12345678', '33', TABLE, 'en');
    if (!/must have 9 digits/.test(paysEn)) throw new Error('message pays anglais attendu : ' + paysEn);

    const baseEn = verifier('abc', '91', TABLE, 'en');
    if (!/digits only/.test(baseEn)) throw new Error('message socle anglais attendu : ' + baseEn);
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) {
    echecs.forEach((e) => console.error('  ✗ ' + e + '\n'));
    process.exit(1);
}
