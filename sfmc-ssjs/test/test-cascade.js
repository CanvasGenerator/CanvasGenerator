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
    /* Le couple qui a casse la candidature EFAP le 01/09 : meme campus, meme
       niveau, l'un SANS specialite. `distinct` ignorant les valeurs vides, la
       specialite paraissait unique et etait posee d'office — ce qui eliminait
       justement le programme qui n'en a pas. Niveau a part pour ne pas
       perturber les autres cas. */
    { id: 'p5', name: 'Master FR', campus: 'EFAP PARIS', level: 'Bac+5',
      speciality: '', rhythm: 'FT', language: 'FR' },
    { id: 'p6', name: 'Master EN', campus: 'EFAP PARIS', level: 'Bac+5',
      speciality: 'Luxe', rhythm: 'FT', language: 'EN' },
];

const BASE = {
    school: 'efap',
    campus: [{ value: 'EFAP PARIS', label: 'PARIS' }, { value: 'EFAP LILLE', label: 'LILLE' }],
    programs: PROGRAMMES,
    ptats: [{ ptatId: 't-p2-2026', programId: 'p2', termId: 'T2026' },
            { ptatId: 't-p1-2026', programId: 'p1', termId: 'T2026' },
            { ptatId: 't-p3-2027', programId: 'p3', termId: 'T2027' },
            { ptatId: 't-p5-2026', programId: 'p5', termId: 'T2026' },
            { ptatId: 't-p6-2026', programId: 'p6', termId: 'T2026' }],
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

/* Brochure et formulaires evenement ne portent QUE la specialite : le contrat
   ne prevoit rythme, langue et rentree que sur la candidature. La cascade doit
   donc tolerer l'absence des trois autres champs. */
const LAYOUT_SPECIALITE_SEULE = [['Email', 0], ['Campus', 1], ['Niveau', 1],
                                 ['Speciality', 1], ['Consentements', 0]];

/* Le nom que portent REELLEMENT les formulaires EDH. Tous les autres tests
   disent 'Niveau', le nom de form-salesforce-core — c'est ce qui a laisse
   passer un socle qui ne lisait pas StudyLevel. */
const LAYOUT_STUDYLEVEL = [['Email', 0], ['Campus', 1], ['StudyLevel', 1],
                           ['Speciality', 1], ['Consentements', 0]];

/* La candidature se reconnait a son `TypeFormulaire`, et elle seule restreint
   la liste des niveaux aux programmes reellement ouverts. */
/* `StudyLevel`, comme les six formulaires EDH — et non `Niveau`, que seul
   form-salesforce-core emploie. La distinction n'est pas cosmetique : sur un
   champ nomme `Niveau`, la ligne historique `remplir('Niveau', ...)` filtre
   deja la liste par campus, quel que soit le type de formulaire. */
const LAYOUT_CANDIDATURE = [['Email', 0], ['TypeFormulaire', 1], ['Campus', 1],
                            ['StudyLevel', 1], ['Speciality', 1], ['Rhythm', 1],
                            ['Language', 1], ['Rentree', 1], ['Programme', 1],
                            ['Consentements', 0]];

/* « Vous etes » ne fait pas partie de la cascade, mais une condition croisee
   peut s'y referer : c'est le cas de la specialite de la brochure CREAD. */
const LAYOUT_AVEC_CONTACT = [['Email', 0], ['Campus', 1], ['Niveau', 1],
                             ['VousEtes', 1], ['Speciality', 1], ['Consentements', 0]];

let ok = 0; const echecs = [];
function test(nom, fn, layout = LAYOUT) {
    const dom = creerDom(layout);
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
    /* Specialite mise a `jamais` EXPRES : depuis le 31/08, un champ progressif
       attend que TOUS ses precedents soient remplis, et la specialite precede
       le rythme. Un champ que la matrice masque ne bloque pas — c'est ce qui
       permet d'isoler ici la seule regle testee, le seuil de niveau. */
    const c = cfg({ champs: { Speciality: { visible: 'jamais', niveauMin: 0 },
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

/* ---- Formulaires sans la cascade complete ------------------------------ */
test('Speciality seule : la cascade tourne sans rythme, langue ni rentree', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    egal(d.options('Speciality').sort(), ['Comm', 'Luxe'], 'specialites proposees');
    if (!d.visible('Speciality')) throw new Error('Speciality masquee alors qu il y a deux valeurs');
}, LAYOUT_SPECIALITE_SEULE);

test('Speciality seule : une valeur unique reste masquee mais renseignee', (d, run) => {
    run(cfg(), { Campus: 'EFAP LILLE', Niveau: 'Terminale' });
    egal(d.champs.Speciality.value, 'Comm', 'valeur unique posee d office');
    if (d.visible('Speciality')) throw new Error('Speciality affichee alors qu il n y a qu une valeur');
}, LAYOUT_SPECIALITE_SEULE);

/* ---- Nom du champ niveau ----------------------------------------------- */
test('StudyLevel filtre la specialite au meme titre que Niveau [REGRESSION]', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'Bac+3' });
    egal(d.options('Speciality').sort(), ['Comm', 'Luxe'], 'specialites a Bac+3');
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'Terminale' });
    egal(d.options('Speciality'), ['Comm'], 'specialites en Terminale');
}, LAYOUT_STUDYLEVEL);

