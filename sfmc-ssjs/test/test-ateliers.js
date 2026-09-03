/**
 * ============================================================================
 *  TESTS DES SOUS-EVENEMENTS (« Au programme »)
 * ============================================================================
 *  Regle arbitree le 29/08 : on ne propose QUE les sous-evenements
 *  obligatoires, sous forme de cases a cocher. Les facultatifs existent cote
 *  CRM mais ne sont pas offerts au choix — le visiteur s'inscrit a une date,
 *  et ce qu'elle comprend d'obligatoire lui est presente.
 *
 *  Ces tests montent un DOM minimal, distinct du harnais de la cascade : la
 *  zone des ateliers n'est pas un <select>, elle est retrouvee par
 *  [data-socle="appointments"] et remplie a la main.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs');
const blocs = [...fs.readFileSync(SRC, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
const CASCADE = blocs[blocs.length - 1][1];

/* Deux dates du meme evenement. Les sous-evenements portent l'Id de LEUR
   instance : un atelier se tient a une date, pas a un evenement. */
const INSTANCE = { value: 'i1', label: 'Samedi 10 octobre', date: '2026-10-10',
                   address: 'Paris', jours: '0', campus: 'EFAP PARIS', evenement: 'e1' };
const APPOINTMENTS = [
    { value: 'a1', label: 'Conference de presentation', required: 'true',  debut: '10:30', fin: '11:15', instance: 'i1', evenement: 'e1' },
    { value: 'a2', label: 'Visite libre',               required: 'false', debut: '',      fin: '',      instance: 'i1', evenement: 'e1' },
    { value: 'a3', label: 'Entretien individuel',       required: true,    debut: '',      fin: '',      instance: 'i1', evenement: 'e1' },
    /* Obligatoire, mais rattache a une AUTRE date du meme evenement. */
    { value: 'a4', label: 'Atelier du 17',              required: true,    debut: '09:00', fin: '10:00', instance: 'i2', evenement: 'e1' },
    /* Obligatoire, mais sans instance : on ne sait pas a quelle date il se
       tient, donc on ne le propose nulle part. */
    { value: 'a5', label: 'Creneau sans date',          required: true,    debut: '14:00', fin: '15:00', instance: '',   evenement: 'e1' },
];

function creerElement(tag) {
    const el = {
        tagName: String(tag).toUpperCase(), className: '', textContent: '',
        type: '', id: '', value: '', checked: false, style: {},
        attributs: {}, enfants: [],
        setAttribute(n, v) { this.attributs[n] = v; },
        appendChild(n) {
            const i = this.enfants.indexOf(n);
            if (i >= 0) this.enfants.splice(i, 1);
            this.enfants.push(n); n.parentNode = this; return n;
        },
        /* `insertBefore` et `nextSibling` sont REELS : c'est par eux que le
           socle deplace le bloc des ateliers sous la date retenue. Sans eux le
           deplacement echouait dans son try/catch, en silence, et le test
           n'aurait rien vu. */
        insertBefore(n, ref) {
            const i = this.enfants.indexOf(n);
            if (i >= 0) this.enfants.splice(i, 1);
            const j = ref ? this.enfants.indexOf(ref) : -1;
            if (j < 0) this.enfants.push(n); else this.enfants.splice(j, 0, n);
            n.parentNode = this; return n;
        },
        get nextSibling() {
            const p = this.parentNode;
            if (!p || !p.enfants) return null;
            const i = p.enfants.indexOf(this);
            return i >= 0 ? (p.enfants[i + 1] || null) : null;
        },
        /* Les ecouteurs sont REELLEMENT retenus, et `declencher` les rejoue.
           Un addEventListener vide suffisait tant que rien ne dependait d'un
           clic ; depuis que les cases naissent decochees, le remplissage du
           champ cache ne se produit QUE sur l'evenement `change` — un harnais
           muet declarerait donc mort un champ qui marche. */
        _ecouteurs: {},
        addEventListener(type, fn) {
            (this._ecouteurs[type] = this._ecouteurs[type] || []).push(fn);
        },
        declencher(type) {
            (this._ecouteurs[type] || []).forEach((f) => f({ target: this }));
        },
    };
    return el;
}

