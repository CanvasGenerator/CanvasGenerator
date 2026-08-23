/**
 * ============================================================================
 *  TESTS DU JS DE CASCADE
 * ============================================================================
 *  Chaque test correspond a une regle du contrat ou a un bug rencontre.
 *  Les cas marques [REGRESSION] ont reellement casse en cours de projet.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { creerDom } = require('./harness-dom');

const SRC = path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs');
const blocs = [...fs.readFileSync(SRC, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
const CASCADE = blocs[blocs.length - 1][1];

const LAYOUT = [['Email', 0], ['Campus', 1], ['Niveau', 1], ['Speciality', 1],
                ['Rhythm', 1], ['Language', 1], ['Rentree', 1], ['Programme', 1],
                ['Consentements', 0]];

/* Deux programmes sur le meme campus, dont un ouvert a DEUX niveaux : c'est le
   cas qui a revele le bug du multipicklist. */
const PROGRAMMES = [
    { id: 'p1', name: 'Annee 1', campus: 'EFAP PARIS', level: 'Terminale;Bac obtenu',
      speciality: 'Comm', rhythm: 'FT', language: 'FR' },
    { id: 'p2', name: 'Annee 4', campus: 'EFAP PARIS', level: 'Bac+3',
      speciality: 'Comm', rhythm: 'FT', language: 'FR' },
    { id: 'p3', name: 'Annee 4 Luxe', campus: 'EFAP PARIS', level: 'Bac+3',
      speciality: 'Luxe', rhythm: 'PT', language: 'EN' },
    { id: 'p4', name: 'Lille A1', campus: 'EFAP LILLE', level: 'Terminale',
      speciality: 'Comm', rhythm: 'FT', language: 'FR' },
];

const BASE = {
    school: 'efap',
    campus: [{ value: 'EFAP PARIS', label: 'PARIS' }, { value: 'EFAP LILLE', label: 'LILLE' }],
    programs: PROGRAMMES,
    ptats: [{ ptatId: 't-p2-2026', programId: 'p2', termId: 'T2026' },
            { ptatId: 't-p1-2026', programId: 'p1', termId: 'T2026' },
            { ptatId: 't-p3-2027', programId: 'p3', termId: 'T2027' }],
    terms: [{ value: 'T2026', label: 'Rentree 2026' }, { value: 'T2027', label: 'Rentree 2027' }],
    instances: [], appointments: [],
    picklists: { StudyLevel: [
        { value: 'Terminale', label: 'Terminale', ordre: 1 },
        { value: 'Bac obtenu', label: 'Bac obtenu', ordre: 1 },
        { value: 'Bac+3', label: 'Bac+3', ordre: 4 },
    ] },
};

const cfg = (o = {}) => Object.assign({
    progressif: true, ordre: 'campus,niveau,speciality,rhythm,language,rentree',
    langueDefaut: '', rentreeDecalee: false,
    champs: { Speciality: { visible: 'toujours', niveauMin: 0 },
              Rhythm: { visible: 'toujours', niveauMin: 0 },
              Language: { visible: 'toujours', niveauMin: 0 } },
}, o);

let ok = 0; const echecs = [];
function test(nom, fn) {
    const dom = creerDom(LAYOUT);
    try {
        fn(dom, (config, selections = {}) => {
            dom.reset();
            for (const [k, v] of Object.entries(selections)) dom.champs[k].value = v;
            vm.runInNewContext(CASCADE, {
                window: { SOCLE_DATA: Object.assign({}, BASE, { config }) },
                document: dom.document,
            });
        });
        ok++;
    } catch (e) { echecs.push(`${nom}\n      ${e.message}`); }
}
function egal(obtenu, attendu, quoi) {
    const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
    if (a !== b) throw new Error(`${quoi}\n      obtenu  : ${a}\n      attendu : ${b}`);
}

