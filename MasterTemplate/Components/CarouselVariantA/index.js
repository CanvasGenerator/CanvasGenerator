export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeCard(title, imgSrc, description, bullets) {
        return {
            tagName: 'div', classes: ['mcva-card'],
            components: [
                // Badge header coloré
                {
                    type: 'text', tagName: 'div', classes: ['mcva-badge'],
                    editable: true, selectable: true,
                    components: title
                },
                // Image
                {
                    type: 'image', editable: true, selectable: true,
                    attributes: { src: imgSrc, alt: title },
                    classes: ['mcva-img']
                },
                // Texte + bullets
                {
                    tagName: 'div', classes: ['mcva-body'],
                    components: [
                        {
                            type: 'text', tagName: 'p', classes: ['mcva-desc'],
                            editable: true, selectable: true,
                            components: description
                        },
                        {
                            type: 'text', tagName: 'ul', classes: ['mcva-list'],
                            editable: true, selectable: true,
                            components: bullets.map(b => ({ tagName: 'li', components: b }))
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel-variant-a', {
        label: 'Carrousel Variante A (photo + vidéos)',
        category: cat,
        attributes: { class: 'fa fa-film' },
        content: {
            type: 'mcva-component',
            styles: `
                .mcva-section { padding: 40px 20px; background: var(--brand-carousel, #fff); font-family: var(--brand-font, 'Inter', sans-serif); }
                .mcva-viewport { max-width: 1100px; margin: 0 auto; overflow: hidden; }
                .mcva-track { display: flex; transition: transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94); }

                .mcva-card {
                    flex: 0 0 calc(100% / 3);
                    box-sizing: border-box;
                    padding: 0 6px;
                    display: flex;
                    flex-direction: column;
                }

                .mcva-badge {
                    background-color: var(--brand-accent, var(--brand-primary, #374151));
                    color: #fff;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    line-height: 1.35;
                    padding: 10px 12px;
                    min-height: 48px;
                    display: flex;
                    align-items: center;
                }

                .mcva-img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    display: block;
                }

                .mcva-body {
                    padding: 14px 12px 16px;
                    border: 1px solid var(--brand-border, #e5e7eb);
                    border-top: none;
                    flex: 1;
                    background: var(--brand-background, #ffffff);
                }

                .mcva-desc {
                    font-size: 13px;
                    color: var(--brand-text, #1a1a1a);
                    line-height: 1.6;
                    margin: 0 0 10px;
                }

                .mcva-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    font-size: 12.5px;
                    color: #444;
                    line-height: 1.85;
                }
                .mcva-list li::before {
                    content: '• ';
                    color: var(--brand-primary, #374151);
                    font-weight: 700;
                }

                .mcva-nav { text-align: center; margin-top: 20px; }
                .mcva-prev, .mcva-next {
                    width: 40px; height: 40px; border-radius: 50%;
                    border: 2px solid var(--brand-primary, #555); background: var(--brand-background, #ffffff);
                    cursor: pointer; font-size: 22px; margin: 0 6px;
                    color: var(--brand-text, #1a1a1a); display: inline-flex;
                    align-items: center; justify-content: center;
                    transition: background 0.2s, color 0.2s;
                }
                .mcva-prev:hover, .mcva-next:hover { background: #333; color: #fff; }

                @media (max-width: 768px) {
                    .mcva-card { flex: 0 0 100%; padding: 0; }
                    .mcva-img { height: 220px; }
                }
            `,
            components: [{
                tagName: 'section', classes: ['mcva-section'],
                components: [{
                    tagName: 'div', classes: ['mcva-viewport'],
                    components: [
                        {
                            tagName: 'div', classes: ['mcva-track'],
                            components: [
                                makeCard(
                                    'Classe Préparatoire Arts Appliqués',
                                    'https://placehold.co/380x200/d1d5db/374151?text=Photo',
                                    'La classe préparatoire en Arts Appliqués est une année pluridisciplinaire accessible après le Bac.',
                                    ['Cursus en 5 ans', 'Cours en anglais possible', 'Alternance en 5e année']
                                ),
                                makeCard(
                                    'Direction Artistique',
                                    'https://placehold.co/380x200/9ca3af/374151?text=Photo',
                                    'Le programme Direction Artistique a pour objectif de former des futurs professionnels capables de créer.',
                                    ['Cursus en 5 ans', 'Classe Préparatoire en Arts appliqués', 'Double Diplôme possible']
                                ),
                                makeCard(
                                    'Animation 3D & Immersion',
                                    'https://placehold.co/380x200/6b7280/e5e7eb?text=Photo',
                                    'Animation 3D & Immersion forme des experts de la 3D capables de concevoir des expériences visuelles immersives.',
                                    ['Cursus en 5 ans', 'Classe Préparatoire en Arts appliqués', 'Double Diplôme NAD-UQAC']
                                ),
                                makeCard(
                                    'Design Graphique',
                                    'https://placehold.co/380x200/4b5563/e5e7eb?text=Photo',
                                    'Une formation complète pour maîtriser les outils et techniques du design graphique contemporain.',
                                    ['Cursus en 5 ans', 'Alternance possible', 'Double Diplôme possible']
                                )
                            ]
                        },
                        {
                            tagName: 'div', classes: ['mcva-nav'],
                            components: [
                                { tagName: 'button', classes: ['mcva-prev'], selectable: true, components: '&#8249;' },
                                { tagName: 'button', classes: ['mcva-next'], selectable: true, components: '&#8250;' }
                            ]
                        }
                    ]
                }]
            }]
        }
    });

    editor.DomComponents.addType('mcva-component', {
        model: { defaults: { 'script-props': [],
            script: function() {
                var el = this, track = el.querySelector('.mcva-track');
                var next = el.querySelector('.mcva-next'), prev = el.querySelector('.mcva-prev');
                var idx = 0;
                function getVisible() {
                    return window.innerWidth <= 768 ? 1 : 3;
                }
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
