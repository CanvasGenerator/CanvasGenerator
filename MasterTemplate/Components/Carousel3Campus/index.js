export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeSlide(badgeText, addressText, overlayText) {
        return {
            tagName: 'div', classes: ['mc3c-slide'],
            components: [{
                tagName: 'div', classes: ['mc3c-card'],
                components: [
                    // Header : badge + ligne
                    {
                        tagName: 'div', classes: ['mc3c-card-header'],
                        components: [
                            { type: 'text', tagName: 'span', classes: ['mc3c-badge'], editable: true, selectable: true, components: badgeText },
                            { tagName: 'hr', classes: ['mc3c-line'] }
                        ]
                    },
                    // Adresse
                    { type: 'text', tagName: 'div', classes: ['mc3c-address'], editable: true, selectable: true, components: addressText },
                    // Media + overlay
                    {
                        tagName: 'div', classes: ['mc3c-media'],
                        components: [
                            { type: 'image', editable: true, selectable: true, attributes: { src: '', alt: '' }, classes: ['mc3c-img'] },
                            { type: 'text', tagName: 'span', classes: ['mc3c-overlay-label'], editable: true, selectable: true, components: overlayText }
                        ]
                    }
                ]
            }]
        };
    }

    editor.BlockManager.add('master-carousel3-campus', {
        label: 'Carrousel 3 – Campus',
        category: cat,
        attributes: { class: 'fa fa-map-marker' },
        content: {
            type: 'mc3c-component',
            styles: `
                .mc3c-section { padding: 60px 20px; background: var(--brand-carousel, #f5f5f5); font-family: Arial, sans-serif; }
                .mc3c-container { max-width: 1100px; margin: 0 auto; overflow: hidden; }
                .mc3c-track { display: flex; transition: transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94); }

                .mc3c-slide { flex: 0 0 100%; box-sizing: border-box; }

                .mc3c-card { background: #f0f0f0; padding: 20px 20px 0 20px; }

                .mc3c-card-header { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }

                .mc3c-badge {
                    background: var(--brand-primary, #c0175e);
                    color: #fff; font-size: 13px; font-weight: 700;
                    padding: 4px 12px; border-radius: 2px;
                    white-space: nowrap; flex-shrink: 0;
                }

                .mc3c-line { flex: 1; border: none; border-top: 1px solid #999; margin: 0; }

                .mc3c-address { font-size: 13px; color: #333; margin-bottom: 14px; }

                .mc3c-media { position: relative; width: 100%; height: 280px; overflow: hidden; background: #d1d5db; }
                .mc3c-img { width: 100%; height: 100%; object-fit: cover; display: block; }

                .mc3c-overlay-label {
                    position: absolute; bottom: 16px; left: 16px;
                    color: #fff; font-size: 28px; font-weight: 700;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
                    pointer-events: none;
                }

                .mc3c-nav { text-align: center; margin-top: 24px; }

                .mc3c-prev, .mc3c-next {
                    width: 44px; height: 44px; border-radius: 50%;
                    border: 2px solid var(--brand-primary, #555); background: #fff;
                    cursor: pointer; font-size: 22px; margin: 0 5px;
                    color: #333; display: inline-flex; align-items: center; justify-content: center;
                    transition: background 0.2s, color 0.2s, border-color 0.2s;
                }
                .mc3c-prev:hover, .mc3c-next:hover { background: var(--brand-primary, #333); color: #fff; border-color: var(--brand-primary, #333); }

                @media (max-width: 640px) {
                    .mc3c-container { max-width: 100%; overflow: hidden; }
                    .mc3c-media { height: 200px; }
                    .mc3c-overlay-label { font-size: 22px; }
                    .mc3c-line { display: none; }
                }
            `,
            components: [{
                tagName: 'section', classes: ['mc3c-section'],
                components: [
                    {
                        tagName: 'div', classes: ['mc3c-container'],
                        components: [{
                            tagName: 'div', classes: ['mc3c-track'],
                            components: [
                                makeSlide('NOM', 'Adresse', 'Ville'),
                                makeSlide('NOM', 'Adresse', 'Ville'),
                                makeSlide('NOM', 'Adresse', 'Ville')
                            ]
                        }]
                    },
                    {
                        tagName: 'div', classes: ['mc3c-nav'],
                        components: [
                            { tagName: 'button', classes: ['mc3c-prev'], selectable: true, components: '&#8249;' },
                            { tagName: 'button', classes: ['mc3c-next'], selectable: true, components: '&#8250;' }
                        ]
                    }
                ]
            }]
        }
    });

    editor.DomComponents.addType('mc3c-component', {
        model: { defaults: { 'script-props': [],
            script: function() {
                var el = this;
                var track = el.querySelector('.mc3c-track');
                var next = el.querySelector('.mc3c-next');
                var prev = el.querySelector('.mc3c-prev');
                var idx = 0;
                var total = track ? track.children.length : 0;
                function go(i) {
                    idx = (i + total) % total;
                    if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
                }
                if (next) next.addEventListener('click', function() { go(idx + 1); });
                if (prev) prev.addEventListener('click', function() { go(idx - 1); });
            }
        }}
    });
}
