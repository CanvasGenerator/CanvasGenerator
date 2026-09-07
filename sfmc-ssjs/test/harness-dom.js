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
 * Le deuxieme membre d'une ligne de layout — ce que le champ EST :
 *
 *   0  pas un champ : un simple porteur, comme l'e-mail ou les consentements ;
 *   1  champ de cascade, NE MASQUE au depart (classe `hidden` du gabarit) —
 *      specialite, rythme, langue, rentree, programme ;
 *   2  champ present et VISIBLE au depart. C'est le cas du campus et du niveau
 *      d'etudes sur les six formulaires : leur `.cnd-field` ne porte aucune
 *      classe `hidden`, et c'est le socle qui les masque le cas echeant.
 *
 * Le 2 a ete ajoute pour les tests de largeur de cellule : sur un niveau
 * d'etudes ne au masque, sa cellule paraissait vide et se retirait avec celle
 * du campus — le test aurait verifie l'inverse de ce qu'il decrit.
 *
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
       porteurs ne partageaient pas tous le meme parent. */

    /* Tout noeud que le socle peut parcourir se declare ELEMENT. `nodeType`
       n'etait pas modelise tant que rien ne descendait dans les enfants d'un
       conteneur ; `ajusterRangee` le fait, et sans lui une rangee paraissait
       n'avoir aucune cellule — donc rien a masquer, et le test passait a
       vide. */
    function enrober(noeud, sel) {
        noeud.nodeType = 1;
        noeud._sel = sel || '';
        /* Les champs du sous-arbre, tels que `celluleVide` les demande. Le
           harnais ne chaine pas le <select> sous son porteur : c'est `_champ`
           qui fait le lien. */
        noeud.querySelectorAll = function (motif) {
            if (String(motif) !== 'input:not([type="hidden"]), select, textarea') return [];
            const out = [];
            /* Le noeud LUI-MEME compte. Dans un vrai DOM le <select> est un
               DESCENDANT du porteur, donc `porteur.querySelectorAll` le trouve.
               L'oublier faisait passer pour vide une cellule qui EST le porteur
               — le `.pc-field` de la precandidature — et le socle rendait
               aussitot visible le champ qu'il venait de masquer. */
            (function descend(n) {
                if (n._champ) out.push(n._champ);
                (n.childNodes || []).forEach(descend);
            })(noeud);
            return out;
        };
        return noeud;
    }

    const sections = {};
    function sectionDe(nom) {
        if (!nom) return parent;
        if (!sections[nom]) {
            const sec = enrober({
                _nom: '(' + nom + ')', style: {}, parentNode: parent, nextSibling: null,
                childNodes: [], classList: creerClassList([]),
                appendChild: parent.appendChild, insertBefore: parent.insertBefore,
                _sync: parent._sync,
            }, nom);
            sections[nom] = sec;
            parent.childNodes.push(sec);
        }
        return sections[nom];
    }

    /* CELLULE INTERMEDIAIRE — le `.cnd-col` de la candidature.
       ------------------------------------------------------------------
       Elle n'existait pas dans le harnais, et c'est exactement ce qui rendait
       le defaut INVISIBLE ici : sur un gabarit plat, masquer le porteur retire
       bien la colonne, et tout paraissait normal. Sur la vraie candidature le
       porteur vit DANS une cellule qui, elle, reste un element de grille et
       garde sa moitie de ligne. */
    const cellules = {};
    function celluleDeSection(section, nomSection, nom) {
        const cle = (nomSection || '') + '/' + nom;
        if (!cellules[cle]) {
            cellules[cle] = enrober({
                _nom: '(' + nom + ')', style: {}, parentNode: section, nextSibling: null,
                childNodes: [], classList: creerClassList([]),
                appendChild: parent.appendChild, insertBefore: parent.insertBefore,
                _sync: parent._sync,
            }, nom);
        }
        /* Le rattachement est REFAIT a chaque appel, et pas seulement a la
           creation : `reset()` vide les childNodes des sections, ce qui en
           retire les cellules. Sans cette ligne la rangee paraissait n'avoir
           aucune cellule des le deuxieme cas de test, et `ajusterRangee` sortait
           sans rien masquer — un faux vert qui accusait le socle. */
        if (section.childNodes.indexOf(cellules[cle]) === -1) {
            section.childNodes.push(cellules[cle]);
        }
        return cellules[cle];
    }

    const champs = {};
    const porteurs = {};
    const celluleParChamp = {};
    for (const [nom, estCascade, section, cellule] of layout) {
        const sec = sectionDe(section);
        /* Sans quatrieme colonne, le porteur EST la cellule : c'est la
           precandidature, et c'est ce cas-la qui doit rendre le geste inerte. */
        const hote = cellule ? celluleDeSection(sec, section, cellule) : sec;
        const porteur = enrober({
            _nom: nom, style: {}, parentNode: hote, nextSibling: null,
            childNodes: [],
            classList: creerClassList(estCascade === 1 ? ['hidden'] : []),
        }, nom);
        hote.childNodes.push(porteur);
        porteurs[nom] = porteur;
        celluleParChamp[nom] = cellule ? hote : porteur;
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
                    /* Remontee des ancetres NOMMES — la cellule, puis la
                       section. Le nom donne dans le layout tient lieu de
                       classe : une section 'cnd-row' repond a `.cnd-row`, et a
                       rien d'autre. Comparaison sur les selecteurs DECOUPES et
                       non en sous-chaine : `.row` ne doit pas se reconnaitre
                       dans `.brf-row`. */
                    const vises = s.split(',').map((x) => x.trim());
                    for (let n = porteur; n; n = n.parentNode) {
                        if (n._sel && vises.indexOf('.' + n._sel) !== -1) return n;
                    }
                    return null;
                },
                parentNode: porteur,
            };
            porteur._champ = el;
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
        /* La CELLULE de grille d'un champ — le `.cnd-col` quand le layout en
           declare une, le porteur lui-meme sinon. C'est elle qu'`ajusterRangee`
           masque ou elargit. */
        cellule: (nom) => celluleParChamp[nom] || null,
        celluleVisible: (nom) => Boolean(celluleParChamp[nom]) &&
            celluleParChamp[nom].style.display !== 'none',
        largeurCellule: (nom) => (celluleParChamp[nom] ? celluleParChamp[nom].style.gridColumn : null),
        /* L'ordre DANS une section : c'est la que se joue « langue avant
           specialite » quand les champs ne sont pas tous freres. */
        ordreSection: (nom) => (sections[nom] ? sections[nom].childNodes.map((n) => n._nom) : null),
        options: (nom) => (champs[nom] ? champs[nom].options.map((o) => o.textContent) : null),
        requis: (nom) => Boolean(champs[nom]) && champs[nom].hasAttribute('required'),
        visible: (nom) => Boolean(champs[nom]) &&
            champs[nom].parentNode.style.display !== 'none' &&
            !champs[nom].parentNode.classList.contains('hidden'),
        reset() {
            parent.childNodes.length = 0;
            Object.values(sections).forEach((sec) => { sec.childNodes.length = 0; });
            /* Les cellules repartent NEUVES : `ajusterRangee` pose un
               `display` et un `gridColumn` inline, et les laisser d'un cas au
               suivant ferait passer un test sur l'etat du precedent. */
            Object.values(cellules).forEach((cel) => {
                cel.childNodes.length = 0;
                cel.style.display = '';
                cel.style.gridColumn = '';
            });
            const vues = new Set();
            for (const [nom, estCascade, section, cellule] of layout) {
                const sec = sectionDe(section);
                if (section && !vues.has(section)) { vues.add(section); }
                const hote = cellule ? celluleDeSection(sec, section, cellule) : sec;
                const p = porteurs[nom];
                p._nom = nom; p.style.display = ''; p.parentNode = hote;
                if (p.classList) p.classList.toggle('hidden', estCascade === 1);
                hote.childNodes.push(p);
            }
            Object.values(cellules).forEach((cel) => cel._sync.call(cel));
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
