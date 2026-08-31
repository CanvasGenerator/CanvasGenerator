/**
 * ============================================================================
 *  CONFIRMATION APRES SOUMISSION
 * ============================================================================
 *  Le formulaire est remplace par un ecran de succes, sans rechargement. Le
 *  message depend de la famille de formulaire, lue dans son propre champ cache.
 *
 *  Ce qui rend ces tests necessaires : le HTML publie porte des titres de succes
 *  VIDES — ils etaient remplis par le JS des blocs, qui ne tourne que dans le
 *  builder. Sans le socle, le visiteur verrait une coche verte et rien d'autre.
 *
 *  Et le bilan du socle d'ecriture est le SEUL signal disponible : AMPscript n'a
 *  pas de try/catch, une ecriture refusee remplace la page entiere. L'absence de
 *  marqueur est un echec, jamais un imprevu.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs');
const blocs = [...fs.readFileSync(SRC, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
const CASCADE = blocs[blocs.length - 1][1];

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(`${nom}\n      ${e.message}`); } }
function vrai(c, msg) { if (!c) throw new Error(msg); }
function egal(a, b, quoi) {
    if (a !== b) throw new Error(`${quoi}\n      obtenu  : ${JSON.stringify(a)}\n      attendu : ${JSON.stringify(b)}`);
}

/* ---- Une carte de formulaire, reduite a ce que le socle manipule --------- */
function creerPage(typeFormulaire, { avecSucces = true, avecZone = true } = {}) {
    const noeuds = [];
    function el(classe, tag = 'DIV') {
        const n = {
            tagName: tag, className: classe, style: {}, textContent: '',
            enfants: [], parentNode: null, value: '', name: '', type: '',
            classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
            appendChild(c) { c.parentNode = n; n.enfants.push(c); noeuds.push(c); return c; },
            scrollIntoView() {},
            querySelector: (sel) => trouver(n, sel)[0] || null,
            querySelectorAll: (sel) => trouver(n, sel),
        };
        noeuds.push(n);
        return n;
    }

    const carte   = el('jpo-card');
    const caches  = {};
    const succes  = avecSucces ? el('jpo-success') : null;
    const titre   = avecSucces ? el('jpo-success-thanks', 'H3') : null;
    const texte   = avecSucces ? el('jpo-success-msg', 'P') : null;
    const zone    = avecZone ? el('jpo-form-zone') : null;
    const form    = el('jpo-form', 'FORM');
    const cache   = el('', 'INPUT');
    cache.name = 'TypeFormulaire';
    cache.value = typeFormulaire;
    const entete  = el('jpo-title', 'H2');

    if (succes) { succes.appendChild(titre); succes.appendChild(texte); carte.appendChild(succes); }
    carte.appendChild(entete);
    if (zone) { zone.appendChild(form); carte.appendChild(zone); } else { carte.appendChild(form); }
    form.appendChild(cache);
    /* Les champs caches de tracking, tels que le builder les pose : vides. */
    ['utm_source', 'utm_medium', 'gclid', 'clientId', 'canal', 'utm_campus'].forEach((n) => {
        const c = el('', 'INPUT');
        c.name = n; c.type = 'hidden'; c.value = '';
        form.appendChild(c);
        caches[n] = c;
    });
    form.__ecouteurs = {};
    form.addEventListener = (t, fn) => { form.__ecouteurs[t] = fn; };

    /** Selecteurs reellement employes : listes de .classe, et form.classe. */
    function trouver(racine, sel) {
        const parts = String(sel).split(',').map((x) => x.trim());
        const out = [];
        (function descend(n) {
            n.enfants.forEach((e) => {
                if (parts.some((p) => correspond(e, p))) out.push(e);
                descend(e);
            });
        })(racine);
        return out;
    }
    function correspond(n, sel) {
        if (sel.startsWith('form.')) return n.tagName === 'FORM' && n.className === sel.slice(5);
        if (sel.startsWith('[name="')) return n.name === sel.slice(7, -2);
        if (sel.startsWith('.')) return n.className === sel.slice(1);
        return false;
    }

    const document = {
        readyState: 'complete',
        addEventListener() {},
        createElement: (t) => el('', String(t).toUpperCase()),
        documentElement: { innerHTML: '' },
        querySelector: (sel) => trouver(carte, sel)[0] || null,
        querySelectorAll: (sel) => trouver(carte, sel),
    };
    return { document, carte, form, succes, titre, texte, zone, entete, caches };
}

function jouer(page, htmlRendu) {
    page.document.documentElement.innerHTML = htmlRendu || '';
    vm.runInNewContext(CASCADE, {
        window: {
            SOCLE_DATA: {
                school: 'efap', picklists: {}, campus: [], programs: [], ptats: [],
                terms: [], instances: [], appointments: [],
                config: { progressif: true, ordre: 'campus,niveau', champs: {} },
            },
            location: { search: '?utm_campus=lyon', href: 'https://x/p?utm_campus=lyon' },
            tracking_params: page.tracking || null,
        },
        document: page.document,
    });
}

const SUCCES = '<!-- socle ecriture: statut=success pa=001AW0001 nouveau=true journal= CM:cree -->';

