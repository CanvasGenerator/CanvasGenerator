export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeSlide(imgSrc, quote, personName, personRole, logoSrc) {
        return {
            tagName: 'div', classes: ['mc2b-slide'],
            components: [
                { type: 'image', editable: true, selectable: true, attributes: { src: imgSrc, alt: personName }, classes: ['mc2b-img'] },
                {
                    tagName: 'div', classes: ['mc2b-body'],
                    components: [
                        { tagName: 'div', classes: ['mc2b-qdeco'], components: '«' },
                        { type: 'text', tagName: 'p', classes: ['mc2b-quote'], editable: true, selectable: true, components: quote },
                        { tagName: 'hr', classes: ['mc2b-sep'] },
                        {
                            tagName: 'div', classes: ['mc2b-profile'],
                            components: [
                                { type: 'image', editable: true, selectable: true, attributes: { src: logoSrc, alt: 'logo' }, classes: ['mc2b-logo'] },
                                {
                                    tagName: 'div', classes: ['mc2b-info'],
                                    components: [
                                        { type: 'text', tagName: 'strong', classes: ['mc2b-name'], editable: true, selectable: true, components: personName },
                                        { type: 'text', tagName: 'span', classes: ['mc2b-role'], editable: true, selectable: true, components: personRole }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel2-b', {
        label: 'Carrousel 2 – B (témoignage + profil)',
        category: cat,
        attributes: { class: 'fa fa-quote-left' },
        content: {
            type: 'mc2b-component',
            styles: `
                .mc2b-section { padding: 48px 20px; background: var(--brand-carousel, #f7f9fc); font-family: Arial, sans-serif; max-width: 1100px; margin: 0 auto; }
                .mc2b-viewport { max-width: 520px; margin: 0 auto; overflow: hidden; }
                .mc2b-track { display: flex; transition: transform 0.42s ease; }

                .mc2b-slide {
                    flex: 0 0 100%; box-sizing: border-box;
                    display: flex; flex-direction: column;
                    border-radius: 8px; overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.10);
                    border: 1px solid #e2e8f0;
                }
                .mc2b-img { width: 100%; height: 260px; object-fit: cover; display: block; }

                /* Corps — fond blanc légèrement teinté */
                .mc2b-body {
                    padding: 22px 24px 26px; background: #fff;
                    display: flex; flex-direction: column; gap: 12px;
                    border-top: 4px solid var(--brand-primary, #374151);
                }
                /* Guillemet décoratif coloré */
                .mc2b-qdeco {
                    font-size: 52px; line-height: 0.9;
                    color: var(--brand-primary, #374151);
                    font-family: Georgia, serif;
                    margin-bottom: -8px;
                    opacity: 0.6;
                }
                .mc2b-quote {
                    font-size: 14px; font-weight: 600; font-style: italic;
                    color: #2d3748; line-height: 1.75; margin: 0;
                }
                .mc2b-sep { border: none; border-top: 1px solid #e2e8f0; margin: 0; }
                .mc2b-profile { display: flex; align-items: center; gap: 14px; }
                .mc2b-logo {
                    height: 48px; width: 48px; object-fit: contain;
                    flex-shrink: 0; border-radius: 50%;
                    border: 2px solid #e2e8f0; background: #f7f9fc; padding: 3px;
                }
                .mc2b-info { display: flex; flex-direction: column; gap: 3px; }
                .mc2b-name { font-size: 13.5px; font-weight: 800; color: var(--brand-primary, #374151); display: block; }
                .mc2b-role { font-size: 12px; color: #718096; display: block; }

                /* Navigation */
                .mc2b-nav { text-align: center; margin-top: 24px; }
                .mc2b-prev, .mc2b-next {
                    width: 42px; height: 42px; border-radius: 50%;
                    border: 2px solid var(--brand-primary, #374151);
                    background: #fff; cursor: pointer; font-size: 22px;
                    color: var(--brand-primary, #374151); margin: 0 6px;
                    transition: background 0.2s, color 0.2s;
                    display: inline-flex; align-items: center; justify-content: center;
                }
                .mc2b-prev:hover, .mc2b-next:hover {
                    background: var(--brand-primary, #374151); color: #fff;
                }
                @media(max-width:580px) { .mc2b-img { height: 210px; } }
            `,
            components: [{
                tagName: 'section', classes: ['mc2b-section'],
                components: [
                    {
                        tagName: 'div', classes: ['mc2b-viewport'],
                        components: [{ tagName: 'div', classes: ['mc2b-track'], components: [
                            makeSlide('https://placehold.co/520x260/dde3ea/374151?text=Témoignage+1',
                                'Ce que j\'ai le plus appris ici, c\'est le processus de création d\'un livre de sa conception à sa fabrication. Aussi le travail en équipe avec les services marketing et d\'édition.',
                                'Angèle', 'Étudiante en 4e année – Direction Artistique',
                                'https://placehold.co/48x48/e2e8f0/374151?text=A'),
                            makeSlide('https://placehold.co/520x260/cdd8e2/374151?text=Témoignage+2',
                                'La formation m\'a apporté toutes les connaissances nécessaires pour exercer mon métier avec confiance et créativité. Les projets pratiques sont une vraie force.',
                                'Thomas', 'Diplômé – Designer Graphique',
                                'https://placehold.co/48x48/e2e8f0/374151?text=T'),
                            makeSlide('https://placehold.co/520x260/c8d4de/374151?text=Témoignage+3',
                                'Une formation exigeante qui prépare vraiment au monde professionnel. Les partenariats avec des studios reconnus donnent une vraie légitimité à notre portfolio.',
                                'Lucie', 'Étudiante en 3e année – Animation 3D',
                                'https://placehold.co/48x48/e2e8f0/374151?text=L')
                        ]}]
                    },
                    { tagName: 'div', classes: ['mc2b-nav'], components: [
                        { tagName: 'button', classes: ['mc2b-prev'], selectable: true, components: '&#8249;' },
                        { tagName: 'button', classes: ['mc2b-next'], selectable: true, components: '&#8250;' }
                    ]}
                ]
            }]
        }
    });

    editor.DomComponents.addType('mc2b-component', {
        model: { defaults: { 'script-props': [],
            script: function() {
                var el=this, track=el.querySelector('.mc2b-track');
                var next=el.querySelector('.mc2b-next'), prev=el.querySelector('.mc2b-prev');
                var idx=0, total=track?track.children.length:0;
                function go(i){idx=(i+total)%total;if(track)track.style.transform='translateX(-'+(idx*100)+'%)';}
                if(next)next.addEventListener('click',function(){go(idx+1);});
                if(prev)prev.addEventListener('click',function(){go(idx-1);});
            }
        }}
    });
}
