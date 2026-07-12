export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    /* ── Helper : crée une carte spécialisation éditable ── */
    function makeCard(titleHtml, tags, desc) {
        return {
            tagName: 'article',
            classes: ['spe-carte'],
            components: [
                /* Case image (grise) — droppable : on peut y glisser une image */
                {
                    tagName: 'div',
                    classes: ['spe-image'],
                    droppable: true,
                    selectable: true,
                    components: 'Image'
                },
                /* Contenu */
                {
                    tagName: 'div',
                    classes: ['spe-contenu'],
                    components: [
                        /* Titre éditable */
                        {
                            type: 'text',
                            tagName: 'h3',
                            editable: true,
                            selectable: true,
                            components: titleHtml
                        },
                        /* Rangée de tags */
                        {
                            tagName: 'div',
                            classes: ['spe-tags'],
                            components: tags.map(t => ({
                                type: 'text',
                                tagName: 'span',
                                classes: ['spe-tag'],
                                editable: true,
                                selectable: true,
                                components: t
                            }))
                        },
                        /* Description éditable */
                        {
                            type: 'text',
                            tagName: 'p',
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
        label: 'Carrousel Variante D (spécialisations + tags)',
        category: cat,
        attributes: { class: 'fa fa-tags' },

        content: {
            type: 'mcd-component',

            styles: `
                .specialisations {
                    background: #f1ede9;
                    padding: 56px 24px 48px;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                .specialisations .section-title {
                    max-width: 1100px;
                    margin: 0 auto 28px;
                    font-size: 22px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: .3px;
                    color: #000;
                }
                .specialisations .container { max-width: 1100px; margin: 0 auto; }

                /* Piste scrollable horizontale (manquait dans l'extrait) */
                .specialisations .carrousel {
                    display: flex;
                    gap: 22px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    padding-bottom: 6px;
                    scrollbar-width: none;
                }
                .specialisations .carrousel::-webkit-scrollbar { display: none; }

                /* ── Carte ── */
                .spe-carte { background: #fadeb9; flex: 0 0 320px; display: flex; flex-direction: column; }
                .spe-image {
                    background: #c9c4bb;
                    height: 210px;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    color: #6a655c;
                    overflow: hidden;
                }
                .spe-image img { width: 100%; height: 100%; object-fit: cover; }
                .spe-contenu { padding: 20px 22px 26px; }
                .spe-contenu h3 {
                    font-size: 13.5px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: var(--brand-text, #1a1a1a);
                    line-height: 1.45;
                    margin-bottom: 14px;
                }
                .spe-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
                .spe-tag {
                    background: #000000;
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: .2px;
                    padding: 4px 9px;
                }
                .spe-contenu p { font-size: 12.5px; color: #5f5b54; line-height: 1.6; margin: 0; }

                /* ── Navigation (manquait dans l'extrait) ── */
                .specialisations .carrousel-nav { max-width: 1100px; margin: 22px auto 0; text-align: right; }
                .specialisations .carrousel-nav button {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    border: 1.5px solid #000;
                    background: var(--brand-background, #ffffff);
                    cursor: pointer;
                    font-size: 22px;
                    line-height: 1;
                    color: #000;
                    margin-left: 8px;
                    transition: background .2s, color .2s;
                }
                .specialisations .carrousel-nav button:hover { background: #000; color: #fff; }

                /* Responsive */
                @media (max-width: 860px) {
                    .spe-carte { flex-basis: 280px; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['specialisations'],
                components: [
                    {
                        type: 'text',
                        tagName: 'h2',
                        classes: ['section-title'],
                        editable: true,
                        selectable: true,
                        components: 'Quels sont les spécialisations&nbsp;?'
                    },
                    {
                        tagName: 'div',
                        classes: ['container'],
                        components: [
                            {
                                tagName: 'div',
                                classes: ['carrousel'],
                                components: [
                                    makeCard(
                                        'Communication &amp;<br>Marketing Stratégique',
                                        ['4 campus disponibles', 'Anglais', 'Alternance possible', 'Double diplôme international'],
                                        'Devenez un manager complet en vous appuyant sur une double compétence Communication et Marketing.'
                                    ),
                                    makeCard(
                                        'Communication &amp;<br>Management Évènementiel',
                                        ['7 campus disponibles', 'Alternance possible'],
                                        'Devenez un manager complet pour une communication stratégique, riche de sens.'
                                    ),
                                    makeCard(
                                        'Création &amp; Stratégies<br>Publicitaires',
                                        ['7 campus disponibles', 'Alternance possible', 'Double diplôme international'],
                                        'Devenez un créatif, porteur de sens et d&rsquo;idées, maîtrisant les dynamiques d&rsquo;un univers publicitaire en révolution.'
                                    )
                                ]
                            },
                            {
                                tagName: 'div',
                                classes: ['carrousel-nav'],
                                components: [
                                    { tagName: 'button', classes: ['spe-prev'], selectable: true, attributes: { type: 'button', 'aria-label': 'Précédent' }, components: '&lsaquo;' },
                                    { tagName: 'button', classes: ['spe-next'], selectable: true, attributes: { type: 'button', 'aria-label': 'Suivant' }, components: '&rsaquo;' }
                                ]
                            }
                        ]
                    }
                ]
            }]
        }
    });

    /* ── Script slider (scroll horizontal) ── */
    editor.DomComponents.addType('mcd-component', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el   = this;
                    var c    = el.querySelector('.carrousel');
                    var prev = el.querySelector('.spe-prev');
                    var next = el.querySelector('.spe-next');
                    if (!c) return;
                    if (prev) prev.addEventListener('click', function() { c.scrollBy({ left: -342, behavior: 'smooth' }); });
                    if (next) next.addEventListener('click', function() { c.scrollBy({ left: 342, behavior: 'smooth' }); });
                }
            }
        }
    });
}
