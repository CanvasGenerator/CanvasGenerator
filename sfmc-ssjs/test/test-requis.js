/**
 * ============================================================================
 *  TESTS : TOUT CHAMP AFFICHE EST OBLIGATOIRE
 * ============================================================================
 *  La regle porte sur ce que le visiteur VOIT, pas sur une liste de noms. Elle
 *  ne peut donc se verifier qu'avec un DOM : c'est l'affichage effectif qui
 *  decide, et c'est justement ce que l'ancienne liste figee ignorait.
 *
 *  DOM minimal monte a la main — le projet n'embarque pas jsdom, et n'en a pas
 *  besoin : le module ne se sert que de closest, querySelectorAll, classList,
 *  style et getComputedStyle.
 * ============================================================================
 */
'use strict';
const path = require('node:path');

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(`${nom}\n      ${e.message}`); } }
function vrai(c, msg) { if (!c) throw new Error(msg); }
function egal(a, b, quoi) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        throw new Error(`${quoi}\n      obtenu  : ${JSON.stringify(a)}\n      attendu : ${JSON.stringify(b)}`);
    }
}

/* ---- DOM minimal -------------------------------------------------------- */
function creerClassList(el) {
    return {
        add: (c) => { if (!el._classes.includes(c)) el._classes.push(c); el._sync(); },
        remove: (c) => { el._classes = el._classes.filter((x) => x !== c); el._sync(); },
        contains: (c) => el._classes.includes(c),
        toggle: (c, f) => (f ? el.classList.add(c) : el.classList.remove(c)),
    };
}

function element(tag, classes = []) {
    const el = {
        nodeType: 1, tagName: String(tag).toUpperCase(),
        _classes: [...classes], enfants: [], parentNode: null,
        style: {}, value: '', checked: false, type: '', name: '', textContent: '',
    };
    /* `className` et `classList` sont DEUX VUES du meme etat, comme dans un
       navigateur. Deux proprietes independantes suffisaient a fausser le test :
       classList.add() rebatissait className et effacait ce qu'une affectation
       directe venait d'y mettre. */
    Object.defineProperty(el, 'className', {
        get: () => el._classes.join(' '),
        set: (v) => { el._classes = String(v || '').split(/\s+/).filter(Boolean); },
    });
    el._sync = () => {};
    el.classList = creerClassList(el);
    el.appendChild = (n) => { n.parentNode = el; el.enfants.push(n); return n; };
    el.closest = (sel) => {
        let n = el;
        while (n) {
            if (correspond(n, sel)) return n;
            n = n.parentNode;
        }
        return null;
    };
    el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
    el.querySelectorAll = (sel) => {
        const out = [];
        const sels = sel.split(',').map((s) => s.trim());
        (function descend(n) {
            n.enfants.forEach((e) => {
                if (sels.some((s) => correspond(e, s))) out.push(e);
                descend(e);
            });
        })(el);
        out.forEach = Array.prototype.forEach.bind(out);
        return out;
    };
    return el;
}

/** Sélecteurs réellement utilisés par le module : tag, .classe, [class*=], radio. */
function correspond(el, sel) {
    if (sel.startsWith('input[type="radio"][name="')) {
        const n = sel.slice('input[type="radio"][name="'.length, -2);
        return el.tagName === 'INPUT' && el.type === 'radio' && el.name === n;
    }
    if (sel === 'input[type="radio"][name]') {
        return el.tagName === 'INPUT' && el.type === 'radio' && !!el.name;
    }
    if (sel === '[class*="-err-msg"]') return /-err-msg/.test(el.className || '');
    if (sel === '[data-socle-champ]') return false;
    if (sel.startsWith('.')) return el._classes.includes(sel.slice(1));
    return el.tagName === sel.toUpperCase();
}

function monterFormulaire() {
    const doc = { createElement: (t) => element(t) };
    const vue = { getComputedStyle: (n) => ({ display: n.style.display || '', visibility: '' }) };
    doc.defaultView = vue;

    const form = element('form');
    form.ownerDocument = doc;

    const champs = {};
    function ajouterChamp(nom, { tag = 'input', type = 'text', conteneur = 'jpo-field', avecSpan = true } = {}) {
        const box = element('div', [conteneur]);
        box.ownerDocument = doc;
        const el = element(tag);
        el.ownerDocument = doc;
        el.type = type; el.name = nom;
        box.appendChild(el);
        if (avecSpan) box.appendChild(element('span', ['jpo-err-msg']));
        form.appendChild(box);
        champs[nom] = { el, box };
        return el;
    }
    return { form, champs, ajouterChamp, doc };
}

