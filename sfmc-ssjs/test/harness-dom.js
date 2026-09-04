/**
 * ============================================================================
 *  FAUX DOM POUR TESTER LE JS DE CASCADE
 * ============================================================================
 *  Le JS de cascade est le seul endroit ou vit la logique metier cote client :
 *  filtrage des programmes, matrice par ecole, ordre des champs, resolution du
 *  PTAT. Il est testable en Node parce qu'il ne touche qu'a une poignee d'APIs
 *  DOM, reproduites ici.
 *
 *  Deux details ont deja fausse des tests et sont donc traites explicitement :
 *    - `innerHTML = ''` doit VIDER les options. Sans ca les options
 *      s'accumulent et un test de doublon passe alors qu'il devrait echouer.
 *    - `insertBefore` / `nextSibling` doivent etre reels : sans eux, le test du
 *      reordonnancement ne voit pas que les champs voisins sont deplaces.
 * ============================================================================
 */
'use strict';

/**
 * Les selecteurs que le PORTEUR d'un champ represente dans ce harnais : le
 * conteneur du champ, tel que le cherche `porteurDe()` du socle.
 *
 * Tout le reste — `.cnd-form`, `.brf-form`, `.jpo-form`... — designe un
 * ANCETRE que le harnais ne modelise pas, et doit donc rendre null. Sans cette
 * distinction, `closest` repondait oui a tout et un masque reserve a un seul
 * formulaire s'appliquait a tous.
 */
const PORTEURS_CONNUS = /(\[data-socle-champ\]|-field\b|\.form-group|\.field\b)/;

/**
 * @param {Array} layout
 * @param {string} [formClass] Classe du <form> simule ('cnd-form', 'brf-form'...).
 *        Vide par defaut : le socle applique alors ses regles GENERIQUES, sans
 *        le masquage propre a la candidature. C'est ce qui permet aux tests
 *        d'ordre du value set de continuer a voir la liste complete des niveaux,
 *        tandis qu'un test explicitement 'cnd-form' verifie le masquage cible.
 */
