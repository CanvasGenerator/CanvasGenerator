export default function (editor, categories) {

    function makeCard(colorClass, headerText, imageSrc, imageAlt, bodyHtml) {
        return {
            tagName: 'div',
            classes: ['carrous-card', colorClass],
            components: [{
                tagName: 'div',
                classes: ['card-inner'],
                components: [

                    // --- Header ---
                    {
                        type: 'text',
                        tagName: 'div',
                        classes: ['card-header'],
                        editable: true,
                        selectable: true,
                        components: headerText
                    },

                    // --- Image ---
                    {
                        type: 'image',
                        editable: true,
                        selectable: true,
                        attributes: {
                            src: imageSrc,
                            alt: imageAlt
                        },
                        style: {
                            width: '100%',
                            height: '200px',
                            'object-fit': 'cover',
                            display: 'block'
                        }
                    },

                    // --- Body ---
                    {
                        type: 'text',
                        tagName: 'div',
                        classes: ['card-body'],
                        editable: true,
                        selectable: true,
                        components: bodyHtml
                    }

                ]
            }]
        };
    }


    editor.BlockManager.add('Carrousel', {
        label: 'Carrousel',
        category: categories.ESSENTIAL,
        attributes: { class: 'gjs-fonts gjs-f-carrousel' },

        content: {
            type: 'carrousel-component',

            styles: `
                * {
                    box-sizing: border-box;
                }

                .carrous-section {
                    padding: 60px 20px;
                }

                .carrous-container {
                    max-width: 1100px;
                    margin: auto;
                    overflow: hidden;
                }

                .carrous-track {
                    display: flex;
                    transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                /* Desktop → 3 cards */
                .carrous-card {
                    flex: 0 0 calc(100% / 3);
                    padding: 8px;
                }

                .card-inner {
                    background: #fff;
                    border: 2px solid;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }

                .card-header {
                    color: #fff;
                    padding: 14px 16px;
                    font-weight: 700;
                    font-size: 13px;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    line-height: 1.3;
                    min-height: 56px;
                    display: flex;
                    align-items: center;
                }

                .card-inner img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    display: block;
                }

                .card-body {
                    padding: 16px;
                    font-size: 13.5px;
                    color: #333;
                    line-height: 1.6;
                    flex: 1;
                }

                .card-body ul {
                    margin-top: 10px;
                    padding-left: 0;
                    list-style: none;
                }

                .card-body ul li::before {
                    content: "• ";
                }

                /* Colors */
                .orange .card-inner  { border-color: #e8891a; }
                .orange .card-header { background: #e8891a; }

                .pink .card-inner    { border-color: #c0175e; }
                .pink .card-header   { background: #c0175e; }

                .purple .card-inner  { border-color: #8B3FA8; }
                .purple .card-header { background: #8B3FA8; }

                /* Navigation */
                .carrous-nav {
                    text-align: center;
                    margin-top: 24px;
                }

                .carrous-prev,
                .carrous-next {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 2px solid #555;
                    background: #fff;
                    cursor: pointer;
                    font-size: 22px;
                    line-height: 1;
                    margin: 0 5px;
                    transition: background 0.2s, color 0.2s;
                    color: #333;
                }

                .carrous-prev:hover,
                .carrous-next:hover {
                    background: #333;
                    color: #fff;
                }

                /* Tablet → 2 cards */
                @media (max-width: 1024px) and (min-width: 581px) {
                    .carrous-card { flex: 0 0 50%; }
                }

                /* Mobile → 1 card */
                @media (max-width: 580px) {
                    .carrous-card { flex: 0 0 100%; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['carrous-section'],
                components: [

                    // --- Track ---
                    {
                        tagName: 'div',
                        classes: ['carrous-container'],
                        components: [{
                            tagName: 'div',
                            classes: ['carrous-track'],
                            components: [

                                makeCard(
                                    'orange',
                                    'CLASSE PRÉPARATOIRE<br>ARTS APPLIQUÉS',
                                    'assets/classe-preparatoire.jpg',
                                    'Classe Préparatoire',
                                    `La classe préparatoire en Arts Appliqués est une année pluridisciplinaire
                                     accessible après le Bac. Elle permet d'acquérir les fondamentaux de la
                                     conception de l'image, du graphisme et de la création digitale.`
                                ),

                                makeCard(
                                    'pink',
                                    'DIRECTION ARTISTIQUE',
                                    'assets/direction-artistique.jpg',
                                    'Direction Artistique',
                                    `Le programme Direction Artistique forme des futurs professionnels capables
                                     de créer de nouvelles expériences utilisateurs digitales ou physiques.
                                     <ul>
                                         <li>Cursus en 5 ans</li>
                                         <li>Classe Préparatoire en Arts appliqués</li>
                                         <li>Cursus en anglais possible (Nantes)</li>
                                         <li>Alternance en 5e année</li>
                                         <li>2 spécialisations dès la 4ème année</li>
                                     </ul>`
                                ),

                                makeCard(
                                    'purple',
                                    'ANIMATION 3D &amp; IMMERSION',
                                    'assets/animation-3d-immersion.jpg',
                                    'Animation 3D',
                                    `Le programme Animation 3D &amp; Immersion forme des experts capables de
                                     concevoir des expériences visuelles immersives pour le jeu vidéo,
                                     l'animation, la publicité, l'architecture, la santé...
                                     <ul>
                                         <li>Cursus en 5 ans</li>
                                         <li>Classe Préparatoire en Arts appliqués</li>
                                         <li>Double Diplôme possible à Montréal (NAD-UQAC)</li>
                                     </ul>`
                                ),

                                makeCard(
                                    'orange',
                                    'DESIGN GRAPHIQUE',
                                    'assets/design-graphique.jpg',
                                    'Design Graphique',
                                    `Le programme Design Graphique forme des concepteurs visuels capables de
                                     répondre aux enjeux de communication actuels, du print au digital.
                                     <ul>
                                         <li>Cursus en 5 ans</li>
                                         <li>Spécialisation identité de marque</li>
                                         <li>Projets en partenariat avec des entreprises</li>
                                     </ul>`
                                )

                            ]
                        }]
                    },

                    // --- Navigation ---
                    {
                        tagName: 'div',
                        classes: ['carrous-nav'],
                        components: [
                            {
                                type: 'text',
                                tagName: 'button',
                                classes: ['carrous-prev'],
                                editable: true,
                                selectable: true,
                                components: '&#8249;'
                            },
                            {
                                type: 'text',
                                tagName: 'button',
                                classes: ['carrous-next'],
                                editable: true,
                                selectable: true,
                                components: '&#8250;'
                            }
                        ]
                    }

                ]
            }]
        }
    });



    editor.DomComponents.addType('carrousel-component', {
        model: {
            defaults: {

                'script-props': [],

                script: function () {
                    const el      = this;
                    const track   = el.querySelector('.carrous-track');
                    const nextBtn = el.querySelector('.carrous-next');
                    const prevBtn = el.querySelector('.carrous-prev');
                    let index     = 0;

                    function getVisible() {
                        if (window.innerWidth <= 580)  return 1;
                        if (window.innerWidth <= 1024) return 2;
                        return 3;
                    }

                    function update() {
                        const visible   = getVisible();
                        const cardWidth = track.firstElementChild.offsetWidth;
                        const maxIndex  = track.children.length - visible;

                        index = Math.min(Math.max(index, 0), maxIndex);
                        track.style.transform = `translateX(-${index * cardWidth}px)`;
                    }

                    nextBtn.addEventListener('click', () => {
                        const visible = getVisible();
                        index = (index < track.children.length - visible) ? index + 1 : 0;
                        update();
                    });

                    prevBtn.addEventListener('click', () => {
                        const visible = getVisible();
                        index = (index > 0) ? index - 1 : track.children.length - visible;
                        update();
                    });

                    window.addEventListener('resize', update);
                    update();
                }

            }
        }
    });

}