test('StudyLevel declenche la cascade [REGRESSION]', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS' });
    const avant = d.options('Speciality').length;
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'Terminale' });
    if (d.options('Speciality').length === avant) {
        throw new Error('la liste ne bouge pas quand le niveau change — socle sourd a StudyLevel');
    }
}, LAYOUT_STUDYLEVEL);

/* ---- Le programme se deduit des PROGRAMMES ------------------------------ */
test('Les programmes sont proposes SANS attendre la rentree [REGRESSION]', (d, run) => {
    /* La liste venait des PTAT et restait vide tant qu'aucune rentree n'etait
       choisie — au rebours de tous les autres formulaires. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    egal(d.options('Programme').sort(), ['Annee 4', 'Annee 4 Luxe'], 'programmes sans rentree');
});

test('Un programme SANS PTAT apparait quand meme [REGRESSION]', (d, run) => {
    /* Le PTAT est une fenetre de candidature, pas la definition du cursus.
       « Lille A1 » n'en a aucun et n'etait donc jamais propose. */
    run(cfg(), { Campus: 'EFAP LILLE', Niveau: 'Terminale' });
    egal(d.options('Programme'), ['Lille A1'], 'programme sans PTAT');
    egal(d.champs.PTAT_Id.value, '', 'PTAT invente pour un programme qui n en a pas');
});

test('La rentree RESTREINT la liste des programmes', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', Rentree: 'T2027' });
    egal(d.options('Programme'), ['Annee 4 Luxe'], 'programmes de la rentree 2027');
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', Rentree: 'T2026' });
    egal(d.options('Programme'), ['Annee 4'], 'programmes de la rentree 2026');
});

