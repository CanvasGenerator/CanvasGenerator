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
                ]
            }
        },

        view: {
            // Accordion interactif dans le canvas de l'éditeur
            events: {
                'click .ma-toggle': 'onToggle',
                'click .ma-q':      'onRowClick'
            },

            onToggle(e) {
                e.stopPropagation();
                e.preventDefault();
                this._toggle(e.target.closest('.ma-item'));
            },

            onRowClick(e) {
                e.stopPropagation(); // empêche la sélection GrapesJS des enfants verrouillés
                this._toggle(e.target.closest('.ma-item'));
            },

            _toggle(item) {
                if (!item) return;
                const answer = item.querySelector('.ma-a');
                const btn    = item.querySelector('.ma-toggle');
                const isOpen = item.classList.contains('ma-open');
                item.classList.toggle('ma-open', !isOpen);
                if (answer) answer.style.display = isOpen ? 'none' : 'block';
                if (btn)    btn.innerHTML = isOpen ? '&#43;' : '&#8722;';
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
  .ma-section { padding: 48px 24px; background: #fff; font-family: Arial, sans-serif; }
  .ma-inner { max-width: 900px; margin: 0 auto; }
  .ma-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .ma-title { font-size: 20px; font-weight: 900; color: var(--text-main, #111); letter-spacing: 1px; margin: 0; }
  .ma-item { border-bottom: 1px solid #e0e0e0; }
  .ma-q { display: flex; justify-content: space-between; align-items: center; padding: 16px 4px; cursor: pointer; gap: 16px; }
  .ma-q span { font-size: 14px; color: var(--text-main, #222); line-height: 1.4; flex: 1; }
  .ma-toggle {
    width: 32px; height: 32px; border-radius: 50%; border: 2px solid #bbb;
    background: #fff; font-size: 20px; line-height: 1; color: #555;
    cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .ma-item.ma-open .ma-toggle { border-color: var(--brand-primary,#1f2937); color: var(--brand-primary,#1f2937); }
  .ma-a { padding: 0 4px 16px; }
  .ma-a p { margin: 0; font-size: 13.5px; color: #555; line-height: 1.65; }
  @media(max-width:768px) { .ma-section { padding: 32px 16px; } }
</style>`,
        attributes: { class: 'fa fa-list-ul' }
    });
}
