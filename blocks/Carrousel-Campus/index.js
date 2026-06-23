export default function (editor, categories) {

    function makeSlide(badgeText, addressText, imageSrc, imageAlt, overlayText) {
        return {
            tagName: 'div',
            classes: ['ccp-slide'],
            components: [{
                tagName: 'div',
                classes: ['ccp-card'],
                components: [

                    // --- Header : badge + ligne ---
                    {
                        tagName: 'div',
                        classes: ['ccp-card-header'],
                        components: [
                            {
                                type: 'text',
                                tagName: 'span',
                                classes: ['ccp-badge'],
                                editable: true,
                                selectable: true,
                                components: badgeText
                            },
                            {
                                tagName: 'hr',
                                classes: ['ccp-line']
                            }
                        ]
                    },

                    // --- Adresse ---
                    {
                        type: 'text',
                        tagName: 'div',
                        classes: ['ccp-address'],
                        editable: true,
                        selectable: true,
                        components: addressText
                    },

                    // --- Media ---
                    {
                        tagName: 'div',
                        classes: ['ccp-media'],
                        components: [
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
                                    height: '100%',
                                    'object-fit': 'cover',
                                    display: 'block'
                                }
                            },
                            {
                                type: 'text',
                                tagName: 'span',
                                classes: ['ccp-overlay-label'],
                                editable: true,
                                selectable: true,
                                components: overlayText
                            }
                        ]
                    }

                ]
            }]
        };
    }



    editor.BlockManager.add('CarrouselCampus', {
        label: 'Campus',
        category: categories.ESSENTIAL,
        attributes: { class: 'gjs-fonts gjs-f-carrousel-campus' },

        content: {
            type: 'carrousel-campus-component',

            styles: `
                * {
                    box-sizing: border-box;
                }

                .ccp-section {
                    padding: 60px 20px;
                    background: #f5f5f5;
                }

                .ccp-container {
                    max-width: 620px;
                    margin: auto;
                    overflow: hidden;
                }

                .ccp-track {
                    display: flex;
                    transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                /* Slide */
                .ccp-slide {
                    flex: 0 0 100%;
                }

                /* Card */
                .ccp-card {
                    background: #f0f0f0;
                    padding: 20px 20px 0 20px;
                }

                /* Header : badge + ligne */
                .ccp-card-header {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 10px;
                }

                .ccp-badge {
                    background: #c0175e;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 700;
                    padding: 4px 12px;
                    border-radius: 2px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .ccp-line {
                    flex: 1;
                    border: none;
                    border-top: 1px solid #999;
                    margin: 0;
                }

                /* Adresse */
                .ccp-address {
                    font-size: 13px;
                    color: #333;
                    margin-bottom: 14px;
                }

                /* Media */
                .ccp-media {
                    position: relative;
                    width: 100%;
                    height: 280px;
                    overflow: hidden;
                }

                .ccp-media img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                /* Overlay label */
                .ccp-overlay-label {
                    position: absolute;
                    bottom: 16px;
                    left: 16px;
                    color: #fff;
                    font-size: 28px;
                    font-weight: 700;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
                    pointer-events: none;
                }

                /* Navigation */
                .ccp-nav {
                    text-align: center;
                    margin-top: 24px;
                }

                .ccp-prev,
                .ccp-next {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 2px solid #555;
                    background: #fff;
                    cursor: pointer;
                    font-size: 22px;
                    line-height: 1;
                    margin: 0 5px;
                    transition: background 0.2s, color 0.2s, border-color 0.2s;
                    color: #333;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .ccp-prev:hover,
                .ccp-next:hover {
                    background: #333;
                    color: #fff;
                    border-color: #333;
                }

                /* Mobile */
                @media (max-width: 640px) {
                    .ccp-container  { max-width: 100%; }
                    .ccp-media      { height: 200px; }
                    .ccp-overlay-label { font-size: 22px; }
                }
            `,

            components: [{
                tagName: 'section',
                classes: ['ccp-section'],
                components: [

                    // --- Track ---
                    {
                        tagName: 'div',
                        classes: ['ccp-container'],
                        components: [{
                            tagName: 'div',
                            classes: ['ccp-track'],
                            components: [

                                makeSlide(
                                    'Annecy',
                                    '105, avenue de Genève, 74000 Annecy',
                                    'assets/campus-annecy.jpg',
                                    'Campus Annecy',
                                    'Annecy'
                                ),

                                makeSlide(
                                    'Paris',
                                    '12, rue de la Paix, 75001 Paris',
                                    'assets/campus-paris.jpg',
                                    'Campus Paris',
                                    'Paris'
                                ),

                                makeSlide(
                                    'Nantes',
                                    '8, allée des Arts, 44000 Nantes',
                                    'assets/campus-nantes.jpg',
                                    'Campus Nantes',
                                    'Nantes'
                                )

                            ]
                        }]
                    },

                    // --- Navigation ---
                    {
                        tagName: 'div',
                        classes: ['ccp-nav'],
                        components: [
                            {
                                type: 'text',
                                tagName: 'button',
                                classes: ['ccp-prev'],
                                editable: true,
                                selectable: true,
                                components: '&#8249;'
                            },
                            {
                                type: 'text',
                                tagName: 'button',
                                classes: ['ccp-next'],
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


    editor.DomComponents.addType('carrousel-campus-component', {
        model: {
            defaults: {

                'script-props': [],

                script: function () {
                    const el      = this;
                    const track   = el.querySelector('.ccp-track');
                    const prevBtn = el.querySelector('.ccp-prev');
                    const nextBtn = el.querySelector('.ccp-next');
                    const slides  = track.querySelectorAll('.ccp-slide');
                    const total   = slides.length;
                    let index     = 0;

                    function update() {
                        const slideWidth = slides[0].offsetWidth;
                        track.style.transform = `translateX(-${index * slideWidth}px)`;
                    }

                    nextBtn.addEventListener('click', () => {
                        index = (index + 1) % total;
                        update();
                    });

                    prevBtn.addEventListener('click', () => {
                        index = (index - 1 + total) % total;
                        update();
                    });

                    window.addEventListener('resize', update);
                    update();
                }

            }
        }
    });

}