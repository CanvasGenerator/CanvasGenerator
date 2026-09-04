/**
 * ============================================================================
 *  CONFIRMATION APRES SOUMISSION
 * ============================================================================
 *  Un encart s'ouvre AU-DESSUS DU BOUTON, sans rechargement et sans que rien
 *  ne disparaisse : le formulaire reste affiche, avec ses valeurs. Le message
 *  depend de la famille de formulaire, lue dans son propre champ cache ; le ton
 *  depend de l'issue — vert pour une confirmation, orange pour une candidature
 *  deja en cours, rouge pour un refus.
 *
 *  ⚠ CE N'ETAIT PAS LE CAS AVANT LE 2026-09-03. La confirmation remplacait le
 *  formulaire par l'ecran `.xxx-success`, et emportait avec elle les titres et
 *  toute la fratrie de la carte. Le client a demande l'inverse. Plusieurs tests
 *  de ce fichier sont donc la NEGATION de ceux qu'ils remplacent, et gardes
 *  comme tels : le masquage etait lui-meme le fruit de correctifs successifs,
 *  et rien n'empeche quelqu'un de le retablir par reflexe.
 *
 *  Ce qui rend ces tests necessaires : le HTML publie porte des titres de succes
 *  VIDES — ils etaient remplis par le JS des blocs, qui ne tourne que dans le
 *  builder. Le socle ne les remplit plus, il n'ouvre plus cet ecran du tout ;
 *  c'est ce qui rend le retour applicable SANS republier les pages en ligne.
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

/** Une promesse deroulee sur place : le test reste synchrone, alors que le
    socle enchaine fetch().then().then(). */
function promesseSync(v) {
    if (v && v.__sync) return v;
    return { __sync: true, then: (fn) => promesseSync(fn(v)), catch() { return this; } };
}

