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

/* ---- Regles d'affichage des picklists (retours client 2026-09-02) ------
   Trois retours « Toutes les ecoles » sur « Vous etes » et « Niveau
   d'etudes ». Tous les trois se jouent A L'AFFICHAGE : le value set
   Salesforce reste la seule source des valeurs, et la `value` postee au
   socle d'ecriture ne bouge pas. Les tests verifient les deux moities. */

/* Ces deux champs se remplissent depuis le VALUE SET, pas depuis la cascade :
   `remplir('Niveau', ...)` ne trouve aucun champ de ce nom sur un formulaire
   EDH, qui dit `StudyLevel`. C'est donc bien la table RANG du socle qui decide
   de ce que le candidat lit. */
const LAYOUT_AFFICHAGE = [['Email', 0], ['Campus', 1], ['VousEtes', 1],
                          ['StudyLevel', 1], ['Indicatif', 1], ['Speciality', 1],
                          ['Consentements', 0]];

/* Les valeurs REELLES des value sets de l'org (cf. REFERENCE-API-ORG.md),
   dans un ordre volontairement melange : un value set sort dans l'ordre de
   creation cote org, jamais trie. */
const QUI_CRM = [
    { value: 'Jury',          label: 'Jury' },
    { value: 'Parent',        label: 'Parent' },
    { value: 'Career Change', label: 'Reconversion Professionnelle' },
    { value: 'EDH Student',   label: 'Etudiant dans une école du groupe' },
    { value: 'Student',       label: 'Etudiant' },
];

const NIVEAUX_CRM = [
    { value: 'BAC+3',               label: 'BAC+3' },
    { value: 'Autres',              label: 'Autres' },
    { value: 'Terminale',           label: 'Terminale' },
    { value: 'BAC+1',               label: 'BAC+1' },
    { value: 'BAC obtenu ou Prépa', label: 'BAC obtenu ou Prépa' },
    { value: 'BAC+2',               label: 'BAC+2' },
    { value: 'Collège',             label: 'Collège' },
    { value: 'Seconde',             label: 'Seconde' },
    { value: 'BAC+5 et +',          label: 'BAC+5 et +' },
    { value: 'Première',            label: 'Première' },
    { value: 'BAC+4',               label: 'BAC+4' },
];

/** Joue le socle sur un value set donne et rend le DOM obtenu. */
function jouerAffichage(picklists, marque = 'EFAP') {
    const dom = creerDom(LAYOUT_AFFICHAGE);
    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, { marque, picklists, config: cfg() }) },
        document: dom.document,
    });
    return dom;
}

/** Les `value` reellement postees, dans l'ordre d'affichage. */
const valeurs = (dom, nom) => dom.champs[nom].options.map((o) => o.value);

test('« Jury » n est plus propose au candidat', () => {
    /* La valeur existe toujours dans PersonAccountType__c et sert cote CRM :
       on cesse de la proposer, on ne la retire pas du value set. */
    const d = jouerAffichage({ VousEtes: QUI_CRM });
    if (d.options('VousEtes').some((l) => /jury/i.test(l))) {
        throw new Error('Jury propose : ' + JSON.stringify(d.options('VousEtes')));
    }
    if (valeurs(d, 'VousEtes').includes('Jury')) throw new Error('Jury encore postable');
}, LAYOUT_AFFICHAGE);

test('« Vous etes » : ordre Etudiant, Etudiant <marque>, Parent, Reconversion', () => {
    const d = jouerAffichage({ VousEtes: QUI_CRM });
    egal(d.options('VousEtes'),
         ['Etudiant', 'Étudiant EFAP', 'Parent', 'Reconversion Professionnelle'],
         'libelles de « Vous etes »');
}, LAYOUT_AFFICHAGE);

test('Le libelle prend la marque, la value reste celle du CRM', () => {
    /* Le coeur du contrat : traduire une `value` la ferait rejeter par l'org,
       sans message d'erreur. Seul le texte visible change. */
    const d = jouerAffichage({ VousEtes: QUI_CRM }, 'ICART');
    if (!d.options('VousEtes').includes('Étudiant ICART')) {
        throw new Error('marque absente du libelle : ' + JSON.stringify(d.options('VousEtes')));
    }
    egal(valeurs(d, 'VousEtes'), ['Student', 'EDH Student', 'Parent', 'Career Change'],
         'values postees au socle d ecriture');
}, LAYOUT_AFFICHAGE);

