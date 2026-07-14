export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ══════════════════════════════════════════════════════
       BLOC GrapesJS : Nos Campus
       Affiche la liste des campus SÉLECTIONNÉS AU NIVEAU DE LA PAGE
       (bouton « Campus » de la barre d'outils → js/campus.js).
       Source unique : window.LPCampus.getResolvedCampuses().
    ══════════════════════════════════════════════════════ */

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

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
                /* Runtime script (page exportée) : amélioration progressive.
                   Le contenu réel est déjà "bake" dans le HTML par l'éditeur ;
                   ce script re-synchronise depuis l'API si elle est joignable. */
                script: function() {
                    var section = this;
                    var list = section.querySelector('.mnc-list');
                    if (!list) return;

                    var prefix    = section.getAttribute('data-campus-prefix') || '';
                    var separator = section.getAttribute('data-campus-separator') || ' · ';
                    var ids       = window.__LP_CAMPUS_IDS || [];
                    var baseUrl   = window.__LP_API_BASE || '';

                    function esc(s) {
                        return String(s == null ? '' : s)
                            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    }

                    fetch(baseUrl + '/api/campuses')
                        .then(function(r) { return r.json(); })
                        .then(function(all) {
                            if (!Array.isArray(all)) return;
                            var campuses = all;
                            if (ids && ids.length) {
                                var byId = {};
                                all.forEach(function(c) { byId[c.id] = c; });
                                campuses = ids.map(function(id) { return byId[id]; }).filter(Boolean);
                            }
                            if (!campuses.length) return; // garde le contenu bake
                            list.innerHTML = campuses.map(function(c) {
                                return '<span class="mnc-campus-name">' + prefix + esc((c.name || '').toUpperCase()) + '</span>';
                            }).join('<span class="mnc-dot">' + esc(separator) + '</span>');
                        })
                        .catch(function() { /* garde le contenu bake */ });
                }
            }
        },

        view: {
            init() {
                this._onCampusChange = () => this.renderCampuses();
                document.addEventListener('lp:campuses-changed', this._onCampusChange);
                this.listenTo(this.model, 'change:attributes', this.renderCampuses);
                setTimeout(() => this.renderCampuses(), 0);
            },
            removed() {
                document.removeEventListener('lp:campuses-changed', this._onCampusChange);
            },
            renderCampuses() {
                const component = this.model;
                const attrs = component.getAttributes();
                const prefix = attrs['data-campus-prefix'] || '';
                const separator = attrs['data-campus-separator'] || ' · ';

                const listComp = component.find('.mnc-list')[0];
                if (!listComp) return;

                const campuses = (window.LPCampus && window.LPCampus.getResolvedCampuses)
                    ? window.LPCampus.getResolvedCampuses() : [];

                if (campuses.length) {
                    const namesHtml = campuses.map(c =>
                        `<span class="mnc-campus-name">${prefix}${escapeHtml((c.name || '').toUpperCase())}</span>`
                    ).join(`<span class="mnc-dot">${escapeHtml(separator)}</span>`);
                    listComp.components(namesHtml);
                } else {
                    listComp.components('<span class="mnc-placeholder">📍 Aucun campus. Cliquez sur <b>Campus</b> dans la barre d\'outils pour en sélectionner.</span>');
                }
                // Verrouille les enfants (contenu piloté par la page)
                listComp.components().each(child => {
                    child.set({ editable: false, selectable: false, hoverable: false, draggable: false });
                });
            }
        }
    });

    editor.BlockManager.add('master-nos-campus', {
        label: 'Nos Campus',
        category: cat,
        content: `
<section class="mnc-section" data-gjs-type="mc-nos-campus" data-campus-prefix="" data-campus-separator="">
  <div class="mnc-inner">
    <h2 class="mnc-title">NOS CAMPUS</h2>
    <div class="mnc-list">
      <span class="mnc-placeholder">📍 Aucun campus. Cliquez sur <b>Campus</b> dans la barre d'outils pour en sélectionner.</span>
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