function creerDom(layout, formClass = '') {
    /* Le <form> porteur, retourne par `el.closest('.cnd-form')` UNIQUEMENT quand
       le type simule correspond. Les autres selecteurs (`.cnd-field`,
       `[data-socle-champ]`...) continuent de renvoyer le porteur du champ. */
    const forme = { _nom: '(form.' + (formClass || 'generique') + ')' };
    const parent = {
        childNodes: [],
        appendChild(n) {
            const i = this.childNodes.indexOf(n);
            if (i >= 0) this.childNodes.splice(i, 1);
            this.childNodes.push(n); n.parentNode = this; this._sync();
        },
        insertBefore(n, ref) {
            const i = this.childNodes.indexOf(n);
            if (i >= 0) this.childNodes.splice(i, 1);
            const j = ref ? this.childNodes.indexOf(ref) : -1;
            if (j < 0) this.childNodes.push(n); else this.childNodes.splice(j, 0, n);
            n.parentNode = this; this._sync();
        },
        _sync() {
            this.childNodes.forEach((n, i) => { n.nextSibling = this.childNodes[i + 1] || null; });
        },
    };

    /* Les formulaires masquent par CLASSE, pas par style inline : les champs de
       la cascade naissent avec `hidden`. Le harnais doit le refleter, sans quoi
       il declare visible un champ qu'un navigateur garderait cache. */
    function creerClassList(initiales) {
        const set = new Set(initiales);
        return {
            add: (c) => set.add(c),
            remove: (c) => set.delete(c),
            contains: (c) => set.has(c),
            toggle: (c, force) => (force === undefined ? (set.has(c) ? set.delete(c) : set.add(c))
                                                      : (force ? set.add(c) : set.delete(c))),
        };
    }

    /* Sections intermediaires. Un troisieme element dans une ligne de layout
       place le porteur dans un SOUS-CONTENEUR partage, au lieu du formulaire.

       Ce n'est pas un raffinement : sur la vraie candidature, le campus et le
       niveau vivent dans un `.cnd-row` a deux colonnes, tandis que specialite,
       rythme, langue et rentree sont enfants directs du `<form>`. Un gabarit
       PLAT laissait donc passer un `appliquerOrdre` qui abandonnait des que les
       porteurs ne partageaient pas tous le meme parent.

       Les sections s'IMBRIQUENT : un nom en chemin ('row/colA') cree la rangee
       puis la colonne. C'est le markup reel de la brochure, de la candidature
       et de l'immersion — une rangee a deux colonnes, un champ par colonne —
       et c'est ce qu'il faut pour verifier qu'une colonne restee seule prend
       toute la largeur. */
    const sections = {};
    function sectionDe(nom) {
        if (!nom) return parent;
        if (!sections[nom]) {
            const parts = String(nom).split('/');
            const hote = parts.length > 1 ? sectionDe(parts.slice(0, -1).join('/')) : parent;
            const sec = {
                _nom: '(' + parts[parts.length - 1] + ')', style: {}, parentNode: hote,
                nextSibling: null,
                childNodes: [], classList: creerClassList([]),
                appendChild: parent.appendChild, insertBefore: parent.insertBefore,
                _sync: parent._sync,
            };
            sections[nom] = sec;
            hote.childNodes.push(sec);
        }
        return sections[nom];
    }

    /* Rattache une section — et toutes celles qui la portent — a son hote.
       `reset()` vide les listes d'enfants : sans ce rattachement les sections
       deja creees n'y revenaient jamais, et le DOM rejoue perdait ses rangees. */
    function attacherSection(chemin) {
        const parts = String(chemin).split('/');
        for (let i = 0; i < parts.length; i++) {
            const sec = sections[parts.slice(0, i + 1).join('/')];
            if (sec && sec.parentNode.childNodes.indexOf(sec) === -1) {
                sec.parentNode.childNodes.push(sec);
            }
        }
    }

    const champs = {};
    for (const [nom, estCascade, section] of layout) {
        const hote = sectionDe(section);
        const porteur = {
            _nom: nom, style: {}, parentNode: hote, nextSibling: null,
            classList: creerClassList(estCascade ? ['hidden'] : []),
        };
        hote.childNodes.push(porteur);
        if (estCascade) {
            const el = {
                tagName: 'SELECT', name: nom, value: '', options: [], style: {}, disabled: false,
                /* Les attributs comptent : `required` suit la visibilite, et
                   c'est le NAVIGATEUR qui exige les champs affiches — il n'y a
                   pas d'autre validation sur une page publiee. */
                attributs: {},
                setAttribute(n, v) { el.attributs[n] = String(v); },
                removeAttribute(n) { delete el.attributs[n]; },
                getAttribute(n) { return Object.prototype.hasOwnProperty.call(el.attributs, n) ? el.attributs[n] : null; },
                hasAttribute(n) { return Object.prototype.hasOwnProperty.call(el.attributs, n); },
                set innerHTML(v) { if (v === '') el.options.length = 0; },
                get innerHTML() { return ''; },
                querySelector: () => null,
                appendChild: (o) => el.options.push(o),
                addEventListener() {},
                /* SELECTIF, et non « porteur quoi qu'on demande ».
                   Un closest permissif rendait vrai TOUTE remontee, y compris
                   `closest('.cnd-form')` : le masque propre a la candidature
                   s'appliquait donc a tous les gabarits du harnais, et quatre
                   tests de l'ordre des niveaux tombaient alors que le code de
                   production est correct — un vrai closest, lui, ne trouve pas
                   de .cnd-form au-dessus d'une brochure.

                   Le harnais ne modelise qu'un seul ancetre, le porteur du
                   champ : on ne rend donc `porteur` que pour les selecteurs qui
                   le designent, et null pour tout ancetre qu'il ne represente
                   pas. C'est ce qui rend le cloisonnement par formulaire
                   REELLEMENT testable. */
                closest: (sel) => {
                    const s = String(sel || '');
                    if (PORTEURS_CONNUS.test(s)) return porteur;
                    /* Le <form> simule, et LUI SEUL : `closest('.cnd-form')` ne
                       repond que si le harnais joue bien une candidature. C'est
                       ce qui distingue un masque cible d'un masque global. */
                    if (formClass && s.indexOf(formClass) !== -1) return forme;
                    return null;
                },
                parentNode: porteur,
            };
            champs[nom] = el;
        }
    }
    parent._sync();
    champs.PTAT_Id = { tagName: 'INPUT', value: '', addEventListener() {} };

    /* `readyState` et `addEventListener` servent a tester l'attente du DOM.
       Par defaut 'complete' : la cascade s'execute alors immediatement, ce qui
       preserve tous les tests existants. Passer 'loading' pour verifier que la
       cascade DIFFERE bien son travail. */
    const ecouteurs = {};
    const document = {
        readyState: 'complete',
        querySelector(sel) {
            const m = /\[name="(.+?)"\]/.exec(sel);
            return m ? (champs[m[1]] || null) : null;
        },
        createElement: () => ({}),
        addEventListener(type, fn) { (ecouteurs[type] = ecouteurs[type] || []).push(fn); },
    };

    return {
        parent, champs, document,
        /* declenche un evenement DOM, pour tester le chemin differe */
        emettre: (type) => (ecouteurs[type] || []).forEach((fn) => fn()),
        nbEcouteurs: (type) => (ecouteurs[type] || []).length,
        ordre: () => parent.childNodes.map((n) => n._nom),
        /* L'ordre DANS une section : c'est la que se joue « langue avant
           specialite » quand les champs ne sont pas tous freres. */
        ordreSection: (nom) => (sections[nom] ? sections[nom].childNodes.map((n) => n._nom) : null),
        options: (nom) => (champs[nom] ? champs[nom].options.map((o) => o.textContent) : null),
        requis: (nom) => Boolean(champs[nom]) && champs[nom].hasAttribute('required'),
        visible: (nom) => Boolean(champs[nom]) &&
            champs[nom].parentNode.style.display !== 'none' &&
            !champs[nom].parentNode.classList.contains('hidden'),
        /* Le conteneur lui-meme : c'est sur lui que se lisent le `display`
           d'une colonne videe et le `grid-column` de celle qui reste. */
        section: (nom) => sections[nom] || null,
        reset() {
            parent.childNodes.length = 0;
            Object.values(sections).forEach((sec) => {
                sec.childNodes.length = 0;
                sec.style.display = ''; sec.style.gridColumn = '';
            });
            for (const [nom, estCascade, section] of layout) {
                const hote = sectionDe(section);
                if (section) attacherSection(section);
                const p = champs[nom] ? champs[nom].parentNode
                                      : { _nom: nom, style: {}, classList: creerClassList([]) };
                p._nom = nom; p.style.display = ''; p.style.gridColumn = ''; p.parentNode = hote;
                if (p.classList) p.classList.toggle('hidden', Boolean(estCascade));
                hote.childNodes.push(p);
            }
            Object.values(sections).forEach((sec) => sec._sync.call(sec));
            parent._sync();
            Object.values(champs).forEach((e) => {
                if (e.options) e.options.length = 0;
                e.value = '';
                if (e.attributs) { for (const k of Object.keys(e.attributs)) delete e.attributs[k]; }
            });
        },
    };
}

module.exports = { creerDom };