/* ---- Une carte de formulaire, reduite a ce que le socle manipule --------- */
function creerPage(typeFormulaire, { avecSucces = true, avecZone = true, champs = {} } = {}) {
    const noeuds = [];
    function el(classe, tag = 'DIV') {
        const n = {
            tagName: tag, className: classe, style: {}, textContent: '',
            enfants: [], parentNode: null, value: '', name: '', type: '',
            attrs: {},
            classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
            appendChild(c) { c.parentNode = n; n.enfants.push(c); noeuds.push(c); return c; },
            /* `setAttribute`, `insertBefore` et `removeChild` servent l'encart
               de blocage : il se retrouve par son [data-socle], se pose AVANT
               le bouton, et se vide avant d'etre reecrit. Sans eux le socle
               empilerait un encart par tentative, et le test ne le verrait
               pas. */
            setAttribute(k, v) { n.attrs[k] = String(v); },
            getAttribute(k) { return Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null; },
            insertBefore(c, ref) {
                const i = n.enfants.indexOf(ref);
                c.parentNode = n;
                n.enfants.splice(i < 0 ? n.enfants.length : i, 0, c);
                noeuds.push(c);
                return c;
            },
            removeChild(c) {
                const i = n.enfants.indexOf(c);
                if (i > -1) n.enfants.splice(i, 1);
                c.parentNode = null;
                return c;
            },
            scrollIntoView() {},
            /* Muet, mais indispensable : des qu'un champ porte un nom que le
               socle connait — `Programme`, `Campus` — la cascade s'y abonne.
               Sans ce point d'entree, poser un champ dans le faux formulaire
               faisait tomber le test sur « addEventListener is not a
               function », loin de ce qu'il cherchait a verifier. */
            addEventListener() {},
            querySelector: (sel) => trouver(n, sel)[0] || null,
            querySelectorAll: (sel) => trouver(n, sel),
            /* `contains` et `children` sont ceux du vrai DOM, pas du confort :
               le socle ENUMERE les enfants de la carte pour masquer tout ce qui
               n'est pas l'ecran de succes. Sans eux, le harnais rendait ce
               balayage inerte et le test de la zone campus passait a vide. */
            contains(c) {
                if (!c) return false;
                if (c === n) return true;
                return n.enfants.some((e) => e.contains(c));
            },
        };
        Object.defineProperty(n, 'children', { get: () => n.enfants });
        Object.defineProperty(n, 'firstChild', { get: () => n.enfants[0] || null });
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
    /* La zone campus des formulaires evenement : SOEUR de la zone de
       formulaire, pas sa descendante. C'est toute la difficulte du sujet. */
    const campus  = el('jpo-campus-zone');

    /* L'icone : premier enfant de l'ecran de succes, un <div> SANS classe,
       exactement comme dans le HTML publie. C'est ce que le socle normalise. */
    const icone = avecSucces ? el('', 'DIV') : null;
    if (icone) icone.textContent = '\u2705';
    /* La liste de brochures « (PDF) », presente dans le HTML des pages deja
       publiees : le socle doit la masquer, la retirer du bloc ne suffit pas. */
    const listePdf = avecSucces ? el('brf-brochure-list') : null;
    if (succes) {
        succes.appendChild(icone);
        succes.appendChild(titre);
        succes.appendChild(texte);
        succes.appendChild(listePdf);
        carte.appendChild(succes);
    }
    carte.appendChild(entete);
    carte.appendChild(campus);
    if (zone) { zone.appendChild(form); carte.appendChild(zone); } else { carte.appendChild(form); }
    form.appendChild(cache);
    /* Les champs caches de tracking, tels que le builder les pose : vides. */
    ['submitted', 'utm_source', 'utm_medium', 'gclid', 'clientId', 'canal', 'utm_campus'].forEach((n) => {
        const c = el('', 'INPUT');
        c.name = n; c.type = 'hidden'; c.value = (n === 'submitted' ? 'true' : '');
        form.appendChild(c);
        caches[n] = c;
    });
    /* Les champs de saisie que le test veut renseigner — Programme, Campus…
       Ils servent a la resolution du CTA de brochure, qui compare les criteres
       de la DE a ce que le visiteur a choisi. */
    Object.keys(champs).forEach((nom) => {
        const c = el('', 'INPUT');
        c.name = nom; c.value = champs[nom];
        form.appendChild(c);
        caches[nom] = c;
    });
    /* L'enveloppe du bouton, DERNIER enfant du formulaire comme dans la
       maquette : c'est l'ancre devant laquelle l'encart de blocage se pose. */
    const submitWrap = el('cnd-submit-wrap');
    const bouton = el('', 'BUTTON');
    bouton.type = 'submit';
    submitWrap.appendChild(bouton);
    form.appendChild(submitWrap);
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
        if (sel === 'button[type="submit"]') return n.tagName === 'BUTTON' && n.type === 'submit';
        if (sel === 'input[type="submit"]') return n.tagName === 'INPUT' && n.type === 'submit';
        if (sel.startsWith('[data-socle="')) return n.getAttribute('data-socle') === sel.slice(13, -2);
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
    return { document, carte, form, succes, titre, texte, zone, entete, campus, caches,
             submitWrap, bouton, icone, listePdf };
}

function jouer(page, htmlRendu) {
    page.document.documentElement.innerHTML = htmlRendu || '';
    vm.runInNewContext(CASCADE, {
        window: {
            SOCLE_DATA: {
                school: 'efap', picklists: {}, campus: [], programs: [], ptats: [],
                terms: [], instances: [], appointments: [],
                /* Absent par defaut : la DE des brochures n'existe pas encore,
                   et c'est l'etat que la plupart des tests doivent verifier. */
                ctaDoc: page.ctaDoc,
                config: { progressif: true, ordre: 'campus,niveau', champs: {} },
            },
            location: { search: '?utm_campus=lyon', href: 'https://x/p?utm_campus=lyon' },
            tracking_params: page.tracking || null,
            console: page.console || { warn() {} },
            fetch: page.fetch || undefined,
            /* Les alertes sont RELEVEES, pas avalees : une candidature bloquee
               ne doit en declencher aucune — c'est tout l'objet du correctif. */
            alert: (m) => { (page.alertes || (page.alertes = [])).push(String(m)); },
        },
        document: page.document,
    });
}

const SUCCES = '<!-- socle ecriture: statut=success pa=001AW0001 nouveau=true journal= CM:cree -->';

/* ============================================================================
 *  L'ENCART DE MESSAGE — LE FORMULAIRE NE DISPARAIT PLUS
 * ============================================================================
 *  Retour client du 2026-09-03. Jusqu'ici une confirmation EMPORTAIT la page :
 *  zone de formulaire, titres et toute la fratrie de la carte passaient en
 *  display:none, et l'ecran `.xxx-success` s'ouvrait a leur place. Le visiteur
 *  se retrouvait devant un message seul, sans plus rien a relire ni a corriger.
 *
 *  Les tests de cette section sont donc, pour beaucoup, l'INVERSE exact de ceux
 *  qu'ils remplacent : ce qui devait disparaitre doit desormais rester. Ils
 *  sont gardes en l'etat plutot que supprimes, parce que le masquage etait lui
 *  aussi le fruit de correctifs successifs (la zone campus, le 31/08) et que
 *  rien n'empeche quelqu'un de le retablir par reflexe.
 *
 *  Le ton fait partie du contrat : vert pour une confirmation, orange pour une
 *  candidature deja en cours, rouge pour un refus. Un encart vert sur un refus
 *  serait pire que pas d'encart du tout.
 * ========================================================================== */

const VERT   = '#12805c';
const ORANGE = '#b54708';
const ROUGE  = '#b42318';
const COCHE  = '✔️';

/** L'encart du formulaire, et le texte qu'il porte. */
function encart(p) { return p.form.querySelector('[data-socle="message"]'); }
function texteEncart(p) {
    const z = encart(p);
    return z ? z.children.map((c) => c.textContent).join(' ') : null;
}
function tonEncart(p) {
    const z = encart(p);
    return z ? z.style.borderLeftColor : null;
}

test('Un succes LAISSE le formulaire en place [retour 2026-09-03]', () => {
    /* Le coeur du retour : le visiteur doit continuer a voir ce qu'il a
       envoye, et pouvoir renvoyer. */
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    vrai(p.zone.style.display !== 'none', 'formulaire masque par la confirmation');
    vrai(p.entete.style.display !== 'none', 'titre du formulaire masque par la confirmation');
    vrai(encart(p) !== null, 'aucun encart de confirmation pose');
    egal(tonEncart(p), VERT, 'confirmation affichee dans un ton qui n est pas le vert');
});

test('L ecran .xxx-success n est plus JAMAIS ouvert [retour 2026-09-03]', () => {
    /* Il reste dans le HTML publie, a son `display:none` de depart. C'est ce
       qui rend ce retour applicable sans republier les pages en ligne — et
       c'est aussi ce qui neutralise, sans un mot de code, la liste de
       brochures « (PDF) » aux liens morts qu'il contenait. */
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    vrai(p.succes.style.display !== 'block', 'ecran de succes ouvert');
    egal(p.titre.textContent, '', 'titre de l ecran de succes rempli alors qu il reste ferme');
});

/* Retour du 2026-09-03 : chaque famille garde son TITRE et son CORPS. Ils ne
   vivent plus dans l'ecran de succes mais dans les deux lignes de l'encart. */
const TITRES = {
    brochure:    'Votre brochure est prête !',
    candidature: 'Nous avons bien reçu votre demande de candidature',
    evenement:   'Votre inscription est confirmée !',
    immersion:   'Votre demande de participation est confirmée !'
};
const TEXTES = {
    brochure:    'Vous pouvez dès maintenant la télécharger. '
               + 'Elle vous a également été envoyée par email.',
    candidature: 'Pour la finaliser et déposer votre dossier, créez '
               + 'votre espace candidat via le lien envoyé par e-mail '
               + '(pensez à vérifier vos spams).',
    evenement:   'Merci pour votre inscription à notre événement. '
               + 'Vous recevrez toutes les informations pratiques par email.',
    immersion:   'Notre équipe des admissions vous contactera '
               + 'prochainement par téléphone afin de convenir d\'une date.'
};

test('Chaque famille affiche son titre ET son corps dans l encart', () => {
    ['brochure', 'candidature', 'evenement', 'immersion'].forEach((famille) => {
        const p = creerPage(famille);
        jouer(p, SUCCES);
        egal(texteEncart(p), COCHE + ' ' + TITRES[famille] + ' ' + TEXTES[famille],
             `message inattendu pour ${famille}`);
    });
});

test('Le titre du message passe en gras, le corps non', () => {
    /* Deux lignes dans un meme encart sans hierarchie se lisent comme un pave.
       Le gras est ce qui fait qu'on reconnait la confirmation d'un coup d'oeil. */
    const p = creerPage('candidature');
    jouer(p, SUCCES);
    const lignes = encart(p).children;
    egal(lignes.length, 2, 'l encart ne porte pas deux lignes');
    egal(lignes[0].style.fontWeight, '700', 'titre du message non mis en avant');
    vrai(lignes[1].style.fontWeight !== '700', 'corps du message mis en gras lui aussi');
});

test('La confirmation s ouvre par une coche', () => {
    /* Le HTML publie portait un emoji different selon le formulaire — une
       enveloppe sur la candidature, une coche ailleurs. L'encart tranche : une
       coche, partout, sans republier quoi que ce soit. */
    const p = creerPage('immersion');
    jouer(p, SUCCES);
    vrai(texteEncart(p).indexOf(COCHE) === 0, 'la confirmation ne commence pas par une coche');
});

test('L encart de confirmation se pose AVANT le bouton', () => {
    /* Meme place que l'encart de refus : le visiteur lit avant de recliquer,
       et n'a qu'un seul endroit ou regarder quelle que soit l'issue. */
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    const enfants = p.form.children;
    vrai(enfants.indexOf(encart(p)) < enfants.indexOf(p.submitWrap),
         'confirmation posee sous le bouton');
});

test('Sans marqueur de succes, aucun encart [REGRESSION]', () => {
    /* Une ecriture refusee remplace la page entiere, bilan compris. Afficher
       la confirmation dans ce cas ferait croire a une soumission enregistree. */
    const p = creerPage('brochure');
    jouer(p, 'The page content contains errors and cannot be processed.');
    egal(encart(p), null, 'confirmation affichee alors que rien n a ete ecrit');
    vrai(p.zone.style.display !== 'none', 'formulaire masque alors que rien n a ete ecrit');
});

test('La zone campus RESTE affichee [retour 2026-09-03]', () => {
    /* Inverse assume du correctif du 31/08. `.jpo-campus-zone` — la liste des
       campus et le rappel de date — est SOEUR de la zone de formulaire ; le
       socle l'emportait avec elle dans son balayage des enfants de la carte.
       Ce balayage n'existe plus : plus rien n'est masque, donc plus rien a
       rattraper selecteur par selecteur. */
    const p = creerPage('evenement');
    jouer(p, SUCCES);
    vrai(p.campus.style.display !== 'none', 'zone campus masquee par la confirmation');
    vrai(p.zone.style.display !== 'none', 'zone de formulaire masquee');
    vrai(p.entete.style.display !== 'none', 'titre du formulaire masque');
    vrai(texteEncart(p).length > 0, 'message de confirmation perdu');
});

test('Un statut error n est pas un succes', () => {
    const p = creerPage('brochure');
    jouer(p, '<!-- socle ecriture: statut=error pa= nouveau=false journal= -->');
    egal(encart(p), null, 'confirmation affichee sur une erreur');
    vrai(p.zone.style.display !== 'none', 'formulaire masque sur une erreur');
});

test('Le formulaire est branche pour un envoi sans rechargement', () => {
    const p = creerPage('evenement');
    jouer(p, '');
    vrai(typeof p.form.__ecouteurs.submit === 'function', 'aucun ecouteur submit pose');
});

test('Sans bloc de succes dans la page, la confirmation s affiche quand meme', () => {
    /* L'encart est fabrique par le socle et vit DANS le formulaire : il ne
       depend plus du tout de l'ecran `.xxx-success` du HTML publie. Une page
       ancienne, ou une maquette d'ecole qui ne le porte pas, confirme
       exactement comme les autres. */
    const p = creerPage('brochure', { avecSucces: false });
    jouer(p, SUCCES);
    egal(texteEncart(p), COCHE + ' ' + TITRES.brochure + ' ' + TEXTES.brochure,
         'confirmation absente sans ecran de succes dans la page');
});

test('Le bouton est rendu au visiteur apres un succes [retour 2026-09-03]', () => {
    /* Il ne l'etait pas, et c'etait sans consequence tant que la confirmation
       emportait le formulaire — bouton compris. Maintenant que le formulaire
       reste, un bouton fige sur « Envoi en cours... » serait la seule chose
       cassee de la page, et interdirait le renvoi que ce retour demande. */
    const p = creerPage('brochure');
    p.fetch = () => promesseSync({ text: () => promesseSync(SUCCES) });
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    egal(p.bouton.disabled, false, 'bouton laisse desactive apres une confirmation');
    egal(tonEncart(p), VERT, 'confirmation absente apres un envoi fetch');
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

test('Une page SANS socle d ecriture est signalee des le chargement [REGRESSION]', () => {
    /* Le marqueur est emis a chaque requete, meme sur un simple affichage :
       son absence complete signifie que le bloc n est pas inclus. Sans cette
       distinction, l echec se lisait « reessayez dans un instant » — alors
       qu aucune tentative ne pourra jamais aboutir avant republication. */
    const p = creerPage('candidature');
    const avertis = [];
    p.console = { warn: (m) => avertis.push(String(m)) };
    jouer(p, '<html>page publiee avant le socle d ecriture</html>');
    vrai(avertis.length === 1, 'aucun avertissement au chargement');
    vrai(/republier/i.test(avertis[0]), `avertissement peu clair : ${avertis[0]}`);
});

test('Une page AVEC le socle d ecriture ne declenche aucun avertissement', () => {
    const p = creerPage('candidature');
    const avertis = [];
    p.console = { warn: (m) => avertis.push(String(m)) };
    /* Sur un simple affichage le statut est vide, mais le marqueur est la. */
    jouer(p, '<!-- socle ecriture: statut= pa= nouveau=false journal= -->');
    vrai(avertis.length === 0, `avertissement a tort : ${avertis[0]}`);
});

test('Le script ne se lit pas lui-meme [REGRESSION]', () => {
    /* Ce script contient ses propres expressions en clair, et la page les lui
       renvoie. Sans ancrage sur <!--, la recherche de « socle erreur: »
       trouvait le TEXTE de sa propre regex et rendait
       « \\s*([\\s\\S]*?)\\s* » comme message d'erreur au visiteur. */
    const p = creerPage('brochure');
    const faux = 'var RE = /socle ecriture:\\s*statut=(\\w+)/i;'
               + 'var RE2 = /socle erreur:\\s*([\\s\\S]*?)\\s*-->/i;';
    jouer(p, faux);
    vrai(p.zone.style.display !== 'none',
         'le script a pris sa propre source pour un bilan de succes');
});

test('`submitted` n est poste QU UNE FOIS [REGRESSION]', () => {
    /* Le formulaire porte deja un champ cache `submitted`. L ajouter sans
       condition le postait deux fois, RequestParameter rendait "true,true",
       l egalite echouait cote AMPscript et TOUT le bloc d ecriture etait saute
       — statut vide, aucune ligne de journal, et un message accusant le CRM.
       Diagnostique le 31/08 en instrumentant le fetch d une page publiee. */
    const p = creerPage('candidature');
    let corps = '';
    p.fetch = (u, o) => { corps = (o && o.body) || ''; return Promise.resolve({ text: () => Promise.resolve('') }); };
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    const n = corps.split('submitted=true').length - 1;
    egal(n, 1, 'drapeau submitted poste ' + n + ' fois');
});

test('Les opt-in par canal sont deduits de la case RGPD [REGRESSION]', () => {
    /* Le socle d ecriture attend HasOptedInEmail / SMS / WhatsApp / Phone, un
       par canal ; le formulaire n a qu une case. La conversion etait faite par
       le JS des blocs, absent d une page publiee : aucun consentement n etait
       enregistre, alors que le visiteur avait coche. */
    const p = creerPage('brochure');
    let corps = '';
    p.fetch = (u, o) => { corps = (o && o.body) || ''; return Promise.resolve({ text: () => Promise.resolve('') }); };
    jouer(p, '');
    /* La case n existe pas dans ce faux formulaire : opt-out attendu. */
    p.form.__ecouteurs.submit({ preventDefault() {} });
    ['HasOptedInEmail', 'HasOptedInSMS', 'HasOptedInWhatsApp', 'HasOptedInPhone'].forEach((c) => {
        vrai(corps.indexOf(c + '=0') > -1, `${c} absent du corps poste`);
    });
});

/* ============================================================================
 *  CANDIDATURE BLOQUEE — regle 8 du cadrage
 * ============================================================================
 *  Deux refus, deux messages, et aucune ecriture dans le CRM :
 *    r1  une candidature est deja en cours pour ce couple personne x PTAT ;
 *    r2  une decision defavorable a deja ete rendue sur ce programme.
 *
 *  Ce que ces tests verrouillent : le socle d'ecriture posait `statut=blocked`
 *  sans emettre le moindre motif, si bien que le front tombait sur sa branche
 *  d'echec et servait au candidat « le CRM a refuse l'ecriture — le detail est
 *  dans LPB_Log_Soumissions ». Le texte affiche est celui du cadrage, au mot
 *  pres : il est compare EN ENTIER, pas par mot-cle.
 *
 *  ⚠ LA REGLE ELLE-MEME N'A PAS BOUGE le 2026-09-03. C'est le socle
 *  d'ECRITURE qui decide du motif, dans handler-form.ampscript, et il n'a pas
 *  ete touche. Ce qui change ici tient en deux points, tous deux d'affichage :
 *  le TEXTE de R1, et le TON — orange pour un dossier en cours, rouge pour un
 *  refus, la ou les deux partageaient le meme rouge.
 * ========================================================================== */

const BLOQUE_R1 = '<!-- socle ecriture: statut=blocked pa= nouveau=false journal= BLOQUE:r1:1candidature(s) -->'
                + '<!-- socle blocage: motif=r1 -->';
const BLOQUE_R2 = '<!-- socle ecriture: statut=blocked pa= nouveau=false journal= BLOQUE:r2:1candidature(s) -->'
                + '<!-- socle blocage: motif=r2 -->';

/* Retour du 2026-09-03 : le libelle de R1 est celui que porte deja le socle
   d'ecriture. L'ancien annoncait « votre candidature a deja ete transmise
   [...] consultez l'email qui vous avait ete envoye » — une promesse d'email
   que rien ne garantit, et aucune porte de sortie. Celui-ci ORIENTE. */
const TEXTE_R1 = 'Vous avez déjà une candidature en cours pour ce programme. '
               + 'Nous vous invitons à contacter le service des admissions du '
               + 'campus auquel vous souhaitez candidater.';
const TEXTE_R2 = 'Votre précédente candidature à ce programme a fait '
               + "l'objet d'une décision défavorable. Une nouvelle "
               + "candidature au même programme n'est pas possible avant "
               + "l'année prochaine. Pour toute question, veuillez "
               + 'contacter le service des admissions.';

test('Une candidature bloquee affiche le message R1 du cadrage [REGRESSION]', () => {
    const p = creerPage('candidature');
    jouer(p, BLOQUE_R1);
    egal(texteEncart(p), TEXTE_R1, 'message R1 absent ou reformule');
});

test('Un refus anterieur affiche le message R2, pas celui de R1 [REGRESSION]', () => {
    /* Les deux messages ne disent pas la meme chose au candidat : l'un
       l'oriente vers les admissions, l'autre lui annonce qu'il devra attendre
       l'annee prochaine. Les confondre serait pire que se taire. */
    const p = creerPage('candidature');
    jouer(p, BLOQUE_R2);
    egal(texteEncart(p), TEXTE_R2, 'message R2 absent ou reformule');
});

test('Un dossier en cours est orange, un refus est rouge [retour 2026-09-03]', () => {
    /* Les deux partageaient le rouge, et le rouge annonce une fin de course.
       « Une candidature est deja en cours » n'en est pas une : le candidat a un
       interlocuteur a joindre. Le ton doit le dire avant que le texte ne soit
       lu. */
    const enCours = creerPage('candidature');
    jouer(enCours, BLOQUE_R1);
    egal(tonEncart(enCours), ORANGE, 'candidature en cours affichee en rouge');

    const refuse = creerPage('candidature');
    jouer(refuse, BLOQUE_R2);
    egal(tonEncart(refuse), ROUGE, 'decision defavorable affichee dans un ton trop doux');
});

test('Un blocage ne declenche AUCUNE alerte technique [REGRESSION]', () => {
    /* Le symptome d'origine : « L'envoi n'a pas abouti — le CRM a refuse
       l'ecriture. Le detail est dans LPB_Log_Soumissions », dans une alert(),
       a un candidat, pour un refus parfaitement prevu par le cadrage. */
    const p = creerPage('candidature');
    p.fetch = () => promesseSync({ text: () => promesseSync(BLOQUE_R1) });
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    egal(p.alertes, undefined, 'alerte affichee : ' + ((p.alertes || [])[0] || ''));
    egal(texteEncart(p), TEXTE_R1, 'message du cadrage absent apres un envoi fetch');
});

test('Un blocage n est PAS une confirmation [REGRESSION]', () => {
    /* Rien n'a ete ecrit : ni compte, ni consentement, ni campagne. Le ton
       vert ferait croire a une candidature enregistree. C'est desormais LE
       point de vigilance : les deux etats partagent le meme encart, et seule
       la couleur les separe au premier coup d'oeil. */
    const p = creerPage('candidature');
    jouer(p, BLOQUE_R1);
    vrai(tonEncart(p) !== VERT, 'blocage affiche dans le ton d une confirmation');
    egal(p.titre.textContent, '', 'ecran de succes rempli sur un blocage');
});

test('Le formulaire reste utilisable : le blocage porte sur UN programme', () => {
    /* Changer de campus, de specialite ou de rentree designe un autre PTAT, sur
       lequel rien n'interdit de candidater. */
    const p = creerPage('candidature');
    jouer(p, BLOQUE_R1);
    vrai(p.zone.style.display !== 'none', 'formulaire masque par le blocage');
    vrai(p.entete.style.display !== 'none', 'titre du formulaire masque par le blocage');
});

test('L encart se pose AVANT le bouton, pas apres', () => {
    const p = creerPage('candidature');
    jouer(p, BLOQUE_R1);
    const enfants = p.form.children;
    vrai(enfants.indexOf(encart(p)) < enfants.indexOf(p.submitWrap),
         'encart pose apres le bouton : le candidat recliquerait sans avoir lu');
});

test('Motif absent : on retombe sur R1, jamais sur une annonce de refus', () => {
    /* Une page publiee avant que le socle d'ecriture n'emette le motif. R1
       n'annonce aucune decision de jury — c'est le defaut le moins faux. */
    const p = creerPage('candidature');
    jouer(p, '<!-- socle ecriture: statut=blocked pa= nouveau=false journal= -->');
    egal(texteEncart(p), TEXTE_R1, 'repli inattendu sans motif');
    egal(tonEncart(p), ORANGE, 'repli affiche dans le ton d un refus');
});

test('Deux tentatives n empilent pas deux encarts [REGRESSION]', () => {
    /* L'encart se retrouve par son [data-socle] et se vide avant d'etre
       reecrit. Sans cela, un candidat qui insiste verrait le message deux
       fois, puis trois. */
    const p = creerPage('candidature');
    let reponse = BLOQUE_R1;
    p.fetch = () => promesseSync({ text: () => promesseSync(reponse) });
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    reponse = BLOQUE_R2;
    p.form.__ecouteurs.submit({ preventDefault() {} });

    const encarts = p.form.children.filter((n) => n.className === 'socle-message');
    egal(encarts.length, 1, encarts.length + ' encart(s) dans le formulaire');
    egal(texteEncart(p), TEXTE_R2, 'le second message n a pas remplace le premier');
});

test('Un blocage qui suit une confirmation la REMPLACE [retour 2026-09-03]', () => {
    /* Le cas que l'encart unique existe pour empecher. Le formulaire ne
       disparaissant plus, un visiteur peut confirmer puis changer de programme
       et retomber sur un blocage : deux encarts distincts le laisseraient lire
       « demande bien recue » juste au-dessus de « candidature en cours ». Le
       ton doit suivre le texte, sinon le message reste vert. */
    const p = creerPage('candidature');
    let reponse = SUCCES;
    p.fetch = () => promesseSync({ text: () => promesseSync(reponse) });
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    egal(tonEncart(p), VERT, 'prealable : la confirmation ne s est pas affichee');

    reponse = BLOQUE_R2;
    p.form.__ecouteurs.submit({ preventDefault() {} });
    const encarts = p.form.children.filter((n) => n.className === 'socle-message');
    egal(encarts.length, 1, encarts.length + ' encart(s) : la confirmation cohabite avec le refus');
    egal(texteEncart(p), TEXTE_R2, 'la confirmation n a pas ete remplacee');
    egal(tonEncart(p), ROUGE, 'refus affiche dans le vert de la confirmation');
});

test('Le bouton est rendu au candidat apres un blocage', () => {
    const p = creerPage('candidature');
    p.fetch = () => promesseSync({ text: () => promesseSync(BLOQUE_R1) });
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    egal(p.bouton.disabled, false, 'bouton laisse desactive : le candidat ne peut plus rien tenter');
});


/* ============================================================================
 *  LE CTA « DEMANDE DE DOCUMENTATION » — retour client du 2026-09-03
 * ============================================================================
 *  Le formulaire de brochure promet une documentation ; il annonçait seulement
 *  qu'elle partait par email. Le client demande le lien SUR LA PAGE, tout de
 *  suite après la soumission.
 *
 *  Tout vient de la DE `CTA_demande_documentation`, publiée dans
 *  `SOCLE_DATA.ctaDoc` filtrée sur l'école courante : le lien, le libellé et
 *  LES DEUX COULEURS — chaque école a sa charte. Rien n'est en dur, pas même
 *  le libellé ; seul le couple noir/blanc sert de repli quand la DE laisse les
 *  couleurs vides.
 *
 *  ⚠ Ces tests décrivent AUSSI l'écart de référentiel mesuré le 04/09 entre la
 *  DE (saisie à la main) et le value set Salesforce que poste le formulaire.
 *  Ils sont le seul endroit où cet écart est vérifié automatiquement.
 * ========================================================================== */

/** Le bouton de l'encart, et ce qu'il porte. */
function cta(p) {
    const z = encart(p);
    if (!z) return null;
    return z.children.filter((c) => c.tagName === 'A')[0] || null;
}

/* Une ligne de la DE, telle qu'elle arrive dans SOCLE_DATA.ctaDoc. Les valeurs
   sont celles de la capture EFAP du 04/09, au caractère près. */
function ligneDoc(sur) {
    return Object.assign({
        url: 'https://cdn.efap.com/doc-efap.pdf',
        libelle: 'Je télécharge la documentation',
        fond: '#1A1919',
        police: '#FFFFFF',
        niveau: '',
        cursus: '',
    }, sur || {});
}

test('Sans la DE, la confirmation brochure n a PAS de bouton', () => {
    /* L'état d'avant le branchement, et il doit rester correct : DE absente,
       mal nommée, ou sans ligne pour cette école — le message s'affiche seul. */
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    vrai(encart(p) !== null, 'prealable : la confirmation ne s est pas affichee');
    egal(cta(p), null, 'bouton pose alors qu aucune ligne n est disponible');
});

test('Une ligne sans critère sert de documentation par défaut', () => {
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc()];
    jouer(p, SUCCES);
    const bouton = cta(p);
    vrai(bouton !== null, 'aucun bouton pose alors que la DE fournit une ligne');
    egal(bouton.getAttribute('href'), 'https://cdn.efap.com/doc-efap.pdf', 'mauvaise URL');
    egal(bouton.textContent, 'Je télécharge la documentation', 'libelle de la DE ignore');
});

test('Les couleurs de l école viennent de la DE', () => {
    /* Le cœur du retour : chaque école a sa charte. Un bouton noir partout
       aurait été plus simple, et faux. */
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc({ fond: '#C8102E', police: '#FFF' })];
    jouer(p, SUCCES);
    egal(cta(p).style.background, '#C8102E', 'couleur de fond de la DE ignoree');
    egal(cta(p).style.color, '#FFF', 'couleur de police de la DE ignoree');
});

test('Couleurs vides ou invalides : on retombe sur un bouton lisible', () => {
    /* Une DE se remplit à la main. Une couleur oubliée, ou saisie « noir »
       plutôt que « #1A1919 », ne doit pas rendre le libellé illisible sur un
       fond transparent. */
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc({ fond: '', police: 'blanc' })];
    jouer(p, SUCCES);
    egal(cta(p).style.background, '#000', 'repli de fond absent');
    egal(cta(p).style.color, '#fff', 'repli de police absent');
});