test('Le PTAT est pose meme sans rentree choisie [REGRESSION]', (d, run) => {
    /* Un programme a rentree unique voit son champ Rentree masque par la regle
       « une seule valeur » : exiger la rentree laissait alors PTAT_Id vide. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', Speciality: 'Luxe', Programme: 'p3' });
    egal(d.champs.PTAT_Id.value, 't-p3-2027', 'PTAT non resolu');
});

/* ---- Obligatoire = affiche -------------------------------------------- */
test('`required` suit la visibilite du champ [REGRESSION]', (d, run) => {
    /* C'est le NAVIGATEUR qui exige les champs : le JS des blocs ne tourne que
       dans le builder. Laisser `required` sur un champ masque bloquerait la
       soumission sans rien montrer — impossible de mettre le focus sur un
       champ invisible, l'utilisateur ne verrait qu'un bouton sans effet. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (!d.visible('Speciality')) throw new Error('prealable : Speciality devrait etre visible');
    if (!d.requis('Speciality')) throw new Error('champ affiche mais pas exige');

    run(cfg({ champs: { Speciality: { visible: 'jamais', niveauMin: 0 },
                        Rhythm: { visible: 'toujours', niveauMin: 0 },
                        Language: { visible: 'toujours', niveauMin: 0 } } }),
        { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (d.visible('Speciality')) throw new Error('prealable : Speciality devrait etre masquee');
    if (d.requis('Speciality')) throw new Error('champ masque encore exige : soumission bloquee sans rien a l ecran');
});

test('Un champ a valeur unique est masque, renseigne, et NON exige', (d, run) => {
    run(cfg(), { Campus: 'EFAP LILLE', Niveau: 'Terminale' });
    egal(d.champs.Speciality.value, 'Comm', 'valeur unique posee');
    if (d.visible('Speciality')) throw new Error('champ a valeur unique affiche');
    if (d.requis('Speciality')) throw new Error('champ masque exige');
});

/* ---- Referentiels de niveau divergents --------------------------------- */
test('Le niveau du formulaire et celui des programmes se rejoignent [REGRESSION]', (d, run) => {
    /* Le formulaire envoie le referentiel Account (BAC+3, majuscules), les
       programmes portent celui de LearningProgram (Bac+3). La comparaison
       litterale ne matchait rien. */
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'BAC+3' });
    egal(d.options('Speciality').sort(), ['Comm', 'Luxe'], 'specialites pour BAC+3 en majuscules');
}, LAYOUT_STUDYLEVEL);

test('« BAC obtenu ou Prépa » rejoint « Bac obtenu » [REGRESSION]', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'BAC obtenu ou Prépa' });
    egal(d.options('Speciality'), ['Comm'], 'specialites pour le libelle long');
}, LAYOUT_STUDYLEVEL);

test('Aucune valeur atteignable : la liste est VIDEE, pas laissee telle quelle [REGRESSION]', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'BAC+3' });
    egal(d.options('Speciality').length, 2, 'deux specialites au depart');
    run(cfg(), { Campus: 'EFAP PARIS', StudyLevel: 'Bac+1' });
    egal(d.options('Speciality'), [], 'liste videe quand plus rien n est atteignable');
}, LAYOUT_STUDYLEVEL);

/* ---- Conditions croisees (regle CREAD) --------------------------------- */
const CONDS = 'Campus=EFAP PARIS;VousEtes=Career Change';
const cfgCond = () => cfg({ champs: {
    Speciality: { visible: 'toujours', niveauMin: 0, conditions: CONDS },
    Rhythm:     { visible: 'toujours', niveauMin: 0 },
    Language:   { visible: 'toujours', niveauMin: 0 },
} });