/** Toutes les cases a cocher du sous-arbre, dans l'ordre. */
function cases(noeud, out = []) {
    (noeud.enfants || []).forEach((e) => {
        if (e.type === 'checkbox') out.push(e);
        cases(e, out);
    });
    return out;
}

/** Tous les boutons radio du sous-arbre, dans l'ordre — les dates. */
function radios(noeud, out = []) {
    (noeud.enfants || []).forEach((e) => {
        if (e.type === 'radio') out.push(e);
        radios(e, out);
    });
    return out;
}

function creerDom() {
    const zone = creerElement('div');
    zone.classList = { add() {}, remove() {}, contains: () => false, toggle() {} };
    zone.closest = () => porteur;
    Object.defineProperty(zone, 'innerHTML', {
        get: () => '', set(v) { if (v === '') zone.enfants.length = 0; },
    });
    zone.querySelectorAll = (sel) => {
        const tout = cases(zone);
        return /:checked/.test(sel) ? tout.filter((c) => c.checked) : tout;
    };

    const porteur = creerElement('div');
    porteur.classList = {
        _c: new Set(),
        add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
        contains(c) { return this._c.has(c); },
        toggle(c, f) { f ? this._c.add(c) : this._c.delete(c); },
    };

    /* Un campus EST necessaire depuis le 30/08 : sans lui le socle ne propose
       aucune date, donc aucun sous-evenement. */
    const champs = {
        Appointments: { tagName: 'INPUT', value: '', addEventListener() {} },
        InstanceId: null,
        Campus: { tagName: 'SELECT', value: 'EFAP PARIS', options: [], addEventListener() {} },
    };

    /* ZONE DES DATES. Elle rendait `null`, ce qui poussait le socle sur son
       repli <select> : le rendu par BOUTONS RADIO — celui des vraies pages —
       n'etait donc teste par personne, et « aucune date preselectionnee » ne
       pouvait pas etre verifie. */
    const zoneDates = creerElement('div');
    zoneDates.classList = { add() {}, remove() {}, contains: () => false, toggle() {} };
    zoneDates.closest = () => zoneDates;
    Object.defineProperty(zoneDates, 'innerHTML', {
        get: () => '', set(v) { if (v === '') zoneDates.enfants.length = 0; },
    });
    zoneDates.querySelector = (sel) => {
        const r = radios(zoneDates);
        if (/:checked/.test(sel)) return r.filter((x) => x.checked)[0] || null;
        return r[0] || null;
    };

    const document = {
        readyState: 'complete',
        addEventListener() {},
        createElement: creerElement,
        querySelector(sel) {
            if (sel === '[data-socle="appointments"]') return zone;
            if (sel === '[data-socle="instances"]') return zoneDates;
            const m = /\[name="(.+?)"\]/.exec(sel);
            return m ? (champs[m[1]] || null) : null;
        },
    };
    return { document, zone, zoneDates, porteur, champs };
}

function jouer(appointments, options = {}) {
    const d = creerDom();
    vm.runInNewContext(CASCADE, {
        window: {
            SOCLE_DATA: {
                school: 'efap', picklists: {}, campus: [], programs: [], ptats: [], terms: [],
                instances: [INSTANCE], appointments,
                config: { progressif: true, ordre: 'campus,niveau', champs: {} },
            },
        },
        document: d.document,
    });

    /* Les dates ne sont plus preselectionnees (retour du 03/09). La plupart des
       tests ci-dessous portent sur le programme d'une date RETENUE : on coche
       donc la premiere, comme le ferait un visiteur, sans quoi ils testeraient
       l'ecran vide d'avant tout choix.
       `choisirDate: false` laisse l'etat initial intact — c'est ce dont ont
       besoin les tests qui verifient justement l'absence de preselection. */
    if (options.choisirDate !== false) {
        const r = radios(d.zoneDates);
        if (r.length) { r[0].checked = true; r[0].declencher('change'); }
    }
    return d;
}