test('Une ligne SANS libellé ne rend aucun bouton', () => {
    /* Rien n'est en dur, pas même le texte : inventer « Télécharger » ferait
       apparaître, dans la charte de l'école, un bouton que personne n'a écrit. */
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc({ libelle: '' })];
    jouer(p, SUCCES);
    egal(cta(p), null, 'bouton pose avec un libelle invente');
});

test('Le niveau d études sélectionne la bonne ligne', () => {
    const p = creerPage('brochure', { champs: { StudyLevel: 'Terminale' } });
    p.ctaDoc = [
        ligneDoc({ url: 'https://x/defaut.pdf' }),
        ligneDoc({ url: 'https://x/terminale.pdf', niveau: 'Terminale' }),
    ];
    jouer(p, SUCCES);
    egal(cta(p).getAttribute('href'), 'https://x/terminale.pdf',
         'le defaut a pris le pas sur la ligne du niveau');
});

test('La ligne la PLUS PRÉCISE gagne, quel que soit l ordre dans la DE', () => {
    /* Un défaut d'école et des documentations par niveau doivent cohabiter
       sans que le métier ait à trier ses lignes. */
    const p = creerPage('brochure', { champs: { StudyLevel: 'BAC+2' } });
    p.ctaDoc = [
        ligneDoc({ url: 'https://x/bac2.pdf', niveau: 'Bac+2' }),
        ligneDoc({ url: 'https://x/defaut.pdf' }),
    ];
    jouer(p, SUCCES);
    egal(cta(p).getAttribute('href'), 'https://x/bac2.pdf', 'ordre de la DE mal arbitre');
});

