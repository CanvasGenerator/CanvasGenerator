/**
 * Encadré « Onglets Admission » du panneau de droite, commun aux deux blocs
 * d'onglets d'admission :
 *   • Onglets Admission du Master Template (MasterTemplate/Components/Tabs) ;
 *   • « Comment intégrer… ? » (blocks/admission-tabs).
 *
 * Les traits GrapesJS n'apparaissent que si le BLOC ENTIER est sélectionné ;
 * or on clique presque toujours un titre d'onglet ou une étape. L'encadré
 * s'affiche dès que la sélection est N'IMPORTE OÙ dans un bloc d'onglets,
 * juste au-dessus des traits, et ses boutons agissent sur l'onglet affiché.
 *
 * Chaque bloc fournit ses commandes, nommées `<prefixe>-add-step`,
 * `<prefixe>-add-text`, `<prefixe>-remove-tab`, `<prefixe>-add-tab-steps` et
 * `<prefixe>-add-tab-free`.
 *
 * @param {object} opts
 * @param {string} opts.id          id DOM de l'encadré (un par bloc)
 * @param {string} opts.prefixe     préfixe des commandes du bloc
 * @param {(cmp) => object|null} opts.trouverBloc  racine du bloc contenant la sélection
 * @param {(racine, selection) => string} opts.surSelection
 *        appelé à chaque sélection dans le bloc : affiche l'onglet visé dans le
 *        modèle et renvoie son nom (affiché dans l'encadré)
 */
export function installerOutilsOnglets(editor, { id, prefixe, trouverBloc, surSelection, bascule = null }) {
    // bascule (optionnelle) : { cmd, libelle(racine) } — bouton d'option du
    // bloc dont le libellé reflète l'état courant (ex. onglets non cliquables).
    function encadre() {
        let box = document.getElementById(id);
        if (box) return box;
        const traits = document.getElementById('traits-container');
        if (!traits || !traits.parentNode) return null;
        box = document.createElement('div');
        box.id = id;
        box.style.cssText = 'display:none;margin:12px 16px;padding:12px;border:1px solid #d6d9e0;border-radius:8px;background:#f7f8fb;font-family:inherit;';
        const btn = 'display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px solid #1a7a5e;border-radius:6px;background:#fff;color:#1a7a5e;font-size:13px;font-weight:600;cursor:pointer;text-align:left;';
        const sep = '<div style="margin-top:14px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#888;">';
        box.innerHTML = '<div style="font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#555;">Onglets Admission</div>'
            + '<div style="margin-top:6px;font-size:11px;color:#777;line-height:1.4;">Cliquez sur le titre d’un onglet pour l’afficher : les ajouts ci-dessous se font dans cet onglet.</div>'
            + sep + 'Onglet sélectionné : <span data-role="tab-name" style="color:#1a7a5e;text-transform:none;"></span></div>'
            + `<button type="button" data-cmd="${prefixe}-add-step" style="${btn}">＋ Ajouter une étape</button>`
            + `<button type="button" data-cmd="${prefixe}-add-text" style="${btn}">＋ Ajouter un texte</button>`
            + `<button type="button" data-cmd="${prefixe}-remove-tab" style="${btn}border-color:#c0392b;color:#c0392b;">－ Supprimer cet onglet</button>`
            + sep + 'Nouvel onglet</div>'
            + `<button type="button" data-cmd="${prefixe}-add-tab-steps" style="${btn}">＋ Onglet avec étapes</button>`
            + `<button type="button" data-cmd="${prefixe}-add-tab-free" style="${btn}">＋ Onglet contenu libre</button>`
            + '<div style="margin-top:8px;font-size:11px;color:#777;line-height:1.4;">« Contenu libre » : zone où glisser n’importe quel bloc (texte, image, deux colonnes…).</div>'
            + (bascule
                ? sep + 'Option</div>'
                  + `<button type="button" data-cmd="${bascule.cmd}" data-role="bascule" style="${btn}"></button>`
                  + '<div style="margin-top:8px;font-size:11px;color:#777;line-height:1.4;">Onglets non cliquables : tous les titres s’affichent, seul le contenu du 1er onglet est montré (quand tous les onglets ont les mêmes étapes). Effet visible sur la page publiée / l’aperçu.</div>'
                : '');
        box.querySelectorAll('button[data-cmd]').forEach(b => {
            b.onclick = () => {
                editor.runCommand(b.getAttribute('data-cmd'));
                // Le libellé du bouton d'option suit l'état après le clic.
                if (bascule && b.getAttribute('data-role') === 'bascule') {
                    const racine = trouverBloc(editor.getSelected());
                    if (racine) b.textContent = bascule.libelle(racine);
                }
            };
        });
        traits.parentNode.insertBefore(box, traits);
        return box;
    }

    editor.on('component:selected component:deselected', () => {
        const box = encadre();
        const sel = editor.getSelected();
        const racine = trouverBloc(sel);
        if (box) box.style.display = racine ? 'block' : 'none';
        if (!racine) return;
        const nom = surSelection(racine, sel);
        const champ = box && box.querySelector('[data-role="tab-name"]');
        if (champ) champ.textContent = nom || '—';
        const opt = box && bascule && box.querySelector('[data-role="bascule"]');
        if (opt) opt.textContent = bascule.libelle(racine);
    });

}

/** Texte affiché d'un composant (dans le canvas), sans espaces superflus. */
export function texteDe(cmp) {
    return (cmp && cmp.view && cmp.view.el ? cmp.view.el.textContent : '').replace(/\s+/g, ' ').trim();
}