let ok = 0; const echecs = [];
function test(nom, fn) {
    try { fn(); ok++; } catch (e) { echecs.push(`${nom}\n      ${e.message}`); }
}
function egal(obtenu, attendu, quoi) {
    const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
    if (a !== b) throw new Error(`${quoi}\n      obtenu  : ${a}\n      attendu : ${b}`);
}

test('Seuls les sous-evenements obligatoires sont proposes', () => {
    const d = jouer(APPOINTMENTS);
    egal(cases(d.zone).map((c) => c.value), ['a1', 'a3'], 'cases rendues');
});

/** Le premier descendant portant cette classe, dans l'ordre du document. */
function parClasse(noeud, classe) {
    for (const e of (noeud.enfants || [])) {
        if (e.className === classe) return e;
        const trouve = parClasse(e, classe);
        if (trouve) return trouve;
    }
    return null;
}
/** Les textes des enfants directs, dans l'ordre. */
function textes(noeud) {
    return (noeud.enfants || []).map((e) => String(e.textContent || ''));
}

test('La carte de date separe le QUAND et le OU [RETOUR 03/09]', () => {
    /* La capture du client fait foi : icone calendrier a gauche avec la date,
       les horaires et la conference ; icone epingle a droite avec le campus et
       l'adresse. L'adresse etait auparavant a GAUCHE sous les horaires, ce qui
       faisait annoncer un lieu par un calendrier et laissait l'epingle sans
       objet. Les icones sont posees en CSS sur ces deux conteneurs : se tromper
       de colonne, c'est se tromper d'icone. */
    const d = jouer(APPOINTMENTS, { choisirDate: false });
    const ligne = d.zoneDates.enfants[0];
    if (!ligne) throw new Error('aucune date rendue');

    const quand = parClasse(ligne, 'socle-instance-quand');
    const ou = parClasse(ligne, 'socle-instance-ou');
    if (!quand) throw new Error('colonne du QUAND absente');
    if (!ou) throw new Error('colonne du OU absente');

    egal(textes(quand), ['Samedi 10 octobre 2026', 'Conférence à : 10h30'],
         'colonne du QUAND (l instance de test n a pas d horaires)');
    egal(textes(ou), ['Efap Paris', 'Paris'], 'colonne du OU');
});

test('Les minutes rondes tombent : 14:00 donne 14h [RETOUR 03/09]', () => {
    /* La carte du builder ecrit « 10h - 13h », pas « 10h00 - 13h00 » : c'est
       la reference designee par la capture du 03/09. Une heure NON ronde garde
       ses minutes — les deux moities sont verifiees ici, sans quoi un format
       qui les supprimerait toujours passerait. */
    const d = jouer([{ value: 'z1', label: 'Creneau rond', required: 'true',
                       debut: '14:00', fin: '16:30', instance: 'i1', evenement: 'e1' }]);
    const txt = cases(d.zone).map((c) => {
        const parent = d.zone.enfants.find((w) => (w.enfants || []).includes(c));
        return textes(parent).join('');
    }).join(' ');
    if (!/14h\b/.test(txt) || /14h00/.test(txt)) {
        throw new Error(`heure ronde mal formatee : ${txt}`);
    }
    if (!/16h30/.test(txt)) throw new Error(`minutes perdues sur une heure non ronde : ${txt}`);
});