test('Marque inconnue : le libelle Salesforce est conserve', () => {
    /* Le retour client dit « si possible ». Une page hors LPB_Mapping_Ecoles
       ne doit afficher ni « Etudiant » tout court, ni « Etudiant undefined ». */
    const d = jouerAffichage({ VousEtes: QUI_CRM }, '');
    egal(d.options('VousEtes'),
         ['Etudiant', 'Etudiant dans une école du groupe', 'Parent', 'Reconversion Professionnelle'],
         'libelles sans marque connue');
}, LAYOUT_AFFICHAGE);

test('Niveau d etudes : ordre pedagogique, pas celui du value set', () => {
    const d = jouerAffichage({ StudyLevel: NIVEAUX_CRM });
    /* « BAC+1 » du value set s affiche « Bac+1 » depuis le retour du 02/09 :
       le CRM garde ses capitales, l ecran ne les montre plus. */
    egal(d.options('StudyLevel'),
         ['Collège', 'Seconde', 'Première', 'Terminale', 'Bac obtenu ou Prépa',
          'Bac+1', 'Bac+2', 'Bac+3', 'Bac+4', 'Bac+5 et +', 'Autres'],
         'niveaux d etudes');
}, LAYOUT_AFFICHAGE);

test('CAP et BEP tombent a leur place le jour ou le CRM les ajoute', () => {
    /* Le retour client les demande ; ils ne sont pas dans le value set
       aujourd hui. Leur rang est pose pour que l ajout cote CRM suffise, sans
       rouvrir le socle. */
    const d = jouerAffichage({ StudyLevel: NIVEAUX_CRM.concat(
        [{ value: 'BEP', label: 'BEP' }, { value: 'CAP', label: 'CAP' }]) });
    egal(d.options('StudyLevel').slice(-3), ['CAP', 'BEP', 'Autres'],
         'CAP et BEP apres bac+5, avant Autres');
}, LAYOUT_AFFICHAGE);

test('Une valeur inconnue de la table reste affichee, avant « Autres »', () => {
    /* Le contraire d une liste en dur, qui l aurait fait disparaitre en
       silence : une valeur ajoutee cote CRM est mal placee au pire. */
    const d = jouerAffichage({ StudyLevel: NIVEAUX_CRM.concat(
        [{ value: 'Doctorat', label: 'Doctorat' }]) });
    egal(d.options('StudyLevel').slice(-2), ['Doctorat', 'Autres'],
         'valeur inconnue conservee');
}, LAYOUT_AFFICHAGE);

test('Les deux conventions de casse du CRM se classent pareil [REGRESSION]', () => {
    /* `Account.Academic_Level_List__c` dit `BAC obtenu ou Prépa`, celui des
       programmes `Bac obtenu` — c est deja ce qui avait fait rendre 0
       programme au filtre de niveau (cf. canonNiveau). Un tri comparant les
       valeurs a l identique se tromperait pareil, mais sans erreur visible :
       la liste sortirait simplement dans le desordre. */
    const d = jouerAffichage({ StudyLevel: [
        { value: 'Bac+5/+',    label: 'Bac+5/+' },
        { value: 'Autre',      label: 'Autre' },
        { value: 'COLLÈGE',    label: 'COLLÈGE' },
        { value: 'bac+2',      label: 'bac+2' },
        { value: 'Bac obtenu', label: 'Bac obtenu' },
    ] });
    /* Les libelles ressortent dans la casse d affichage (retour du 02/09) :
       ce test regarde l ORDRE, pas la casse — `COLLÈGE` reste bien en tete. */
    egal(d.options('StudyLevel'),
         ['Collège', 'Bac obtenu', 'Bac+2', 'Bac+5/+', 'Autre'],
         'niveaux de l autre referentiel');
}, LAYOUT_AFFICHAGE);

/* ---- Casse des libelles (retour client du 02/09) ----------------------
   « Ne rien ecrire en lettres majuscules (ex : les campus doivent etre en
   minuscule). » Le CRM stocke « EFAP PARIS », « BAC+1 », « COLLEGE » : ses
   valeurs ne bougent pas, seul l'ecran change. Chaque test verifie donc les
   deux moities — le texte lu ET la `value` postee. */

