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

    const ICON_OPTIONS = [
        { id: 'computer', name: '🖥️ Ordinateur' },
        { id: 'clock',    name: '🕐 Horloge'    },
        { id: 'users',    name: '👥 Personnes'  },
        { id: 'chart',    name: '📈 Graphique'  },
        { id: 'file',     name: '📄 Fichier'    },
        { id: 'check',    name: '✅ Validation' },
    ];

    /* ══════════════════════════════════════════════════════
       COMPOSANT : mta-step-icon
       → Icône seule, choisie via un trait (panneau de droite).
         Ne réécrit QUE son propre innerHTML, donc les textes
         voisins de la carte restent éditables librement.
    ══════════════════════════════════════════════════════ */
    editor.DomComponents.addType('mta-step-icon', {
        model: {
            defaults: {
                name: 'Icône',
                tagName: 'div',
                classes: ['mta-step-icon'],
                selectable: true,
                editable: false,
                droppable: false,
                draggable: false,
                copyable: false,
                removable: false,
                attributes: { 'data-icon-id': 'computer' },
                traits: [
                    {
                        type:    'select',
                        label:   '🎨 Icône',
                        name:    'data-icon-id',
                        options: ICON_OPTIONS,
                    },
                ],
                'script-props': ['data-icon-id'],
                script: function(props) {
                    var ICONS = {
                        computer: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
                        clock:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                        users:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
                        chart:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
                        file:     '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
                        check:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                    };
                    var id = props['data-icon-id'] || 'computer';
                    this.innerHTML = ICONS[id] || ICONS.computer;
                }
            }
        },
        view: {
            init() {
                this.listenTo(this.model, 'change:attributes:data-icon-id', this.renderIcon);
            },
            onRender() {
                this.renderIcon();
            },
            renderIcon() {
                const id = this.model.getAttributes()['data-icon-id'] || 'computer';
                this.el.innerHTML = STEP_ICONS[id] || STEP_ICONS.computer;
            }
        }
    });

    /* ══════════════════════════════════════════════════════
       Helpers de construction (composants ÉDITABLES en place)
    ══════════════════════════════════════════════════════ */

    // Les deux libellés d'un onglet (sous-titre + titre)
    function tabLabelComps(sub, title) {
        return [
            { type: 'text', tagName: 'span',   classes: ['mta-tab-hd-sub'],   editable: true, selectable: true, components: sub   },
            { type: 'text', tagName: 'strong', classes: ['mta-tab-hd-title'], editable: true, selectable: true, components: title },
        ];
    }

    // Une carte étape (« encart ») : icône (trait) + textes éditables
    function makeStep(data) {
        const items = (data.items || []).filter(Boolean);

        const bodyComps = [
            {
                type: 'text', tagName: 'span', classes: ['mta-badge'],
                editable: true, selectable: true,
                components: 'Étape <strong>' + data.step + '</strong>',
            },
            {
                type: 'text', tagName: 'p', classes: ['mta-step-label'],
                editable: true, selectable: true,
                attributes: items.length ? { 'data-expandable': 'true' } : {},
                components: data.title + (items.length ? ' <span class="mta-expand-icon">˅</span>' : ''),
            },
        ];

        if (items.length) {
            bodyComps.push({
                tagName: 'ul', classes: ['mta-step-details'], selectable: true,
                components: items.map(t => ({
                    type: 'text', tagName: 'li', editable: true, selectable: true, components: t,
                })),
            });
        }

        return {
            tagName: 'div', classes: ['mta-step'],
            selectable: true, draggable: true, copyable: true, removable: true,
            components: [{
                tagName: 'div', classes: ['mta-step-head'],
                components: [
                    { type: 'mta-step-icon', attributes: { 'data-icon-id': data.iconId } },
                    { tagName: 'div', classes: ['mta-step-body'], components: bodyComps },
                ]
            }]
        };
    }

    /* ── Données par défaut du bloc ── */
    const TABS = [
        { sub: 'Admission classes préparatoires', title: 'Arts Appliqués' },
        { sub: 'Admission Programme',                  title: 'Game Design / Jeux Vidéo' },
        { sub: 'Admission Programme',                  title: 'Audiovisuel' },
    ];

    const PANES = [
        [ /* Arts Appliqués */
            { step: '1', title: 'Candidature en ligne',                    iconId: 'computer', items: ['Formulaire en ligne', 'Choix du programme'] },
            { step: '2', title: 'Création du dossier de candidature', iconId: 'file',     items: ['Bulletin de notes', 'Book créatif', 'Une production à réaliser chez soi'] },
            { step: '3', title: 'Entretien individuel de motivation',      iconId: 'users',    items: ['Entretien de 20 minutes', 'Présentation de votre projet'] },
            { step: '4', title: 'Résultats d\'admission',             iconId: 'chart',    items: ['Réponse par email', 'Délai de 2 semaines'] },
        ],
        [ /* Game Design */
            { step: '1', title: 'Candidature en ligne',                    iconId: 'computer', items: ['Formulaire en ligne', 'Choix du programme'] },
            { step: '2', title: 'Création du dossier de candidature', iconId: 'file',     items: ['Bulletin de notes', 'Book créatif', 'Une production à réaliser chez soi'] },
            { step: '3', title: 'Entretien individuel de motivation',      iconId: 'users',    items: ['Entretien de 20 minutes', 'Présentation de votre projet'] },
            { step: '4', title: 'Résultats d\'admission',             iconId: 'chart',    items: ['Réponse par email', 'Délai de 2 semaines'] },
        ],
        [ /* Audiovisuel */
            { step: '1', title: 'Candidature en ligne',                    iconId: 'computer', items: ['Formulaire en ligne', 'Choix du programme'] },
            { step: '2', title: 'Dossier de candidature',                  iconId: 'file',     items: ['Bulletin de notes', 'Lettre de motivation', 'CV artistique'] },
            { step: '3', title: 'Entretien individuel de motivation',      iconId: 'users',    items: ['Entretien de 20 minutes', 'Présentation de votre projet'] },
            { step: '4', title: 'Résultats d\'admission',             iconId: 'chart',    items: ['Réponse par email', 'Délai de 2 semaines'] },
        ],
    ];

    /* ── En-têtes desktop ── */
    const headerComps = TABS.map((t, i) => ({
        tagName: 'div',
        classes: i === 0 ? ['mta-tab-hd', 'mta-active'] : ['mta-tab-hd'],
        attributes: { 'data-tab': String(i) },
        components: tabLabelComps(t.sub, t.title),
    }));

    /* ── Onglets mobiles + panneaux (interleavés) ── */
    const bodyComps = [];
    TABS.forEach((t, i) => {
        bodyComps.push({
            tagName: 'div',
            classes: i === 0 ? ['mta-mob-tab', 'mta-active'] : ['mta-mob-tab'],
            attributes: { 'data-tab': String(i) },
            components: tabLabelComps(t.sub, t.title),
        });
        bodyComps.push({
            tagName: 'div',
            classes: i === 0 ? ['mta-pane', 'mta-pane-active'] : ['mta-pane'],
            attributes: { 'data-pane': String(i) },
            components: [{
                tagName: 'div', classes: ['mta-steps-grid'],
                components: PANES[i].map(makeStep),
            }],
        });
    });

    const wrapperComps = [
        { tagName: 'div', classes: ['mta-headers'], components: headerComps },
        ...bodyComps,
    ];

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
                    font-family: var(--brand-font, 'Inter', sans-serif);
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
                    background: var(--brand-background, #ffffff);
                    border-bottom: 1px solid #ffffff;
                    margin-bottom: -1px;
                    z-index: 10;
                    position: relative;
                }
                .mta-tab-hd.mta-active .mta-tab-hd-sub  { color: var(--brand-text, #1a1a1a); }
                .mta-tab-hd.mta-active .mta-tab-hd-title { color: var(--brand-text, #1a1a1a); }

                /* ── Steps grid ── */
                .mta-pane { display: none; }
                .mta-pane.mta-pane-active { display: block; }

                .mta-steps-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    align-items: start;
                    padding: 0;
                    background: var(--brand-background, #ffffff);
                }
                .mta-step {
                    padding: 24px 20px;
                    border-right: 1px solid #e0e0e0;
                    border-bottom: 1px solid #e0e0e0;
                    background: var(--brand-background, #ffffff);
                    cursor: pointer;
                }
                .mta-step:last-child { border-right: none; }

                .mta-step-head {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .mta-step-icon { flex-shrink: 0; color: var(--brand-text, #1a1a1a); margin-top: 2px; }
                .mta-step-body { flex: 1; }
                .mta-badge {
                    display: inline-block;
                    background: var(--brand-secondary, #f29c38);
                    color: var(--brand-text, #1a1a1a);
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
                    color: var(--brand-text, #1a1a1a);
                    margin: 0;
                    cursor: pointer;
                    line-height: 1.3;
                }
                .mta-step-label .mta-expand-icon {
                    font-size: 11px;
                    margin-left: 6px;
                    color: var(--brand-text, #1a1a1a);
                    vertical-align: middle;
                }
                .mta-step-details {
                    margin: 12px 0 0;
                    padding: 12px 0 0 16px;
                    font-size: 13px;
                    color: var(--brand-muted, #6b7280);
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
                    .mta-mob-tab.mta-active { background: var(--brand-background, #ffffff); border-bottom: 1px solid #e0e0e0; }
                    .mta-mob-tab.mta-active .mta-tab-hd-sub   { color: var(--brand-text, #1a1a1a); }
                    .mta-mob-tab.mta-active .mta-tab-hd-title { color: var(--brand-text, #1a1a1a); }
                }
            `,
            components: [{
                tagName: 'section',
                classes: ['mta-section'],
                components: [{
                    tagName: 'div',
                    classes: ['mta-wrapper'],
                    attributes: { id: 'mta-wrapper' },
                    components: wrapperComps,
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
                    // `this` = l'élément racine du composant (scopé par GrapesJS),
                    // donc on ne dépend pas de l'export de l'id #mta-wrapper.
                    var wrapper = this.querySelector('.mta-wrapper') || document.getElementById('mta-wrapper');
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
                            if (icon) icon.textContent = open ? '˄' : '˅';
                        });
                    });
                }
            }
        }
    });
}
