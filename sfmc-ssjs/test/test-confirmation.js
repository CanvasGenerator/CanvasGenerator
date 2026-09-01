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

/** Une promesse deroulee sur place : le test reste synchrone, alors que le
    socle enchaine fetch().then().then(). */
function promesseSync(v) {
    if (v && v.__sync) return v;
    return { __sync: true, then: (fn) => promesseSync(fn(v)), catch() { return this; } };
}

/* ---- Une carte de formulaire, reduite a ce que le socle manipule --------- */
function creerPage(typeFormulaire, { avecSucces = true, avecZone = true } = {}) {
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

test('Un succes remplace le formulaire par l ecran de confirmation', () => {
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    egal(p.zone.style.display, 'none', 'le formulaire reste affiche');
    egal(p.succes.style.display, 'block', 'l ecran de succes reste masque');
    egal(p.entete.style.display, 'none', 'le titre du formulaire reste affiche');
});

const ENVOYEE_CAND = 'Candidature envoy\u00e9e';
const ENVOYEE_AUTRE = 'Demande envoy\u00e9e';

test('Seule la candidature a son propre message ; le reste dit « Demande envoyee »', () => {
    /* Demande du 2026-09-02 : deux textes pour quatre familles, et rien
       d'autre a l'ecran. */
    const cand = creerPage('candidature');
    jouer(cand, SUCCES);
    egal(cand.titre.textContent, ENVOYEE_CAND, 'message de candidature inattendu');

    ['brochure', 'evenement', 'immersion'].forEach((famille) => {
        const p = creerPage(famille);
        jouer(p, SUCCES);
        egal(p.titre.textContent, ENVOYEE_AUTRE, `message inattendu pour ${famille}`);
    });
});

test('Le sous-titre explicatif est vide ET masque [REGRESSION]', () => {
    /* Il est toujours dans le HTML des pages publiees avant ce changement.
       Le vider sans le masquer lui laisserait sa marge basse. */
    const p = creerPage('candidature');
    jouer(p, SUCCES);
    egal(p.texte.textContent, '', 'sous-titre encore rempli');
    egal(p.texte.style.display, 'none', 'sous-titre vide mais toujours dans le flux');
});

test('La liste de brochures « (PDF) » disparait [REGRESSION]', () => {
    /* Liens morts (`onclick="return false"`) sous un intitule fige, et liste
       vide sur une page publiee faute du JS des blocs pour la remplir. La
       retirer du bloc ne touche aucune page en ligne : c'est au socle de le
       faire, a l'execution. */
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    egal(p.listePdf.style.display, 'none', 'liste de brochures toujours affichee');
});

test('L icone devient une coche, quel que soit l emoji publie [REGRESSION]', () => {
    /* Le HTML publie porte une enveloppe sur la candidature et une coche
       verte ailleurs. Sans normalisation, seule une republication les
       harmoniserait. */
    const p = creerPage('candidature');
    p.icone.textContent = '\u1f4e7';
    jouer(p, SUCCES);
    egal(p.icone.textContent, '\u2714\ufe0f', 'icone non normalisee');
});

test('Un bloc annexe porteur d une classe n est PAS repeint', () => {
    /* La normalisation ne vise que le <div> sans classe pose par le builder :
       une ecole peut avoir ajoute son propre bloc en tete. */
    const p = creerPage('brochure');
    p.icone.className = 'brf-logo-ecole';
    p.icone.textContent = '\u2705';
    jouer(p, SUCCES);
    egal(p.icone.textContent, '\u2705', 'bloc d ecole repeint par le socle');
});

test('Le titre publie est VIDE sans le socle : il doit etre rempli [REGRESSION]', () => {
    const p = creerPage('immersion');
    egal(p.titre.textContent, '', 'prealable : le HTML publie porte un titre vide');
    jouer(p, SUCCES);
    vrai(p.titre.textContent.length > 0, 'titre laisse vide — coche sans texte');
});

test('Sans marqueur de succes, rien ne bouge [REGRESSION]', () => {
    /* Une ecriture refusee remplace la page entiere, bilan compris. Afficher
       la confirmation dans ce cas ferait croire a une soumission enregistree. */
    const p = creerPage('brochure');
    jouer(p, 'The page content contains errors and cannot be processed.');
    vrai(p.zone.style.display !== 'none', 'formulaire masque alors que rien n a ete ecrit');
    egal(p.titre.textContent, '', 'confirmation affichee sur un echec');
});

test('La zone campus disparait avec le formulaire [REGRESSION]', () => {
    /* Sur un formulaire evenement, `.jpo-campus-zone` — la liste des campus et
       le rappel de la date — est SOEUR de `.jpo-form-zone`, pas sa descendante.
       Le socle ne masquait que la seconde : la confirmation s'affichait avec,
       juste au-dessus, une liste de campus toujours cliquable. Constate en
       recette sur la JPO le 31/08.

       Le test ne vaut que parce que le harnais expose `children` et
       `contains` : sans eux le balayage du socle serait inerte et ce test
       passerait sans rien prouver. */
    const p = creerPage('evenement');
    jouer(p, SUCCES);
    egal(p.campus.style.display, 'none', 'zone campus toujours affichee sous la confirmation');
    egal(p.zone.style.display, 'none', 'zone de formulaire toujours affichee');
    egal(p.entete.style.display, 'none', 'titre du formulaire toujours affiche');
    vrai(p.succes.style.display !== 'none', 'ecran de succes masque par le balayage');
    vrai(p.titre.textContent.length > 0, 'message de confirmation perdu');
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
    const h3 = cree[0].enfants.filter((n) => n.tagName === 'H3');
    egal(h3.length, 1, 'ecran fabrique sans titre, ou avec plusieurs');
    egal(h3[0].textContent, ENVOYEE_AUTRE, 'message inattendu dans l ecran fabrique');
    vrai(!cree[0].enfants.some((n) => n.tagName === 'P'),
         'sous-titre fabrique alors qu il ne doit plus y en avoir');
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
 * ========================================================================== */

const BLOQUE_R1 = '<!-- socle ecriture: statut=blocked pa= nouveau=false journal= BLOQUE:r1:1candidature(s) -->'
                + '<!-- socle blocage: motif=r1 -->';
const BLOQUE_R2 = '<!-- socle ecriture: statut=blocked pa= nouveau=false journal= BLOQUE:r2:1candidature(s) -->'
                + '<!-- socle blocage: motif=r2 -->';

const TEXTE_R1 = 'Vous avez d\u00e9j\u00e0 une candidature en cours pour ce programme. '
               + 'Nous vous invitons \u00e0 contacter le service des admissions du '
               + 'campus auquel vous souhaitez candidater.';
const TEXTE_R2 = 'Votre pr\u00e9c\u00e9dente candidature \u00e0 ce programme a fait '
               + "l'objet d'une d\u00e9cision d\u00e9favorable. Une nouvelle "
               + "candidature au m\u00eame programme n'est pas possible avant "
               + "l'ann\u00e9e prochaine. Pour toute question, veuillez "
               + 'contacter le service des admissions.';

/** L'encart de blocage, et le texte qu'il porte. */
function encart(p) { return p.form.querySelector('[data-socle="blocage"]'); }
function texteEncart(p) {
    const z = encart(p);
    return z ? z.children.map((c) => c.textContent).join(' ') : null;
}

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
    /* Rien n'a ete ecrit : ni compte, ni consentement, ni campagne. Afficher
       l'ecran de succes ferait croire a une candidature enregistree. */
    const p = creerPage('candidature');
    jouer(p, BLOQUE_R1);
    egal(p.titre.textContent, '', 'confirmation affichee sur un blocage');
    vrai(p.succes.style.display !== 'block', 'ecran de succes ouvert sur un blocage');
});

test('Le formulaire reste utilisable : le blocage porte sur UN programme', () => {
    /* Changer de campus, de specialite ou de rentree designe un autre PTAT, sur
       lequel rien n'interdit de candidater. Masquer le formulaire, comme le
       fait la confirmation, fermerait cette porte. */
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

    const encarts = p.form.children.filter((n) => n.className === 'socle-blocage');
    egal(encarts.length, 1, encarts.length + ' encart(s) de blocage dans le formulaire');
    egal(texteEncart(p), TEXTE_R2, 'le second message n a pas remplace le premier');
});

test('Le bouton est rendu au candidat apres un blocage', () => {
    const p = creerPage('candidature');
    p.fetch = () => promesseSync({ text: () => promesseSync(BLOQUE_R1) });
    jouer(p, '');
    p.form.__ecouteurs.submit({ preventDefault() {} });
    egal(p.bouton.disabled, false, 'bouton laisse desactive : le candidat ne peut plus rien tenter');
});

test('Un formulaire abouti ne porte aucun encart de blocage', () => {
    const p = creerPage('brochure');
    jouer(p, SUCCES);
    egal(encart(p), null, 'encart de blocage pose sur une brochure aboutie');
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
echecs.forEach((e) => console.log(`  ✗ ${e}\n`));
process.exit(echecs.length ? 1 : 0);
