export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ══════════════════════════════════════════════════════
       BLOC GrapesJS : Nos Campus
       Affiche la liste des campus sélectionnés via un picker.
       Si data-campus-mode="all", tous les campus de la BDD
       sont affichés (et mis à jour dynamiquement).
    ══════════════════════════════════════════════════════ */

    editor.DomComponents.addType('mc-nos-campus', {

        isComponent(el) {
            return el.tagName === 'SECTION' &&
                   el.getAttribute('data-gjs-type') === 'mc-nos-campus';
        },

        model: {
            defaults: {
                droppable: false,
                removable: true,
                copyable: true,
                toolbar: [
                    {
                        attributes: {
                            class: 'fa fa-map-marker',
                            title: 'Choisir les campus',
                            style: 'color:#1a7a5e;font-size:15px;'
                        },
                        command: 'open-campus-picker'
                    },
                    { attributes: { class: 'fa fa-arrows', cursor: true }, command: 'tlb-move' },
                    { attributes: { class: 'fa fa-clone' },               command: 'tlb-clone' },
                    { attributes: { class: 'fa fa-trash-o' },             command: 'tlb-delete' }
                ],
                'script-props': ['data-campus-prefix', 'data-campus-separator'],
                traits: [
                    {
                        type: 'text',
                        name: 'data-campus-prefix',
                        label: 'Préfixe de ville',
                        placeholder: 'ex: 📍 '
                    },
                    {
                        type: 'text',
                        name: 'data-campus-separator',
                        label: 'Séparateur',
                        placeholder: 'ex:  ·  '
                    }
                ],
                /* Runtime script: for exported pages with mode="all",
                   fetch campuses from the API and render them dynamically */
                script: function() {
                    var section = this;
                    var mode = section.getAttribute('data-campus-mode');
                    if (mode !== 'all') return; // static content, nothing to do

                    var list = section.querySelector('.mnc-list');
                    if (!list) return;

                    var prefix = section.getAttribute('data-campus-prefix') || '';
                    var separator = section.getAttribute('data-campus-separator') || ' · ';

                    // Try to fetch fresh campus list from API
                    var baseUrl = window.__LP_API_BASE || '';
                    fetch(baseUrl + '/api/campuses')
                        .then(function(r) { return r.json(); })
                        .then(function(campuses) {
                            if (!Array.isArray(campuses) || campuses.length === 0) return;
                            var html = campuses.map(function(c) {
                                return '<span class="mnc-campus-name">' + prefix + c.name.toUpperCase() + '</span>';
                            }).join('<span class="mnc-dot">' + separator + '</span>');
                            list.innerHTML = html;
                        })
                        .catch(function() { /* keep static content */ });
                }
            }
        },

        view: {
            init() {
                this.listenTo(this.model, 'change:attributes', this.handleAttrChange);
            },
            handleAttrChange() {
                const component = this.model;
                const attrs = component.getAttributes();
                const ids = (attrs['data-campus-ids'] || '').split(',').filter(Boolean);
                const prefix = attrs['data-campus-prefix'] || '';
                const separator = attrs['data-campus-separator'] || ' · ';
                const mode = attrs['data-campus-mode'] || '';

                const listComp = component.find('.mnc-list')[0];
                if (!listComp) return;

                const allCampuses = window.__LP_CAMPUSES || [];
                let selectedCampuses = [];
                if (mode === 'all') {
                    selectedCampuses = allCampuses;
                } else {
                    selectedCampuses = allCampuses.filter(c => ids.includes(c.id));
                }

                if (selectedCampuses.length) {
                    const escapeHtml = (str) => {
                        if (!str) return '';
                        return String(str)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                    };
                    const namesHtml = selectedCampuses.map(c =>
                        `<span class="mnc-campus-name">${prefix}${escapeHtml(c.name.toUpperCase())}</span>`
                    ).join(`<span class="mnc-dot">${escapeHtml(separator)}</span>`);
                    listComp.components(namesHtml);
                } else {
                    listComp.components('<span class="mnc-placeholder">📍 Cliquez sur le bouton <i class="fa fa-map-marker" style="color:#1a7a5e;font-size:14px;margin:0 2px;"></i> dans la barre d\'outils pour choisir vos campus.</span>');
                }
            }
        }
    });

    editor.BlockManager.add('master-nos-campus', {
        label: 'Nos Campus',
        category: cat,
        content: `
<section class="mnc-section" data-gjs-type="mc-nos-campus" data-campus-mode="" data-campus-ids="" data-campus-prefix="" data-campus-separator="">
  <div class="mnc-inner">
    <h2 class="mnc-title">NOS CAMPUS</h2>
    <div class="mnc-list">
      <span class="mnc-placeholder">📍 Cliquez sur le bouton <i class="fa fa-map-marker" style="color:#1a7a5e;font-size:14px;margin:0 2px;"></i> dans la barre d'outils pour choisir vos campus.</span>
    </div>
  </div>
</section>
<style>
  .mnc-section { padding: 40px 24px; background: var(--brand-background, #ffffff); font-family: var(--brand-font, 'Inter', sans-serif); }
  .mnc-inner { max-width: 900px; margin: 0 auto; text-align: center; }
  .mnc-title {
    font-size: 22px; font-weight: 900; color: var(--brand-text, #1a1a1a);
    letter-spacing: 2px; margin: 0 0 24px; text-transform: uppercase;
  }
  .mnc-list {
    display: flex; flex-wrap: wrap; justify-content: center;
    align-items: center; gap: 6px 4px; line-height: 1.8;
  }
  .mnc-campus-name {
    font-size: 13px; font-weight: 700; color: var(--brand-text, #1a1a1a);
    letter-spacing: 1px; white-space: nowrap; padding: 0 4px;
  }
  .mnc-dot {
    font-size: 16px; color: #999; padding: 0 2px;
  }
  .mnc-placeholder {
    font-size: 13px; color: #9ca3af; font-style: italic;
  }
  @media(max-width:600px) {
    .mnc-section { padding: 28px 16px; }
    .mnc-campus-name { font-size: 12px; }
  }
</style>`,
        attributes: { class: 'fa fa-map-marker' }
    });
}
