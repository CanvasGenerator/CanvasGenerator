export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeSlide(imgSrc, tag, title, desc, linkLabel) {
        return {
            tagName: 'div',
            classes: ['mc2a-slide'],
            components: [
                { type: 'image', editable: true, selectable: true, attributes: { src: imgSrc, alt: title }, classes: ['mc2a-img'] },
                { type: 'text', tagName: 'span', classes: ['mc2a-tag'], editable: true, selectable: true, components: tag },
                {
                    tagName: 'div', classes: ['mc2a-body'],
                    components: [
                        { type: 'text', tagName: 'h3', classes: ['mc2a-title'], editable: true, selectable: true, components: title },
                        { type: 'text', tagName: 'p', classes: ['mc2a-desc'], editable: true, selectable: true, components: desc },
                        { type: 'text', tagName: 'a', classes: ['mc2a-link'], editable: true, selectable: true, attributes: { href: '#' }, components: linkLabel }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel2-a', {
        label: 'Carrousel 2 – A (événement + lien)',
        category: cat,
        attributes: { class: 'fa fa-calendar' },
        content: {
            type: 'mc2a-component',
            styles: `
                .mc2a-section { padding: 48px 20px; background: var(--brand-carousel, #fff); font-family: Arial, sans-serif; max-width: 1100px; margin: 0 auto; }
                .mc2a-viewport { max-width: 560px; margin: 0 auto; overflow: hidden; }
                .mc2a-track { display: flex; transition: transform 0.42s ease; }

                .mc2a-slide {
                    flex: 0 0 100%; box-sizing: border-box;
                    display: flex; flex-direction: column;
                    border-radius: 8px; overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.10);
                    border: 1px solid #e8ecf0;
                    position: relative;
                }
                .mc2a-img { width: 100%; height: 270px; object-fit: cover; display: block; }

                /* Badge */
                .mc2a-tag {
                    position: absolute; top: 16px; left: 16px;
                    background: var(--brand-primary, #374151);
                    color: #fff;
                    font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.08em; padding: 5px 13px; border-radius: 4px;
                }

                /* Corps */
                .mc2a-body {
                    padding: 24px 26px 28px;
                    background: #fff;
                    display: flex; flex-direction: column; gap: 10px;
                    border-top: 4px solid var(--brand-primary, #374151);
                }
                .mc2a-title { font-size: 20px; font-weight: 800; color: #1a1a2e; margin: 0; line-height: 1.3; }
                .mc2a-desc { font-size: 13.5px; color: #555; line-height: 1.7; margin: 0; }
                .mc2a-link {
                    display: inline-block; margin-top: 4px;
                    font-size: 13px; font-weight: 700;
                    color: var(--brand-primary, #374151);
                    text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
                }

                /* Navigation */
                .mc2a-nav { text-align: center; margin-top: 24px; }
                .mc2a-prev, .mc2a-next {
                    width: 42px; height: 42px; border-radius: 50%;
                    border: 2px solid var(--brand-primary, #374151);
                    background: #fff; cursor: pointer; font-size: 22px;
                    color: var(--brand-primary, #374151); margin: 0 6px;
                    transition: background 0.2s, color 0.2s;
                    display: inline-flex; align-items: center; justify-content: center;
                }
                .mc2a-prev:hover, .mc2a-next:hover {
                    background: var(--brand-primary, #374151); color: #fff;
                }
                @media(max-width:580px) { .mc2a-img { height: 210px; } .mc2a-title { font-size: 17px; } }
            `,
            components: [{
                tagName: 'section', classes: ['mc2a-section'],
                components: [
                    {
                        tagName: 'div', classes: ['mc2a-viewport'],
                        components: [{ tagName: 'div', classes: ['mc2a-track'], components: [
                            makeSlide('https://placehold.co/560x270/dde3ea/374151?text=Portes+Ouvertes', 'Portes Ouvertes',
                                'Nos Journées Portes Ouvertes',
                                'Nos équipes et nos étudiants vous attendent sur nos campus. Un moment idéal pour affiner votre choix d\'orientation et visiter nos ateliers.',
                                'Voir les dates →'),
                            makeSlide('https://placehold.co/560x270/cdd8e2/374151?text=Journées+Découverte', 'Journée Découverte',
                                'Découvrez Nos Formations',
                                'Venez rencontrer nos équipes pédagogiques, assister à des cours et poser toutes vos questions sur nos programmes.',
                                'Voir les dates →'),
                            makeSlide('https://placehold.co/560x270/c8d4de/374151?text=Webconférence', 'Webconférence',
                                'Sessions d\'Information en Ligne',
                                'Participez à nos webconférences pour tout savoir sur nos formations, les débouchés professionnels et les modalités d\'inscription.',
                                'S\'inscrire →')
                        ]}]
                    },
                    { tagName: 'div', classes: ['mc2a-nav'], components: [
                        { tagName: 'button', classes: ['mc2a-prev'], selectable: true, components: '&#8249;' },
                        { tagName: 'button', classes: ['mc2a-next'], selectable: true, components: '&#8250;' }
                    ]}
                ]
            }]
        }
    });

    editor.DomComponents.addType('mc2a-component', {
        model: { defaults: { 'script-props': [],
            script: function() {
                var el=this, track=el.querySelector('.mc2a-track');
                var next=el.querySelector('.mc2a-next'), prev=el.querySelector('.mc2a-prev');
                var idx=0, total=track?track.children.length:0;
                function go(i){idx=(i+total)%total;if(track)track.style.transform='translateX(-'+(idx*100)+'%)';}
                if(next)next.addEventListener('click',function(){go(idx+1);});
                if(prev)prev.addEventListener('click',function(){go(idx-1);});
            }
        }}
    });
}