test('La CASSE ne fait pas rater la ligne [REGRESSION 04/09]', () => {
    /* Mesuré sur les comptes réels : le formulaire poste « BAC+1 », la DE
       porte « Bac+1 ». Une comparaison littérale ne matchait pas, et le
       candidat n'avait aucun bouton — sans le moindre signal. */
    const p = creerPage('brochure', { champs: { StudyLevel: 'BAC+1' } });
    p.ctaDoc = [ligneDoc({ url: 'https://x/bac1.pdf', niveau: 'Bac+1' })];
    jouer(p, SUCCES);
    vrai(cta(p) !== null, 'ligne ratee sur une simple difference de casse');
    egal(cta(p).getAttribute('href'), 'https://x/bac1.pdf', 'mauvaise ligne retenue');
});

test('Les ACCENTS ne font pas rater la ligne', () => {
    const p = creerPage('brochure', { champs: { StudyLevel: 'Première' } });
    p.ctaDoc = [ligneDoc({ url: 'https://x/premiere.pdf', niveau: 'PREMIERE' })];
    jouer(p, SUCCES);
    vrai(cta(p) !== null, 'ligne ratee sur une difference d accent');
});

test('Le bac obtenu se reconnaît dans ses TROIS graphies [REGRESSION 04/09]', () => {
    /* Le seul écart que la normalisation ne rattrape pas : des libellés
       franchement différents pour le même niveau, pas des variantes de casse.

         « BAC »                 la DE, telle qu'elle est saisie
         « Bac obtenu »          le référentiel des programmes
         « BAC obtenu ou Prépa » le référentiel des comptes — CE QUE LE
                                 FORMULAIRE POSTE

       Confirmé par le métier le 04/09 : le « BAC » de la DE désigne bien le bac
       obtenu. Sans l'équivalence, un candidat bachelier n'avait aucun bouton.

       Les deux premières graphies sont couvertes parce que la DE peut porter
       l'une ou l'autre demain — et parce que ce test est le rappel que
       l'équivalence est un pansement : le jour où la DE sera alignée sur le
       value set Salesforce, il pourra tomber. */
    ['BAC', 'Bac obtenu', 'BAC obtenu ou Prépa'].forEach((graphie) => {
        const p = creerPage('brochure', { champs: { StudyLevel: 'BAC obtenu ou Prépa' } });
        p.ctaDoc = [ligneDoc({ url: 'https://x/bac.pdf', niveau: graphie })];
        jouer(p, SUCCES);
        vrai(cta(p) !== null, 'candidat bachelier laisse sans bouton pour ' + graphie);
        egal(cta(p).getAttribute('href'), 'https://x/bac.pdf', 'mauvaise ligne pour ' + graphie);
    });
});