const LAYOUT_CASSE = [['Email', 0], ['Campus', 1], ['Country', 1],
                      ['StudyLevel', 1], ['Consentements', 0]];

function jouerCasse(surcharge) {
    const dom = creerDom(LAYOUT_CASSE);
    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, { config: cfg() }, surcharge) },
        document: dom.document,
    });
    return dom;
}

test('Campus : les capitales du CRM ne sortent plus a l ecran', () => {
    const d = jouerCasse({ campus: [
        { value: 'EFAP PARIS',               label: 'EFAP PARIS' },
        { value: 'BRASSART AIX-EN-PROVENCE', label: 'BRASSART AIX-EN-PROVENCE' },
    ] });
    /* « Aix-en-Provence » et non « Aix-En-Provence » : la particule redescend
       des qu elle n ouvre pas le libelle. */
    egal(d.options('Campus'), ['Brassart Aix-en-Provence', 'Efap Paris'],
         'libelles de campus');
    egal(valeurs(d, 'Campus'), ['BRASSART AIX-EN-PROVENCE', 'EFAP PARIS'],
         'values postees au socle d ecriture');
}, LAYOUT_CASSE);

test('Pays : une majuscule par mot, les particules exceptees', () => {
    const d = jouerCasse({ picklists: { Country: [
        { value: 'FR', label: 'FRANCE' },
        { value: 'CI', label: "CÔTE D'IVOIRE" },
        { value: 'GB', label: 'Royaume-Uni' },
    ] } });
    egal(d.options('Country'), ["Côte d'Ivoire", 'France', 'Royaume-Uni'],
         'libelles de pays');
}, LAYOUT_CASSE);

test('Niveau : casse de PHRASE, pas de titre anglais', () => {
    /* Une majuscule par mot donnerait « Bac Obtenu Ou Prepa » : un titre, pas
       une phrase francaise. Le niveau, « vous etes » et les programmes ne
       prennent donc que leur premiere lettre. */
    const d = jouerCasse({ picklists: { StudyLevel: [
        { value: 'BAC OBTENU OU PRÉPA', label: 'BAC OBTENU OU PRÉPA' },
    ] } });
    egal(d.options('StudyLevel'), ['Bac obtenu ou prépa'], 'niveau en casse de phrase');
    egal(valeurs(d, 'StudyLevel'), ['BAC OBTENU OU PRÉPA'], 'value du niveau intacte');
}, LAYOUT_CASSE);

test('Sigles et codes gardent leurs capitales', () => {
    /* « Bep », « Mba » ou « Lille a1 » seraient des fautes, pas des
       corrections : un sigle n a pas de premiere lettre a mettre en
       majuscule, et « A1 » est un code de programme. */
    const d = jouerCasse({ picklists: { StudyLevel: [
        { value: 'BEP',           label: 'BEP' },
        { value: 'MBA MARKETING', label: 'MBA MARKETING' },
        { value: 'Lille A1',      label: 'Lille A1' },
    ] } });
    const lus = d.options('StudyLevel');
    for (const attendu of ['BEP', 'MBA marketing', 'Lille A1']) {
        if (!lus.includes(attendu)) {
            throw new Error(`« ${attendu} » abime : ${JSON.stringify(lus)}`);
        }
    }
}, LAYOUT_CASSE);

test('Un libelle deja ecrit a la main n est pas retouche', () => {
    /* La regle ne vise que les CAPITALES du CRM. « Bac obtenu », saisi
       correctement, doit ressortir identique — sinon on corrige du texte qui
       n a rien demande. */
    const d = jouerCasse({ picklists: { StudyLevel: [
        { value: 'Bac obtenu', label: 'Bac obtenu' },
        { value: 'Terminale',  label: 'Terminale' },
    ] } });
    egal(d.options('StudyLevel'), ['Terminale', 'Bac obtenu'], 'libelles intacts');
}, LAYOUT_CASSE);

