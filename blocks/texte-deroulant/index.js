/**
 * « Texte déroulant » — bouton de la barre d'outils de TEXTE (RTE).
 *
 * Besoin : pouvoir insérer, DANS N'IMPORTE QUEL TEXTE de n'importe quel bloc, un
 * mot cliquable qui déplie un détail — comme le lien « ÉPREUVES ∨ » codé en dur
 * dans le bloc « Onglets Admission » (blocks/admission-tabs/index.js).
 *
 * Usage marketeur : double-clic sur un texte → sélectionner le mot → cliquer le
 * bouton « ⌄ » de la barre d'outils → le mot devient le déclencheur et une zone
 * de détail apparaît dessous, à rédiger comme du texte normal.
 *
 * Pourquoi TOUT est en inline (styles + onclick) et non via une classe CSS + un
 * `script:` de composant :
 *  - le fragment est inséré À L'INTÉRIEUR d'un composant `text` existant (h2, p,
 *    span…) : il n'a pas de type GrapesJS propre, donc ni `script:` exporté ni
 *    règle CSS garantie à l'export (`getCss()` élague les règles inutilisées) ;
 *  - inline = auto-porté : survit à l'export HTML/ZIP, à l'aperçu dashboard, à
 *    la publication SFMC (page statique) et à la traduction (lib/translate.js ne
 *    touche qu'aux nœuds texte et à quelques attributs, jamais à `onclick`) ;
 *  - aucun `id` généré → dupliquer un bloc ne crée aucune collision.
 *
 * ⚠️ BUG CORRIGÉ — « ça marche pendant l'écriture puis plus après » : à la
 * fermeture de l'édition, GrapesJS re-parse le contenu du texte et SUPPRIME tout
 * attribut commençant par `on` (option de parsing `allowUnsafeAttr`, false par
 * défaut). L'`onclick` était donc perdu dès le premier clic hors du texte, dans
 * l'éditeur ET dans la page enregistrée. D'où `autoriserAttributsInline()`
 * ci-dessous + l'option `parser.optionsHtml.allowUnsafeAttr` dans js/app.js.
 *
 * Comportement dans l'éditeur : identique à la page publiée (replié, clic pour
 * ouvrir), via un écouteur délégué sur le document du canvas. Le détail n'est
 * forcé visible QUE pendant la rédaction du texte qui le contient (règle
 * `[contenteditable="true"] .txt-deroulant-detail` dans injectComponentFixedStyles).
 */