test('Le bac obtenu ne deborde pas sur un autre niveau', () => {
    /* Une équivalence trop large servirait la documentation « bac obtenu » à un
       élève de Terminale, qui ne l'a pas encore. */
    const p = creerPage('brochure', { champs: { StudyLevel: 'Terminale' } });
    p.ctaDoc = [ligneDoc({ url: 'https://x/bac.pdf', niveau: 'BAC' })];
    jouer(p, SUCCES);
    egal(cta(p), null, 'documentation « bac obtenu » servie a un eleve de Terminale');
});

test('Une cellule multi-valeurs « Bac+1;Bac+2 » sert les deux niveaux', () => {
    /* `niveau_etudes` est en Text(4000) : la colonne accepte plusieurs valeurs
       séparées par `;`, comme les colonnes de programme. */
    ['BAC+1', 'BAC+2'].forEach((niveau) => {
        const p = creerPage('brochure', { champs: { StudyLevel: niveau } });
        p.ctaDoc = [ligneDoc({ url: 'https://x/cycle1.pdf', niveau: 'Bac+1;Bac+2' })];
        jouer(p, SUCCES);
        vrai(cta(p) !== null, `cellule multi-valeurs ratee pour ${niveau}`);
    });
});

test('Un niveau hors de la cellule multi-valeurs ne matche pas', () => {
    const p = creerPage('brochure', { champs: { StudyLevel: 'BAC+5 et +' } });
    p.ctaDoc = [ligneDoc({ url: 'https://x/cycle1.pdf', niveau: 'Bac+1;Bac+2' })];
    jouer(p, SUCCES);
    egal(cta(p), null, 'ligne servie a un niveau qu elle ne couvre pas');
});

