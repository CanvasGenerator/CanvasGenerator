export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ── Helper : crée une card Programme D éditable ── */
    function makeCard(imgSrc, title, tags, desc) {
        return {
            tagName: 'div',
            classes: ['mcd-card'],
            components: [
                /* Image éditable */
                {
                    type: 'image',
                    editable: true,
                    selectable: true,
                    attributes: { src: imgSrc, alt: title },
                    classes: ['mcd-img']
                },
                /* Corps de la card (fond beige) */
                {
                    tagName: 'div',
                    classes: ['mcd-body'],
                    components: [
                        /* Titre éditable */
                        {
                            type: 'text',
                            tagName: 'div',
                            classes: ['mcd-title'],
                            editable: true,
                            selectable: true,
                            components: title
                        },
                        /* Rangée de tags */
                        {
                            tagName: 'div',
                            classes: ['mcd-tags'],
                            components: tags.map(t => ({
                                type: 'text',
                                tagName: 'span',
                                classes: ['mcd-tag'],
                                editable: true,
                                selectable: true,
                                components: t
                            }))
                        },
                        /* Description éditable */
                        {
                            type: 'text',
                            tagName: 'p',
                            classes: ['mcd-desc'],
                            editable: true,
                            selectable: true,
                            components: desc
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel-variant-d', {
        label: 'Carrousel Variante D (programme + tags)',
        category: cat,
        attributes: { class: 'fa fa-tags' },

        content: {
            type: 'mcd-component',

            styles: `
                .mcd-section {
                    padding: 20px 20px 0;
                    background: transparent;
                    font-family: Arial, sans-serif;
                }
                /* Wrapper gris très clair — uniquement autour des cartes */
                .mcd-colored-zone {
                    background: #f3f4f6;
                    width: 100%;
                    padding: 20px 20px 20px;
                    box-sizing: border-box;
                }
                .mcd-viewport {
                    overflow: hidden;
                    width: 100%;
                }
                .mcd-track {
                    display: flex;
                    transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                /* ── Card ── */
                .mcd-card {
                    flex: 0 0 calc(100% / 3);
                    max-width: calc(100% / 3);
                    box-sizing: border-box;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                }
                .mcd-img {
                    width: 100%;
                    height: 195px;
                    object-fit: cover;
                    display: block;
                }
                /* Corps beige/crème */
                .mcd-body {
                    flex: 1;
                    background: #f5ede0;
                    padding: 14px 16px 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .mcd-title {
                    font-size: 13px;
                    font-weight: 800;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    line-height: 1.35;
                }
                /* Rangée de badges */
                .mcd-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                .mcd-tag {
                    display: inline-block;
                    background: #1f2937;
                    color: #e5e7eb;
                    font-size: 10.5px;
                    font-weight: 600;
                    padding: 3px 8px;
                    border-radius: 2px;
                    white-space: nowrap;
                    cursor: text;
                }
                .mcd-desc {
                    font-size: 12px;
                    color: #333;
                    line-height: 1.6;
                    margin: 0;
                }

                /* ── Navigation ── */
                .mcd-nav {
                    text-align: center;
                    margin-top: 20px;
                }
                .mcd-prev,
                .mcd-next {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid #555;
                    background: #fff;
                    cursor: pointer;
                    font-size: 20px;
                    color: #333;
                    margin: 0 6px;
                    transition: background 0.2s, color 0.2s;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .mcd-prev:hover,
                .mcd-next:hover {
                    background: #fff;
                    color: var(--brand-primary, #374151);
                    border-color: #fff;
                }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .mcd-card { flex: 0 0 100%; padding: 0; }
                    .mcd-img { height: 220px; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['mcd-section'],
                components: [
                    // Zone colorée — uniquement autour des cartes
                    {
                        tagName: 'div',
                        classes: ['mcd-colored-zone'],
                        components: [{
                            tagName: 'div',
                            classes: ['mcd-viewport'],
                            components: [{
                                tagName: 'div',
                                classes: ['mcd-track'],
                                components: [
                                    makeCard('https://placehold.co/380x195/c9c9c9/333?text=Programme+1', 'COMMUNICATION &amp; MARKETING STRATÉGIQUE', ['4 campus disponibles', 'Anglais', 'Alternance possible', 'Double diplôme international'], 'Devenez un manager complet en vous appuyant sur une double compétence Communication et Marketing.'),
                                    makeCard('https://placehold.co/380x195/a0a0c0/111?text=Programme+2', 'COMMUNICATION &amp; MANAGEMENT ÉVÉNEMENTIEL', ['7 campus disponibles', 'Alternance possible'], 'Devenez un manager complet pour une communication stratégique, riche de sens.'),
                                    makeCard('https://placehold.co/380x195/b0b8c0/333?text=Programme+3', 'CRÉATION &amp; STRATÉGIES PUBLICITAIRES', ['7 campus disponibles', 'Alternance possible', 'Double diplôme international'], 'Devenez un créatif, porteur de sens et d\'idées, maîtrisant les dynamiques d\'un univers publicitaire en révolution.'),
                                    makeCard('https://placehold.co/380x195/c0b8a0/333?text=Programme+4', 'RELATIONS PUBLIQUES &amp; INFLUENCE', ['5 campus disponibles', 'Alternance possible'], 'Maîtrisez les techniques de relations presse, lobbying et communication d\'influence.')
                                ]
                            }]
                        }]
                    },

                    // Boutons en dehors de la zone colorée
                    {
                        tagName: 'div',
                        classes: ['mcd-nav'],
                        components: [
                            { tagName: 'button', classes: ['mcd-prev'], selectable: true, components: '&#8249;' },
                            { tagName: 'button', classes: ['mcd-next'], selectable: true, components: '&#8250;' }
                        ]
                    }
                ]
            }]
        }
    });

    /* ── Script slider ── */
    editor.DomComponents.addType('mcd-component', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el    = this;
                    var track = el.querySelector('.mcd-track');
                    var next  = el.querySelector('.mcd-next');
                    var prev  = el.querySelector('.mcd-prev');
                    var idx   = 0;

                    function getVisible() {
                        return window.innerWidth <= 768 ? 1 : 3;
                    }

                    function update() {
                        if (!track || !track.firstElementChild) return;
                        var vis   = getVisible();
                        var max   = track.children.length - vis;
                        var cardW = track.firstElementChild.offsetWidth;
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