/* ---- Multipicklist ----------------------------------------------------- */
test('Un programme multi-niveaux apparait sous CHACUN de ses niveaux [REGRESSION]', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS' });
    const niveaux = d.options('Niveau');
    if (!niveaux.includes('Terminale')) throw new Error('Terminale absent');
    if (!niveaux.includes('Bac obtenu')) throw new Error('Bac obtenu absent');
    if (niveaux.includes('Terminale;Bac obtenu')) {
        throw new Error('la chaine brute est proposee comme option, elle est inchoisissable');
    }
});

test('Selectionner Bac obtenu remonte bien le programme multi-niveaux', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac obtenu', Rentree: 'T2026' });
    egal(d.options('Programme'), ['Annee 1'], 'programmes pour Bac obtenu');
});

/* ---- Cloisonnement par campus ------------------------------------------ */
test('Le campus filtre : Lille ne remonte pas les programmes de Paris', (d, run) => {
    run(cfg(), { Campus: 'EFAP LILLE' });
    egal(d.options('Niveau'), ['Terminale'], 'niveaux du campus Lille');
});

/* ---- Matrice par ecole ------------------------------------------------- */
test('visible=jamais masque le champ meme avec plusieurs valeurs', (d, run) => {
    run(cfg({ champs: { Speciality: { visible: 'jamais', niveauMin: 0 },
                        Rhythm: { visible: 'toujours', niveauMin: 0 },
                        Language: { visible: 'toujours', niveauMin: 0 } } }),
        { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (d.visible('Speciality')) throw new Error('Speciality visible alors que jamais');
});

test('visible=niveau respecte le seuil (rythme EFAP a partir de Bac+3)', (d, run) => {
    const c = cfg({ champs: { Speciality: { visible: 'toujours', niveauMin: 0 },
                              Rhythm: { visible: 'niveau', niveauMin: 4 },
                              Language: { visible: 'toujours', niveauMin: 0 } } });
    run(c, { Campus: 'EFAP PARIS', Niveau: 'Terminale' });
    if (d.visible('Rhythm')) throw new Error('Rhythm visible en Terminale (ordre 1 < 4)');
    run(c, { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (!d.visible('Rhythm')) throw new Error('Rhythm masque en Bac+3 (ordre 4 >= 4)');
});

test('progressif=false affiche les champs sans attendre le niveau (cas EFAP)', (d, run) => {
    run(cfg({ progressif: true }), { Campus: 'EFAP PARIS' });
    const avecProgressif = d.visible('Speciality');
    run(cfg({ progressif: false }), { Campus: 'EFAP PARIS' });
    const sansProgressif = d.visible('Speciality');
    if (avecProgressif) throw new Error('progressif=true : Speciality visible sans niveau');
    if (!sansProgressif) throw new Error('progressif=false : Speciality masque');
});

test('langueDefaut est applique quand rien n\'est choisi (IFA Paris)', (d, run) => {
    run(cfg({ langueDefaut: 'FR' }), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    egal(d.champs.Language.value, 'FR', 'langue par defaut');
});

/* ---- Ordre d'affichage ------------------------------------------------- */
test('Ordre IFA : la langue passe avant la specialite [REGRESSION]', (d, run) => {
    run(cfg({ ordre: 'campus,niveau,language,speciality,rhythm,rentree' }),
        { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    egal(d.ordre(),
        ['Email', 'Campus', 'Niveau', 'Language', 'Speciality', 'Rhythm', 'Rentree', 'Programme', 'Consentements'],
        'ordre des champs');
});

test('Un champ absent de la config garde sa place, il ne passe pas en tete [REGRESSION]', (d, run) => {
    run(cfg({ ordre: 'campus,niveau,speciality,rhythm,language,rentree' }),
        { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    const o = d.ordre();
    if (o[0] !== 'Email') throw new Error(`Email n'est plus premier : ${o.join(' > ')}`);
    if (o[o.length - 1] !== 'Consentements') throw new Error(`Consentements deplace : ${o.join(' > ')}`);
    if (o.indexOf('Programme') !== o.length - 2) {
        throw new Error(`Programme mal place : ${o.join(' > ')}`);
    }
});

/* Cas qui exerce reellement la reprise des champs non listes : Programme est
   place AVANT les champs ordonnes. Sans la liste `restants`, il resterait
   coince en tete du groupe. Le test precedent ne le voyait pas, parce que dans
   la disposition standard Programme suit deja Rentree — decouvert par test de
   mutation, pas par relecture. */
test('Programme place avant les champs ordonnes est ramene a sa place [REGRESSION]', () => {
    const LAYOUT2 = [['Email', 0], ['Programme', 1], ['Campus', 1], ['Niveau', 1],
                     ['Speciality', 1], ['Rhythm', 1], ['Language', 1], ['Rentree', 1],
                     ['Consentements', 0]];
    const d2 = creerDom(LAYOUT2);
    d2.reset();
    d2.champs.Campus.value = 'EFAP PARIS';
    d2.champs.Niveau.value = 'Bac+3';
    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, { config: cfg({ ordre: 'campus,niveau,language,speciality,rhythm,rentree' }) }) },
        document: d2.document,
    });
    const o = d2.ordre();
    const iProg = o.indexOf('Programme');
    const iRentree = o.indexOf('Rentree');
    if (iProg < iRentree) {
        throw new Error(`Programme reste avant Rentree : ${o.join(' > ')}`);
    }
    if (o[0] !== 'Email') throw new Error(`Email deplace : ${o.join(' > ')}`);
});

/* ---- Resolution du PTAT ------------------------------------------------ */
test('Le PTAT se resout sur le couple programme x rentree', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', Rentree: 'T2026', Programme: 'p2' });
    egal(d.champs.PTAT_Id.value, 't-p2-2026', 'PTAT resolu');
});

test('Un couple programme x rentree inexistant laisse le PTAT vide', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', Rentree: 'T2027', Programme: 'p2' });
    egal(d.champs.PTAT_Id.value, '', 'PTAT pour un couple absent');
});

/* ---- Robustesse -------------------------------------------------------- */
test('Sans config, le comportement reste celui d\'avant la matrice', (d, run) => {
    run(undefined, { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (!d.options('Niveau').length) throw new Error('cascade inerte sans config');
});

test('SOCLE_DATA null ne casse rien : le HTML statique reste en place', (d) => {
    vm.runInNewContext(CASCADE, { window: { SOCLE_DATA: null }, document: d.document });
});

/* [REGRESSION] La cascade doit ATTENDRE le DOM.
   Le socle est inclus en haut de page : au moment ou son JS tourne, le
   formulaire n'existe pas encore. Sans attente, tous les querySelector rendent
   null et la cascade sort en silence — les listes restent vides et RIEN ne
   signale la panne. Constate le 2026-08-23 sur un formulaire reel publie : la
   cascade n'avait jamais pu fonctionner.

   Ce test echoue si quelqu'un retire l'attente du DOM. */
test('attend DOMContentLoaded quand le document charge encore', () => {
    const d = creerDom(LAYOUT);
    d.document.readyState = 'loading';

    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, { config: cfg({}) }) },
        document: d.document,
    });

    if (d.nbEcouteurs('DOMContentLoaded') !== 1) {
        throw new Error('la cascade ne s\'abonne pas a DOMContentLoaded');
    }
    const avant = d.options('Campus');
    if (avant && avant.length) {
        throw new Error(`la cascade a rempli Campus AVANT le DOM : ${JSON.stringify(avant)}`);
    }

    d.emettre('DOMContentLoaded');
    const apres = d.options('Campus');
    if (!apres || !apres.length) {
        throw new Error('Campus toujours vide apres DOMContentLoaded');
    }
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) {
    echecs.forEach((e) => console.error('  ✗ ' + e + '\n'));
    process.exit(1);
}