test('Le bloc des ateliers se place SOUS la date retenue [RETOUR 03/09]', () => {
    /* Il vivait a la fin du formulaire : le visiteur cochait une date en haut
       puis trouvait « Je souhaite participer a » plusieurs champs plus loin,
       sans rien qui les relie. Il doit desormais suivre la date choisie. */
    const d = jouer(APPOINTMENTS, { choisirDate: false });

    const avant = d.zoneDates.enfants.indexOf(d.porteur);
    if (avant !== -1) throw new Error('le bloc est deja dans la liste des dates avant tout choix');

    const r = radios(d.zoneDates);
    r[0].checked = true;
    r[0].declencher('change');

    const ligne = r[0].parentNode;
    const iLigne = d.zoneDates.enfants.indexOf(ligne);
    const iBloc = d.zoneDates.enfants.indexOf(d.porteur);
    if (iBloc === -1) throw new Error('le bloc n a pas rejoint la liste des dates');
    if (iBloc !== iLigne + 1) {
        throw new Error(`le bloc est en position ${iBloc}, attendu juste apres la date (${iLigne + 1})`);
    }
});

test('Aucune DATE n est preselectionnee [RETOUR 03/09]', () => {
    /* La date la plus proche etait cochee d'office. Places limitees : cela
       inscrivait a un creneau tout visiteur qui ne descendait pas jusqu'ici,
       et remplissait ce creneau d'absents. */
    const d = jouer(APPOINTMENTS, { choisirDate: false });
    const r = radios(d.zoneDates);
    if (!r.length) throw new Error('aucune date rendue');
    r.forEach((x) => { if (x.checked) throw new Error(`date ${x.value} cochee d avance`); });

    /* `required` doit SURVIVRE au retrait de la preselection. Le socle
       d'ecriture refuse une soumission sans InstanceId : sans `required`, le
       visiteur se heurterait a un refus muet cote serveur au lieu d'un message
       du navigateur avant l'envoi. */
    if (!r[0].required) throw new Error('required absent : le refus viendrait du serveur');

    /* Et le programme reste vide : afficher les ateliers d'une date que
       personne n'a retenue presenterait des creneaux qui ne sont pas les siens. */
    egal(cases(d.zone).map((c) => c.value), [], 'ateliers avant tout choix');
});

test('Choisir une date affiche SON programme [RETOUR 03/09]', () => {
    const d = jouer(APPOINTMENTS, { choisirDate: false });
    const r = radios(d.zoneDates);
    r[0].checked = true;
    r[0].declencher('change');
    egal(cases(d.zone).map((c) => c.value), ['a1', 'a3'], 'ateliers apres le choix');
});

test('Ce sont des cases a cocher, DECOCHEES par defaut [RETOUR 03/09]', () => {
    /* Elles etaient pre-cochees parce que le CRM les marque obligatoires.
       Places limitees : pre-cocher inscrivait d'office tout visiteur a des
       sessions a capacite contrainte, et remplissait les places avec des gens
       qui ne viendraient pas. Le choix revient au visiteur. */
    const d = jouer(APPOINTMENTS);
    const c = cases(d.zone);
    if (!c.length) throw new Error('aucune case rendue');
    c.forEach((x) => {
        if (x.type !== 'checkbox') throw new Error(`type ${x.type} au lieu de checkbox`);
        if (x.checked) throw new Error(`${x.value} cochee d avance`);
    });
});

test('Appointments part VIDE, et se remplit au clic [RETOUR 03/09]', () => {
    /* Les deux moities comptent : rien n'est poste tant que le visiteur n'a
       rien choisi, et ce qu'il choisit part bien. Ne verifier que la premiere
       laisserait passer un champ cache definitivement mort. */
    const d = jouer(APPOINTMENTS);
    egal(d.champs.Appointments.value, '', 'champ cache au chargement');

    const c = cases(d.zone);
    c[0].checked = true;
    d.zone.declencher('change');
    egal(d.champs.Appointments.value, 'a1', 'champ cache apres un clic');
});

