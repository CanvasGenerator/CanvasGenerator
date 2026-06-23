export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeSlide(imgSrc, quote, personName, personRole, logoSrc) {
        return {
            tagName: 'div', classes: ['mc2c-slide'],
            components: [
                /* Colonne gauche : portrait */
                {
                    tagName: 'div', classes: ['mc2c-img-col'],
                    components: [{ type: 'image', editable: true, selectable: true, attributes: { src: imgSrc, alt: personName }, classes: ['mc2c-img'] }]
                },
                /* Colonne droite : fond clair + citation */
                {
                    tagName: 'div', classes: ['mc2c-text-col'],
                    components: [
                        { tagName: 'div', classes: ['mc2c-bigquote'], components: '«' },
                        { type: 'text', tagName: 'p', classes: ['mc2c-quote'], editable: true, selectable: true, components: quote },
                        {
                            tagName: 'div', classes: ['mc2c-profile'],
                            components: [
                                { type: 'image', editable: true, selectable: true, attributes: { src: logoSrc, alt: 'logo' }, classes: ['mc2c-logo'] },
                                {
                                    tagName: 'div', classes: ['mc2c-info'],
                                    components: [
                                        { type: 'text', tagName: 'strong', classes: ['mc2c-name'], editable: true, selectable: true, components: personName },
                                        { type: 'text', tagName: 'span', classes: ['mc2c-role'], editable: true, selectable: true, components: personRole }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel2-c', {
        label: 'Carrousel 2 – C (portrait gauche + citation droite)',
        category: cat,
        attributes: { class: 'fa fa-user-circle' },
        content: {
            type: 'mc2c-component',
            styles: `
                .mc2c-section { padding: 0; background: #f7f9fc; font-family: Arial, sans-serif; }
                .mc2c-viewport { max-width: 820px; margin: 0 auto; overflow: hidden; }
                .mc2c-track { display: flex; transition: transform 0.42s ease; }

                /* Slide 2 colonnes */
                .mc2c-slide {
                    flex: 0 0 100%; box-sizing: border-box;
                    display: flex; min-height: 400px;
                    border-radius: 8px; overflow: hidden;
                    box-shadow: 0 6px 28px rgba(0,0,0,0.10);
                    border: 1px solid #e2e8f0;
                }

                /* Colonne image gauche 44% */
                .mc2c-img-col { flex: 0 0 44%; overflow: hidden; }
                .mc2c-img { width: 100%; height: 100%; object-fit: cover; display: block; }

                /* Colonne droite — fond blanc */
                .mc2c-text-col {
                    flex: 1;
                    background: #fff;
                    padding: 36px 34px 32px;
                    display: flex; flex-direction: column;
                    justify-content: space-between; gap: 18px;
                    border-left: 5px solid var(--brand-primary, #374151);
                }

                /* Grand guillemet coloré */
                .mc2c-bigquote {
                    font-size: 64px; line-height: 0.8;
                    color: var(--brand-primary, #374151);
                    font-family: Georgia, serif;
                    opacity: 0.5;
                    margin-bottom: -12px;
                }
                .mc2c-quote {
                    font-size: 15px; font-weight: 600; font-style: italic;
                    color: #2d3748; line-height: 1.78; margin: 0; flex: 1;
                }

                /* Profil */
                .mc2c-profile {
                    display: flex; align-items: center; gap: 14px;
                    border-top: 1px solid #e2e8f0; padding-top: 18px;
                }
                .mc2c-logo {
                    height: 52px; width: 52px; object-fit: contain;
                    flex-shrink: 0; border-radius: 50%;
                    border: 2px solid #e2e8f0; background: #f7f9fc; padding: 4px;
                }
                .mc2c-info { display: flex; flex-direction: column; gap: 4px; }
                .mc2c-name { font-size: 14px; font-weight: 800; color: var(--brand-primary, #374151); display: block; }
                .mc2c-role { font-size: 12.5px; color: #718096; display: block; }

                /* Navigation */
                .mc2c-nav { text-align: center; padding: 22px 0 28px; background: #f7f9fc; }
                .mc2c-prev, .mc2c-next {
                    width: 42px; height: 42px; border-radius: 50%;
                    border: 2px solid var(--brand-primary, #374151);
                    background: #fff; cursor: pointer; font-size: 22px;
                    color: var(--brand-primary, #374151); margin: 0 6px;
                    transition: background 0.2s, color 0.2s;
                    display: inline-flex; align-items: center; justify-content: center;
                }
                .mc2c-prev:hover, .mc2c-next:hover {
                    background: var(--brand-primary, #374151); color: #fff;
                }

                /* Mobile */
                @media(max-width:640px) {
                    .mc2c-section { padding: 0 16px; }
                    .mc2c-slide { flex-direction: column; min-height: auto; }
                    .mc2c-img-col { flex: 0 0 auto; height: 240px; }
                    .mc2c-text-col { padding: 22px 20px; border-left: none; border-top: 5px solid var(--brand-primary, #374151); }
                    .mc2c-quote { font-size: 13.5px; }
                }
            `,
            components: [{
                tagName: 'section', classes: ['mc2c-section'],
                components: [
                    {
                        tagName: 'div', classes: ['mc2c-viewport'],
                        components: [{ tagName: 'div', classes: ['mc2c-track'], components: [
                            makeSlide('https://placehold.co/370x400/cdd8e2/374151?text=Portrait',
                                '« La formation m\'a apporté toutes les connaissances nécessaires pour mon métier de Directeur Artistique. Un tremplin exceptionnel vers le monde professionnel. »',
                                'Cédric Humeau', 'Art Director – Diplômé 1997',
                                'https://placehold.co/52x52/dde3ea/374151?text=CH'),
                            makeSlide('https://placehold.co/370x400/becdda/374151?text=Portrait+2',
                                '« Une expérience unique qui m\'a permis de développer ma créativité et de construire un réseau professionnel solide dès ma sortie de l\'école. »',
                                'Sophie Martin', 'Motion Designer – Diplômée 2019',
                                'https://placehold.co/52x52/dde3ea/374151?text=SM'),
                            makeSlide('https://placehold.co/370x400/b5c7d6/374151?text=Portrait+3',
                                '« Ce qui m\'a le plus marqué, c\'est la proximité avec les professionnels et les projets concrets réalisés avec de vraies entreprises du secteur. »',
                                'Antoine Dupont', 'Brand Designer – Diplômé 2021',
                                'https://placehold.co/52x52/dde3ea/374151?text=AD')
                        ]}]
                    },
                    { tagName: 'div', classes: ['mc2c-nav'], components: [
                        { tagName: 'button', classes: ['mc2c-prev'], selectable: true, components: '&#8249;' },
                        { tagName: 'button', classes: ['mc2c-next'], selectable: true, components: '&#8250;' }
                    ]}
                ]
            }]
        }
    });

    editor.DomComponents.addType('mc2c-component', {
        model: { defaults: { 'script-props': [],
            script: function() {
                var el=this, track=el.querySelector('.mc2c-track');
                var next=el.querySelector('.mc2c-next'), prev=el.querySelector('.mc2c-prev');
                var idx=0, total=track?track.children.length:0;
                function go(i){idx=(i+total)%total;if(track)track.style.transform='translateX(-'+(idx*100)+'%)';}
                if(next)next.addEventListener('click',function(){go(idx+1);});
                if(prev)prev.addEventListener('click',function(){go(idx-1);});
            }
        }}
    });
}
