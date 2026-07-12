export default function (editor) {
    const bm = editor.BlockManager;

    const addBlock = (id, label, category, iconClass, content) => {
        bm.add(id, {
            label,
            category,
            content,
            media: `<div style="text-align:center; padding:10px;"><i class="${iconClass} fa-2x"></i></div>`
        });
    };

    // ── Layout ─────────────────────────────────────────────────────────
    const catLayout = 'Layout';
    /* Les blocs Layout ont été déplacés vers le Component Builder
    addBlock('b-section', 'Section', catLayout, 'fa-solid fa-square', { ... });
    addBlock('b-container', 'Container', catLayout, 'fa-solid fa-box', { ... });
    addBlock('b-grid', 'Grid', catLayout, 'fa-solid fa-border-all', { ... });
    addBlock('b-flex-row', 'Flex Row', catLayout, 'fa-solid fa-arrows-left-right', { ... });
    addBlock('b-flex-col', 'Flex Column', catLayout, 'fa-solid fa-arrows-up-down', { ... });
    addBlock('b-spacer', 'Spacer', catLayout, 'fa-solid fa-up-down', { ... });
    addBlock('b-divider', 'Divider', catLayout, 'fa-solid fa-minus', { ... });
    */

    // ── Typography ─────────────────────────────────────────────────────
    const catTypo = 'Typography';
    /* Les blocs Typography ont été déplacés vers le Component Builder
    addBlock('b-heading', 'Heading', catTypo, 'fa-solid fa-heading', { ... });
    addBlock('b-subheading', 'Subheading', catTypo, 'fa-solid fa-h2', { ... });
    addBlock('b-paragraph', 'Paragraph', catTypo, 'fa-solid fa-paragraph', { ... });
    addBlock('b-text', 'Text', catTypo, 'fa-solid fa-font', { ... });
    addBlock('b-quote', 'Quote', catTypo, 'fa-solid fa-quote-left', { ... });
    addBlock('b-list', 'List', catTypo, 'fa-solid fa-list-ul', { ... });
    addBlock('b-badge', 'Badge', catTypo, 'fa-solid fa-tag', { ... });
    */

    // ── Actions ────────────────────────────────────────────────────────
    const catActions = 'Actions';
    addBlock('b-button', 'Button', catActions, 'fa-solid fa-stop', `
        <a href="#" style="display: inline-block; padding: 12px 24px; background-color: var(--brand-primary); color: #fff; text-decoration: none; border-radius: 4px; font-weight: 600; text-align: center; transition: opacity 0.2s;">Cliquez ici</a>
    `);
    addBlock('b-button-group', 'Button Group', catActions, 'fa-solid fa-layer-group', `
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="#" style="display: inline-block; padding: 12px 24px; background-color: var(--brand-primary); color: #fff; text-decoration: none; border-radius: 4px; font-weight: 600; text-align: center;">Bouton 1</a>
            <a href="#" style="display: inline-block; padding: 12px 24px; background-color: transparent; border: 2px solid var(--brand-primary); color: var(--brand-primary); text-decoration: none; border-radius: 4px; font-weight: 600; text-align: center;">Bouton 2</a>
        </div>
    `);
    addBlock('b-link', 'Link', catActions, 'fa-solid fa-link', {
        type: 'link', content: 'Lien texte', style: { color: 'var(--brand-primary)', 'text-decoration': 'underline' }
    });

    // ── Media ──────────────────────────────────────────────────────────
    const catMedia = 'Media';
    addBlock('b-image', 'Image', catMedia, 'fa-solid fa-image', {
        type: 'image', style: { 'max-width': '100%', height: 'auto', display: 'block' }
    });
    addBlock('b-icon', 'Icon', catMedia, 'fa-solid fa-icons', {
        type: 'text', tagName: 'i', classes: ['fa', 'fa-star'], style: { 'font-size': '32px', color: 'var(--brand-primary)' }
    });
    addBlock('b-video', 'Video', catMedia, 'fa-solid fa-video', {
        type: 'video', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ', style: { width: '100%', height: '315px' }
    });
    addBlock('b-avatar', 'Avatar', catMedia, 'fa-solid fa-user-circle', {
        type: 'image', style: { width: '64px', height: '64px', 'border-radius': '50%', 'object-fit': 'cover', display: 'block' }
    });
    addBlock('b-logo', 'Logo', catMedia, 'fa-brands fa-pied-piper-alt', {
        type: 'image', style: { width: '120px', height: 'auto', display: 'block' }
    });

    // ── Navigation ─────────────────────────────────────────────────────
    const catNav = 'Navigation';
    addBlock('b-navbar', 'Navbar', catNav, 'fa-solid fa-bars', `
        <nav style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background-color: var(--brand-background, #ffffff); box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: 100%;">
            <div style="font-size: 20px; font-weight: bold; color: var(--brand-primary);">LOGO</div>
            <div style="display: flex; gap: 20px;">
                <a href="#" style="text-decoration: none; color: var(--brand-muted, #6b7280); font-weight: 500;">Accueil</a>
                <a href="#" style="text-decoration: none; color: var(--brand-muted, #6b7280); font-weight: 500;">Services</a>
                <a href="#" style="text-decoration: none; color: var(--brand-muted, #6b7280); font-weight: 500;">Contact</a>
            </div>
        </nav>
    `);
    addBlock('b-menu', 'Menu', catNav, 'fa-solid fa-ellipsis-v', `
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
            <li><a href="#" style="text-decoration: none; color: var(--brand-text, #1a1a1a); padding: 8px; display: block; border-radius: 4px;">Lien 1</a></li>
            <li><a href="#" style="text-decoration: none; color: var(--brand-text, #1a1a1a); padding: 8px; display: block; border-radius: 4px;">Lien 2</a></li>
            <li><a href="#" style="text-decoration: none; color: var(--brand-text, #1a1a1a); padding: 8px; display: block; border-radius: 4px;">Lien 3</a></li>
        </ul>
    `);
    addBlock('b-breadcrumb', 'Breadcrumb', catNav, 'fa-solid fa-chevron-right', `
        <div style="display: flex; gap: 8px; align-items: center; color: var(--brand-muted, #6b7280); font-size: 14px;">
            <a href="#" style="color: var(--brand-primary); text-decoration: none;">Accueil</a>
            <span>/</span>
            <a href="#" style="color: var(--brand-primary); text-decoration: none;">Catégorie</a>
            <span>/</span>
            <span style="color: var(--brand-text, #1a1a1a);">Page actuelle</span>
        </div>
    `);
    addBlock('b-tabs', 'Tabs', catNav, 'fa-solid fa-folder', `
        <div style="width: 100%;">
            <div style="display: flex; border-bottom: 1px solid var(--brand-border, #e5e7eb);">
                <div style="padding: 12px 20px; font-weight: bold; color: var(--brand-primary); border-bottom: 2px solid var(--brand-primary); cursor: pointer;">Onglet 1</div>
                <div style="padding: 12px 20px; color: var(--brand-muted, #6b7280); cursor: pointer;">Onglet 2</div>
                <div style="padding: 12px 20px; color: var(--brand-muted, #6b7280); cursor: pointer;">Onglet 3</div>
            </div>
            <div style="padding: 24px; background-color: var(--brand-background, #ffffff); border: 1px solid var(--brand-border, #e5e7eb); border-top: none;">
                Contenu de l'onglet 1.
            </div>
        </div>
    `);
    addBlock('b-pagination', 'Pagination', catNav, 'fa-solid fa-angle-double-right', `
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 20px;">
            <a href="#" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; color: var(--brand-text, #1a1a1a); text-decoration: none;">Préc</a>
            <a href="#" style="padding: 8px 12px; border: 1px solid var(--brand-primary); background-color: var(--brand-primary); color: #fff; border-radius: 4px; text-decoration: none;">1</a>
            <a href="#" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; color: var(--brand-text, #1a1a1a); text-decoration: none;">2</a>
            <a href="#" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; color: var(--brand-text, #1a1a1a); text-decoration: none;">3</a>
            <a href="#" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; color: var(--brand-text, #1a1a1a); text-decoration: none;">Suiv</a>
        </div>
    `);

    // ── Content Blocks ─────────────────────────────────────────────────
    const catContent = 'Content Blocks';
    addBlock('b-card', 'Card', catContent, 'fa-solid fa-address-card', `
        <div style="border: 1px solid var(--brand-border, #e5e7eb); border-radius: 8px; overflow: hidden; background-color: var(--brand-background, #ffffff); box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 350px;">
            <img src="https://via.placeholder.com/350x200" alt="Card Image" style="width: 100%; height: 200px; object-fit: cover; display: block;">
            <div style="padding: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 10px; color: var(--brand-text, #1a1a1a); font-size: 20px;">Titre de la carte</h3>
                <p style="color: var(--brand-muted, #6b7280); margin-bottom: 20px; line-height: 1.5;">Description courte de la carte pour donner un aperçu du contenu.</p>
                <a href="#" style="display: inline-block; padding: 10px 20px; background-color: var(--brand-primary); color: #fff; text-decoration: none; border-radius: 4px; font-weight: 500;">En savoir plus</a>
            </div>
        </div>
    `);
    addBlock('b-feature', 'Feature Item', catContent, 'fa-solid fa-star', `
        <div style="text-align: center; padding: 20px; max-width: 300px;">
            <div style="width: 64px; height: 64px; background-color: #eff6ff; color: var(--brand-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                <i class="fa fa-star fa-2x"></i>
            </div>
            <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 18px; color: var(--brand-text, #1a1a1a);">Fonctionnalité</h3>
            <p style="color: var(--brand-muted, #6b7280); line-height: 1.5; margin: 0;">Une description claire et concise de cette fonctionnalité incroyable.</p>
        </div>
    `);
    addBlock('b-statistic', 'Statistic', catContent, 'fa-solid fa-chart-bar', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; font-weight: bold; color: var(--brand-primary); margin-bottom: 8px;">99%</div>
            <div style="color: var(--brand-muted, #6b7280); font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Satisfaction</div>
        </div>
    `);
    addBlock('b-testimonial', 'Testimonial', catContent, 'fa-solid fa-comment-dots', `
        <div style="padding: 24px; background-color: var(--brand-surface, #f5f5f5); border-radius: 8px; border-left: 4px solid var(--brand-primary);">
            <p style="font-size: 16px; font-style: italic; color: var(--brand-muted, #6b7280); margin-bottom: 20px;">"Un outil fantastique qui a complètement changé notre façon de travailler. Je le recommande vivement à tout le monde."</p>
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="https://via.placeholder.com/48" alt="Avatar" style="width: 48px; height: 48px; border-radius: 50%;">
                <div>
                    <div style="font-weight: bold; color: var(--brand-text, #1a1a1a);">Jean Dupont</div>
                    <div style="color: var(--brand-muted, #6b7280); font-size: 14px;">CEO, Entreprise</div>
                </div>
            </div>
        </div>
    `);
    addBlock('b-faq', 'FAQ Item', catContent, 'fa-solid fa-question-circle', `
        <div style="border: 1px solid var(--brand-border, #e5e7eb); border-radius: 8px; padding: 20px; background-color: var(--brand-background, #ffffff); margin-bottom: 10px;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: var(--brand-text, #1a1a1a); font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
                Comment ça marche ?
                <i class="fa fa-chevron-down" style="color: #9ca3af; font-size: 14px;"></i>
            </h4>
            <p style="color: var(--brand-muted, #6b7280); margin: 0; line-height: 1.5;">C'est très simple. Vous vous inscrivez, vous configurez votre compte et vous commencez à utiliser nos services en quelques minutes.</p>
        </div>
    `);
    addBlock('b-accordion', 'Accordion', catContent, 'fa-solid fa-stream', `
        <div style="width: 100%; border: 1px solid var(--brand-border, #e5e7eb); border-radius: 8px; overflow: hidden;">
            <div style="padding: 16px 20px; background-color: var(--brand-surface, #f5f5f5); font-weight: 500; color: var(--brand-text, #1a1a1a); border-bottom: 1px solid var(--brand-border, #e5e7eb); cursor: pointer; display: flex; justify-content: space-between;">
                Section 1
                <i class="fa fa-plus" style="color: #9ca3af;"></i>
            </div>
            <div style="padding: 16px 20px; background-color: var(--brand-background, #ffffff); color: var(--brand-muted, #6b7280); border-bottom: 1px solid var(--brand-border, #e5e7eb);">
                Contenu de la section 1.
            </div>
            <div style="padding: 16px 20px; background-color: var(--brand-surface, #f5f5f5); font-weight: 500; color: var(--brand-text, #1a1a1a); cursor: pointer; display: flex; justify-content: space-between;">
                Section 2
                <i class="fa fa-plus" style="color: #9ca3af;"></i>
            </div>
        </div>
    `);
    addBlock('b-timeline', 'Timeline', catContent, 'fa-solid fa-history', `
        <div style="position: relative; padding-left: 30px; border-left: 2px solid var(--brand-border, #e5e7eb); margin: 20px 0;">
            <div style="position: relative; margin-bottom: 30px;">
                <div style="position: absolute; left: -39px; top: 0; width: 16px; height: 16px; background-color: var(--brand-primary); border-radius: 50%; border: 4px solid #fff;"></div>
                <div style="font-weight: bold; color: var(--brand-text, #1a1a1a); margin-bottom: 4px;">2024</div>
                <div style="color: var(--brand-muted, #6b7280);">Lancement du nouveau produit sur le marché.</div>
            </div>
            <div style="position: relative;">
                <div style="position: absolute; left: -39px; top: 0; width: 16px; height: 16px; background-color: #d1d5db; border-radius: 50%; border: 4px solid #fff;"></div>
                <div style="font-weight: bold; color: var(--brand-text, #1a1a1a); margin-bottom: 4px;">2023</div>
                <div style="color: var(--brand-muted, #6b7280);">Phase de développement et de tests.</div>
            </div>
        </div>
    `);

    // ── Marketing Sections ─────────────────────────────────────────────
    const catMktg = 'Marketing Sections';
    addBlock('b-hero', 'Hero', catMktg, 'fa-solid fa-bullhorn', `
        <section style="padding: 80px 20px; background-color: var(--brand-surface, #f5f5f5); text-align: center;">
            <h1 style="font-size: 48px; font-weight: 800; color: var(--brand-text, #1a1a1a); margin-bottom: 20px; line-height: 1.2;">Créez l'avenir dès aujourd'hui</h1>
            <p style="font-size: 20px; color: var(--brand-muted, #6b7280); max-width: 700px; margin: 0 auto 30px;">Notre plateforme vous offre tous les outils dont vous avez besoin pour réussir en ligne.</p>
            <div style="display: flex; gap: 16px; justify-content: center;">
                <a href="#" style="padding: 14px 28px; background-color: var(--brand-primary); color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px;">Commencer</a>
                <a href="#" style="padding: 14px 28px; background-color: transparent; border: 2px solid #d1d5db; color: var(--brand-text, #1a1a1a); text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px;">En savoir plus</a>
            </div>
        </section>
    `);
    addBlock('b-features-sec', 'Features Section', catMktg, 'fa-solid fa-th-large', `
        <section style="padding: 60px 20px; background-color: var(--brand-background, #ffffff);">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="font-size: 32px; font-weight: bold; color: var(--brand-text, #1a1a1a); margin-bottom: 10px;">Nos Fonctionnalités</h2>
                <p style="color: var(--brand-muted, #6b7280); font-size: 18px;">Tout ce dont vous avez besoin, rien de superflu.</p>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; max-width: 1000px; margin: 0 auto;">
                <div style="text-align: center;">
                    <i class="fa fa-bolt fa-3x" style="color: var(--brand-primary); margin-bottom: 20px;"></i>
                    <h3 style="font-size: 20px; margin-bottom: 10px;">Rapide</h3>
                    <p style="color: var(--brand-muted, #6b7280);">Performances optimisées pour une vitesse fulgurante.</p>
                </div>
                <div style="text-align: center;">
                    <i class="fa fa-lock fa-3x" style="color: var(--brand-primary); margin-bottom: 20px;"></i>
                    <h3 style="font-size: 20px; margin-bottom: 10px;">Sécurisé</h3>
                    <p style="color: var(--brand-muted, #6b7280);">Vos données sont protégées avec les meilleurs standards.</p>
                </div>
                <div style="text-align: center;">
                    <i class="fa fa-mobile fa-3x" style="color: var(--brand-primary); margin-bottom: 20px;"></i>
                    <h3 style="font-size: 20px; margin-bottom: 10px;">Responsive</h3>
                    <p style="color: var(--brand-muted, #6b7280);">Parfaitement adapté à tous les écrans et appareils.</p>
                </div>
            </div>
        </section>
    `);
    addBlock('b-pricing', 'Pricing Table', catMktg, 'fa-solid fa-tags', `
        <section style="padding: 60px 20px; background-color: var(--brand-surface, #f5f5f5);">
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 30px; max-width: 1000px; margin: 0 auto;">
                <div style="background-color: var(--brand-background, #ffffff); padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; flex: 1; min-width: 280px; border: 1px solid var(--brand-border, #e5e7eb);">
                    <h3 style="font-size: 24px; margin-bottom: 10px; color: var(--brand-text, #1a1a1a);">Basique</h3>
                    <div style="font-size: 48px; font-weight: bold; color: var(--brand-text, #1a1a1a); margin-bottom: 20px;">9€<span style="font-size: 16px; color: var(--brand-muted, #6b7280); font-weight: normal;">/mois</span></div>
                    <ul style="list-style: none; padding: 0; margin: 0 0 30px 0; color: var(--brand-muted, #6b7280); text-align: left;">
                        <li style="margin-bottom: 10px;"><i class="fa fa-check" style="color: #10b981; margin-right: 10px;"></i>1 Projet</li>
                        <li style="margin-bottom: 10px;"><i class="fa fa-check" style="color: #10b981; margin-right: 10px;"></i>Support email</li>
                    </ul>
                    <a href="#" style="display: block; padding: 12px; background-color: var(--brand-surface, #f5f5f5); color: var(--brand-text, #1a1a1a); text-decoration: none; border-radius: 6px; font-weight: bold;">Choisir</a>
                </div>
                <div style="background-color: var(--brand-background, #ffffff); padding: 40px 30px; border-radius: 8px; box-shadow: 0 10px 15px rgba(0,0,0,0.1); text-align: center; flex: 1; min-width: 280px; border: 2px solid var(--brand-primary); position: relative;">
                    <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background-color: var(--brand-primary); color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Populaire</div>
                    <h3 style="font-size: 24px; margin-bottom: 10px; color: var(--brand-text, #1a1a1a);">Pro</h3>
                    <div style="font-size: 48px; font-weight: bold; color: var(--brand-primary); margin-bottom: 20px;">29€<span style="font-size: 16px; color: var(--brand-muted, #6b7280); font-weight: normal;">/mois</span></div>
                    <ul style="list-style: none; padding: 0; margin: 0 0 30px 0; color: var(--brand-muted, #6b7280); text-align: left;">
                        <li style="margin-bottom: 10px;"><i class="fa fa-check" style="color: #10b981; margin-right: 10px;"></i>Projets illimités</li>
                        <li style="margin-bottom: 10px;"><i class="fa fa-check" style="color: #10b981; margin-right: 10px;"></i>Support prioritaire</li>
                        <li style="margin-bottom: 10px;"><i class="fa fa-check" style="color: #10b981; margin-right: 10px;"></i>Analytiques avancées</li>
                    </ul>
                    <a href="#" style="display: block; padding: 12px; background-color: var(--brand-primary); color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Choisir</a>
                </div>
            </div>
        </section>
    `);
    addBlock('b-cta', 'CTA Section', catMktg, 'fa-solid fa-bullseye', `
        <section style="padding: 60px 20px; background-color: var(--brand-primary); color: #fff; text-align: center;">
            <h2 style="font-size: 32px; font-weight: bold; margin-bottom: 16px;">Prêt à vous lancer ?</h2>
            <p style="font-size: 18px; margin-bottom: 30px; opacity: 0.9;">Rejoignez des milliers de clients satisfaits.</p>
            <a href="#" style="display: inline-block; padding: 14px 32px; background-color: var(--brand-background, #ffffff); color: var(--brand-primary); text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px;">S'inscrire maintenant</a>
        </section>
    `);
    addBlock('b-newsletter', 'Newsletter', catMktg, 'fa-solid fa-envelope-open-text', `
        <section style="padding: 40px 20px; background-color: var(--brand-background, #ffffff); text-align: center; border-top: 1px solid var(--brand-border, #e5e7eb); border-bottom: 1px solid var(--brand-border, #e5e7eb);">
            <h3 style="font-size: 24px; font-weight: bold; color: var(--brand-text, #1a1a1a); margin-bottom: 10px;">Abonnez-vous à notre Newsletter</h3>
            <p style="color: var(--brand-muted, #6b7280); margin-bottom: 20px;">Restez informé de nos dernières actualités et offres.</p>
            <form style="display: flex; max-width: 500px; margin: 0 auto; gap: 10px;">
                <input type="email" placeholder="Votre adresse email" style="flex: 1; padding: 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 16px;">
                <button type="submit" style="padding: 12px 24px; background-color: var(--brand-primary); color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 16px;">S'abonner</button>
            </form>
        </section>
    `);
    addBlock('b-footer-simple', 'Footer', catMktg, 'fa-solid fa-shoe-prints', `
        <footer style="background-color: var(--brand-text, #1a1a1a); color: #9ca3af; padding: 40px 20px; text-align: center;">
            <div style="margin-bottom: 20px; font-size: 24px; font-weight: bold; color: #fff;">LOGO</div>
            <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px;">
                <a href="#" style="color: #9ca3af; text-decoration: none;"><i class="fa-brands fa-facebook fa-2x"></i></a>
                <a href="#" style="color: #9ca3af; text-decoration: none;"><i class="fa-brands fa-twitter fa-2x"></i></a>
                <a href="#" style="color: #9ca3af; text-decoration: none;"><i class="fa-brands fa-linkedin fa-2x"></i></a>
            </div>
            <p style="margin: 0; font-size: 14px;">&copy; 2024 Votre Entreprise. Tous droits réservés.</p>
        </footer>
    `);
}