test('Le cursus se compare au programme comme à la spécialité', () => {
    /* La colonne est vide sur toutes les lignes connues au 04/09 : on ignore
       laquelle des deux le métier y saisira. On accepte donc les deux. */
    const surProgramme = creerPage('brochure', { champs: { Programme: 'MBA-COM' } });
    surProgramme.ctaDoc = [ligneDoc({ url: 'https://x/mba.pdf', cursus: 'MBA-COM' })];
    jouer(surProgramme, SUCCES);
    vrai(cta(surProgramme) !== null, 'cursus non reconnu depuis Programme');

    const surSpecialite = creerPage('brochure', { champs: { Speciality: 'Communication' } });
    surSpecialite.ctaDoc = [ligneDoc({ url: 'https://x/com.pdf', cursus: 'Communication' })];
    jouer(surSpecialite, SUCCES);
    vrai(cta(surSpecialite) !== null, 'cursus non reconnu depuis Speciality');
});

test('Deux critères doivent TOUS correspondre', () => {
    const p = creerPage('brochure', { champs: { StudyLevel: 'BAC+2', Programme: 'MBA-COM' } });
    p.ctaDoc = [
        ligneDoc({ url: 'https://x/defaut.pdf' }),
        ligneDoc({ url: 'https://x/autre.pdf', niveau: 'Bac+2', cursus: 'DESIGN' }),
    ];
    jouer(p, SUCCES);
    egal(cta(p).getAttribute('href'), 'https://x/defaut.pdf',
         'ligne retenue alors qu un seul de ses deux criteres correspond');
});

