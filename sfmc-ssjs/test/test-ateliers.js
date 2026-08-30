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
        appendChild(n) { this.enfants.push(n); return n; },
        addEventListener() {},
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

    const document = {
        readyState: 'complete',
        addEventListener() {},
        createElement: creerElement,
        querySelector(sel) {
            if (sel === '[data-socle="appointments"]') return zone;
            if (sel === '[data-socle="instances"]') return null;
            const m = /\[name="(.+?)"\]/.exec(sel);
            return m ? (champs[m[1]] || null) : null;
        },
    };
    return { document, zone, porteur, champs };
}

function jouer(appointments) {
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

test('Ce sont bien des cases a cocher, cochees d avance', () => {
    const d = jouer(APPOINTMENTS);
    const c = cases(d.zone);
    if (!c.length) throw new Error('aucune case rendue');
    c.forEach((x) => {
        if (x.type !== 'checkbox') throw new Error(`type ${x.type} au lieu de checkbox`);
        if (!x.checked) throw new Error(`${x.value} non cochee`);
    });
});

test('Le champ cache Appointments porte les valeurs obligatoires', () => {
    const d = jouer(APPOINTMENTS);
    egal(d.champs.Appointments.value, 'a1,a3', 'champ cache');
});

test('L horaire est affiche quand le CRM le porte, et rien ne le remplace sinon', () => {
    const d = jouer(APPOINTMENTS);
    const textes = d.zone.enfants.map((w) => w.enfants.map((e) => e.textContent).join(''));
    if (!/10:30/.test(textes[0])) throw new Error(`horaire absent : ${textes[0]}`);
    if (/—\s*$/.test(textes[1])) throw new Error(`tiret orphelin sans horaire : ${textes[1]}`);
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