/* ---- Le module sous test ------------------------------------------------ */
const SRC = path.join(__dirname, '..', '..', 'blocks', 'forms', 'shared', 'champs-requis.js');
let validerChampsAffiches;

(async () => {
    ({ validerChampsAffiches } = await import('file://' + SRC));

    test('Un champ vide et visible est signale', () => {
        const d = monterFormulaire();
        d.ajouterChamp('LastName');
        const manquants = validerChampsAffiches(d.form, { message: 'requis' });
        egal(manquants.map((m) => m.name), ['LastName'], 'champs manquants');
        vrai(d.champs.LastName.box.querySelector('[class*="-err-msg"]')._classes.includes('show'),
             'message non affiche sous le champ');
    });

    test('Un champ rempli ne l\'est pas', () => {
        const d = monterFormulaire();
        d.ajouterChamp('LastName').value = 'Dupont';
        egal(validerChampsAffiches(d.form).length, 0, 'faux positif');
    });

    test('Un champ MASQUE n\'est jamais exige [REGRESSION]', () => {
        /* Une specialite a valeur unique est masquee mais renseignee ; une
           specialite hors perimetre est masquee et vide. Les deux doivent
           passer, sans quoi le formulaire devient insoumettable. */
        const d = monterFormulaire();
        d.ajouterChamp('Speciality', { tag: 'select' });
        d.champs.Speciality.box.style.display = 'none';
        egal(validerChampsAffiches(d.form).length, 0, 'champ masque exige');
    });

    test('La classe hidden masque autant que display:none', () => {
        const d = monterFormulaire();
        d.ajouterChamp('Rhythm', { tag: 'select' });
        d.champs.Rhythm.box.classList.add('hidden');
        egal(validerChampsAffiches(d.form).length, 0, 'classe hidden ignoree');
    });

    test('Un champ cache de tracking n\'est pas exige', () => {
        const d = monterFormulaire();
        d.ajouterChamp('utm_source', { type: 'hidden' });
        egal(validerChampsAffiches(d.form).length, 0, 'champ de tracking exige');
    });

    test('La case de consentement est exigee, decochee [REGRESSION]', () => {
        /* Elle ne bloquait PAS la soumission : on enregistrait un opt-out
           implicite sans que le visiteur ait rien refuse. */
        const d = monterFormulaire();
        d.ajouterChamp('RGPDConsent', { type: 'checkbox', conteneur: 'jpo-rgpd', avecSpan: false });
        egal(validerChampsAffiches(d.form).map((m) => m.name), ['RGPDConsent'], 'consentement non exige');
        const cree = d.champs.RGPDConsent.box.enfants
            .filter((n) => /-err-msg/.test(n.className || ''));
        vrai(cree.length === 1,
             `message non cree dans un conteneur qui n en avait pas (enfants: ${
                 d.champs.RGPDConsent.box.enfants.map((n) => n.tagName + '.' + (n.className || '')).join(', ')})`);
    });

    test('Un groupe de radios compte pour UN champ', () => {
        const d = monterFormulaire();
        const box = element('div', ['jpo-field']);
        box.ownerDocument = d.doc;
        ['a', 'b', 'c'].forEach((v) => {
            const r = element('input');
            r.ownerDocument = d.doc; r.type = 'radio'; r.name = 'InstanceId'; r.value = v;
            box.appendChild(r);
        });
        box.appendChild(element('span', ['jpo-err-msg']));
        d.form.appendChild(box);

        egal(validerChampsAffiches(d.form).length, 1, 'groupe radio non exige, ou compte plusieurs fois');
        box.enfants[1].checked = true;
        egal(validerChampsAffiches(d.form).length, 0, 'groupe radio coche encore signale');
    });

    test('Un champ declare facultatif est ignore', () => {
        const d = monterFormulaire();
        d.ajouterChamp('ChildPhone');
        egal(validerChampsAffiches(d.form, { facultatifs: ['ChildPhone'] }).length, 0, 'facultatif exige');
    });

    test('Un libelle deja ecrit par le formulaire n\'est pas ecrase', () => {
        const d = monterFormulaire();
        d.ajouterChamp('MobilePhone');
        d.champs.MobilePhone.box.enfants[1].textContent = 'Numero invalide.';
        validerChampsAffiches(d.form, { message: 'Ce champ est requis.' });
        egal(d.champs.MobilePhone.box.enfants[1].textContent, 'Numero invalide.', 'message specifique ecrase');
    });

    console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
    if (echecs.length) { echecs.forEach((e) => console.error('  ✗ ' + e + '\n')); process.exit(1); }
})();
