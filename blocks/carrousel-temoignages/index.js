export default function (editor, categories) {


    function makeSlideImage(quoteText, imageSrc, imageAlt, logoSrc, logoAlt, nameText, roleText) {
        return {
            tagName: 'div',
            classes: ['ctm-slide'],
            components: [

                // --- Media ---
                {
                    tagName: 'div',
                    classes: ['ctm-media'],
                    components: [{
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
                    }]
                },

                // --- Content ---
                {
                    tagName: 'div',
                    classes: ['ctm-content'],
                    components: [

                        // Citation
                        {
                            type: 'text',
                            tagName: 'blockquote',
                            classes: ['ctm-quote'],
                            editable: true,
                            selectable: true,
                            components: quoteText
                        },

                        // Auteur
                        {
                            tagName: 'div',
                            classes: ['ctm-author'],
                            components: [
                                {
                                    type: 'image',
                                    editable: true,
                                    selectable: true,
                                    attributes: {
                                        src: logoSrc,
                                        alt: logoAlt
                                    },
                                    classes: ['ctm-logo']
                                },
                                {
                                    tagName: 'div',
                                    classes: ['ctm-author-info'],
                                    components: [
                                        {
                                            type: 'text',
                                            tagName: 'span',
                                            classes: ['ctm-name'],
                                            editable: true,
                                            selectable: true,
                                            components: nameText
                                        },
                                        {
                                            type: 'text',
                                            tagName: 'span',
                                            classes: ['ctm-role'],
                                            editable: true,
                                            selectable: true,
                                            components: roleText
                                        }
                                    ]
                                }
                            ]
                        }

                    ]
                }

            ]
        };
    }

    function makeSlideVideo(quoteText, videoSrc, posterSrc, logoSrc, logoAlt, nameText, roleText) {
        return {
            tagName: 'div',
            classes: ['ctm-slide'],
            components: [

                // --- Media (vidéo) ---
                {
                    tagName: 'div',
                    classes: ['ctm-media'],
                    components: [{
                        tagName: 'video',
                        attributes: {
                            controls: true,
                            poster: posterSrc
                        },
                        style: {
                            width: '100%',
                            height: '100%',
                            'object-fit': 'cover',
                            display: 'block'
                        },
                        components: [{
                            tagName: 'source',
                            attributes: {
                                src: videoSrc,
                                type: 'video/mp4'
                            }
                        }]
                    }]
                },

                // --- Content ---
                {
                    tagName: 'div',
                    classes: ['ctm-content'],
                    components: [

                        // Citation
                        {
                            type: 'text',
                            tagName: 'blockquote',
                            classes: ['ctm-quote'],
                            editable: true,
                            selectable: true,
                            components: quoteText
                        },

                        // Auteur
                        {
                            tagName: 'div',
                            classes: ['ctm-author'],
                            components: [
                                {
                                    type: 'image',
                                    editable: true,
                                    selectable: true,
                                    attributes: {
                                        src: logoSrc,
                                        alt: logoAlt
                                    },
                                    classes: ['ctm-logo']
                                },
                                {
                                    tagName: 'div',
                                    classes: ['ctm-author-info'],
                                    components: [
                                        {
                                            type: 'text',
                                            tagName: 'span',
                                            classes: ['ctm-name'],
                                            editable: true,
                                            selectable: true,
                                            components: nameText
                                        },
                                        {
                                            type: 'text',
                                            tagName: 'span',
                                            classes: ['ctm-role'],
                                            editable: true,
                                            selectable: true,
                                            components: roleText
                                        }
                                    ]
                                }
                            ]
                        }

                    ]
                }

            ]
        };
    }



    editor.BlockManager.add('CarrouselTemoignages', {
        label: 'Témoignages',
        category: categories.ESSENTIAL,
        attributes: { class: 'gjs-fonts gjs-f-carrousel-temoignages' },

        content: {
            type: 'carrousel-temoignages-component',

            styles: `
                * {
                    box-sizing: border-box;
                }

                .ctm-section {
                    padding: 60px 20px;
                    background: #fff;
                }

                /* Titre bloc */
                .ctm-header {
                    max-width: 900px;
                    margin: 0 auto 32px auto;
                }

                .ctm-title-bloc {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Container */
                .ctm-container {
                    max-width: 900px;
                    margin: auto;
                    overflow: hidden;
                }

                .ctm-track {
                    display: flex;
                    transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                /* Slide */
                .ctm-slide {
                    flex: 0 0 100%;
                    display: flex;
                    align-items: stretch;
                }

                /* Media */
                .ctm-media {
                    flex: 0 0 40%;
                    max-width: 40%;
                    overflow: hidden;
                }

                .ctm-media img,
                .ctm-media video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                /* Contenu */
                .ctm-content {
                    flex: 1;
                    padding: 36px 40px;
                    border: 2px solid #c0175e;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 24px;
                }

                /* Citation */
                .ctm-quote {
                    margin: 0;
                    font-size: 15px;
                    line-height: 1.65;
                    color: #222;
                    font-style: normal;
                }

                /* Auteur */
                .ctm-author {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .ctm-logo {
                    width: 64px;
                    height: 64px;
                    object-fit: contain;
                    flex-shrink: 0;
                }

                .ctm-author-info {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }

                .ctm-name {
                    font-weight: 700;
                    font-size: 13px;
                    color: #111;
                }

                .ctm-role {
                    font-size: 12px;
                    color: #555;
                }

                /* Navigation */
                .ctm-nav {
                    text-align: center;
                    margin-top: 24px;
                }

                .ctm-prev,
                .ctm-next {
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

                .ctm-prev:hover,
                .ctm-next:hover {
                    background: #333;
                    color: #fff;
                    border-color: #333;
                }

                /* Mobile */
                @media (max-width: 640px) {
                    .ctm-slide {
                        flex-direction: column;
                    }

                    .ctm-media {
                        flex: none;
                        max-width: 100%;
                        width: 100%;
                        height: 260px;
                    }

                    .ctm-content {
                        padding: 24px 20px;
                        border-top: none;
                    }
                }
            `,


            components: [{
                tagName: 'section',
                classes: ['ctm-section'],
                components: [

                    // --- Titre ---
                    {
                        tagName: 'div',
                        classes: ['ctm-header'],
                        components: [{
                            type: 'text',
                            tagName: 'h2',
                            classes: ['ctm-title-bloc'],
                            editable: true,
                            selectable: true,
                            components: 'Témoignages'
                        }]
                    },

                    // --- Track ---
                    {
                        tagName: 'div',
                        classes: ['ctm-container'],
                        components: [{
                            tagName: 'div',
                            classes: ['ctm-track'],
                            components: [

                                makeSlideImage(
                                    '"La formation BRASSART m\'a apporté toutes les connaissances nécessaires pour mon métier de Directeur Artistique."',
                                    'assets/cedric-humeau.webp',
                                    'Cédric Humeau',
                                    'assets/logo-carpool-studio.png',
                                    'Carpool Studio',
                                    'Cédric Humeau',
                                    'Art Director - BRASSART 1997'
                                ),

                                makeSlideImage(
                                    '"BRASSART m\'a permis de développer une vision créative forte et de m\'intégrer rapidement dans le monde professionnel."',
                                    'assets/Antoine-Provost.jpg',
                                    'Antoine Provost',
                                    'assets/logo-TBWA.png',
                                    'Agence TBWA',
                                    'Antoine Provost',
                                    'étudiant en Direction Artistique en alternance chez TBWA'
                                ),

                                makeSlideVideo(
                                    '"Rejoignez BRASSART, l\'école des métiers de la création !"',
                                    'assets/temoignage-video.mp4',
                                    'assets/temoignage-photo.jpg',
                                    'assets/brassart-logo.png',
                                    'Brassart',
                                    'Léo &amp; Eliott en filière Animation 3D &amp; VFX',
                                    'étudiants en filière Animation 3D &amp; VFX - BRASSART'
                                )

                            ]
                        }]
                    },

                    // --- Navigation ---
                    {
                        tagName: 'div',
                        classes: ['ctm-nav'],
                        components: [
                            {
                                type: 'text',
                                tagName: 'button',
                                classes: ['ctm-prev'],
                                editable: true,
                                selectable: true,
                                components: '&#8249;'
                            },
                            {
                                type: 'text',
                                tagName: 'button',
                                classes: ['ctm-next'],
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



    editor.DomComponents.addType('carrousel-temoignages-component', {
        model: {
            defaults: {

                // Permet l'édition des enfants malgré la présence d'un script
                'script-props': [],

                script: function () {
                    const el      = this;
                    const track   = el.querySelector('.ctm-track');
                    const prevBtn = el.querySelector('.ctm-prev');
                    const nextBtn = el.querySelector('.ctm-next');
                    const slides  = track.querySelectorAll('.ctm-slide');
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