export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ── Helper : crée un item de galerie éditable ── */
    function makeItem(imgSrc, caption) {
        return {
            tagName: 'div',
            classes: ['mcc-item'],
            components: [
                {
                    type: 'image',
                    editable: true,
                    selectable: true,
                    attributes: { src: imgSrc, alt: caption },
                    classes: ['mcc-img']
                },
                {
                    type: 'text',
                    tagName: 'p',
                    classes: ['mcc-caption'],
                    editable: true,
                    selectable: true,
                    components: caption
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel-variant-c', {
        label: 'Carrousel Variante C (galerie étudiants)',
        category: cat,
        attributes: { class: 'fa fa-th-large' },

        content: {
            type: 'mcc-component',

            styles: `
                /* ── Conteneur ── */
                .mcc-section {
                    padding: 32px 24px;
                    background: #fff;
                    font-family: Arial, sans-serif;
                }
                .mcc-wrapper {
                    max-width: 1100px;
                    margin: 0 auto;
                    border: 1px solid #ddd;
                    padding: 20px 20px 24px;
                    box-sizing: border-box;
                }

                /* ── Titre ── */
                .mcc-title {
                    font-size: 14px;
                    font-weight: 800;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    text-align: center;
                    margin: 0 0 18px;
                }

                /* ── DESKTOP : grille 3×2 statique ── */
                .mcc-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                .mcc-item {
                    display: flex;
                    flex-direction: column;
                }
                .mcc-img {
                    width: 100%;
                    height: 140px;
                    object-fit: cover;
                    display: block;
                }
                .mcc-caption {
                    font-size: 10.5px;
                    font-weight: 700;
                    color: #222;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    line-height: 1.35;
                    margin: 6px 0 0;
                }

                /* ── Navigation mobile (cachée sur desktop) ── */
                .mcc-nav {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    margin-top: 16px;
                }
                .mcc-nav-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 22px;
                    color: #333;
                    padding: 4px 8px;
                    line-height: 1;
                }
                .mcc-counter {
                    font-size: 13px;
                    font-weight: 600;
                    color: #555;
                    min-width: 36px;
                    text-align: center;
                }

                /* ── MOBILE : carrousel 1 item ── */
                @media (max-width: 768px) {
                    .mcc-wrapper { padding: 16px 16px 20px; }
                    .mcc-title { text-align: left; font-size: 15px; }

                    /* Passe en carousel */
                    .mcc-grid {
                        display: block;
                        overflow: hidden;
                    }
                    .mcc-item {
                        display: none;
                    }
                    .mcc-item.mcc-active {
                        display: flex;
                    }
                    .mcc-img { height: 240px; }
                    .mcc-caption { font-size: 13px; margin-top: 10px; }

                    /* Affiche la nav */
                    .mcc-nav { display: flex; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['mcc-section'],
                components: [{
                    tagName: 'div',
                    classes: ['mcc-wrapper'],
                    id: 'mcc-wrapper',
                    components: [

                        /* ── Titre éditable ── */
                        {
                            type: 'text',
                            tagName: 'h2',
                            classes: ['mcc-title'],
                            editable: true,
                            selectable: true,
                            components: 'GALERIE DE NOS ÉTUDIANTS'
                        },

                        /* ── Grille de 6 items ── */
                        {
                            tagName: 'div',
                            classes: ['mcc-grid'],
                            components: [
                                makeItem(
                                    'https://placehold.co/360x140/c9c9c9/333?text=Projet+1',
                                    'RÉNOVATION D\'UNE MAISON DE 1930 ET DE SON EXTÉRIEUR'
                                ),
                                makeItem(
                                    'https://placehold.co/360x140/b0b0b0/333?text=Projet+2',
                                    'RESTRUCTURATION D\'UN HABITAT PATRIMONIAL'
                                ),
                                makeItem(
                                    'https://placehold.co/360x140/d8c9a0/333?text=Projet+3',
                                    'UNE MAISON ENTRE ANCIEN ET CONTEMPORAIN'
                                ),
                                makeItem(
                                    'https://placehold.co/360x140/a0b8c0/333?text=Projet+4',
                                    'CRÉATION D\'UN COFFEE SHOP / ESPACE DE COWORKING'
                                ),
                                makeItem(
                                    'https://placehold.co/360x140/c0b8a0/333?text=Projet+5',
                                    'RÉNOVATION D\'UNE MAISON DES ANNÉES 70'
                                ),
                                makeItem(
                                    'https://placehold.co/360x140/a8a8b8/333?text=Projet+6',
                                    'AMÉNAGEMENT ET AGENCEMENT D\'UN APPARTEMENT DE 117M²'
                                )
                            ]
                        },

                        /* ── Navigation (mobile only) ── */
                        {
                            tagName: 'div',
                            classes: ['mcc-nav'],
                            components: [
                                { tagName: 'button', classes: ['mcc-nav-btn', 'mcc-prev'], components: '&#8592;' },
                                { tagName: 'span',   classes: ['mcc-counter'], components: '1/6' },
                                { tagName: 'button', classes: ['mcc-nav-btn', 'mcc-next'], components: '&#8594;' }
                            ]
                        }

                    ]
                }]
            }]
        }
    });

    /* ── Script : carousel mobile uniquement ── */
    editor.DomComponents.addType('mcc-component', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var wrapper = document.getElementById('mcc-wrapper');
                    if (!wrapper) return;

                    var items   = Array.from(wrapper.querySelectorAll('.mcc-item'));
                    var prev    = wrapper.querySelector('.mcc-prev');
                    var next    = wrapper.querySelector('.mcc-next');
                    var counter = wrapper.querySelector('.mcc-counter');
                    var idx     = 0;
                    var total   = items.length;

                    function isMobile() { return window.innerWidth <= 768; }

                    function updateCounter() {
                        if (counter) counter.textContent = (idx + 1) + '/' + total;
                    }

                    function show(i) {
                        idx = (i + total) % total;
                        items.forEach(function(item, n) {
                            item.classList.toggle('mcc-active', n === idx);
                        });
                        updateCounter();
                    }

                    function init() {
                        if (isMobile()) {
                            show(idx);
                        } else {
                            /* Desktop : tous visibles, pas de carousel */
                            items.forEach(function(item) {
                                item.classList.remove('mcc-active');
                            });
                        }
                    }

                    if (next) next.addEventListener('click', function() { if (isMobile()) show(idx + 1); });
                    if (prev) prev.addEventListener('click', function() { if (isMobile()) show(idx - 1); });

                    window.addEventListener('resize', init);
                    init();
                }
            }
        }
    });
}
