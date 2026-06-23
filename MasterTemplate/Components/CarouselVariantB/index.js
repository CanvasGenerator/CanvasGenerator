export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ─────────────────────────────────────────────
       Helper : crée un objet card GrapesJS éditable
    ───────────────────────────────────────────── */
    function makeCard(imgSrc, title, jobs) {
        return {
            tagName: 'div',
            classes: ['mcb-card'],
            components: [
                /* ── Image éditable ── */
                {
                    type: 'image',
                    editable: true,
                    selectable: true,
                    attributes: { src: imgSrc, alt: title },
                    classes: ['mcb-img']
                },
                /* ── Zone texte ── */
                {
                    tagName: 'div',
                    classes: ['mcb-info'],
                    components: [
                        /* Titre éditable */
                        {
                            type: 'text',
                            tagName: 'div',
                            classes: ['mcb-title'],
                            editable: true,
                            selectable: true,
                            components: title
                        },
                        /* Liste métiers éditable */
                        {
                            type: 'text',
                            tagName: 'ul',
                            classes: ['mcb-jobs'],
                            editable: true,
                            selectable: true,
                            components: jobs.map(j => ({
                                tagName: 'li',
                                components: j
                            }))
                        }
                    ]
                }
            ]
        };
    }

    /* ─────────────────────────────────────────────
       Enregistrement du bloc
    ───────────────────────────────────────────── */
    editor.BlockManager.add('master-carousel-variant-b', {
        label: 'Carrousel Variante B (photo + métiers)',
        category: cat,
        attributes: { class: 'fa fa-picture-o' },

        content: {
            type: 'mcb-component',

            styles: `
                /* ── Wrapper général ── */
                .mcb-section {
                    padding: 40px 20px;
                    font-family: Arial, sans-serif;
                    background: #fff;
                }
                /* Cadre extérieur avec couleur de marque */
                .mcb-frame {
                    max-width: 860px;
                    margin: 0 auto;
                    border: 3px solid var(--brand-primary, #374151);
                    padding: 6px;
                    box-sizing: border-box;
                }
                /* Viewport masque le débordement */
                .mcb-viewport {
                    overflow: hidden;
                }
                /* Track : flex horizontale, transition smooth */
                .mcb-track {
                    display: flex;
                    transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                /* ── Card ── */
                /* Desktop : 3 cards visibles */
                .mcb-card {
                    flex: 0 0 calc(100% / 3);
                    box-sizing: border-box;
                    border: 1px solid var(--brand-primary, #374151);
                    display: flex;
                    flex-direction: column;
                    background: #fff;
                }
                /* Image en haut */
                .mcb-img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    display: block;
                }
                /* Zone texte bas */
                .mcb-info {
                    padding: 14px 16px;
                    flex: 1;
                    background: #fff;
                }
                /* Titre programme */
                .mcb-title {
                    font-size: 12.5px;
                    font-weight: 800;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    margin-bottom: 10px;
                    line-height: 1.35;
                }
                /* Liste de métiers */
                .mcb-jobs {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    font-size: 12px;
                    color: #444;
                    line-height: 1.8;
                }
                .mcb-jobs li::before {
                    content: '• ';
                    color: var(--brand-primary, #374151);
                    font-weight: 700;
                }

                /* ── Navigation ── */
                .mcb-nav {
                    text-align: center;
                    margin-top: 18px;
                }
                .mcb-prev,
                .mcb-next {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid #555;
                    background: #fff;
                    cursor: pointer;
                    font-size: 20px;
                    line-height: 1;
                    margin: 0 6px;
                    color: #333;
                    transition: background 0.2s, color 0.2s;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .mcb-prev:hover,
                .mcb-next:hover {
                    background: #333;
                    color: #e5e7eb;
                }

                /* ── Responsive ── */
                /* Tablet : 2 cards */
                @media (max-width: 1024px) and (min-width: 581px) {
                    .mcb-card { flex: 0 0 50%; }
                }
                /* Mobile : 1 card */
                @media (max-width: 580px) {
                    .mcb-card { flex: 0 0 100%; }
                    .mcb-img { height: 220px; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['mcb-section'],
                components: [{
                    tagName: 'div',
                    classes: ['mcb-frame'],
                    components: [
                        /* ── Viewport + Track ── */
                        {
                            tagName: 'div',
                            classes: ['mcb-viewport'],
                            components: [{
                                tagName: 'div',
                                classes: ['mcb-track'],
                                components: [
                                    makeCard(
                                        'https://placehold.co/380x200/d1d5db/374151?text=Photo+programme',
                                        'INFOGRAPHIE ÉCO-CONCEPTION',
                                        [
                                            'Infographiste éco-concepteur',
                                            'Designer graphique',
                                            'Typographe',
                                            'Web Designer',
                                            'Iconographe',
                                            'Maquettiste',
                                            'Opérateur PAO'
                                        ]
                                    ),
                                    makeCard(
                                        'https://placehold.co/380x200/9ca3af/374151?text=Photo+programme',
                                        'DIRECTION ARTISTIQUE',
                                        [
                                            'Directeur Artistique',
                                            'Brand Designer',
                                            'Directeur de Création',
                                            'Motion Designer',
                                            'Designer Packaging',
                                            'Designer Digital',
                                            'UX Designer'
                                        ]
                                    ),
                                    makeCard(
                                        'https://placehold.co/380x200/6b7280/e5e7eb?text=Photo+programme',
                                        'ANIMATION 3D & IMMERSION',
                                        [
                                            'Animateur 3D',
                                            'Character designer',
                                            'Concepteur 3D - VFX',
                                            'Artiste VFX',
                                            'Rendering artist',
                                            'Modéleur 3D',
                                            'Lighting artist',
                                            'Rigger'
                                        ]
                                    ),
                                    makeCard(
                                        'https://placehold.co/380x200/4b5563/e5e7eb?text=Photo+programme',
                                        'DESIGN GRAPHIQUE',
                                        [
                                            'Graphic Designer',
                                            'Brand Designer',
                                            'Art Director',
                                            'Motion Designer',
                                            'UI Designer',
                                            'Illustrateur'
                                        ]
                                    )
                                ]
                            }]
                        },

                        /* ── Navigation prev / next ── */
                        {
                            tagName: 'div',
                            classes: ['mcb-nav'],
                            components: [
                                {
                                    tagName: 'button',
                                    classes: ['mcb-prev'],
                                    selectable: true,
                                    components: '&#8249;'
                                },
                                {
                                    tagName: 'button',
                                    classes: ['mcb-next'],
                                    selectable: true,
                                    components: '&#8250;'
                                }
                            ]
                        }
                    ]
                }]
            }]
        }
    });

    /* ─────────────────────────────────────────────
       DomComponent : script de slider
    ───────────────────────────────────────────── */
    editor.DomComponents.addType('mcb-component', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el    = this;
                    var track = el.querySelector('.mcb-track');
                    var next  = el.querySelector('.mcb-next');
                    var prev  = el.querySelector('.mcb-prev');
                    var idx   = 0;

                    function getVisible() {
                        var w = window.innerWidth;
                        if (w <= 580)  return 1;
                        if (w <= 1024) return 2;
                        return 3;
                    }

                    function update() {
                        var vis     = getVisible();
                        var max     = track.children.length - vis;
                        var cardW   = track.firstElementChild
                                        ? track.firstElementChild.offsetWidth
                                        : 0;
                        idx = Math.min(Math.max(idx, 0), max);
                        track.style.transform = 'translateX(-' + (idx * cardW) + 'px)';
                    }

                    if (next) {
                        next.addEventListener('click', function() {
                            var vis = getVisible();
                            idx = idx < track.children.length - vis ? idx + 1 : 0;
                            update();
                        });
                    }
                    if (prev) {
                        prev.addEventListener('click', function() {
                            var vis = getVisible();
                            idx = idx > 0 ? idx - 1 : track.children.length - vis;
                            update();
                        });
                    }

                    window.addEventListener('resize', update);
                    update();
                }
            }
        }
    });
}