test('La liste de la cascade est triee aussi, sous le nom « Niveau »', () => {
    /* Le niveau porte trois noms de champ selon le formulaire. Ici c'est la
       CASCADE qui remplit la liste, depuis les programmes — donc depuis
       `LearningProgram.Academic_Level_List__c`, l'autre referentiel — et sous
       le nom `Niveau`. Sans les alias RANG.Niveau / RANG.Level, cette liste
       garderait l'ordre des programmes.

       Les programmes sont volontairement ranges du plus haut niveau au plus
       bas : sans tri, `distinct()` rendrait Bac+5/+ en premier. */
    const dom = creerDom(LAYOUT);
    dom.champs.Campus.value = 'EFAP PARIS';
    vm.runInNewContext(CASCADE, {
        window: { SOCLE_DATA: Object.assign({}, BASE, {
            marque: 'EFAP',
            programs: [
                { id: 'x1', name: 'M2', campus: 'EFAP PARIS', level: 'Bac+5/+',
                  speciality: 'Comm', rhythm: 'FT', language: 'FR' },
                { id: 'x2', name: 'L3', campus: 'EFAP PARIS', level: 'Bac+3',
                  speciality: 'Comm', rhythm: 'FT', language: 'FR' },
                { id: 'x3', name: 'A1', campus: 'EFAP PARIS', level: 'Terminale;Bac obtenu',
                  speciality: 'Comm', rhythm: 'FT', language: 'FR' },
            ],
            config: cfg() }) },
        document: dom.document,
    });
    egal(dom.options('Niveau'), ['Terminale', 'Bac obtenu', 'Bac+3', 'Bac+5/+'],
         'niveaux de la cascade');
}, LAYOUT);

test('Indicatifs classes par PAYS, pas par le chiffre en tete [REGRESSION]', () => {
    /* Retour client du 02/09 : « afficher les valeurs par ordre alphabetique ».
       Le libelle du value set commence par le chiffre — `+34 (Espagne)` — donc
       un tri sur le libelle brut reproduirait l'ancien tri numerique sans que
       personne ne s'en apercoive : la liste SEMBLERAIT triee.

       Les indicatifs ci-dessous sont pris tels quels dans LPB_Dico_Traductions
       et choisis pour que les deux tris divergent : par chiffre on aurait
       +33, +34, +212, +596 ; par pays, Espagne, France, Maroc, Martinique. */
    const d = jouerAffichage({ Indicatif: [
        { value: '596', label: '+596 (Martinique)' },
        { value: '33',  label: '+33 (France)' },
        { value: '212', label: '+212 (Maroc)' },
        { value: '34',  label: '+34 (Espagne)' },
    ] });
    egal(d.options('Indicatif'),
         ['+34 (Espagne)', '+33 (France)', '+212 (Maroc)', '+596 (Martinique)'],
         'indicatifs par ordre alphabetique de pays');
}, LAYOUT_AFFICHAGE);

test('Indicatifs : accents et articles suivent la locale', () => {
    /* localeCompare, et non une comparaison de codes : sinon Egypte passerait
       APRES Emirats et Etats-Unis (E accentue > E simple en Unicode brut). */
    const d = jouerAffichage({ Indicatif: [
        { value: '971', label: '+971 (Emirats arabes unis)' },
        { value: '1',   label: '+1 (Etats-Unis)' },
        { value: '20',  label: '+20 (Égypte)' },
    ] });
    egal(d.options('Indicatif'),
         ['+20 (Égypte)', '+971 (Emirats arabes unis)', '+1 (Etats-Unis)'],
         'accents classes comme dans un dictionnaire');
}, LAYOUT_AFFICHAGE);

test('Indicatif sans parentheses : garde son libelle, ne disparait pas', () => {
    /* Filet : si le value set change de forme, on classe sur le libelle
       entier plutot que de rendre une chaine vide — qui remonterait toutes
       ces options en tete. */
    const d = jouerAffichage({ Indicatif: [
        { value: '33', label: '+33 (France)' },
        { value: '99', label: 'Autre' },
    ] });
    egal(d.options('Indicatif'), ['Autre', '+33 (France)'], 'libelle atypique conserve');
}, LAYOUT_AFFICHAGE);

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
if (echecs.length) {
    echecs.forEach((e) => console.error('  ✗ ' + e + '\n'));
    process.exit(1);
}
