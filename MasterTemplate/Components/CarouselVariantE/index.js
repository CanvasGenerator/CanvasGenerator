export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ── Helper : card Variante E (header coloré + texte + logos) ── */
    function makeCard(headerText, bodyText, logos) {
        const logoComponents = logos.map(logo => ({
            type: 'image',
            editable: true,
            selectable: true,
            attributes: { src: logo.src, alt: logo.alt },
            classes: ['mce-logo']
        }));

        return {
            tagName: 'div',
            classes: ['mce-card'],
            components: [
                /* Header coloré éditable */
                {
                    type: 'text',
                    tagName: 'div',
                    classes: ['mce-card-header'],
                    editable: true,
                    selectable: true,
                    components: headerText
                },
                /* Corps : texte + logos */
                {
                    tagName: 'div',
                    classes: ['mce-card-body'],
                    components: [
                        {
                            type: 'text',
                            tagName: 'div',
                            classes: ['mce-card-text'],
                            editable: true,
                            selectable: true,
                            components: bodyText
                        },
                        {
                            tagName: 'div',
                            classes: ['mce-logos'],
                            components: logoComponents
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel-variant-e', {
        label: 'Carrousel Variante E (reconnaissance + logos)',
        category: cat,
        attributes: { class: 'fa fa-certificate' },

        content: {
            type: 'mce-component',

            styles: `
                .mce-section {
                    padding: 36px 20px;
                    background: var(--brand-carousel, var(--brand-primary, #374151));
                    font-family: Arial, sans-serif;
                }
                .mce-viewport {
                    max-width: 1100px;
                    margin: 0 auto;
                    overflow: hidden;
                }
                .mce-track {
                    display: flex;
                    transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                /* ── Card ── */
                .mce-card {
                    flex: 0 0 calc(100% / 3);
                    box-sizing: border-box;
                    padding: 0 6px;
                    display: flex;
                    flex-direction: column;
                }

                /* Header clair avec accent de marque */
                .mce-card-header {
                    background: #f7f9fc;
                    color: var(--brand-primary, #374151);
                    font-size: 13px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    line-height: 1.35;
                    padding: 14px 16px;
                    min-height: 64px;
                    display: flex;
                    align-items: center;
                    border-top: 4px solid var(--brand-primary, #374151);
                    border-bottom: 1px solid #e2e8f0;
                }

                /* Corps blanc */
                .mce-card-body {
                    flex: 1;
                    border: 1px solid #e0e0e0;
                    border-top: none;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 16px;
                    background: #fff;
                }
                .mce-card-text {
                    font-size: 12px;
                    color: #333;
                    line-height: 1.65;
                }
                /* Bullets dans le texte */
                .mce-card-text ul {
                    list-style: none;
                    padding: 0;
                    margin: 6px 0 0;
                }
                .mce-card-text ul li::before {
                    content: '• ';
                    font-weight: 700;
                    color: var(--brand-primary, #374151);
                }

                /* Zone logos */
                .mce-logos {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    align-items: center;
                    margin-top: auto;
                    padding-top: 12px;
                    border-top: 1px solid #f0f0f0;
                }
                .mce-logo {
                    height: 40px;
                    max-width: 100px;
                    object-fit: contain;
                    display: block;
                }

                /* ── Navigation ── */
                .mce-nav {
                    text-align: center;
                    margin-top: 20px;
                }
                .mce-prev,
                .mce-next {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid var(--brand-primary, #555);
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
                .mce-prev:hover,
                .mce-next:hover {
                    background: #fff;
                    color: var(--brand-primary, #374151);
                    border-color: #fff;
                }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .mce-card { flex: 0 0 100%; padding: 0; }
                    .mce-card-header { font-size: 14px; min-height: 56px; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['mce-section'],
                components: [
                    {
                        tagName: 'div',
                        classes: ['mce-viewport'],
                        components: [{
                            tagName: 'div',
                            classes: ['mce-track'],
                            components: [
                                makeCard(
                                    'DES TITRES RNCP PAR FRANCE COMPÉTENCES',
                                    'L\'école délivre des certifications professionnelles enregistrées au Répertoire National des Certifications Professionnelles (RNCP) par décision de France Compétences, institution nationale publique placée sous l\'autorité du ministère en charge de la formation professionnelle.',
                                    [
                                        { src: 'https://placehold.co/100x40/f0f0f0/555?text=Logo+1', alt: 'France Compétences' }
                                    ]
                                ),
                                makeCard(
                                    'UNE ÉCOLE DE CRÉATION CLASSÉE PARMI LES MEILLEURES',
                                    `L'école est fière de faire partie chaque année de nombreux classements d'écoles de création, renommés en France mais également à l'international :<ul><li><strong>Top 11 mondial</strong> des écoles d'Animation 3D (The Rookies)</li><li><strong>Top 15 français</strong> des écoles d'Animation 3D (Animation Career Review)</li><li><strong>Top 3 France</strong> des écoles de Jeux Vidéo (Eduniversal)</li></ul>`,
                                    [
                                        { src: 'https://placehold.co/90x40/f0f0f0/555?text=Logo+A', alt: 'Animation Career' },
                                        { src: 'https://placehold.co/70x40/f0f0f0/555?text=Logo+B', alt: 'The Rookies' },
                                        { src: 'https://placehold.co/80x40/f0f0f0/555?text=Logo+C', alt: 'Eduniversal' }
                                    ]
                                ),
                                makeCard(
                                    'DES FILMS ÉTUDIANTS SÉLECTIONNÉS DANS LES FESTIVALS',
                                    'Nos étudiants ont du talent ! De nombreux films sont sélectionnés par des festivals du monde entier comme Icona, Student World Impact Film Festival, Unrestricted View Film Festival…',
                                    [
                                        { src: 'https://placehold.co/80x40/f0f0f0/555?text=Festival+1', alt: 'Impact Film Festival' },
                                        { src: 'https://placehold.co/80x40/f0f0f0/555?text=Festival+2', alt: 'View Film Festival' }
                                    ]
                                ),
                                makeCard(
                                    'DES PARTENARIATS INTERNATIONAUX D\'EXCEPTION',
                                    'L\'école entretient des partenariats avec des institutions et entreprises reconnues à l\'international, offrant à nos étudiants des opportunités uniques de mobilité et de double diplôme.',
                                    [
                                        { src: 'https://placehold.co/80x40/f0f0f0/555?text=Partner+1', alt: 'Partenaire 1' },
                                        { src: 'https://placehold.co/80x40/f0f0f0/555?text=Partner+2', alt: 'Partenaire 2' }
                                    ]
                                )
                            ]
                        }]
                    },
                    {
                        tagName: 'div',
                        classes: ['mce-nav'],
                        components: [
                            { tagName: 'button', classes: ['mce-prev'], selectable: true, components: '&#8249;' },
                            { tagName: 'button', classes: ['mce-next'], selectable: true, components: '&#8250;' }
                        ]
                    }
                ]
            }]
        }
    });

    editor.DomComponents.addType('mce-component', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el    = this;
                    var track = el.querySelector('.mce-track');
                    var next  = el.querySelector('.mce-next');
                    var prev  = el.querySelector('.mce-prev');
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

                    if (next) next.addEventListener('click', function() {
                        var vis = getVisible();
                        idx = idx < track.children.length - vis ? idx + 1 : 0;
                        update();
                    });
                    if (prev) prev.addEventListener('click', function() {
                        var vis = getVisible();
                        idx = idx > 0 ? idx - 1 : track.children.length - vis;
                        update();
                    });

                    window.addEventListener('resize', update);
                    update();
                }
            }
        }
    });
}
