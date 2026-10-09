import { installerOutilsOnglets, texteDe } from '../../../blocks/shared/onglets-outils.js';

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

    /* ── Panneaux ──
       Plus d'onglets mobiles statiques : le script les GÉNÈRE à partir des
       en-têtes desktop. Ils étaient une copie à maintenir à la main, invisible
       en vue desktop dans l'éditeur : renommer ou supprimer un onglet desktop
       laissait l'ancien libellé en mobile (recette BRASSART, 10/2026). */
    const bodyComps = [];
    TABS.forEach((t, i) => {
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

    // CSS de l'onglet « contenu libre ». Aussi ajouté à la volée par la commande
    // d'ajout : les pages existantes n'ont pas cette règle dans leur CSS.
    const FREE_PANE_CSS = '.mta-free { padding: 28px 32px; min-height: 120px; background: var(--brand-background, #ffffff); color: var(--brand-text, #1a1a1a); line-height: 1.6; } .mta-free h3 { font-size: 16px; font-weight: 800; margin: 0 0 10px; } @media (max-width: 768px) { .mta-free { padding: 22px 20px; } }';

    /* ══════════════════════════════════════════════════════
       SCRIPT COMMUN (v1 et v2)
       • Onglets mobiles GÉNÉRÉS depuis les en-têtes desktop : une seule source
         de vérité. Les anciens onglets mobiles statiques (pages existantes)
         sont masqués, plus jamais affichés avec un libellé périmé.
       • Ligne d'en-têtes : autant de colonnes que d'onglets (1 à N), au lieu
         de 3 colonnes figées.
       • Clics câblés par `onclick` et non `addEventListener` : le script est
         relancé après un ajout/suppression d'onglet, et un double écouteur
         ouvrait puis refermait aussitôt le détail d'une étape.
       • Colonnes d'étapes selon leur nombre (comportement de la v2) :
         desktop 1 à 4 sur une ligne, 5+ par 3 ; tablette 2 ; mobile 1.
    ══════════════════════════════════════════════════════ */
    const tabsScript = function() {
        var root = this;
        var wrapper = root.querySelector('.mta-wrapper') || root;
        var win = root.ownerDocument.defaultView || window;
        var doc = root.ownerDocument;
        var inEditor = !!(win.frameElement && /\bgjs-frame\b/.test(win.frameElement.className || ''));
        // Option « onglets non cliquables » (data-mta-fixe="1" sur le wrapper),
        // pour une page dont tous les onglets ont les mêmes étapes : sur la page
        // publiée, tous les titres sont affichés à l'identique, sans clic, avec
        // le contenu du premier onglet. Dans l'éditeur, les onglets restent
        // cliquables pour pouvoir modifier leur contenu.
        var fixe = wrapper.getAttribute('data-mta-fixe') === '1' && !inEditor;

        function kids(sel) {
            return Array.prototype.filter.call(wrapper.children, function(c) { return c.matches(sel); });
        }
        function headers() {
            var bar = kids('.mta-headers')[0];
            return bar ? Array.prototype.filter.call(bar.children, function(c) { return c.matches('.mta-tab-hd'); }) : [];
        }

        function switchTab(idx) {
            headers().forEach(function(h) { h.classList.toggle('mta-active', h.getAttribute('data-tab') === idx); });
            kids('.mta-pane').forEach(function(p) { p.classList.toggle('mta-pane-active', p.getAttribute('data-pane') === idx); });
            kids('.mta-mob-tab').forEach(function(m) { m.classList.toggle('mta-active', m.getAttribute('data-tab') === idx); });
            paint();
        }

        // Les onglets générés n'ont pas d'id : les couleurs posées au Style
        // Manager sur un en-tête (#id) ne les atteignent pas. On recopie donc
        // les couleurs CALCULÉES de l'en-tête desktop (masqué en mobile, mais
        // son style reste calculé) → même rendu qu'en desktop.
        function paint() {
            var cs = win.getComputedStyle;
            kids('.mta-mob-tab[data-mta-gen]').forEach(function(m) {
                var h = headers().filter(function(x) { return x.getAttribute('data-tab') === m.getAttribute('data-tab'); })[0];
                if (!h) return;
                m.style.backgroundColor = cs(h).backgroundColor;
                ['.mta-tab-hd-sub', '.mta-tab-hd-title'].forEach(function(sel) {
                    var from = h.querySelector(sel), to = m.querySelector(sel);
                    if (from && to) to.style.color = cs(from).color;
                });
            });
        }

        function sync() {
            var hds = headers();
            var bar = kids('.mta-headers')[0];
            if (bar && hds.length) bar.style.gridTemplateColumns = 'repeat(' + hds.length + ', minmax(0, 1fr))';

            kids('.mta-mob-tab[data-mta-gen]').forEach(function(m) { m.parentNode.removeChild(m); });
            kids('.mta-mob-tab').forEach(function(m) { m.style.display = 'none'; });

            // Onglets non cliquables : panneau du premier onglet, au-dessus duquel
            // on place TOUS les onglets mobiles.
            var premier = hds[0] && kids('.mta-pane[data-pane="' + hds[0].getAttribute('data-tab') + '"]')[0];

            hds.forEach(function(h) {
                var idx = h.getAttribute('data-tab');
                if (fixe) {
                    h.onclick = null;
                    h.style.cursor = 'default';
                    h.classList.add('mta-active');
                } else {
                    h.onclick = function() { switchTab(idx); };
                }
                var pane = kids('.mta-pane[data-pane="' + idx + '"]')[0];
                if (!pane) return;
                var mob = doc.createElement('div');
                mob.className = 'mta-mob-tab' + ((fixe || h.classList.contains('mta-active')) ? ' mta-active' : '');
                mob.setAttribute('data-tab', idx);
                mob.setAttribute('data-mta-gen', '');
                mob.innerHTML = h.innerHTML;
                Array.prototype.forEach.call(mob.querySelectorAll('[id]'), function(n) { n.removeAttribute('id'); });
                if (fixe) {
                    mob.style.cursor = 'default';
                    wrapper.insertBefore(mob, premier || pane);
                } else {
                    mob.onclick = function() { switchTab(idx); };
                    wrapper.insertBefore(mob, pane);
                }
            });

            if (fixe) {
                kids('.mta-pane').forEach(function(p) { p.classList.toggle('mta-pane-active', p === premier); });
                paint();
                return;
            }

            // Aucun panneau actif (onglet actif supprimé) → le premier onglet.
            var active = hds.filter(function(h) { return h.classList.contains('mta-active'); })[0];
            if (!active && hds[0]) switchTab(hds[0].getAttribute('data-tab'));
            else paint();
        }

        wrapper.querySelectorAll('[data-expandable="true"]').forEach(function(label) {
            label.onclick = function() {
                var details = label.parentElement.querySelector('.mta-step-details');
                var icon    = label.querySelector('.mta-expand-icon');
                if (!details) return;
                var open = details.classList.toggle('mta-open');
                if (icon) icon.textContent = open ? '˄' : '˅';
            };
        });

        function layout() {
            var w = win.innerWidth;
            wrapper.querySelectorAll('.mta-steps-grid').forEach(function(grid) {
                var steps = grid.querySelectorAll(':scope > .mta-step');
                steps.forEach(function(s) { s.style.minWidth = '0'; });
                if (w <= 768) { grid.style.gridTemplateColumns = ''; return; }
                var n = steps.length || 1;
                var cols = w <= 1024 ? Math.min(n, 2) : (n <= 4 ? n : 3);
                grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
            });
        }

        // Relance (ajout/suppression d'onglet) : on retire l'écouteur et les
        // observateurs de l'exécution précédente avant d'en poser de nouveaux.
        if (wrapper.__mtaCleanup) wrapper.__mtaCleanup();
        var observers = [];
        function observeWrapper() {
            if (!win.MutationObserver) return;
            // L'éditeur re-rend les enfants du wrapper à chaque modification du
            // modèle, ce qui efface les onglets générés : on les régénère.
            var obs = new win.MutationObserver(function() {
                obs.disconnect();
                sync();
                obs.observe(wrapper, { childList: true });
            });
            obs.observe(wrapper, { childList: true });
            observers.push(obs);
            wrapper.querySelectorAll('.mta-steps-grid').forEach(function(grid) {
                var o = new win.MutationObserver(layout);
                o.observe(grid, { childList: true });
                observers.push(o);
            });
        }
        win.addEventListener('resize', layout);
        wrapper.__mtaCleanup = function() {
            win.removeEventListener('resize', layout);
            observers.forEach(function(o) { o.disconnect(); });
        };

        sync();
        // Page publiée : toujours ouvrir sur le PREMIER onglet. Dans l'éditeur,
        // l'onglet affiché est celui qu'on édite (enregistré dans le modèle) et
        // ne doit pas changer quand le script est relancé. (Onglets non
        // cliquables : déjà réglés par sync, ne rien basculer.)
        if (!inEditor && !fixe && !wrapper.__mtaStarted) {
            var firstHd = headers()[0];
            if (firstHd) switchTab(firstHd.getAttribute('data-tab'));
        }
        wrapper.__mtaStarted = true;
        layout();
        observeWrapper();
    };

    /* ══════════════════════════════════════════════════════
       COMMANDES : ajouter / supprimer un onglet
       Déclenchées par les boutons du panneau de droite (traits) quand le bloc
       est sélectionné. Chaque école peut ainsi ajouter, par exemple, un onglet
       « Admissions internationales » :
         • version ÉTAPES   → même présentation que les autres onglets ;
         • version LIBRE    → zone où l'on écrit et dépose n'importe quel bloc
                              (texte, deux colonnes, image…), pour les écoles
                              dont la présentation diffère.
    ══════════════════════════════════════════════════════ */
    const TAB_TYPES = ['mc-tabs-admission', 'mc-tabs-admission-v2'];

    function findTabsRoot(cmp) {
        for (let c = cmp; c; c = c.parent()) {
            if (TAB_TYPES.includes(c.get('type'))) return c;
        }
        return null;
    }

    function tabsParts(root) {
        const wrapper = root.find('.mta-wrapper')[0];
        const bar = wrapper && wrapper.components().filter(c => c.getClasses().includes('mta-headers'))[0];
        return { wrapper, bar };
    }

    // Onglet VISÉ par les boutons : celui dont on a cliqué le titre ou le contenu
    // (on remonte la sélection jusqu'à un en-tête data-tab ou un panneau
    // data-pane) ; à défaut l'onglet actif du modèle, sinon le premier.
    function currentTabIdx(root, bar, selected) {
        for (let c = selected; c && c !== root; c = c.parent()) {
            const a = c.getAttributes();
            const cls = c.getClasses();
            if (cls.includes('mta-tab-hd') && a['data-tab'] != null) return a['data-tab'];
            if (cls.includes('mta-pane') && a['data-pane'] != null) return a['data-pane'];
        }
        const active = bar.components().filter(h => h.getClasses().includes('mta-active'))[0];
        const first = active || bar.components().at(0);
        return first ? first.getAttributes()['data-tab'] : null;
    }

    function paneOf(wrapper, idx) {
        return wrapper.components().filter(c => c.getClasses().includes('mta-pane') && c.getAttributes()['data-pane'] === idx)[0];
    }

    // Affiche un onglet en écrivant l'état actif dans le MODÈLE. Le simple clic
    // dans le canvas ne changeait que le DOM : GrapesJS réappliquait ensuite les
    // classes du modèle et le contenu de l'onglet cliqué disparaissait.
    function showTabInModel(wrapper, bar, idx) {
        bar.components().forEach(h => {
            const on = h.getAttributes()['data-tab'] === idx;
            if (on !== h.getClasses().includes('mta-active')) on ? h.addClass('mta-active') : h.removeClass('mta-active');
        });
        wrapper.components().filter(c => c.getClasses().includes('mta-pane')).forEach(p => {
            const on = p.getAttributes()['data-pane'] === idx;
            if (on !== p.getClasses().includes('mta-pane-active')) on ? p.addClass('mta-pane-active') : p.removeClass('mta-pane-active');
        });
    }

    // Applique l'onglet actif dans le MODÈLE (classes exportées), retire les
    // anciens onglets mobiles statiques (désormais générés), relance le script.
    function activateTab(root, wrapper, bar, idx) {
        showTabInModel(wrapper, bar, idx);
        wrapper.components().filter(c => c.getClasses().includes('mta-mob-tab')).forEach(m => m.remove());
        setTimeout(() => { if (root.view) root.view.updateScript(); }, 0);
    }

    function addTab(ed, kind) {
        const root = findTabsRoot(ed.getSelected());
        if (!root) return;
        const { wrapper, bar } = tabsParts(root);
        if (!wrapper || !bar) return;

        const used = bar.components().map(h => parseInt(h.getAttributes()['data-tab'], 10)).filter(n => !isNaN(n));
        wrapper.components().forEach(c => {
            const n = parseInt(c.getAttributes()['data-pane'], 10);
            if (!isNaN(n)) used.push(n);
        });
        const idx = String(used.length ? Math.max(...used) + 1 : 0);

        bar.append({
            tagName: 'div', classes: ['mta-tab-hd'], attributes: { 'data-tab': idx },
            components: tabLabelComps('Admission', 'Admissions internationales'),
        });

        let content;
        if (kind === 'free') {
            if (!ed.Css.getRule('.mta-free')) ed.Css.addRules(FREE_PANE_CSS);
            content = [{
                tagName: 'div', classes: ['mta-free'], droppable: true,
                components: [
                    { type: 'text', tagName: 'h3', editable: true, components: 'Admissions internationales' },
                    { type: 'text', tagName: 'p', editable: true, components: 'Décrivez ici le parcours d’admission des candidats internationaux. Vous pouvez aussi glisser n’importe quel bloc dans cette zone (texte, image, deux colonnes…).' },
                ],
            }];
        } else {
            content = [{
                tagName: 'div', classes: ['mta-steps-grid'],
                components: [
                    { step: '1', title: 'Candidature en ligne', iconId: 'computer', items: ['Formulaire en ligne'] },
                    { step: '2', title: 'Entretien',            iconId: 'users',    items: ['Entretien à distance'] },
                    { step: '3', title: 'Résultats',            iconId: 'chart',    items: ['Réponse par email'] },
                ].map(makeStep),
            }];
        }
        wrapper.append({ tagName: 'div', classes: ['mta-pane'], attributes: { 'data-pane': idx }, components: content });

        activateTab(root, wrapper, bar, idx);
    }

    editor.Commands.add('mta-add-tab-steps', { run: ed => addTab(ed, 'steps') });
    editor.Commands.add('mta-add-tab-free',  { run: ed => addTab(ed, 'free') });
    editor.Commands.add('mta-remove-tab', {
        run(ed) {
            const root = findTabsRoot(ed.getSelected());
            if (!root) return;
            const { wrapper, bar } = tabsParts(root);
            if (!wrapper || !bar) return;
            if (bar.components().length <= 1) { alert('Le bloc doit garder au moins un onglet.'); return; }

            const idx = currentTabIdx(root, bar, ed.getSelected());
            const hd = bar.components().filter(h => h.getAttributes()['data-tab'] === idx)[0];
            const title = hd ? (hd.view && hd.view.el ? hd.view.el.textContent.trim() : '') : '';
            if (!confirm('Supprimer l’onglet affiché' + (title ? ' « ' + title + ' »' : '') + ' et son contenu ?')) return;

            if (hd) hd.remove();
            wrapper.components()
                .filter(c => c.getAttributes()['data-pane'] === idx || (c.getClasses().includes('mta-mob-tab') && c.getAttributes()['data-tab'] === idx))
                .forEach(c => c.remove());

            const first = bar.components().at(0);
            activateTab(root, wrapper, bar, first.getAttributes()['data-tab']);
            ed.select(root);
        }
    });

    /* Ajouts DANS l'onglet visé (celui dont on a cliqué le titre ou le contenu). */
    const PANE_TEXT_CSS = '.mta-pane-text { padding: 18px 24px; line-height: 1.6; color: var(--brand-text, #1a1a1a); background: var(--brand-background, #ffffff); }';

    function inCurrentTab(ed, fn) {
        const root = findTabsRoot(ed.getSelected());
        if (!root) return;
        const { wrapper, bar } = tabsParts(root);
        if (!wrapper || !bar) return;
        const idx = currentTabIdx(root, bar, ed.getSelected());
        const pane = idx != null && paneOf(wrapper, idx);
        if (!pane) return;
        showTabInModel(wrapper, bar, idx);
        const added = fn(pane);
        // Relance du script : dépliage des nouvelles étapes, colonnes, onglets mobiles.
        setTimeout(() => {
            if (root.view) root.view.updateScript();
            if (added) ed.select(added);
        }, 0);
    }

    editor.Commands.add('mta-add-step', {
        run: ed => inCurrentTab(ed, pane => {
            let grid = pane.find('.mta-steps-grid')[0];
            if (!grid) grid = pane.append({ tagName: 'div', classes: ['mta-steps-grid'] })[0];
            const steps = grid.components().filter(c => c.getClasses().includes('mta-step'));
            const n = steps.length + 1;
            let step;
            if (steps.length) {
                // Copie de la dernière étape : même langue, même mise en forme ;
                // seul le numéro change. Les textes se modifient ensuite.
                step = grid.append(steps[steps.length - 1].clone())[0];
                const num = step.find('.mta-badge strong')[0];
                if (num) num.components(String(n));
            } else {
                step = grid.append(makeStep({ step: String(n), title: 'Nouvelle étape', iconId: 'check', items: ['Détail à personnaliser'] }))[0];
            }
            return step;
        })
    });

    editor.Commands.add('mta-add-text', {
        run: ed => inCurrentTab(ed, pane => {
            if (!ed.Css.getRule('.mta-pane-text')) ed.Css.addRules(PANE_TEXT_CSS);
            const free = pane.find('.mta-free')[0];
            return (free || pane).append({
                type: 'text', tagName: 'div', classes: ['mta-pane-text'], editable: true,
                components: 'Texte à personnaliser (double-cliquez pour modifier).',
            })[0];
        })
    });

    /* Encadré « Onglets Admission » du panneau de droite : module partagé avec
       le bloc « Comment intégrer… ? » (blocks/shared/onglets-outils.js). */
    // Option « onglets non cliquables » : attribut data-mta-fixe sur le wrapper,
    // lu par le script du bloc (voir tabsScript).
    const estFixe = root => {
        const { wrapper } = tabsParts(root);
        return !!wrapper && wrapper.getAttributes()['data-mta-fixe'] === '1';
    };
    editor.Commands.add('mta-toggle-fixe', {
        run(ed) {
            const root = findTabsRoot(ed.getSelected());
            if (!root) return;
            const { wrapper } = tabsParts(root);
            if (!wrapper) return;
            if (estFixe(root)) wrapper.removeAttributes('data-mta-fixe');
            else wrapper.addAttributes({ 'data-mta-fixe': '1' });
        }
    });

    installerOutilsOnglets(editor, {
        id: 'mta-tab-tools',
        prefixe: 'mta',
        trouverBloc: findTabsRoot,
        bascule: {
            cmd: 'mta-toggle-fixe',
            libelle: root => estFixe(root)
                ? '☑ Onglets non cliquables (activé)'
                : '☐ Onglets non cliquables (désactivé)',
        },
        surSelection(root, sel) {
            const { wrapper, bar } = tabsParts(root);
            if (!wrapper || !bar) return '';
            const idx = currentTabIdx(root, bar, sel);
            // Clic sur un titre (ou dans un contenu) → cet onglet devient l'onglet
            // affiché, dans le modèle : il reste visible pendant l'édition.
            if (idx != null) showTabInModel(wrapper, bar, idx);
            const hd = bar.components().filter(h => h.getAttributes()['data-tab'] === idx)[0];
            return texteDe(hd && hd.find('.mta-tab-hd-title')[0]);
        },
    });

    /* ══════════════════════════════════════════════════════
       BLOC GrapesJS : Onglets Admission
    ══════════════════════════════════════════════════════ */
    // La palette dépose la VERSION 2 (même contenu, même CSS, fonctionnement
    // enrichi) ; le type d'origine reste déclaré pour les pages existantes.
    editor.BlockManager.add('master-tabs', {
        label: 'Onglets Admission',
        category: cat,
        content: {
            type: 'mc-tabs-admission-v2',
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

                /* ── Onglet « contenu libre » (présentation propre à l'école) ── */
                ${FREE_PANE_CSS}

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
                    // ⚠️ L'id 'mta-wrapper' est RETIRÉ intentionnellement :
                    // l'id hardcodé était utilisé comme fallback dans le script
                    // (document.getElementById), ce qui causait des conflits
                    // entre instances et après déclinaison. Le script utilise
                    // maintenant uniquement `this` pour trouver le wrapper.
                    components: wrapperComps,
                }]
            }]
        },
        attributes: { class: 'fa fa-folder-o' }
    });

    /* ══════════════════════════════════════════════════════
       TYPE mc-tabs-admission : pages existantes.
       Même script que la v2 (tabsScript) : c'est un CORRECTIF, pas un
       changement de présentation — ces pages affichaient en mobile des
       onglets périmés (libellés non synchronisés avec le desktop).
       Le script n'utilise que `this` (jamais d'id en dur) : plusieurs
       instances par page et pages déclinées restent indépendantes.
    ══════════════════════════════════════════════════════ */
    editor.DomComponents.addType('mc-tabs-admission', {
        model: {
            defaults: {
                'script-props': [],
                script: tabsScript,
            }
        }
    });

    /* ══════════════════════════════════════════════════════
       TYPE mc-tabs-admission-v2 — blocs déposés depuis la palette.
       Même script que la v1 (voir tabsScript) ; le bloc déposé
       n'embarque plus d'onglets mobiles statiques.
    ══════════════════════════════════════════════════════ */
    editor.DomComponents.addType('mc-tabs-admission-v2', {
        extend: 'mc-tabs-admission',
        model: {
            defaults: {
                script: tabsScript,
            }
        }
    });
}