test('L horaire est affiche quand le CRM le porte, et rien ne le remplace sinon', () => {
    const d = jouer(APPOINTMENTS);
    const textes = d.zone.enfants.map((w) => w.enfants.map((e) => e.textContent).join(''));
    /* NOTATION FRANCAISE — retour client du 03/09 : « 9h30 au lieu de 09:30 ».
       Le CRM envoie "10:30" ; l'affichage doit dire "10h30". On verifie les
       DEUX moities : le nouveau format present, et l'ancien absent — sans quoi
       un simple ajout laisserait passer un retour en arriere. */
    if (!/10h30/.test(textes[0])) throw new Error(`horaire absent : ${textes[0]}`);
    if (/\d{2}:\d{2}/.test(textes[0])) throw new Error(`notation anglaise persistante : ${textes[0]}`);
    if (/—\s*$/.test(textes[1])) throw new Error(`tiret orphelin sans horaire : ${textes[1]}`);
});

test('Le zero de tete tombe : 09:30 devient 9h30 [RETOUR 03/09]', () => {
    /* Le cas exact du retour client. `10:30` ci-dessus ne l'aurait pas
       couvert : il n'a pas de zero de tete a perdre. */
    const d = jouer(APPOINTMENTS.map((a) => (a.value === 'a1'
        ? { ...a, debut: '09:30', fin: '10:15' } : a)));
    const textes = d.zone.enfants.map((w) => w.enfants.map((e) => e.textContent).join(''));
    if (!/9h30/.test(textes[0])) throw new Error(`zero de tete non retire : ${textes[0]}`);
    if (/09h30/.test(textes[0])) throw new Error(`zero de tete conserve : ${textes[0]}`);
});

test('La mention « (obligatoire) » ne se repete plus sur chaque ligne', () => {
    const d = jouer(APPOINTMENTS);
    const textes = d.zone.enfants.map((w) => w.enfants.map((e) => e.textContent).join(''));
    textes.forEach((t) => {
        if (/obligatoire/i.test(t)) throw new Error(`mention redondante : ${t}`);
    });
});

test('Aucun obligatoire : le bloc entier est masque [REGRESSION]', () => {
    const d = jouer([{ value: 'a2', label: 'Visite libre', required: 'false', debut: '', fin: '' }]);
    egal(cases(d.zone).length, 0, 'aucune case');
    if (d.porteur.style.display !== 'none') throw new Error('le bloc reste affiche, intitule sans contenu');
    if (!d.porteur.classList.contains('hidden')) throw new Error('la classe hidden n est pas posee');
});

test('Un sous-evenement d une AUTRE date n est pas propose [REGRESSION]', () => {
    const d = jouer(APPOINTMENTS);
    const vus = cases(d.zone).map((c) => c.value);
    if (vus.indexOf('a4') > -1) throw new Error('atelier du 17 propose sous la date du 10');
});

test('Un sous-evenement SANS instance n est propose nulle part [REGRESSION]', () => {
    /* Il s'affichait sous TOUTES les dates de l'evenement : les conferences du
       10 septembre apparaissaient aussi sous le 26. */
    const d = jouer(APPOINTMENTS);
    const vus = cases(d.zone).map((c) => c.value);
    if (vus.indexOf('a5') > -1) throw new Error('atelier sans date propose quand meme');
});

test('Sans campus, aucune date et donc aucun sous-evenement [REGRESSION]', () => {
    const d = creerDom();
    d.champs.Campus.value = '';
    vm.runInNewContext(CASCADE, {
        window: {
            SOCLE_DATA: {
                school: 'efap', picklists: {}, campus: [], programs: [], ptats: [], terms: [],
                instances: [INSTANCE], appointments: APPOINTMENTS,
                config: { progressif: true, ordre: 'campus,niveau', champs: {} },
            },
        },
        document: d.document,
    });
    egal(cases(d.zone).length, 0, 'sous-evenements proposes sans campus');
    egal(d.champs.Appointments.value, '', 'champ cache renseigne sans date');
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
echecs.forEach((e) => console.log(`  ✗ ${e}\n`));
process.exit(echecs.length ? 1 : 0);
