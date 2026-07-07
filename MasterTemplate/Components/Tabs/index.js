export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ═══════════════════════════════════════════════════════
       ICÔNES SVG par identifiant
    ═══════════════════════════════════════════════════════ */
    const STEP_ICONS = {
        computer: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
        clock:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
        users:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        chart:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
        file:     '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        check:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    };

    /* ══════════════════════════════════════════════════════
       Fonction utilitaire : construit le HTML intérieur
       d'une carte étape à partir des attributs data-*
    ══════════════════════════════════════════════════════ */
    function buildStepHTML(attrs) {
        const step  = attrs['data-step']  || '1';
        const title = attrs['data-title'] || 'Titre de l\'étape';
        const iconId = attrs['data-icon-id'] || 'computer';
        const icon  = STEP_ICONS[iconId] || STEP_ICONS.computer;

        // Collect non-empty items
        const items = ['data-item1','data-item2','data-item3','data-item4']
            .map(k => (attrs[k] || '').trim())
            .filter(Boolean);

        const hasItems = items.length > 0;
        const liHTML   = items.map(i => `<li>${i}</li>`).join('');
        const expandAttr = hasItems ? ' data-expandable="true"' : '';
        const expandIcon = hasItems ? ` <span class="mta-expand-icon">\u02C5</span>` : '';
        const detailsHTML = hasItems
            ? `<ul class="mta-step-details">${liHTML}</ul>`
            : '';

        return `
            <div class="mta-step-head">
                <div class="mta-step-icon">${icon}</div>
                <div class="mta-step-body">
                    <span class="mta-badge">\u00C9tape <strong>${step}</strong></span>
                    <p class="mta-step-label"${expandAttr}>${title}${expandIcon}</p>
                    ${detailsHTML}
                </div>
            </div>`;
    }

    /* ══════════════════════════════════════════════════════
       COMPOSANT PERSONNALISÉ : mta-step-card
       → Panneau de droite avec champs simples pour le user
    ══════════════════════════════════════════════════════ */
    editor.DomComponents.addType('mta-step-card', {

        model: {
            defaults: {
                name: '\u00C9tape',
                tagName: 'div',
                classes: ['mta-step'],
                droppable: false,
                highlightable: true,
                attributes: {
                    'data-step':    '1',
                    'data-title':   'Titre de l\'étape',
                    'data-icon-id': 'computer',
                    'data-item1':   '',
                    'data-item2':   '',
                    'data-item3':   '',
                    'data-item4':   '',
                },

                /* ── Traits = champs visibles dans le panneau de droite ── */
                traits: [
                    {
                        type:  'text',
                        label: '📝 Titre',
                        name:  'data-title',
                        placeholder: 'Ex : Candidature en ligne',
                    },
                    {
                        type:    'select',
                        label:   '🎨 Icône',
                        name:    'data-icon-id',
                        options: [
                            { id: 'computer', name: '🖥️ Ordinateur' },
                            { id: 'clock',    name: '🕐 Horloge'    },
                            { id: 'users',    name: '👥 Personnes'  },
                            { id: 'chart',    name: '📈 Graphique'  },
                            { id: 'file',     name: '📄 Fichier'    },
                            { id: 'check',    name: '✅ Validation' },
                        ],
                    },
                    {
                        type:  'text',
                        label: '• Détail 1',
                        name:  'data-item1',
                        placeholder: 'Laisser vide pour masquer',
                    },
                    {
                        type:  'text',
                        label: '• Détail 2',
                        name:  'data-item2',
                        placeholder: 'Laisser vide pour masquer',
                    },
                    {
                        type:  'text',
                        label: '• Détail 3',
                        name:  'data-item3',
                        placeholder: 'Laisser vide pour masquer',
                    },
                    {
                        type:  'text',
                        label: '• Détail 4',
                        name:  'data-item4',
                        placeholder: 'Laisser vide pour masquer',
                    },
                ],

                /* ── Script runtime (page finale exportée) ── */
                'script-props': [
                    'data-step','data-title','data-icon-id',
                    'data-item1','data-item2','data-item3','data-item4'
                ],
                script: function(props) {
                    var ICONS = {
                        computer: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
                        clock:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                        users:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
                        chart:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
                        file:     '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
                        check:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                    };
                    var step   = props['data-step']    || '1';
                    var title  = props['data-title']   || '';
                    var iconId = props['data-icon-id'] || 'computer';
                    var icon   = ICONS[iconId] || ICONS.computer;
                    var items  = [props['data-item1'], props['data-item2'], props['data-item3'], props['data-item4']]
                                    .filter(function(s) { return s && s.trim(); });
                    var hasItems   = items.length > 0;
                    var liHTML     = items.map(function(i) { return '<li>' + i + '</li>'; }).join('');
                    var expandAttr = hasItems ? ' data-expandable="true"' : '';
                    var expandIcon = hasItems ? ' <span class="mta-expand-icon">\u02C5</span>' : '';
                    var detailsHTML = hasItems ? '<ul class="mta-step-details">' + liHTML + '</ul>' : '';

                    this.innerHTML =
                        '<div class="mta-step-head">' +
                            '<div class="mta-step-icon">' + icon + '</div>' +
                            '<div class="mta-step-body">' +
                                '<span class="mta-badge">\u00C9tape <strong>' + step + '</strong></span>' +
                                '<p class="mta-step-label"' + expandAttr + '>' + title + expandIcon + '</p>' +
                                detailsHTML +
                            '</div>' +
                        '</div>';

                    // expand/collapse listener
                    var label = this.querySelector('[data-expandable]');
                    if (label) {
                        label.addEventListener('click', function() {
                            var details = label.parentElement.querySelector('.mta-step-details');
                            var ic = label.querySelector('.mta-expand-icon');
                            if (!details) return;
                            var open = details.classList.toggle('mta-open');
                            if (ic) ic.textContent = open ? '\u02C4' : '\u02C5';
                        });
                    }
                }
            }
        },

        /* ── Vue éditeur : re-render + expand/collapse dans le canvas ── */
        view: {
            /* Délégation d'événement sur le conteneur mta-step :
               fonctionne même après que innerHTML est réécrit */
            events: {
                'click .mta-step-label[data-expandable]': 'toggleDetails',
                'click .mta-expand-icon': 'toggleDetails',
            },

            toggleDetails(e) {
                e.stopPropagation();
                const label   = this.el.querySelector('.mta-step-label[data-expandable]');
                const details = this.el.querySelector('.mta-step-details');
                const icon    = this.el.querySelector('.mta-expand-icon');
                if (!details || !label) return;
                const open = details.classList.toggle('mta-open');
                if (icon) icon.textContent = open ? '\u02C4' : '\u02C5';
            },

            init() {
                this.listenTo(this.model, 'change:attributes', this.renderStepContent);
            },
            onRender() {
                this.renderStepContent();
            },
            renderStepContent() {
                const attrs = this.model.getAttributes();
                this.el.innerHTML = buildStepHTML(attrs);
            }
        }
    });

    /* ══════════════════════════════════════════════════════
       BLOC GrapesJS : Onglets Admission
    ══════════════════════════════════════════════════════ */
    editor.BlockManager.add('master-tabs', {
        label: 'Onglets Admission',
        category: cat,
        content: {
            type: 'mc-tabs-admission',
            styles: `
                /* ── Container ── */
                .mta-section {
                    font-family: Arial, sans-serif;
                    padding: 40px 20px;
                }
                .mta-wrapper {
                    max-width: 1000px;
                    margin: 0 auto;
                    border: 1px solid #000000;
                    overflow: hidden;
                }

                /* ── Tab headers row (desktop) ── */
                .mta-headers {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    border-bottom: 1px solid #000000;
                }
                .mta-tab-hd {
                    padding: 18px 16px;
                    cursor: pointer;
                    border-right: 1px solid #000000;
                    background: #bd2bf3;
                    transition: all 0.3s ease;
                }
                .mta-tab-hd[data-tab="2"] {
                    background: #8a3ffc;
                }
                .mta-tab-hd:last-child { border-right: none; }
                .mta-tab-hd-sub {
                    display: block;
                    font-size: 11px;
                    color: rgba(255,255,255,0.9);
                    margin-bottom: 3px;
                }
                .mta-tab-hd-title {
                    display: block;
                    font-size: 14px;
                    font-weight: 700;
                    color: #ffffff;
                }
                .mta-tab-hd.mta-active {
                    background: #ffffff;
                    border-bottom: 1px solid #ffffff;
                    margin-bottom: -1px;
                    z-index: 10;
                    position: relative;
                }
                .mta-tab-hd.mta-active .mta-tab-hd-sub  { color: #000000; }
                .mta-tab-hd.mta-active .mta-tab-hd-title { color: #000000; }

                /* ── Steps grid ── */
                .mta-pane { display: none; }
                .mta-pane.mta-pane-active { display: block; }

                .mta-steps-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    align-items: start;
                    padding: 0;
                    background: #ffffff;
                }
                .mta-step {
                    padding: 24px 20px;
                    border-right: 1px solid #e0e0e0;
                    border-bottom: 1px solid #e0e0e0;
                    background: #ffffff;
                    cursor: pointer;
                }
                .mta-step:last-child { border-right: none; }

                .mta-step-head {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .mta-step-icon { flex-shrink: 0; color: #111; margin-top: 2px; }
                .mta-step-body { flex: 1; }
                .mta-badge {
                    display: inline-block;
                    background: var(--brand-secondary, #f29c38);
                    color: #111;
                    font-size: 11px;
                    font-weight: 800;
                    padding: 3px 8px;
                    border-radius: 3px;
                    margin-bottom: 8px;
                    letter-spacing: 0.5px;
                }
                .mta-step-label {
                    font-size: 15px;
                    font-weight: 800;
                    color: #111;
                    margin: 0;
                    cursor: pointer;
                    line-height: 1.3;
                }
                .mta-step-label .mta-expand-icon {
                    font-size: 11px;
                    margin-left: 6px;
                    color: #111;
                    vertical-align: middle;
                }
                .mta-step-details {
                    margin: 12px 0 0;
                    padding: 12px 0 0 16px;
                    font-size: 13px;
                    color: #555;
                    line-height: 1.6;
                    border-top: 1px solid #000000;
                    display: none;
                }
                .mta-step-details.mta-open { display: block; }

                /* ── Mobile tabs ── */
                .mta-mob-tab { display: none; }

                @media (max-width: 768px) {
                    .mta-headers { display: none; }
                    .mta-steps-grid { grid-template-columns: 1fr; }
                    .mta-step { border-right: none; }
                    .mta-mob-tab {
                        display: block;
                        padding: 16px 20px;
                        cursor: pointer;
                        background: #bd2bf3;
                        border-bottom: 1px solid #000000;
                        transition: all 0.3s ease;
                    }
                    .mta-mob-tab[data-tab="2"] {
                        background: #8a3ffc;
                    }
                    .mta-mob-tab .mta-tab-hd-sub   { color: rgba(255,255,255,0.9); }
                    .mta-mob-tab .mta-tab-hd-title { color: #ffffff; }
                    .mta-mob-tab.mta-active { background: #ffffff; border-bottom: 1px solid #e0e0e0; }
                    .mta-mob-tab.mta-active .mta-tab-hd-sub   { color: #000000; }
                    .mta-mob-tab.mta-active .mta-tab-hd-title { color: #000000; }
                }
            `,
            components: [{
                tagName: 'section',
                classes: ['mta-section'],
                components: [{
                    tagName: 'div',
                    classes: ['mta-wrapper'],
                    id: 'mta-wrapper',
                    components: [

                        /* ── Tab headers (desktop) ── */
                        {
                            tagName: 'div',
                            classes: ['mta-headers'],
                            components: [
                                {
                                    tagName: 'div', classes: ['mta-tab-hd', 'mta-active'],
                                    attributes: { 'data-tab': '0' },
                                    components: [
                                        { tagName: 'span', classes: ['mta-tab-hd-sub'],   components: 'Admission classes pr\u00E9paratoires' },
                                        { tagName: 'strong', classes: ['mta-tab-hd-title'], components: 'Arts Appliqu\u00E9s' }
                                    ]
                                },
                                {
                                    tagName: 'div', classes: ['mta-tab-hd'],
                                    attributes: { 'data-tab': '1' },
                                    components: [
                                        { tagName: 'span', classes: ['mta-tab-hd-sub'],   components: 'Admission Programme' },
                                        { tagName: 'strong', classes: ['mta-tab-hd-title'], components: 'Game Design / Jeux Vid\u00E9o' }
                                    ]
                                },
                                {
                                    tagName: 'div', classes: ['mta-tab-hd'],
                                    attributes: { 'data-tab': '2' },
                                    components: [
                                        { tagName: 'span', classes: ['mta-tab-hd-sub'],   components: 'Admission Programme' },
                                        { tagName: 'strong', classes: ['mta-tab-hd-title'], components: 'Audiovisuel' }
                                    ]
                                }
                            ]
                        },

                        /* ══ Mob Tab 0 ══ */
                        {
                            tagName: 'div', classes: ['mta-mob-tab', 'mta-active'],
                            attributes: { 'data-tab': '0' },
                            components: [
                                { tagName: 'span', classes: ['mta-tab-hd-sub'],   components: 'Admission classes pr\u00E9paratoires' },
                                { tagName: 'strong', classes: ['mta-tab-hd-title'], components: 'Arts Appliqu\u00E9s' }
                            ]
                        },
                        /* ══ Pane 0 : Arts Appliqués ══ */
                        {
                            tagName: 'div', classes: ['mta-pane', 'mta-pane-active'],
                            attributes: { 'data-pane': '0' },
                            components: [{
                                tagName: 'div', classes: ['mta-steps-grid'],
                                components: [
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '1',
                                            'data-title':   'Candidature en ligne',
                                            'data-icon-id': 'computer',
                                            'data-item1':   'Formulaire en ligne',
                                            'data-item2':   'Choix du programme',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '2',
                                            'data-title':   'Cr\u00E9ation du dossier de candidature',
                                            'data-icon-id': 'file',
                                            'data-item1':   'Bulletin de notes',
                                            'data-item2':   'Book cr\u00E9atif',
                                            'data-item3':   'Une production \u00E0 r\u00E9aliser chez soi',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '3',
                                            'data-title':   'Entretien individuel de motivation',
                                            'data-icon-id': 'users',
                                            'data-item1':   'Entretien de 20 minutes',
                                            'data-item2':   'Pr\u00E9sentation de votre projet',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '4',
                                            'data-title':   'R\u00E9sultats d\'admission',
                                            'data-icon-id': 'chart',
                                            'data-item1':   'R\u00E9ponse par email',
                                            'data-item2':   'D\u00E9lai de 2 semaines',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    }
                                ]
                            }]
                        },

                        /* ══ Mob Tab 1 ══ */
                        {
                            tagName: 'div', classes: ['mta-mob-tab'],
                            attributes: { 'data-tab': '1' },
                            components: [
                                { tagName: 'span', classes: ['mta-tab-hd-sub'],   components: 'Admission Programme' },
                                { tagName: 'strong', classes: ['mta-tab-hd-title'], components: 'Game Design / Jeux Vid\u00E9o' }
                            ]
                        },
                        /* ══ Pane 1 : Game Design ══ */
                        {
                            tagName: 'div', classes: ['mta-pane'],
                            attributes: { 'data-pane': '1' },
                            components: [{
                                tagName: 'div', classes: ['mta-steps-grid'],
                                components: [
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '1',
                                            'data-title':   'Candidature en ligne',
                                            'data-icon-id': 'computer',
                                            'data-item1':   'Formulaire en ligne',
                                            'data-item2':   'Choix du programme',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '2',
                                            'data-title':   'Cr\u00E9ation du dossier de candidature',
                                            'data-icon-id': 'file',
                                            'data-item1':   'Bulletin de notes',
                                            'data-item2':   'Book cr\u00E9atif',
                                            'data-item3':   'Une production \u00E0 r\u00E9aliser chez soi',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '3',
                                            'data-title':   'Entretien individuel de motivation',
                                            'data-icon-id': 'users',
                                            'data-item1':   'Entretien de 20 minutes',
                                            'data-item2':   'Pr\u00E9sentation de votre projet',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '4',
                                            'data-title':   'R\u00E9sultats d\'admission',
                                            'data-icon-id': 'chart',
                                            'data-item1':   'R\u00E9ponse par email',
                                            'data-item2':   'D\u00E9lai de 2 semaines',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    }
                                ]
                            }]
                        },

                        /* ══ Mob Tab 2 ══ */
                        {
                            tagName: 'div', classes: ['mta-mob-tab'],
                            attributes: { 'data-tab': '2' },
                            components: [
                                { tagName: 'span', classes: ['mta-tab-hd-sub'],   components: 'Admission Programme' },
                                { tagName: 'strong', classes: ['mta-tab-hd-title'], components: 'Audiovisuel' }
                            ]
                        },
                        /* ══ Pane 2 : Audiovisuel ══ */
                        {
                            tagName: 'div', classes: ['mta-pane'],
                            attributes: { 'data-pane': '2' },
                            components: [{
                                tagName: 'div', classes: ['mta-steps-grid'],
                                components: [
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '1',
                                            'data-title':   'Candidature en ligne',
                                            'data-icon-id': 'computer',
                                            'data-item1':   'Formulaire en ligne',
                                            'data-item2':   'Choix du programme',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '2',
                                            'data-title':   'Dossier de candidature',
                                            'data-icon-id': 'file',
                                            'data-item1':   'Bulletin de notes',
                                            'data-item2':   'Lettre de motivation',
                                            'data-item3':   'CV artistique',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '3',
                                            'data-title':   'Entretien individuel de motivation',
                                            'data-icon-id': 'users',
                                            'data-item1':   'Entretien de 20 minutes',
                                            'data-item2':   'Pr\u00E9sentation de votre projet',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    },
                                    {
                                        type: 'mta-step-card',
                                        attributes: {
                                            'data-step':    '4',
                                            'data-title':   'R\u00E9sultats d\'admission',
                                            'data-icon-id': 'chart',
                                            'data-item1':   'R\u00E9ponse par email',
                                            'data-item2':   'D\u00E9lai de 2 semaines',
                                            'data-item3':   '',
                                            'data-item4':   '',
                                        }
                                    }
                                ]
                            }]
                        }

                    ] // end mta-wrapper components
                }]
            }]
        },
        attributes: { class: 'fa fa-folder-o' }
    });

    /* ══════════════════════════════════════════════════════
       TYPE mc-tabs-admission : script de tab + expand
    ══════════════════════════════════════════════════════ */
    editor.DomComponents.addType('mc-tabs-admission', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var wrapper = document.getElementById('mta-wrapper');
                    if (!wrapper) return;

                    var tabHds  = wrapper.querySelectorAll('.mta-tab-hd');
                    var panes   = wrapper.querySelectorAll('.mta-pane');
                    var mobTabs = wrapper.querySelectorAll('.mta-mob-tab');

                    function switchTab(idx) {
                        tabHds.forEach(function(h)  { h.classList.remove('mta-active'); });
                        panes.forEach(function(p)   { p.classList.remove('mta-pane-active'); });
                        mobTabs.forEach(function(m) { m.classList.remove('mta-active'); });

                        var activeHd = wrapper.querySelector('.mta-tab-hd[data-tab="' + idx + '"]');
                        if (activeHd) activeHd.classList.add('mta-active');

                        var pane = wrapper.querySelector('.mta-pane[data-pane="' + idx + '"]');
                        if (pane) pane.classList.add('mta-pane-active');

                        var mobActive = wrapper.querySelector('.mta-mob-tab[data-tab="' + idx + '"]');
                        if (mobActive) mobActive.classList.add('mta-active');
                    }

                    tabHds.forEach(function(hd) {
                        hd.addEventListener('click', function() {
                            switchTab(hd.getAttribute('data-tab'));
                        });
                    });
                    mobTabs.forEach(function(mob) {
                        mob.addEventListener('click', function() {
                            switchTab(mob.getAttribute('data-tab'));
                        });
                    });

                    // Expand/collapse step details
                    wrapper.querySelectorAll('[data-expandable="true"]').forEach(function(label) {
                        label.addEventListener('click', function() {
                            var details = label.parentElement.querySelector('.mta-step-details');
                            var icon    = label.querySelector('.mta-expand-icon');
                            if (!details) return;
                            var open = details.classList.toggle('mta-open');
                            if (icon) icon.textContent = open ? '\u02C4' : '\u02C5';
                        });
                    });
                }
            }
        }
    });
}