export default function (editor) {
    // Classes utilisées comme "contrat" entre le HTML inséré, le handler inline,
    // l'écouteur du canvas et la règle CSS d'édition. Ne pas les renommer sans
    // mettre à jour injectComponentFixedStyles() dans js/app.js.
    const CLS_WRAP = 'txt-deroulant';
    const CLS_LIEN = 'txt-deroulant-lien';
    const CLS_FLECHE = 'txt-deroulant-fleche';
    const CLS_DETAIL = 'txt-deroulant-detail';

    const LABEL_DEFAUT = 'EN SAVOIR PLUS';
    const DETAIL_DEFAUT = 'Saisissez ici le texte à afficher au clic.';

    // ── Parsing : conserver les attributs `on*` ──────────────────────────────
    // Ceinture et bretelles avec l'option passée à grapesjs.init() (js/app.js) :
    // si la clé de config change de nom au fil des versions, la mutation directe
    // de la config vivante du module Parser, elle, reste valable. Sans ça,
    // l'`onclick` du fragment est supprimé à chaque re-parse (fin d'édition,
    // rechargement du projet…) et le déroulant devient inerte.
    function autoriserAttributsInline() {
        try {
            const parser = editor.Parser || (editor.get && editor.get('Parser'));
            const cfg = parser && (parser.getConfig ? parser.getConfig() : parser.config);
            if (!cfg) return;
            if (cfg.optionsHtml) cfg.optionsHtml.allowUnsafeAttr = true;
            cfg.allowUnsafeAttr = true;
        } catch (e) {
            console.warn('texte-deroulant : impossible d\'autoriser les attributs inline', e);
        }
    }
    autoriserAttributsInline();

    // ── Bascule ouvert/fermé ─────────────────────────────────────────────────
    // Écrite DEUX fois : ici en JS (pour l'éditeur) et en chaîne inline dans
    // TOGGLE (pour la page publiée). Garder les deux versions synchronisées.
    // L'état est porté par `data-ouvert` et non par `style.display`, que le CSS
    // du canvas neutralise pendant la rédaction.
    function basculer(lien) {
        const wrap = lien.closest ? lien.closest('.' + CLS_WRAP) : lien.parentNode;
        if (!wrap) return;
        const detail = wrap.querySelector('.' + CLS_DETAIL);
        const fleche = lien.querySelector('.' + CLS_FLECHE);
        if (!detail) return;
        const ouvert = detail.getAttribute('data-ouvert') === '1';
        detail.setAttribute('data-ouvert', ouvert ? '0' : '1');
        detail.style.display = ouvert ? 'none' : 'block';
        if (fleche) fleche.style.transform = ouvert ? '' : 'rotate(180deg)';
    }

    // Version inline. Contrainte : aucun guillemet double (l'attribut est
    // délimité par des ").
    const TOGGLE = [
        `var w=this.closest?this.closest('.${CLS_WRAP}'):this.parentNode;`,
        'if(!w)return;',
        `var d=w.querySelector('.${CLS_DETAIL}'),c=this.querySelector('.${CLS_FLECHE}');`,
        'if(!d)return;',
        `var o=d.getAttribute('data-ouvert')==='1';`,
        `d.setAttribute('data-ouvert',o?'0':'1');`,
        `d.style.display=o?'none':'block';`,
        `if(c)c.style.transform=o?'':'rotate(180deg)';`,
    ].join('');

    // ── Bascule DANS L'ÉDITEUR ───────────────────────────────────────────────
    // On ne se repose pas sur l'`onclick` inline dans le canvas : GrapesJS y
    // capte les clics pour sa sélection de composants. Écouteur en phase de
    // CAPTURE + stopPropagation → c'est nous (et nous seuls) qui traitons le
    // clic, donc aucun risque de double bascule avec le handler inline.
    // Contrepartie assumée : cliquer le déclencheur ouvre/ferme le détail au
    // lieu de sélectionner le composant (le double-clic ouvre toujours
    // l'édition du texte — les deux bascules s'annulent).
    function gererClicCanvas(ev) {
        const cible = ev.target;
        const lien = cible && cible.closest ? cible.closest('.' + CLS_LIEN) : null;
        if (!lien) return;
        // Pendant la rédaction, le clic sert à placer le curseur, pas à replier.
        if (lien.closest('[contenteditable="true"]')) return;
        ev.stopPropagation();
        ev.preventDefault();
        basculer(lien);
    }

    function brancherCanvas() {
        try {
            const doc = editor.Canvas && editor.Canvas.getDocument && editor.Canvas.getDocument();
            if (!doc) return;
            doc.removeEventListener('click', gererClicCanvas, true);
            doc.addEventListener('click', gererClicCanvas, true);
        } catch (e) { console.warn('texte-deroulant : écouteur canvas non branché', e); }
    }
    editor.on('load', brancherCanvas);
    // Le canvas est recréé au switch de langue / rechargement de projet.
    editor.on('canvas:frame:load', brancherCanvas);

    // ── Insertion ────────────────────────────────────────────────────────────
    function echapper(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function construireHtml(label, detail) {
        return (
            `<span class="${CLS_WRAP}" style="display:inline;">` +
            `<span class="${CLS_LIEN}" onclick="${TOGGLE}"` +
            ` style="font-weight:700;text-decoration:underline;cursor:pointer;">${label}` +
            `&nbsp;<span class="${CLS_FLECHE}" style="display:inline-block;transition:transform .25s ease;">&or;</span>` +
            `</span>` +
            `<span class="${CLS_DETAIL}" data-ouvert="0"` +
            ` style="display:none;margin-top:8px;font-weight:400;text-decoration:none;">${detail}</span>` +
            `</span>`
        );
    }

    // Empêche l'imbrication : si le curseur est déjà dans un texte déroulant,
    // un second clic sur le bouton en créerait un dans le déclencheur.
    function dejaDansUnDeroulant() {
        try {
            const doc = editor.Canvas.getDocument();
            const sel = doc && doc.getSelection();
            if (!sel || !sel.anchorNode) return false;
            const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
            return !!(node && node.closest && node.closest(`.${CLS_WRAP}`));
        } catch (e) {
            return false;
        }
    }

    editor.RichTextEditor.add('texte-deroulant', {
        icon: '<i class="fa-solid fa-caret-down" style="font-size:14px;margin-top:2px;"></i>',
        attributes: { title: 'Texte déroulant (le texte sélectionné déplie un détail au clic)' },
        result: rte => {
            if (dejaDansUnDeroulant()) return;
            const selection = String(rte.selection() || '').trim();
            const label = echapper(selection) || LABEL_DEFAUT;
            // Pas de `{ select: true }` : cette option termine l'édition du texte
            // (elle déclenche `rte:disable`). On reste en édition pour que le
            // marketeur enchaîne directement sur la rédaction du détail.
            rte.insertHTML(construireHtml(label, DETAIL_DEFAUT));
        },
    });
}
