export default function(editor, categories) {
    const icartColor = '#E35111';
    const category = categories.ICART;

    // NB : le header ICART (header-icart) est désormais dans blocks/headers.js
    // (reproduction fidèle de la maquette). Ce fichier ne gère que les blocs
    // spécifiques ICART ci-dessous.

    // ICART Horizontal Menu
    editor.BlockManager.add('horizontal-menu-icart', {
        label: 'Menu Horizontal ICART',
        category: category,
        content: `
            <div class="hm-icart-wrapper">
                <div class="hm-icart-band-top"></div>
                <nav class="hm-icart-nav-bar">
                    <div class="hm-icart-scroll-container">
                        <ul class="hm-icart-nav-list">
                            <li><a href="#ecole" class="hm-icart-nav-item">L'école</a></li>
                            <li><a href="#programmes" class="hm-icart-nav-item">Programmes</a></li>
                            <li><a href="#debouches" class="hm-icart-nav-item">Débouchés</a></li>
                            <li><a href="#projets" class="hm-icart-nav-item">Projets Étudiants</a></li>
                            <li><a href="#partenariats" class="hm-icart-nav-item">Partenariats</a></li>
                            <li><a href="#campus" class="hm-icart-nav-item">Campus</a></li>
                            <li><a href="#admission" class="hm-icart-nav-item">Admission</a></li>
                        </ul>
                    </div>
                </nav>
            </div>
            <style>
                .hm-icart-wrapper {
                    width: 100%;
                    position: relative;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                .hm-icart-band-top {
                    width: 100%;
                    height: 5px;
                    background-color: ${icartColor};
                }
                .hm-icart-nav-bar {
                    background-color: var(--brand-background, #ffffff);
                    border-bottom: 1px solid #eaeaea;
                    position: sticky;
                    top: 0;
                    z-index: 999;
                }
                .hm-icart-scroll-container {
                    width: 100%;
                    overflow-x: auto;
                    padding: 15px 20px;
                    scrollbar-width: none;
                }
                .hm-icart-scroll-container::-webkit-scrollbar {
                    display: none;
                }
                .hm-icart-nav-list {
                    display: flex;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    gap: 30px;
                }
                .hm-icart-nav-item {
                    color: #000;
                    text-decoration: none;
                    font-size: 13px;
                    font-weight: 700;
                    text-transform: uppercase;
                    transition: color 0.3s;
                    white-space: nowrap;
                }
                .hm-icart-nav-item:hover {
                    color: ${icartColor};
                }
                @media (max-width: 768px) {
                    .hm-icart-nav-list { gap: 20px; }
                    .hm-icart-nav-item { font-size: 11px; }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });

    // ICART Bande Orange (Duplicate of Bande Rose)
    editor.BlockManager.add('bande-orange-icart', {
        label: 'Bande Orange ICART',
        category: category,
        content: `
            <section class="bande-orange-icart">
                <div class="bande-orange-content">
                    <p class="bande-orange-text">Management culturel & Marché de l'art</p>
                </div>
            </section>
            <style>
                .bande-orange-icart {
                    background-color: ${icartColor};
                    width: 100%;
                    min-height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                .bande-orange-icart .bande-orange-text {
                    color: #fff;
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    margin: 0;
                }
                @media (max-width: 768px) {
                    .bande-orange-icart .bande-orange-text { font-size: 16px; }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });

    // ICART Programme List
    editor.BlockManager.add('programme-list-icart', {
        label: 'Programme ICART',
        category: category,
        content: `
            <section class="programme-icart">
                <div class="programme-container">
                    <h3 class="programme-title">Au programme :</h3>
                    <ul class="programme-list">
                        <li><strong>Atelier d'immersion</strong> dans l'univers de la médiation culturelle</li>
                        <li><strong>Masterclass</strong> : Le marché de l'art à l'ère du digital</li>
                        <li><strong>Rencontre avec nos alumni</strong> en poste dans les plus grandes institutions</li>
                        <li><strong>Visite guidée</strong> de nos espaces d'exposition</li>
                        <li><strong>Session Q&A</strong> sur les admissions et le financement</li>
                    </ul>
                </div>
            </section>
            <style>
                .programme-icart {
                    padding: 40px 0;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                    background-color: var(--brand-background, #ffffff);
                }
                .programme-icart .programme-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 0 20px;
                }
                .programme-icart .programme-title {
                    font-size: 18px;
                    font-weight: 700;
                    margin-bottom: 24px;
                    color: #000;
                }
                .programme-icart .programme-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .programme-icart .programme-list li {
                    position: relative;
                    padding-left: 35px;
                    margin-bottom: 20px;
                    font-size: 14px;
                    line-height: 1.5;
                    color: var(--brand-text, #1a1a1a);
                }
                .programme-icart .programme-list li::before {
                    content: '✓';
                    position: absolute;
                    left: 0;
                    top: 0;
                    font-weight: bold;
                    font-size: 16px;
                    color: ${icartColor};
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });

    // ICART 3 Reasons (Match Brassart style)
    editor.BlockManager.add('reasons-icart', {
        label: '3 Bonnes Raisons ICART',
        category: category,
        content: `
            <section class="trois-raisons-icart">
                <div class="tr-grid">
                    <div class="tr-photo">
                        <img src="https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=800&q=80" alt="Étudiants ICART" class="tr-photo-img">
                    </div>
                    <div class="tr-content">
                        <div class="tr-header">
                            <h2 class="tr-title">3 BONNES RAISONS<br>DE NOUS REJOINDRE</h2>
                            <div class="tr-title-line">
                                <div class="tr-line"></div>
                                <span class="tr-b-logo">I</span>
                            </div>
                        </div>
                        <ul class="tr-list">
                            <li class="tr-item">
                                <div class="tr-icon">🎭</div>
                                <div class="tr-text">
                                    <span class="tr-highlight">Expertise</span> Marché de l'art
                                    <span class="tr-sub">Une référence depuis 1963 dans le management culturel.</span>
                                </div>
                            </li>
                            <li class="tr-item">
                                <div class="tr-icon">🏢</div>
                                <div class="tr-text">
                                    <span class="tr-highlight">Immersion</span> professionnelle
                                    <span class="tr-sub">Un réseau unique de 1000 entreprises partenaires.</span>
                                </div>
                            </li>
                            <li class="tr-item">
                                <div class="tr-icon">🌍</div>
                                <div class="tr-text">
                                    <span class="tr-highlight">Rayonnement</span> international
                                    <span class="tr-sub">Des opportunités partout dans le monde.</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
            <style>
                .trois-raisons-icart { font-family: var(--brand-font, 'Inter', sans-serif); overflow: hidden; }
                .tr-grid { display: grid; grid-template-columns: 1fr 1fr; }
                .tr-photo { position: relative; min-height: 400px; }
                .tr-photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
                .tr-content { background-color: ${icartColor}; padding: 50px 40px; display: flex; flex-direction: column; justify-content: center; }
                .tr-header { margin-bottom: 32px; }
                .tr-title { font-size: 24px; font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 12px; text-transform: uppercase; }
                .tr-title-line { display: flex; align-items: center; gap: 10px; }
                .tr-line { flex: 1; max-width: 80px; height: 2px; background: var(--brand-background, #ffffff); }
                .tr-b-logo { font-size: 18px; font-weight: 900; color: #fff; }
                .tr-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 24px; }
                .tr-item { display: flex; align-items: flex-start; gap: 14px; }
                .tr-icon { font-size: 24px; flex-shrink: 0; background: rgba(255,255,255,0.2); border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
                .tr-text { display: flex; flex-direction: column; gap: 4px; color: #fff; font-size: 13px; line-height: 1.4; }
                .tr-highlight { font-weight: 800; background-color: var(--brand-background, #ffffff); color: #000; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
                @media (max-width: 768px) { .tr-grid { grid-template-columns: 1fr; } .tr-photo { min-height: 280px; } }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });

    // ICART Chiffres Clés
    editor.BlockManager.add('chiffres-cles-icart', {
        label: 'Chiffres Clés ICART',
        category: category,
        content: `
            <section class="keyfig-icart">
                <div class="keyfig-card">
                    <div class="keyfig-stats-grid">
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">60</div>
                            <div class="keyfig-label">ans d'expertise</div>
                        </div>
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">2 500</div>
                            <div class="keyfig-label">étudiants</div>
                        </div>
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">4</div>
                            <div class="keyfig-label">campus</div>
                        </div>
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">10 000</div>
                            <div class="keyfig-label">diplômés</div>
                        </div>
                    </div>
                    <div class="keyfig-cta-wrap">
                        <a href="#" class="keyfig-cta">Télécharger la brochure</a>
                    </div>
                </div>
            </section>
            <style>
                .keyfig-icart { padding: 32px 20px; background-color: var(--brand-background, #ffffff); font-family: var(--brand-font, 'Inter', sans-serif); }
                .keyfig-card { max-width: 920px; margin: 0 auto; padding: 28px 32px; background-color: #f3f3f3; display: flex; align-items: center; justify-content: space-between; gap: 32px; }
                .keyfig-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px 34px; flex: 1; }
                .keyfig-number { color: ${icartColor}; font-size: 34px; font-weight: 700; }
                .keyfig-label { display: inline-block; background-color: ${icartColor}; color: #fff; font-size: 11px; font-weight: 600; padding: 5px 8px; }
                .keyfig-cta { display: inline-flex; align-items: center; justify-content: center; min-width: 220px; padding: 14px 24px; background-color: ${icartColor}; color: #fff; text-decoration: none; font-weight: 700; transition: background 0.2s; }
                .keyfig-cta:hover { background-color: #c5460e; }
                @media (max-width: 768px) { .keyfig-card { flex-direction: column; } }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });

    // Campus Slide Helper
    function makeCampusSlide(badgeText, addressText, imageSrc, imageAlt, overlayText) {
        return {
            tagName: 'div', classes: ['ccp-slide'],
            components: [{
                tagName: 'div', classes: ['ccp-card'],
                components: [
                    { tagName: 'div', classes: ['ccp-card-header'], components: [{ type: 'text', tagName: 'span', classes: ['ccp-badge'], components: badgeText }, { tagName: 'hr', classes: ['ccp-line'] }] },
                    { type: 'text', tagName: 'div', classes: ['ccp-address'], components: addressText },
                    { tagName: 'div', classes: ['ccp-media'], components: [{ type: 'image', attributes: { src: imageSrc, alt: imageAlt }, style: { width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' } }, { type: 'text', tagName: 'span', classes: ['ccp-overlay-label'], components: overlayText }] }
                ]
            }]
        };
    }

    // ICART Carrousel Campus
    editor.BlockManager.add('carrousel-campus-icart', {
        label: 'Campus ICART',
        category: category,
        content: {
            type: 'carrousel-campus-component',
            styles: `
                .ccp-section { padding: 60px 20px; background: var(--brand-surface, #f5f5f5); font-family: var(--brand-font, 'Inter', sans-serif); }
                .ccp-container { max-width: 620px; margin: auto; overflow: hidden; }
                .ccp-track { display: flex; transition: transform 0.45s; }
                .ccp-slide { flex: 0 0 100%; }
                .ccp-card { background: #f0f0f0; padding: 20px 20px 0 20px; }
                .ccp-card-header { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
                .ccp-badge { background: ${icartColor}; color: #fff; font-size: 13px; font-weight: 700; padding: 4px 12px; }
                .ccp-line { flex: 1; border: none; border-top: 1px solid #999; }
                .ccp-address { font-size: 13px; color: var(--brand-text, #1a1a1a); margin-bottom: 14px; }
                .ccp-media { position: relative; width: 100%; height: 280px; overflow: hidden; }
                .ccp-overlay-label { position: absolute; bottom: 16px; left: 16px; color: #fff; font-size: 28px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
                .ccp-nav { text-align: center; margin-top: 24px; }
                .ccp-prev, .ccp-next { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #555; background: var(--brand-background, #ffffff); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; margin: 0 5px; }
            `,
            components: [{
                tagName: 'section', classes: ['ccp-section'],
                components: [
                    {
                        tagName: 'div', classes: ['ccp-container'],
                        components: [{
                            tagName: 'div', classes: ['ccp-track'],
                            components: [
                                makeCampusSlide('Paris', '61 rue de la Pompe, 75116 Paris', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600', 'Campus Paris', 'Paris'),
                                makeCampusSlide('Bordeaux', '8 rue de la Seiglière, 33800 Bordeaux', 'https://images.unsplash.com/photo-1595131838595-3154b9f4450b?w=600', 'Campus Bordeaux', 'Bordeaux'),
                                makeCampusSlide('Lyon', '47 rue Sergent Michel Berthet, 69009 Lyon', 'https://images.unsplash.com/photo-1509030464152-c23898ad172a?w=600', 'Campus Lyon', 'Lyon')
                            ]
                        }]
                    },
                    { tagName: 'div', classes: ['ccp-nav'], components: [{ type: 'text', tagName: 'button', classes: ['ccp-prev'], components: '&#8249;' }, { type: 'text', tagName: 'button', classes: ['ccp-next'], components: '&#8250;' }] }
                ]
            }]
        }
    });

    // Testimonial Slide Helper
    function makeTestimonialSlide(quoteText, imageSrc, imageAlt, logoSrc, nameText, roleText) {
        return {
            tagName: 'div', classes: ['ctm-slide'],
            components: [
                { tagName: 'div', classes: ['ctm-media'], components: [{ type: 'image', attributes: { src: imageSrc, alt: imageAlt }, style: { width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' } }] },
                {
                    tagName: 'div', classes: ['ctm-content'],
                    components: [
                        { type: 'text', tagName: 'blockquote', classes: ['ctm-quote'], components: quoteText },
                        {
                            tagName: 'div', classes: ['ctm-author'],
                            components: [
                                { type: 'image', attributes: { src: logoSrc }, classes: ['ctm-logo'] },
                                { tagName: 'div', classes: ['ctm-author-info'], components: [{ type: 'text', tagName: 'span', classes: ['ctm-name'], components: nameText }, { type: 'text', tagName: 'span', classes: ['ctm-role'], components: roleText }] }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    // ICART Carrousel Témoignages
    editor.BlockManager.add('carrousel-temoignages-icart', {
        label: 'Témoignages ICART',
        category: category,
        content: {
            type: 'carrousel-temoignages-component',
            styles: `
                .ctm-section { padding: 60px 20px; background: var(--brand-background, #ffffff); font-family: var(--brand-font, 'Inter', sans-serif); }
                .ctm-header { max-width: 900px; margin: 0 auto 32px; }
                .ctm-title-bloc { font-size: 28px; font-weight: 700; text-transform: uppercase; }
                .ctm-container { max-width: 900px; margin: auto; overflow: hidden; }
                .ctm-track { display: flex; transition: transform 0.45s; }
                .ctm-slide { flex: 0 0 100%; display: flex; }
                .ctm-media { flex: 0 0 40%; height: 350px; }
                .ctm-content { flex: 1; padding: 36px 40px; border: 2px solid ${icartColor}; display: flex; flex-direction: column; justify-content: space-between; }
                .ctm-quote { font-size: 15px; line-height: 1.65; font-style: italic; }
                .ctm-author { display: flex; align-items: center; gap: 16px; }
                .ctm-logo { width: 64px; height: 64px; object-fit: contain; }
                .ctm-name { font-weight: 700; font-size: 13px; }
                .ctm-role { font-size: 12px; color: var(--brand-muted, #6b7280); }
                .ctm-nav { text-align: center; margin-top: 24px; }
                .ctm-prev, .ctm-next { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #555; background: var(--brand-background, #ffffff); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; margin: 0 5px; }
                @media (max-width: 640px) { .ctm-slide { flex-direction: column; } .ctm-media { flex: none; width: 100%; height: 200px; } }
            `,
            components: [{
                tagName: 'section', classes: ['ctm-section'],
                components: [
                    { tagName: 'div', classes: ['ctm-header'], components: [{ type: 'text', tagName: 'h2', classes: ['ctm-title-bloc'], components: 'Témoignages' }] },
                    {
                        tagName: 'div', classes: ['ctm-container'],
                        components: [{
                            tagName: 'div', classes: ['ctm-track'],
                            components: [
                                makeTestimonialSlide('"Une formation d\'excellence qui m\'a ouvert les portes des plus grandes galeries d\'art."', 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=600', 'Sophie Martin', 'https://via.placeholder.com/64', 'Sophie Martin', 'Art Manager - Promo 2021'),
                                makeTestimonialSlide('"Le réseau de l\'ICART est un véritable tremplin pour une carrière dans la culture."', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600', 'Lucas Bernard', 'https://via.placeholder.com/64', 'Lucas Bernard', 'Directeur de festival - Promo 2018')
                            ]
                        }]
                    },
                    { tagName: 'div', classes: ['ctm-nav'], components: [{ type: 'text', tagName: 'button', classes: ['ctm-prev'], components: '&#8249;' }, { type: 'text', tagName: 'button', classes: ['ctm-next'], components: '&#8250;' }] }
                ]
            }]
        }
    });

    // NB : le footer ICART (footer-icart) est désormais dans blocks/footers.js
    // (reproduction fidèle de la maquette : fond blanc, logo noir).
}