test('Conditions croisees : les deux remplies, le champ est propose', (d, run) => {
    run(cfgCond(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', VousEtes: 'Career Change' });
    if (!d.visible('Speciality')) throw new Error('Speciality masquee alors que les deux conditions sont vraies');
}, LAYOUT_AVEC_CONTACT);

test('Conditions croisees : une seule remplie ne suffit pas', (d, run) => {
    run(cfgCond(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', VousEtes: 'Student' });
    if (d.visible('Speciality')) throw new Error('Speciality proposee au mauvais type de contact');
    run(cfgCond(), { Campus: 'EFAP LILLE', Niveau: 'Terminale', VousEtes: 'Career Change' });
    if (d.visible('Speciality')) throw new Error('Speciality proposee au mauvais campus');
}, LAYOUT_AVEC_CONTACT);

test('Conditions croisees : un champ cite mais absent du formulaire masque', (d, run) => {
    run(cfgCond(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (d.visible('Speciality')) throw new Error('condition invérifiable traitee comme vraie');
}, LAYOUT_SPECIALITE_SEULE);

test('Sans conditions, rien ne change [REGRESSION]', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', VousEtes: 'Student' });
    if (!d.visible('Speciality')) throw new Error('Speciality masquee sans aucune condition posee');
}, LAYOUT_AVEC_CONTACT);

/* Le cas BRASSART cumule les deux : rythme a partir de bac+3 ET pour la seule
   direction artistique. Aucun autre test ne croisait un seuil de niveau avec
   une condition — c'est la combinaison, pas chaque moitie, qui pouvait casser. */
const cfgCumul = (conds) => cfg({ champs: {
    Speciality: { visible: 'jamais', niveauMin: 0 },
    Rhythm:     { visible: 'jamais', niveauMin: 0 },
    Language:   { visible: 'niveau', niveauMin: 4, conditions: conds },
} });

test('Cumul seuil + condition : les deux remplis, le champ est propose', (d, run) => {
    run(cfgCumul('Campus=EFAP PARIS'), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (!d.visible('Language')) throw new Error('Language masque alors que seuil et condition sont vrais');
});

test('Cumul seuil + condition : le seuil seul ne suffit pas', (d, run) => {
    run(cfgCumul('Campus=EFAP LILLE'), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (d.visible('Language')) throw new Error('Language propose alors que la condition est fausse');
});

test('Cumul seuil + condition : la condition seule ne suffit pas', (d, run) => {
    run(cfgCumul('Campus=EFAP PARIS'), { Campus: 'EFAP PARIS', Niveau: 'Terminale' });
    if (d.visible('Language')) throw new Error('Language propose sous le seuil de niveau');
});

/* ---- Niveaux restreints aux programmes ouverts -------------------------- */
/* Proposer un niveau sans programme mene a une cascade vide, sans explication.
   A EFAP AIX, six niveaux sur les treize du referentiel ont un programme. */
test('Candidature : seuls les niveaux ayant un programme sont proposes', (d, run) => {
    run(cfg(), { TypeFormulaire: 'candidature', Campus: 'EFAP LILLE' });
    egal(d.options('StudyLevel'), ['Terminale'], 'niveaux ouverts a Lille');
}, LAYOUT_CANDIDATURE);

test('Candidature : la graphie ACCOUNT est conservee, pas celle des programmes', (d, run) => {
    /* Les programmes disent « Bac obtenu », Account attend « BAC obtenu ou
       Prepa ». C'est la valeur ACCOUNT qui doit partir : le formulaire ecrit
       dans Account.Academic_Level_List__c, et une valeur hors value set y est
       rejetee en silence. Le jeu d'essai reproduit l'ecart via canonNiveau. */
    run(cfg(), { TypeFormulaire: 'candidature', Campus: 'EFAP PARIS' });
    const niveaux = d.options('StudyLevel');
    if (niveaux.indexOf('Bac+5') >= 0) {
        throw new Error('un niveau absent du referentiel Account est propose : ' + niveaux.join(','));
    }
    if (!niveaux.length) throw new Error('liste videe alors que des programmes existent');
}, LAYOUT_CANDIDATURE);

test('Hors candidature, la liste des niveaux n\'est pas restreinte', (d, run) => {
    run(cfg(), { TypeFormulaire: 'brochure', Campus: 'EFAP LILLE' });
    /* Le referentiel complet reste propose : seule la candidature restreint. */
    if (d.options('StudyLevel').length <= 1) {
        throw new Error('la brochure a ete restreinte alors qu elle ne doit pas l etre');
    }
}, LAYOUT_CANDIDATURE);

/* ---- Valeur unique : seulement si tout le monde la porte ---------------- */
/* [REGRESSION] Candidature EFAP, 01/09. Paris + « BAC obtenu ou Prepa » laissait
   deux programmes, l'un sans specialite. La specialite de l'autre etait posee
   d'office, ce qui ecartait le premier ; la liste des langues tombait alors a
   « EN » seul, le FR choisi par le candidat etait ECRASE par EN, et plus aucun
   programme ne survivait — ni rentree, ni PTAT. */
test('Un critere que tous les programmes ne portent pas n\'est PAS pose d\'office', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+5' });
    egal(d.champs.Speciality.value, '', 'specialite posee alors qu un programme n en a aucune');
});

test('Le choix de langue survit et designe le bon programme [REGRESSION]', (d, run) => {
    /* DEUX passes, comme dans le navigateur : la premiere sur campus+niveau,
       la seconde apres que le candidat a choisi sa langue. Le bug ne se voyait
       qu'a la seconde — la premiere posait la specialite, la seconde la relisait
       depuis le DOM et eliminait le programme FR. Un test en une seule passe
       passait donc meme avec le bug en place : verifie en sabotant le
       garde-fou. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+5' });
    d.champs.Language.value = 'FR';
    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, { config: cfg() }) },
        document: d.document,
    });
    egal(d.champs.Language.value, 'FR', 'la langue choisie a ete ecrasee');
    egal(d.champs.Programme.value, 'p5', 'programme deduit de la langue');
    egal(d.champs.PTAT_Id.value, 't-p5-2026', 'PTAT resolu');
});

/* ---- Mode progressif --------------------------------------------------- */
/* La regle du 31/08 : un champ progressif n'apparait que si TOUS ceux qui le
   precedent sont renseignes. Avant, le code ne testait que le niveau — la
   langue s'affichait donc avec une specialite vide, et proposait des langues
   qui n'existaient pour aucune specialite atteignable. */
test('Progressif : un champ reste masque tant qu\'un precedent est vide', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (!d.visible('Speciality')) throw new Error('Speciality masquee alors que campus et niveau sont poses');
    if (d.visible('Language')) throw new Error('Language proposee alors que la specialite est vide');
});

test('Progressif : le champ apparait des que ses precedents sont remplis', (d, run) => {
    /* Comm laisse DEUX langues possibles a Bac+3 sur ce jeu d essai : sans quoi
       la regle « une seule valeur » masquerait la langue pour une autre raison
       que celle qu'on teste. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Terminale;Bac obtenu' });
    run(cfg({ ordre: 'campus,niveau,language,speciality,rhythm,rentree' }),
        { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (!d.visible('Language')) throw new Error("l'ordre de l'ecole n'est pas respecte : la langue precede la specialite chez IFA");
});

/* ---- Ordre d'affichage ------------------------------------------------- */
test('Ordre IFA : la langue passe avant la specialite [REGRESSION]', (d, run) => {
    run(cfg({ ordre: 'campus,niveau,language,speciality,rhythm,rentree' }),
        { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    egal(d.ordre(),
        ['Email', 'Campus', 'Niveau', 'Language', 'Speciality', 'Rhythm', 'Rentree', 'Programme', 'Consentements'],
        'ordre des champs');
});

/* Le markup REEL de la candidature : campus et niveau cote a cote dans un
   `.cnd-row`, les quatre champs de cascade enfants directs du formulaire. */
const LAYOUT_DEUX_SECTIONS = [['Email', 0], ['Campus', 1, 'row'], ['StudyLevel', 1, 'row'],
                              ['Speciality', 1], ['Rhythm', 1], ['Language', 1],
                              ['Rentree', 1], ['Consentements', 0]];

test('Ordre IFA applique meme quand les champs ne sont pas freres [REGRESSION]', (d, run) => {
    /* `appliquerOrdre` exigeait que TOUS les porteurs partagent un parent, et
       s'alignait sur celui du premier trouve — le campus, dans son `.cnd-row`.
       Les quatre champs de cascade, enfants du formulaire, etaient donc
       ecartes : il ne restait qu'un porteur et la fonction sortait sans rien
       faire. « Langue avant specialite » n'a jamais eu lieu sur une vraie page.

       On reordonne desormais PAR SECTION. */
    run(cfg({ ordre: 'campus,niveau,language,speciality,rhythm,rentree' }),
        { Campus: 'EFAP PARIS', StudyLevel: 'Bac+3' });
    const o = d.ordre();
    const iL = o.indexOf('Language'), iS = o.indexOf('Speciality');
    if (iL === -1 || iS === -1) throw new Error(`champs introuvables : ${o.join(' > ')}`);
    if (iL > iS) throw new Error(`la langue reste apres la specialite : ${o.join(' > ')}`);
    if (o[0] !== 'Email') throw new Error(`Email n'est plus premier : ${o.join(' > ')}`);
}, LAYOUT_DEUX_SECTIONS);

/* Une seule section, mais le niveau y est place AVANT le campus dans le HTML :
   c'est le reordonnancement qui doit les remettre dans l'ordre demande. */
const LAYOUT_NIVEAU_DABORD = [['Email', 0], ['StudyLevel', 1, 'bloc'], ['Campus', 1, 'bloc'],
                              ['Speciality', 1, 'bloc'], ['Consentements', 0]];

test('Le niveau nomme StudyLevel est reconnu par l ordre [REGRESSION]', (d, run) => {
    /* NOM_DOM ne connaissait que `Niveau` et `Level`. Tous les formulaires EDH
       postent `StudyLevel` : le niveau n'etait donc jamais retrouve ici, il
       restait hors du reordonnancement et gardait sa place — devant le campus,
       alors que la config demande le campus en premier. */
    run(cfg({ ordre: 'campus,niveau,speciality,rhythm,language,rentree' }),
        { Campus: 'EFAP PARIS', StudyLevel: 'Bac+3' });
    egal(d.ordreSection('bloc'), ['Campus', 'StudyLevel', 'Speciality'],
         'le campus doit passer devant le niveau');
}, LAYOUT_NIVEAU_DABORD);

test('Une section n est jamais traversee : chaque champ reste chez lui', (d, run) => {
    run(cfg({ ordre: 'campus,niveau,language,speciality,rhythm,rentree' }),
        { Campus: 'EFAP PARIS', StudyLevel: 'Bac+3' });
    const section = d.ordreSection('row');
    if (section.length !== 2) {
        throw new Error(`la section a change de taille : ${JSON.stringify(section)}`);
    }
    if (d.ordre().indexOf('Campus') !== -1) {
        throw new Error('le campus a quitte sa section pour le formulaire');
    }
}, LAYOUT_DEUX_SECTIONS);

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

/* Le candidat ne CHOISIT plus de programme : « Programme souhaite » est le
   resultat de la cascade, jamais une question. Regle du 31/08. L'ancien test
   de cette place presupposait un choix explicite du candidat — un scenario que
   plus rien ne peut produire. */
test('Le programme n\'est JAMAIS propose, meme avec plusieurs valeurs', (d, run) => {
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    if (d.visible('Programme')) throw new Error('Programme propose au candidat');
});

test('Un programme unique est pose d\'office : c\'est lui qui porte le PTAT', (d, run) => {
    /* La specialite suffit a pincer un seul programme : rythme, langue et
       rentree en decoulent, chacun a valeur unique. C'est le cas nominal de la
       candidature — 132 combinaisons sur 133 chez EFAP. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3', Speciality: 'Luxe' });
    egal(d.champs.Programme.value, 'p3', 'programme deduit');
    egal(d.champs.PTAT_Id.value, 't-p3-2027', 'PTAT deduit du programme');
});

test('Plusieurs programmes possibles : aucun n\'est pose, le PTAT reste vide', (d, run) => {
    /* On ne devine pas a la place du candidat sur un champ qu'il ne voit pas.
       Le PTAT vide se lit au journal du socle (PTAT:absent), la ou une valeur
       inventee serait passee inapercue. */
    run(cfg(), { Campus: 'EFAP PARIS', Niveau: 'Bac+3' });
    egal(d.champs.Programme.value, '', 'aucun programme pose');
    egal(d.champs.PTAT_Id.value, '', 'PTAT vide faute de programme deduit');
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

/* ══════════════════════════════════════════════════════════════════════════
   « Champs visibles des formulaires.xlsx » — 31/08/2026
   ══════════════════════════════════════════════════════════════════════════
   Le champ que le fichier intitule « Programme souhaite » est le champ
   SPECIALITE. Hors candidature, trois ecoles seulement le portent — BRASSART,
   IFA Paris, MoPA — et l'axe vient de
   LPB_Config_Champs_Ecole.ProgrammeVisible. Sur la candidature, les dix ecoles
   l'affichent, et c'est SpecialiteVisible qui decide.

   S'y ajoute le CAMPUS, masque pour les quatre ecoles qui n'en proposent pas. */

test('Hors candidature, la specialite suit l axe de l ecole', (d, jouer) => {
    jouer(cfg({ champs: { Speciality: { visible: 'toujours', niveauMin: 0 } } }),
          { Campus: 'EFAP PARIS', StudyLevel: 'Bac+3' });
    if (!d.visible('Speciality')) throw new Error('specialite masquee alors que l ecole la porte');
    const opts = d.options('Speciality');
    if (!opts.includes('Comm') || !opts.includes('Luxe')) {
        throw new Error(`specialites du couple campus x niveau absentes : ${JSON.stringify(opts)}`);
    }
}, LAYOUT_STUDYLEVEL);

test('Une ecole sans « Programme souhaite » n affiche pas la specialite', (d, jouer) => {
    /* Sept ecoles sur dix : EFAP, CREAD, ESEC, ICART, Ecole Bleue, EFJ, 3WA. */
    jouer(cfg({ champs: { Speciality: { visible: 'jamais', niveauMin: 0 } } }),
          { Campus: 'EFAP PARIS', StudyLevel: 'Bac+3' });
    if (d.visible('Speciality')) throw new Error('specialite proposee malgre un axe jamais');
}, LAYOUT_STUDYLEVEL);

test('Le campus se masque pour les ecoles qui n en proposent pas', (d, jouer) => {
    jouer(cfg({ champs: { Campus: { visible: 'jamais', niveauMin: 0 },
                          Speciality: { visible: 'toujours', niveauMin: 0 } } }), {});
    if (d.visible('Campus')) throw new Error('campus propose malgre CampusVisible=jamais');
    if (d.requis('Campus')) {
        throw new Error('campus masque mais toujours obligatoire : la soumission serait bloquee sans rien montrer');
    }
}, LAYOUT_STUDYLEVEL);

test('Campus masque ET valeur unique : la valeur est posee [REGRESSION]', (d, jouer) => {
    /* Sur un formulaire evenement, les dates sont filtrees par campus et
       « sans campus choisi, aucune date ». Masquer sans poser donnerait donc un
       formulaire sans creneau — une impasse muette. */
    const dom = require('./harness-dom').creerDom(LAYOUT_STUDYLEVEL);
    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, {
            campus: [{ value: 'MOPA ARLES', label: 'ARLES' }],
            config: cfg({ champs: { Campus: { visible: 'jamais', niveauMin: 0 } } }) }) },
        document: dom.document,
    });
    if (dom.visible('Campus')) throw new Error('campus propose malgre CampusVisible=jamais');
    if (dom.champs.Campus.value !== 'MOPA ARLES') {
        throw new Error(`campus unique non pose : ${JSON.stringify(dom.champs.Campus.value)}`);
    }
}, LAYOUT_STUDYLEVEL);

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) {
    echecs.forEach((e) => console.error('  ✗ ' + e + '\n'));
    process.exit(1);
}