test('Un succes remplace le formulaire par l ecran de confirmation', () => {
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    egal(p.zone.style.display, 'none', 'le formulaire reste affiche');
    egal(p.succes.style.display, 'block', 'l ecran de succes reste masque');
    egal(p.entete.style.display, 'none', 'le titre du formulaire reste affiche');
});

test('Le message depend de la famille de formulaire', () => {
    const bro = creerPage('brochure');
    jouer(bro, SUCCES);
    vrai(/brochure/i.test(bro.titre.textContent), `titre brochure inattendu : ${bro.titre.textContent}`);

    const cand = creerPage('candidature');
    jouer(cand, SUCCES);
    vrai(/candidature/i.test(cand.titre.textContent), `titre candidature inattendu : ${cand.titre.textContent}`);

    const evt = creerPage('evenement');
    jouer(evt, SUCCES);
    vrai(/place/i.test(evt.titre.textContent), `titre evenement inattendu : ${evt.titre.textContent}`);
});

test('Le titre publie est VIDE sans le socle : il doit etre rempli [REGRESSION]', () => {
    const p = creerPage('immersion');
    egal(p.titre.textContent, '', 'prealable : le HTML publie porte un titre vide');
    jouer(p, SUCCES);
    vrai(p.titre.textContent.length > 0, 'titre laisse vide — coche verte sans texte');
    vrai(p.texte.textContent.length > 0, 'message laisse vide');
});

test('Sans marqueur de succes, rien ne bouge [REGRESSION]', () => {
    /* Une ecriture refusee remplace la page entiere, bilan compris. Afficher
       la confirmation dans ce cas ferait croire a une soumission enregistree. */
    const p = creerPage('brochure');
    jouer(p, 'The page content contains errors and cannot be processed.');
    vrai(p.zone.style.display !== 'none', 'formulaire masque alors que rien n a ete ecrit');
    egal(p.titre.textContent, '', 'confirmation affichee sur un echec');
});

test('Un statut error n est pas un succes', () => {
    const p = creerPage('brochure');
    jouer(p, '<!-- socle ecriture: statut=error pa= nouveau=false journal= -->');
    vrai(p.zone.style.display !== 'none', 'formulaire masque sur une erreur');
});

test('Le formulaire est branche pour un envoi sans rechargement', () => {
    const p = creerPage('evenement');
    jouer(p, '');
    vrai(typeof p.form.__ecouteurs.submit === 'function', 'aucun ecouteur submit pose');
});

test('Sans bloc de succes dans la page, on en fabrique un', () => {
    const p = creerPage('brochure', { avecSucces: false });
    jouer(p, SUCCES);
    const cree = p.carte.enfants.filter((n) => n.className === 'socle-succes');
    egal(cree.length, 1, 'aucun ecran de succes fabrique');
    vrai(cree[0].enfants.some((n) => n.tagName === 'H3' && n.textContent.length > 0),
         'ecran fabrique sans message');
});

test('Le tracking de la page est recopie dans les champs caches [REGRESSION]', () => {
    /* La CloudPage calcule tout dans window.tracking_params, mais ne remplit
       pas les champs caches : c'etait populateHiddenFields(), cote blocs, qui
       ne tourne que dans le builder. Mesure du 31/08 : utm_source, gclid,
       canal — tous vides a l'ecriture, alors que la page les connaissait. */
    const p = creerPage('evenement');
    p.tracking = {
        utm_source: 'facebook', utm_medium: 'paid_social', gclid: 'GCL31',
        canal: 'Paid Social', client_id: 'GA1.2.33'
    };
    jouer(p, '');
    egal(p.caches.utm_source.value, 'facebook', 'utm_source perdu');
    egal(p.caches.utm_medium.value, 'paid_social', 'utm_medium perdu');
    egal(p.caches.gclid.value, 'GCL31', 'gclid perdu');
    egal(p.caches.canal.value, 'Paid Social', 'canal perdu');
    egal(p.caches.clientId.value, 'GA1.2.33', 'client_id non recopie sous clientId');
});

test('utm_campus vient de l URL, pas de tracking_params', () => {
    /* La page expose `campus`, qui est le campus PRE-SELECTIONNE — pas le
       parametre publicitaire. Les confondre attribuerait la mauvaise ville. */
    const p = creerPage('brochure');
    p.tracking = { campus: 'lyon' };
    jouer(p, '');
    egal(p.caches.utm_campus.value, 'lyon', 'utm_campus non relu dans l URL');
});

test('Une valeur deja posee n est jamais ecrasee', () => {
    const p = creerPage('brochure');
    p.tracking = { utm_source: 'facebook' };
    p.caches.utm_source.value = 'depuis-la-page';
    jouer(p, '');
    egal(p.caches.utm_source.value, 'depuis-la-page', 'valeur existante ecrasee');
});

test('Sans tracking_params, rien ne casse', () => {
    const p = creerPage('brochure');
    p.tracking = null;
    jouer(p, '');
    egal(p.caches.utm_source.value, '', 'valeur inventee sans source');
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
echecs.forEach((e) => console.log(`  ✗ ${e}\n`));
process.exit(echecs.length ? 1 : 0);
