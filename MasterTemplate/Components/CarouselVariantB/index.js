export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeCard(imgSrc, title, jobs) {
        return {
            tagName: 'div', classes: ['mcb-card'],
            components: [
                {
                    tagName: 'div', classes: ['mcb-img-wrap'],
                    components: [
                        {
                            type: 'image', editable: true, selectable: true,
                            attributes: { src: imgSrc, alt: title },
                            classes: ['mcb-img']
                        }
                    ]
                },
                {
                    tagName: 'div', classes: ['mcb-info'],
                    components: [
                        {
                            type: 'text', tagName: 'div', classes: ['mcb-title'],
                            editable: true, selectable: true,
                            components: title
                        },
                        {
                            type: 'text', tagName: 'ul', classes: ['mcb-jobs'],
                            editable: true, selectable: true,
                            components: jobs.map(j => ({ tagName: 'li', components: j }))
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel-variant-b', {
        label: 'Carrousel Variante B (photo + métiers)',
        category: cat,
        attributes: { class: 'fa fa-picture-o' },
        content: {
            type: 'mcb-component',
            styles: `
                .mcb-section {
                    padding: 40px;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                    background: transparent;
                }

                .mcb-frame { width: 100%; }

                /* Zone colorée — uniquement autour des cartes */
                .mcb-gray-zone {
                    background: #d1d5db;
                    padding: 0;
                    width: 100%;
                }

                .mcb-viewport { overflow: hidden; }

                .mcb-track {
                    display: flex;
                    transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                .mcb-card {
                    flex: 0 0 calc(100% / 3);
                    box-sizing: border-box;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                }

                .mcb-img-wrap { background: #c9cacc; }

                .mcb-img {
                    width: 100%;
                    height: 220px;
                    object-fit: cover;
                    display: block;
                }

                .mcb-info {
                    background: #fff;
                    padding: 16px 14px 18px;
                    flex: 1;
                }

                .mcb-title {
                    font-size: 12px;
                    font-weight: 800;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                    margin-bottom: 10px;
                    line-height: 1.4;
                }

                .mcb-jobs {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    font-size: 12px;
                    color: #444;
                    line-height: 1.85;
                }
                .mcb-jobs li::before {
                    content: '• ';
                    color: var(--brand-primary, #374151);
                    font-weight: 700;
                }

                .mcb-nav { text-align: center; padding: 20px 0 0; }
                .mcb-prev, .mcb-next {
                    width: 40px; height: 40px; border-radius: 50%;
                    border: 2px solid #555; background: #fff;
                    cursor: pointer; font-size: 20px; margin: 0 6px;
                    color: #333; display: inline-flex;
                    align-items: center; justify-content: center;
                    transition: background 0.2s, color 0.2s;
                }
                .mcb-prev:hover, .mcb-next:hover {
                    background: #333; color: #fff; border-color: #333;
                }

                @media (max-width: 768px) {
                    .mcb-card { flex: 0 0 100%; padding: 0; }
                    .mcb-img { height: 220px; }
                }
            `,
            components: [{
                tagName: 'section', classes: ['mcb-section'],
                components: [{
                    tagName: 'div', classes: ['mcb-frame'],
                    components: [
                        // Zone colorée — uniquement autour des cartes
                        {
                            tagName: 'div', classes: ['mcb-gray-zone'],
                            components: [{
                                tagName: 'div', classes: ['mcb-viewport'],
                                components: [{
                                    tagName: 'div', classes: ['mcb-track'],
                                    components: [
                                        makeCard('https://placehold.co/380x200/d1d5db/374151?text=Photo+programme', 'INFOGRAPHIE ÉCO-CONCEPTION', ['Infographiste éco-concepteur', 'Designer graphique', 'Typographe', 'Web Designer', 'Iconographe', 'Maquettiste', 'Opérateur PAO']),
                                        makeCard('https://placehold.co/380x200/9ca3af/374151?text=Photo+programme', 'DIRECTION ARTISTIQUE', ['Directeur Artistique', 'Brand Designer', 'Directeur de Création', 'Motion Designer', 'Designer Packaging', 'Designer Digital', 'UX Designer']),
                                        makeCard('https://placehold.co/380x200/6b7280/e5e7eb?text=Photo+programme', 'ANIMATION 3D & IMMERSION', ['Animateur 3D', 'Character designer', 'Concepteur 3D - VFX', 'Artiste VFX', 'Rendering artist', 'Modéleur 3D', 'Lighting artist', 'Rigger']),
                                        makeCard('https://placehold.co/380x200/4b5563/e5e7eb?text=Photo+programme', 'DESIGN GRAPHIQUE', ['Graphic Designer', 'Brand Designer', 'Art Director', 'Motion Designer', 'UI Designer', 'Illustrateur'])
                                    ]
                                }]
                            }]
                        },
                        // Boutons en dehors de la zone colorée
                        {
                            tagName: 'div', classes: ['mcb-nav'],
                            components: [
                                { tagName: 'button', classes: ['mcb-prev'], selectable: true, components: '&#8249;' },
                                { tagName: 'button', classes: ['mcb-next'], selectable: true, components: '&#8250;' }
                            ]
                        }
                    ]
                }]
            }]
        }
    });

    editor.DomComponents.addType('mcb-component', {
        model: { defaults: { 'script-props': [],
            script: function() {
                var el = this, track = el.querySelector('.mcb-track');
                var next = el.querySelector('.mcb-next'), prev = el.querySelector('.mcb-prev');
                var idx = 0;
                function getVisible() { return window.innerWidth <= 768 ? 1 : 3; }
                function update() {
                    var vis = getVisible();
                    var max = track.children.length - vis;
                    var cardW = track.firstElementChild ? track.firstElementChild.offsetWidth : 0;
                    idx = Math.min(Math.max(idx, 0), max);
                    track.style.transform = 'translateX(-' + (idx * cardW) + 'px)';
                }
                if (next) next.addEventListener('click', function() { var vis = getVisible(); idx = idx < track.children.length - vis ? idx + 1 : 0; update(); });
                if (prev) prev.addEventListener('click', function() { var vis = getVisible(); idx = idx > 0 ? idx - 1 : track.children.length - getVisible(); update(); });
                window.addEventListener('resize', update);
                update();
            }
        }}
    });
}