test('Aucune ligne ne correspond : pas de bouton, mais le message reste', () => {
    /* Ne rien proposer vaut mieux que proposer la mauvaise documentation — et
       la confirmation garde toute sa raison d'être : l'envoi a bien eu lieu. */
    const p = creerPage('brochure', { champs: { StudyLevel: 'Autres' } });
    p.ctaDoc = [ligneDoc({ url: 'https://x/terminale.pdf', niveau: 'Terminale' })];
    jouer(p, SUCCES);
    egal(cta(p), null, 'bouton pose sans ligne correspondante');
    vrai(texteEncart(p).length > 0, 'message de confirmation perdu');
});

test('Le bouton s ouvre dans un nouvel onglet, sans fuite de contexte', () => {
    /* `target="_blank"` et non l'attribut `download` : le PDF est hébergé
       ailleurs que la CloudPage, et `download` est ignoré en cross-origin. Le
       `rel` empêche la page ouverte de manipuler celle-ci par `window.opener`
       — et garde le formulaire, avec son message, intact derrière. */
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc()];
    jouer(p, SUCCES);
    egal(cta(p).tagName, 'A', 'le CTA n est pas un lien');
    egal(cta(p).getAttribute('target'), '_blank', 'le PDF remplacerait la page');
    egal(cta(p).getAttribute('rel'), 'noopener noreferrer', 'rel de securite absent');
});

