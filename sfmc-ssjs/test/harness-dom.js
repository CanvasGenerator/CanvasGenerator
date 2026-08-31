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

function creerDom(layout) {
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

    const champs = {};
    for (const [nom, estCascade] of layout) {
        const porteur = {
            _nom: nom, style: {}, parentNode: parent, nextSibling: null,
            classList: creerClassList(estCascade ? ['hidden'] : []),
        };
        parent.childNodes.push(porteur);
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
                closest: () => porteur,
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
        options: (nom) => (champs[nom] ? champs[nom].options.map((o) => o.textContent) : null),
        requis: (nom) => Boolean(champs[nom]) && champs[nom].hasAttribute('required'),
        visible: (nom) => Boolean(champs[nom]) &&
            champs[nom].parentNode.style.display !== 'none' &&
            !champs[nom].parentNode.classList.contains('hidden'),
        reset() {
            parent.childNodes.length = 0;
            for (const [nom, estCascade] of layout) {
                const p = champs[nom] ? champs[nom].parentNode
                                      : { _nom: nom, style: {}, classList: creerClassList([]) };
                p._nom = nom; p.style.display = ''; p.parentNode = parent;
                if (p.classList) p.classList.toggle('hidden', Boolean(estCascade));
                parent.childNodes.push(p);
            }
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
