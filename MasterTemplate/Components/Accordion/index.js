export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    // ─────────────────────────────────────────────────────────────────────────
    // Composant GrapesJS : ma-faq-section
    //
    // - data-gjs-type="ma-faq-section" sur la <section> → type assigné automatiquement
    // - Toolbar  : bouton ❓ pour rouvrir le picker + boutons standards
    // - View     : accordion toggle fonctionnel dans le canvas
    // - Locking  : géré dans app.js via component:add et lockAll dans confirmSelection
    // ─────────────────────────────────────────────────────────────────────────
    editor.DomComponents.addType('ma-faq-section', {

        isComponent(el) {
            return el.tagName === 'SECTION' &&
                   el.getAttribute('data-gjs-type') === 'ma-faq-section';
        },

        model: {
            defaults: {
                droppable: false,
                removable: true,
                copyable: true,
                toolbar: [
                    {
                        // Bouton principal : choisir les FAQs
                        attributes: {
                            class: 'fa fa-question-circle',
                            title: 'Choisir les FAQs',
                            style: 'color:#1a7a5e;font-size:15px;'
                        },
                        command: 'open-faq-picker'
                    },
                    { attributes: { class: 'fa fa-arrows', cursor: true }, command: 'tlb-move' },
                    { attributes: { class: 'fa fa-clone' },               command: 'tlb-clone' },
                    { attributes: { class: 'fa fa-trash-o' },             command: 'tlb-delete' }
                ],
                // Toggle accordéon via `script` (et NON via la `view` GrapesJS) : la
                // `view` ne s'exécute QUE dans l'éditeur, donc le +/- ne fonctionnait
                // pas sur la page publiée / preview. Le `script` est exporté avec la
                // page → l'ouverture/fermeture marche partout. Délégation sur la
                // racine → fonctionne aussi pour les items injectés par le picker FAQ.
                script: function () {
                    var root = this;

                    // ⚠️ BUG CORRIGÉ : initialiser l'état d'affichage de TOUTES les réponses
                    // au chargement. Sans ça, après déclinaison, les items non-ouverts
                    // sont visibles alors que le CSS les cache (`.ma-a` sans `.ma-open`
                    // parent) — mais seulement si le style CSS est absent ou surchargé.
                    root.querySelectorAll('.ma-item').forEach(function(item) {
                        var answer = item.querySelector('.ma-a');
                        var btn    = item.querySelector('.ma-toggle');
                        var isOpen = item.classList.contains('ma-open');
                        if (answer) answer.style.display = isOpen ? 'block' : 'none';
                        if (btn)    btn.innerHTML = isOpen ? '&#8722;' : '+';
                    });

                    root.onclick = function (e) {
                        var q = e.target && e.target.closest ? e.target.closest('.ma-q') : null;
                        if (!q || !root.contains(q)) return;
                        var item = q.closest('.ma-item');
                        if (!item) return;
                        var answer = item.querySelector('.ma-a');
                        var btn = item.querySelector('.ma-toggle');
                        var isOpen = item.classList.contains('ma-open');
                        item.classList.toggle('ma-open', !isOpen);
                        if (answer) answer.style.display = isOpen ? 'none' : 'block';
                        if (btn) btn.innerHTML = isOpen ? '+' : '&#8722;';
                    };
                }
            }
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Bloc dans le panel gauche
    // ─────────────────────────────────────────────────────────────────────────
    editor.BlockManager.add('master-accordion', {
        label: 'Accordéon FAQ',
        category: cat,
        content: `
<section class="ma-section" data-gjs-type="ma-faq-section">
  <div class="ma-inner">
    <div class="ma-header-row">
      <h2 class="ma-title">FOIRE AUX QUESTIONS</h2>
    </div>
    <div class="ma-list">
      <div class="ma-item ma-open">
        <div class="ma-q">
          <span>Cliquez sur ❓ dans la barre d'outils pour choisir vos questions.</span>
          <button class="ma-toggle" aria-label="Toggle">&#8722;</button>
        </div>
        <div class="ma-a">
          <p>Les questions et réponses seront chargées depuis votre banque de FAQs.</p>
        </div>
      </div>
    </div>
  </div>
</section>
<style>
  /* Couleur du texte par défaut de l'école (--brand-text, réglable par école dans
     l'admin « Couleurs »). Posée sur la section : le titre et les questions sont
     en color:inherit, donc sélectionner la section dans le canvas et changer
     Typographie → Couleur dans la sidebar les repeint tous d'un coup (la règle
     #id du Style Manager prime sur celle-ci). Les réponses gardent --brand-muted. */
  .ma-section { padding: 48px 24px; background: var(--brand-background, #ffffff); font-family: var(--brand-font, 'Inter', sans-serif); color: var(--brand-text, #1a1a1a); }
  .ma-inner { max-width: 900px; margin: 0 auto; }
  .ma-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .ma-title { font-size: 20px; font-weight: 900; color: inherit; letter-spacing: 1px; margin: 0; width: 100%; }
  .ma-item { border-bottom: 1px solid #e0e0e0; }
  .ma-q { display: flex; justify-content: space-between; align-items: center; padding: 16px 4px; cursor: pointer; gap: 16px; }
  .ma-q span { font-size: 14px; color: inherit; line-height: 1.4; flex: 1; }
  .ma-toggle {
    width: 32px; height: 32px; border-radius: 50%; border: 2px solid #bbb;
    background: var(--brand-background, #ffffff); font-size: 20px; line-height: 1; color: var(--brand-muted, #6b7280);
    cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .ma-item.ma-open .ma-toggle { border-color: var(--brand-primary,#1f2937); color: var(--brand-primary,#1f2937); }
  .ma-a { padding: 0 4px 16px; }
  .ma-a p { margin: 0; font-size: 13.5px; color: var(--brand-muted, #6b7280); line-height: 1.65; }
  @media(max-width:768px) { .ma-section { padding: 32px 16px; } }
</style>`,
        attributes: { class: 'fa fa-list-ul' }
    });
}