test('Le CTA ne s affiche QUE sur un formulaire de brochure', () => {
    /* Le socle de lecture est le même pour tous : la DE est publiée sur toutes
       les pages de l'école, formulaire de candidature compris. */
    const p = creerPage('candidature');
    p.ctaDoc = [ligneDoc()];
    jouer(p, SUCCES);
    egal(cta(p), null, 'bouton de documentation pose sur une candidature');
});

test('Un blocage ne porte jamais de CTA', () => {
    /* Rien n'a été écrit, donc rien n'a été promis. */
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc()];
    jouer(p, '<!-- socle ecriture: statut=blocked pa= nouveau=false journal= -->'
           + '<!-- socle blocage: motif=r1 -->');
    egal(cta(p), null, 'bouton de telechargement pose sur un blocage');
});

test('Une ligne sans URL est ignorée, elle ne fait pas tomber la page', () => {
    const p = creerPage('brochure');
    p.ctaDoc = [ligneDoc({ url: '' }), ligneDoc({ url: 'https://x/bon.pdf' })];
    jouer(p, SUCCES);
    egal(cta(p).getAttribute('href'), 'https://x/bon.pdf', 'ligne incomplete servie');
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
echecs.forEach((e) => console.log(`  ✗ ${e}\n`));
process.exit(echecs.length ? 1 : 0);
