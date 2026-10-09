/**
 * Bloc « Comment intégrer l'EFAP ? » — onglets d'admission.
 *
 * - Barre d'onglets (2 onglets) : cliquer un onglet affiche son panneau.
 * - Chaque panneau : 3 étapes (icône SVG + label « Étape N » + texte éditable).
 * - Lien « ÉPREUVES ∨ » qui déplie/replie un détail.
 *
 * Type custom (DomComponents.addType) : la logique d'onglets + toggle vit dans le
 * `script` (exporté avec la page). Tout est scopé sur `this` via des CLASSES et
 * `data-tab`/`data-panel` (pas d'id) → plusieurs blocs possibles sans conflit.
 * Le texte s'édite en double-cliquant dessus.
 */
import { installerOutilsOnglets, texteDe } from '../shared/onglets-outils.js';

export default function (editor, categories) {
    const TYPE = 'admission-tabs';
    const TYPE_V2 = 'admission-tabs-v2';

    // Icônes SVG réutilisées (étape 1 = doc, étape 2 = badge, étape 3 = avion papier)
    const ICO_DOC = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:40px;stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><rect x="6" y="8" width="26" height="30" rx="2"/><line x1="6" y1="42" x2="32" y2="42"/><line x1="19" y1="38" x2="19" y2="42"/><line x1="11" y1="15" x2="14" y2="15"/><line x1="17" y1="15" x2="27" y2="15"/><line x1="11" y1="22" x2="14" y2="22"/><line x1="17" y1="22" x2="27" y2="22"/><line x1="11" y1="29" x2="14" y2="29"/><line x1="17" y1="29" x2="27" y2="29"/><circle cx="38" cy="16" r="2"/><circle cx="42" cy="26" r="2"/><circle cx="37" cy="34" r="2"/><line x1="32" y1="15" x2="36" y2="16"/><line x1="40" y1="17" x2="41" y2="24"/><line x1="41" y1="28" x2="38" y2="32"/></svg>`;
    const ICO_BADGE = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:40px;stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><path d="M24 6 l3 4 5 -1 1 5 5 1 -1 5 4 3 -4 3 1 5 -5 1 -1 5 -5 -1 -3 4 -3 -4 -5 1 -1 -5 -5 -1 1 -5 -4 -3 4 -3 -1 -5 5 -1 1 -5 5 1 z"/><path d="M20 24 a4.5 4.5 0 1 1 8 3 c-1 1 -1.5 2 -1.5 3.5 h-5 c0 -1.5 -.5 -2.5 -1.5 -3.5 a4.5 4.5 0 0 1 0 -3 z" transform="translate(0,-2)"/><line x1="21.5" y1="31" x2="26.5" y2="31"/></svg>`;
    const ICO_PLANE = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:40px;stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><polygon points="6,26 42,8 32,42 22,32"/><line x1="42" y1="8" x2="22" y2="32"/><line x1="22" y1="32" x2="20" y2="41"/></svg>`;

    const CONTENT = `
    <section class="integration">
      <h2 class="section-title">Comment intégrer l&rsquo;EFAP&nbsp;?</h2>
      <div class="onglets">
        <div class="onglets-nav">
          <button type="button" class="onglet-btn actif" data-tab="1"><strong>1re, 2e et 3e année</strong></button>
          <button type="button" class="onglet-btn" data-tab="2">4e année</button>
        </div>

        <div class="onglet-panneau actif" data-panel="1">
          <h3>Admissions 1re, 2e et 3e année</h3>
          <p class="sous-titre">Concours (épreuve 100% digitalisées)</p>
          <div class="etapes-grille">
            <div class="etape">
              <div class="etape-icone">${ICO_DOC}</div>
              <div>
                <span class="etape-label">Étape <strong>1</strong></span>
                <p class="etape-texte"><strong>Inscription en ligne au concours</strong><br>à la date de ton choix</p>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_BADGE}</div>
              <div>
                <span class="etape-label">Étape <strong>2</strong></span>
                <p class="etape-texte"><strong>Passage des <span class="lien-epreuves">ÉPREUVES &or;</span></strong><br>du concours</p>
                <div class="epreuves-detail">
                  <p>Détail des épreuves à personnaliser (culture générale, entretien de motivation, épreuve créative...).</p>
                </div>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_PLANE}</div>
              <div>
                <span class="etape-label">Étape <strong>3</strong></span>
                <p class="etape-texte"><strong>Réception des résultats</strong><br>par email</p>
              </div>
            </div>
          </div>
        </div>

        <div class="onglet-panneau" data-panel="2">
          <h3>Admissions 4e année</h3>
          <p class="sous-titre">Contenu à personnaliser</p>
          <div class="etapes-grille">
            <div class="etape">
              <div class="etape-icone">${ICO_DOC}</div>
              <div>
                <span class="etape-label">Étape <strong>1</strong></span>
                <p class="etape-texte"><strong>Étape à personnaliser</strong></p>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_BADGE}</div>
              <div>
                <span class="etape-label">Étape <strong>2</strong></span>
                <p class="etape-texte"><strong>Étape à personnaliser</strong></p>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_PLANE}</div>
              <div>
                <span class="etape-label">Étape <strong>3</strong></span>
                <p class="etape-texte"><strong>Étape à personnaliser</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .integration{background:#a6a7ce;padding:56px 24px 64px;font-family:var(--brand-font,'Montserrat',Arial,sans-serif);color:#1a1a1a;}
        .integration .section-title{font-size:28px;font-weight:800;text-transform:uppercase;letter-spacing:1px;text-align:center;margin-bottom:44px;}
        .integration .onglets{max-width:960px;margin:0 auto;}
        .integration .onglets-nav{display:flex;}
        .integration .onglet-btn{font-family:inherit;font-size:13.5px;font-weight:400;padding:14px 26px;border:none;background:#f1ede9;color:#000;cursor:pointer;}
        .integration .onglet-btn.actif{font-weight:700;background:#fff;}
        .integration .onglet-panneau{display:none;background:#fff;border:1px solid rgba(0,0,0,.18);box-shadow:0 1px 6px rgba(0,0,0,.08);padding:36px 44px 44px;}
        .integration .onglet-panneau.actif{display:block;}
        .integration .onglet-panneau h3{font-size:14.5px;font-weight:700;color:#000;}
        .integration .onglet-panneau .sous-titre{font-size:13px;color:#898989;margin-top:2px;margin-bottom:34px;}
        .integration .etapes-grille{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;}
        .integration .etape{display:flex;gap:16px;align-items:flex-start;}
        .integration .etape-icone{flex:0 0 44px;height:44px;display:flex;align-items:center;justify-content:center;}
        .integration .etape-label{display:inline-block;background:#ecbaae;font-size:12.5px;font-weight:600;padding:2px 8px;margin-bottom:6px;}
        .integration .etape-label strong{margin-left:4px;}
        .integration .etape-texte{font-size:13px;color:#939393;}
        .integration .etape-texte strong{color:#000;}
        .integration .etape-texte .lien-epreuves{font-weight:700;text-decoration:underline;cursor:pointer;}
        .integration .epreuves-detail{max-height:0;overflow:hidden;transition:max-height .3s ease;font-size:12.5px;color:#444;}
        .integration .epreuves-detail.ouvert{max-height:200px;margin-top:8px;}
        @media (max-width:768px){.integration .etapes-grille{grid-template-columns:1fr;gap:24px;}.integration .onglet-panneau{padding:28px 24px;}.integration .onglet-btn{flex:1;text-align:center;}}
      </style>
    </section>`;

    /*
     * SCRIPT COMMUN (version d'origine et version 2).
     *   • Clic sur un onglet → son panneau ; lien « ÉPREUVES » → détail.
     *     Câblés par `onclick` : le script est relancé après un ajout ou une
     *     suppression d'onglet/étape, sans empiler d'écouteurs.
     *   • Page publiée : ouverture TOUJOURS sur le premier onglet (dans
     *     l'éditeur, l'onglet affiché est celui qu'on édite, mémorisé dans le
     *     modèle : il ne doit pas changer quand le script est relancé).
     *   • Version 2 (data-block-version="2") : colonnes d'étapes selon leur
     *     nombre — desktop 1 à 4 sur une ligne, 5+ par 3 ; tablette 2 ;
     *     mobile 1 (CSS du bloc).
     */
    const scriptOnglets = function () {
        var root = this;
        var win = root.ownerDocument.defaultView || window;
        var btns = root.querySelectorAll('.onglet-btn');
        var panels = root.querySelectorAll('.onglet-panneau');
        function afficher(tab) {
            btns.forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-tab') === tab); });
            panels.forEach(function (p) { p.classList.toggle('actif', p.getAttribute('data-panel') === tab); });
        }
        btns.forEach(function (btn) {
            btn.onclick = function () { afficher(btn.getAttribute('data-tab')); };
        });
        root.querySelectorAll('.lien-epreuves').forEach(function (lien) {
            lien.onclick = function () {
                var etape = lien.closest('.etape');
                var detail = etape && etape.querySelector('.epreuves-detail');
                if (detail) detail.classList.toggle('ouvert');
            };
        });

        var inEditor = !!(win.frameElement && /\bgjs-frame\b/.test(win.frameElement.className || ''));
        if (!inEditor && !root.__adtDemarre && btns[0]) afficher(btns[0].getAttribute('data-tab'));
        root.__adtDemarre = true;

        if (root.getAttribute('data-block-version') !== '2') return;
        if (root.__adtNettoyer) root.__adtNettoyer();
        function layout() {
            var w = win.innerWidth;
            root.querySelectorAll('.etapes-grille').forEach(function (grid) {
                var steps = grid.querySelectorAll(':scope > .etape');
                steps.forEach(function (s) { s.style.minWidth = '0'; });
                if (w <= 768) { grid.style.gridTemplateColumns = ''; return; }
                var n = steps.length || 1;
                var cols = w <= 1024 ? Math.min(n, 2) : (n <= 4 ? n : 3);
                grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
            });
        }
        var observateurs = [];
        layout();
        win.addEventListener('resize', layout);
        if (win.MutationObserver) {
            root.querySelectorAll('.etapes-grille').forEach(function (grid) {
                var o = new win.MutationObserver(layout);
                o.observe(grid, { childList: true });
                observateurs.push(o);
            });
        }
        root.__adtNettoyer = function () {
            win.removeEventListener('resize', layout);
            observateurs.forEach(function (o) { o.disconnect(); });
        };
    };

    // La palette dépose la VERSION 2 ; le type d'origine reste déclaré pour les
    // pages existantes. Les deux partagent désormais le même script.
    editor.BlockManager.add(TYPE, {
        label: 'Onglets Admission',
        category: categories.MASTER,
        content: { type: TYPE_V2 },
        attributes: { class: 'fa fa-folder-open' }
    });

    editor.DomComponents.addType(TYPE, {
        isComponent: el => el.classList && el.classList.contains('integration'),
        model: {
            defaults: {
                name: 'Onglets Admission',
                components: CONTENT,
                script: scriptOnglets
            }
        }
    });

    /*
     * VERSION 2 — blocs déposés depuis la palette. Même HTML et même CSS que
     * la version d'origine, repérée par data-block-version="2" ; déclarée
     * APRÈS la version d'origine pour être reconnue en priorité.
     */
    editor.DomComponents.addType(TYPE_V2, {
        extend: TYPE,
        isComponent: el => el.classList && el.classList.contains('integration')
            && el.getAttribute('data-block-version') === '2',
        model: {
            defaults: {
                name: 'Onglets Admission',
                components: CONTENT.replace('<section class="integration">', '<section class="integration" data-block-version="2">'),
                script: scriptOnglets
            }
        }
    });

    /*
     * ÉDITION : même logique que les Onglets Admission du Master Template.
     * On clique sur un onglet pour l'afficher ; l'encadré « Onglets Admission »
     * du panneau de droite (blocks/shared/onglets-outils.js) ajoute une étape
     * ou un texte DANS cet onglet, ajoute un onglet (étapes ou contenu libre)
     * ou supprime l'onglet affiché.
     */
    const TYPES = [TYPE, TYPE_V2];
    const CSS_TEXTE = '.integration .onglet-texte { margin-top: 24px; font-size: 13.5px; line-height: 1.6; color: #444; }';
    const CSS_LIBRE = '.integration .onglet-libre { min-height: 80px; margin-top: 16px; }';

    function trouverBloc(cmp) {
        for (let c = cmp; c; c = c.parent()) {
            if (TYPES.includes(c.get('type'))) return c;
        }
        return null;
    }

    function parties(root) {
        const onglets = root.find('.onglets')[0];
        const nav = onglets && onglets.find('.onglets-nav')[0];
        return { onglets, nav };
    }

    const boutons = nav => nav.components().filter(c => c.getClasses().includes('onglet-btn'));
    const panneaux = onglets => onglets.components().filter(c => c.getClasses().includes('onglet-panneau'));

    // Onglet visé : celui dont on a cliqué le bouton ou le contenu ; à défaut
    // l'onglet actif du modèle, sinon le premier.
    function ongletVise(root, nav, sel) {
        for (let c = sel; c && c !== root; c = c.parent()) {
            const a = c.getAttributes(), cls = c.getClasses();
            if (cls.includes('onglet-btn') && a['data-tab'] != null) return a['data-tab'];
            if (cls.includes('onglet-panneau') && a['data-panel'] != null) return a['data-panel'];
        }
        const b = boutons(nav);
        const actif = b.filter(x => x.getClasses().includes('actif'))[0] || b[0];
        return actif ? actif.getAttributes()['data-tab'] : null;
    }

    // État actif écrit dans le MODÈLE : sinon GrapesJS réapplique les classes
    // du modèle et l'onglet cliqué disparaît pendant l'édition.
    function afficherDansModele(nav, onglets, idx) {
        boutons(nav).forEach(b => {
            const on = b.getAttributes()['data-tab'] === idx;
            if (on !== b.getClasses().includes('actif')) on ? b.addClass('actif') : b.removeClass('actif');
        });
        panneaux(onglets).forEach(p => {
            const on = p.getAttributes()['data-panel'] === idx;
            if (on !== p.getClasses().includes('actif')) on ? p.addClass('actif') : p.removeClass('actif');
        });
    }

    function relancer(ed, root, aSelectionner) {
        setTimeout(() => {
            if (root.view) root.view.updateScript();
            if (aSelectionner) ed.select(aSelectionner);
        }, 0);
    }

    function dansOngletVise(ed, fn) {
        const root = trouverBloc(ed.getSelected());
        if (!root) return;
        const { onglets, nav } = parties(root);
        if (!onglets || !nav) return;
        const idx = ongletVise(root, nav, ed.getSelected());
        const panneau = panneaux(onglets).filter(p => p.getAttributes()['data-panel'] === idx)[0];
        if (!panneau) return;
        afficherDansModele(nav, onglets, idx);
        relancer(ed, root, fn(panneau, root));
    }

    function etapeVierge(n) {
        return `<div class="etape"><div class="etape-icone">${ICO_DOC}</div><div>`
            + `<span class="etape-label">Étape <strong>${n}</strong></span>`
            + `<p class="etape-texte"><strong>Étape à personnaliser</strong></p></div></div>`;
    }

    // Copie la dernière étape (même langue, même mise en forme), numéro suivant.
    function ajouterEtape(grille) {
        const etapes = grille.components().filter(c => c.getClasses().includes('etape'));
        const n = etapes.length + 1;
        if (!etapes.length) return grille.append(etapeVierge(n))[0];
        const etape = grille.append(etapes[etapes.length - 1].clone())[0];
        const num = etape.find('.etape-label strong')[0];
        if (num) num.components(String(n));
        return etape;
    }

    editor.Commands.add('adt-add-step', {
        run: ed => dansOngletVise(ed, panneau => {
            const grille = panneau.find('.etapes-grille')[0] || panneau.append('<div class="etapes-grille"></div>')[0];
            return ajouterEtape(grille);
        })
    });

    editor.Commands.add('adt-add-text', {
        run: ed => dansOngletVise(ed, panneau => {
            if (!ed.Css.getRule('.integration .onglet-texte')) ed.Css.addRules(CSS_TEXTE);
            const libre = panneau.find('.onglet-libre')[0];
            return (libre || panneau).append({
                type: 'text', tagName: 'div', classes: ['onglet-texte'], editable: true,
                components: 'Texte à personnaliser (double-cliquez pour modifier).',
            })[0];
        })
    });

    function ajouterOnglet(ed, libre) {
        const root = trouverBloc(ed.getSelected());
        if (!root) return;
        const { onglets, nav } = parties(root);
        if (!onglets || !nav) return;

        // Barre d'onglets vidée pour n'afficher qu'un seul contenu (ESEC, 3WA,
        // École Bleue) : le contenu VISIBLE n'a plus de bouton. On lui en rend
        // un avant d'ajouter le nouvel onglet — sinon, une fois sur le nouvel
        // onglet, plus moyen d'y revenir. Les panneaux masqués sans bouton
        // (anciens contenus) restent masqués.
        const avecBouton = new Set(boutons(nav).map(b => b.getAttributes()['data-tab']));
        const visibles = panneaux(onglets).filter(p => p.getClasses().includes('actif'));
        (visibles.length ? visibles : panneaux(onglets).slice(0, 1))
            .filter(p => !avecBouton.has(p.getAttributes()['data-panel']))
            .forEach(p => {
                nav.append({
                    type: 'text', tagName: 'button', classes: ['onglet-btn'], editable: true,
                    attributes: { type: 'button', 'data-tab': p.getAttributes()['data-panel'] },
                    components: texteDe(p.find('h3')[0]) || 'Admissions',
                });
            });

        const pris = boutons(nav).map(b => parseInt(b.getAttributes()['data-tab'], 10))
            .concat(panneaux(onglets).map(p => parseInt(p.getAttributes()['data-panel'], 10)))
            .filter(n => !isNaN(n));
        const idx = String(pris.length ? Math.max(...pris) + 1 : 1);

        nav.append({
            type: 'text', tagName: 'button', classes: ['onglet-btn'], editable: true,
            attributes: { type: 'button', 'data-tab': idx },
            components: 'Admissions internationales',
        });

        let corps = '<h3>Admissions internationales</h3><p class="sous-titre">Sous-titre à personnaliser</p>';
        if (libre) {
            if (!ed.Css.getRule('.integration .onglet-libre')) ed.Css.addRules(CSS_LIBRE);
            corps += '<div class="onglet-libre"><p>Décrivez ici le parcours d’admission des candidats internationaux. '
                + 'Vous pouvez aussi glisser n’importe quel bloc dans cette zone (texte, image, deux colonnes…).</p></div>';
        } else {
            corps += '<div class="etapes-grille"></div>';
        }
        const panneau = onglets.append(`<div class="onglet-panneau" data-panel="${idx}">${corps}</div>`)[0];
        if (libre) {
            const zone = panneau.find('.onglet-libre')[0];
            if (zone) zone.set('droppable', true);
        } else {
            const grille = panneau.find('.etapes-grille')[0];
            // Étapes du premier onglet comme modèle (langue et style de la page).
            const premier = panneaux(onglets)[0];
            const modele = premier && premier.find('.etapes-grille')[0];
            const source = modele ? modele.components().filter(c => c.getClasses().includes('etape')).slice(0, 3) : [];
            if (source.length) {
                source.forEach((e, i) => {
                    const copie = grille.append(e.clone())[0];
                    const num = copie.find('.etape-label strong')[0];
                    if (num) num.components(String(i + 1));
                });
            } else {
                [1, 2, 3].forEach(n => grille.append(etapeVierge(n)));
            }
        }

        afficherDansModele(nav, onglets, idx);
        relancer(ed, root, boutons(nav).filter(b => b.getAttributes()['data-tab'] === idx)[0]);
    }

    editor.Commands.add('adt-add-tab-steps', { run: ed => ajouterOnglet(ed, false) });
    editor.Commands.add('adt-add-tab-free',  { run: ed => ajouterOnglet(ed, true) });

    editor.Commands.add('adt-remove-tab', {
        run(ed) {
            const root = trouverBloc(ed.getSelected());
            if (!root) return;
            const { onglets, nav } = parties(root);
            if (!onglets || !nav) return;
            if (boutons(nav).length <= 1) { alert('Le bloc doit garder au moins un onglet.'); return; }
            const idx = ongletVise(root, nav, ed.getSelected());
            const btn = boutons(nav).filter(b => b.getAttributes()['data-tab'] === idx)[0];
            const nom = texteDe(btn);
            if (!confirm('Supprimer l’onglet' + (nom ? ' « ' + nom + ' »' : '') + ' et son contenu ?')) return;
            if (btn) btn.remove();
            panneaux(onglets).filter(p => p.getAttributes()['data-panel'] === idx).forEach(p => p.remove());
            const premier = boutons(nav)[0];
            afficherDansModele(nav, onglets, premier.getAttributes()['data-tab']);
            ed.select(root);
            relancer(ed, root);
        }
    });

    installerOutilsOnglets(editor, {
        id: 'adt-tab-tools',
        prefixe: 'adt',
        trouverBloc,
        surSelection(root, sel) {
            const { onglets, nav } = parties(root);
            if (!onglets || !nav) return '';
            const idx = ongletVise(root, nav, sel);
            if (idx != null) afficherDansModele(nav, onglets, idx);
            return texteDe(boutons(nav).filter(b => b.getAttributes()['data-tab'] === idx)[0]);
        },
    });
}
