export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    // ── Carrousel 1 : Cards programmes (variante A – image + header + body) ──
    editor.BlockManager.add('master-carousel-programmes', {
        label: 'Carrousel Programmes',
        category: cat,
        content: {
            type: 'mc-programmes',
            styles: `
                .mcp-section { padding: 48px 20px; background: #fff; font-family: Arial, sans-serif; }
                .mcp-viewport { max-width: 1100px; margin: 0 auto; overflow: hidden; }
                .mcp-track { display: flex; transition: transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94); }
                .mcp-card { flex: 0 0 calc(100%/3); padding: 8px; box-sizing: border-box; }
                .mcp-card-inner { border: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 100%; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
                .mcp-card-head { background: #f7f9fc; color: var(--brand-primary,#374151); padding: 14px 16px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.35; min-height: 54px; display: flex; align-items: center; border-top: 4px solid var(--brand-primary,#374151); }
                .mcp-card-img { width: 100%; height: 190px; object-fit: cover; display: block; }
                .mcp-card-body { padding: 16px; font-size: 13.5px; color: #333; line-height: 1.6; flex: 1; }
                .mcp-card-body ul { margin: 10px 0 0; padding-left: 0; list-style: none; }
                .mcp-card-body ul li::before { content: "• "; }
                .mcp-nav { text-align: center; margin-top: 22px; }
                .mcp-prev, .mcp-next { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #555; background: #fff; cursor: pointer; font-size: 22px; margin: 0 5px; transition: background 0.2s, color 0.2s; color: #333; }
                .mcp-prev:hover, .mcp-next:hover { background: var(--brand-primary,#374151); color: #fff; border-color: var(--brand-primary,#374151); }
                @media(max-width:1024px) and (min-width:581px) { .mcp-card { flex: 0 0 50%; } }
                @media(max-width:580px) { .mcp-card { flex: 0 0 100%; } }
            `,
            components: [{
                tagName: 'section',
                classes: ['mcp-section'],
                components: [{
                    tagName: 'div', classes: ['mcp-viewport'],
                    components: [{
                        tagName: 'div', classes: ['mcp-track'],
                        components: [
                            {tagName:'div',classes:['mcp-card'],components:[{tagName:'div',classes:['mcp-card-inner'],components:[{tagName:'div',classes:['mcp-card-head'],components:'PROGRAMME 1'},{type:'image',attributes:{src:'https://placehold.co/380x190/dde3ea/374151?text=Programme+1',alt:''},style:{width:'100%',height:'190px','object-fit':'cover'}},{tagName:'div',classes:['mcp-card-body'],components:"Description du programme 1. Modifiez ce texte pour présenter votre formation."}]}]},
                            {tagName:'div',classes:['mcp-card'],components:[{tagName:'div',classes:['mcp-card-inner'],components:[{tagName:'div',classes:['mcp-card-head'],components:'PROGRAMME 2'},{type:'image',attributes:{src:'https://placehold.co/380x190/cdd8e2/374151?text=Programme+2',alt:''},style:{width:'100%',height:'190px','object-fit':'cover'}},{tagName:'div',classes:['mcp-card-body'],components:'Description du programme 2. Modifiez ce texte pour présenter votre formation.'}]}]},
                            {tagName:'div',classes:['mcp-card'],components:[{tagName:'div',classes:['mcp-card-inner'],components:[{tagName:'div',classes:['mcp-card-head'],components:'PROGRAMME 3'},{type:'image',attributes:{src:'https://placehold.co/380x190/c8d4de/374151?text=Programme+3',alt:''},style:{width:'100%',height:'190px','object-fit':'cover'}},{tagName:'div',classes:['mcp-card-body'],components:'Description du programme 3. Modifiez ce texte pour présenter votre formation.'}]}]},
                            {tagName:'div',classes:['mcp-card'],components:[{tagName:'div',classes:['mcp-card-inner'],components:[{tagName:'div',classes:['mcp-card-head'],components:'PROGRAMME 4'},{type:'image',attributes:{src:'https://placehold.co/380x190/b5c7d6/374151?text=Programme+4',alt:''},style:{width:'100%',height:'190px','object-fit':'cover'}},{tagName:'div',classes:['mcp-card-body'],components:'Description du programme 4. Modifiez ce texte pour présenter votre formation.'}]}]}
                        ]
                    }, {
                        tagName:'div', classes:['mcp-nav'],
                        components:[
                            {tagName:'button',classes:['mcp-prev'],components:'&#8249;'},
                            {tagName:'button',classes:['mcp-next'],components:'&#8250;'}
                        ]
                    }]
                }]
            }]
        },
        attributes: { class: 'fa fa-th' }
    });

    editor.DomComponents.addType('mc-programmes', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el = this;
                    var track = el.querySelector('.mcp-track');
                    var next = el.querySelector('.mcp-next');
                    var prev = el.querySelector('.mcp-prev');
                    var idx = 0;
                    function visible() {
                        if (window.innerWidth <= 580) return 1;
                        if (window.innerWidth <= 1024) return 2;
                        return 3;
                    }
                    function update() {
                        var v = visible();
                        var max = track.children.length - v;
                        idx = Math.min(Math.max(idx,0), max);
                        track.style.transform = 'translateX(-' + (idx * track.firstElementChild.offsetWidth) + 'px)';
                    }
                    next.addEventListener('click', function() { idx = idx < track.children.length - visible() ? idx+1 : 0; update(); });
                    prev.addEventListener('click', function() { idx = idx > 0 ? idx-1 : track.children.length - visible(); update(); });
                    window.addEventListener('resize', update);
                    update();
                }
            }
        }
    });

    // ── Carrousel 2 : Témoignages (variante B – vidéo/photo + citation + profil) ──
    editor.BlockManager.add('master-carousel-temoignages', {
        label: 'Carrousel Témoignages',
        category: cat,
        content: {
            type: 'mc-temoignages',
            styles: `
                .mct-section { padding: 48px 20px; background: #fff; font-family: Arial, sans-serif; }
                .mct-inner { max-width: 720px; margin: 0 auto; }
                .mct-slides { overflow: hidden; }
                .mct-track { display: flex; transition: transform 0.42s ease; }
                .mct-slide { flex: 0 0 100%; }
                .mct-img { width: 100%; height: 300px; object-fit: cover; display: block; border-radius: 2px; }
                .mct-quote-box { border-left: 4px solid var(--brand-primary,#1f2937); padding: 20px 24px; margin-top: 20px; }
                .mct-quote { font-size: 15px; font-style: italic; color: #222; line-height: 1.65; margin: 0 0 16px; }
                .mct-profile { display: flex; align-items: center; gap: 16px; }
                .mct-profile-logo { height: 40px; object-fit: contain; }
                .mct-profile-info strong { display: block; font-size: 14px; color: #111; }
                .mct-profile-info span { font-size: 12px; color: #666; }
                .mct-nav { text-align: center; margin-top: 20px; }
                .mct-prev, .mct-next { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #555; background: #fff; cursor: pointer; font-size: 22px; margin: 0 5px; color: #333; transition: background 0.2s, color 0.2s; }
                .mct-prev:hover, .mct-next:hover { background: #333; color: #fff; }
            `,
            components: [{
                tagName:'section', classes:['mct-section'],
                components:[{tagName:'div', classes:['mct-inner'],
                    components:[
                        {tagName:'div',classes:['mct-slides'],components:[{tagName:'div',classes:['mct-track'],components:[
                            {tagName:'div',classes:['mct-slide'],components:[
                                {type:'image',attributes:{src:'https://placehold.co/720x300/333/fff?text=Témoignage+vidéo',alt:''},style:{width:'100%',height:'300px','object-fit':'cover'}},
                                {tagName:'div',classes:['mct-quote-box'],components:[
                                    {tagName:'p',classes:['mct-quote'],components:'"Ce que j\'ai le plus appris ici, c\'est le processus de création de sa conception à sa fabrication. Aussi le travail en équipe, on est amené à travailler avec les services marketing."'},
                                    {tagName:'div',classes:['mct-profile'],components:[
                                        {type:'image',attributes:{src:'https://placehold.co/80x40/f0f0f0/333?text=Logo',alt:''},style:{height:'40px','object-fit':'contain'}},
                                        {tagName:'div',classes:['mct-profile-info'],components:'<strong>Angèle</strong><span>Étudiante en 4e année – Direction Artistique</span>'}
                                    ]}
                                ]}
                            ]},
                            {tagName:'div',classes:['mct-slide'],components:[
                                {type:'image',attributes:{src:'https://placehold.co/720x300/555/fff?text=Témoignage+2',alt:''},style:{width:'100%',height:'300px','object-fit':'cover'}},
                                {tagName:'div',classes:['mct-quote-box'],components:[
                                    {tagName:'p',classes:['mct-quote'],components:'"La formation m\'a apporté toutes les connaissances nécessaires pour mon métier de Directeur Artistique."'},
                                    {tagName:'div',classes:['mct-profile'],components:[
                                        {type:'image',attributes:{src:'https://placehold.co/80x40/f0f0f0/333?text=Logo',alt:''},style:{height:'40px','object-fit':'contain'}},
                                        {tagName:'div',classes:['mct-profile-info'],components:'<strong>Cédric</strong><span>Art Director – Diplômé 1997</span>'}
                                    ]}
                                ]}
                            ]}
                        ]}]},
                        {tagName:'div',classes:['mct-nav'],components:[
                            {tagName:'button',classes:['mct-prev'],components:'&#8249;'},
                            {tagName:'button',classes:['mct-next'],components:'&#8250;'}
                        ]}
                    ]
                }]
            }]
        },
        attributes: { class: 'fa fa-quote-left' }
    });

    editor.DomComponents.addType('mc-temoignages', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el = this;
                    var track = el.querySelector('.mct-track');
                    var next = el.querySelector('.mct-next');
                    var prev = el.querySelector('.mct-prev');
                    var idx = 0;
                    var total = track ? track.children.length : 0;
                    function update() {
                        if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
                    }
                    if (next) next.addEventListener('click', function() { idx = idx < total-1 ? idx+1 : 0; update(); });
                    if (prev) prev.addEventListener('click', function() { idx = idx > 0 ? idx-1 : total-1; update(); });
                    update();
                }
            }
        }
    });

    // ── Carrousel 3 : Campus ──
    editor.BlockManager.add('master-carousel-campus', {
        label: 'Carrousel Campus',
        category: cat,
        content: {
            type: 'mc-campus',
            styles: `
                .mcc2-section { padding: 40px 20px; font-family: Arial, sans-serif; }
                .mcc2-inner { max-width: 640px; margin: 0 auto; }
                .mcc2-slides { overflow: hidden; }
                .mcc2-track { display: flex; transition: transform 0.42s ease; }
                .mcc2-slide { flex: 0 0 100%; }
                .mcc2-slide-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
                .mcc2-badge { background: var(--brand-primary,#1f2937); color: #e5e7eb; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 2px; }
                .mcc2-line { flex: 1; height: 1px; background: #ddd; }
                .mcc2-addr { font-size: 13px; color: #555; margin: 0 0 10px; }
                .mcc2-img-wrap { position: relative; }
                .mcc2-img { width: 100%; height: 320px; object-fit: cover; display: block; }
                .mcc2-city { position: absolute; bottom: 16px; left: 16px; font-size: 28px; font-weight: 900; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
                .mcc2-nav { text-align: center; margin-top: 18px; }
                .mcc2-prev, .mcc2-next { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #555; background: #fff; cursor: pointer; font-size: 22px; margin: 0 5px; color: #333; transition: background 0.2s, color 0.2s; }
                .mcc2-prev:hover, .mcc2-next:hover { background: #333; color: #fff; }
            `,
            components: [{
                tagName:'section', classes:['mcc2-section'],
                components:[{tagName:'div', classes:['mcc2-inner'],
                    components:[
                        {tagName:'div',classes:['mcc2-slides'],components:[{tagName:'div',classes:['mcc2-track'],components:[
                            {tagName:'div',classes:['mcc2-slide'],components:[
                                {tagName:'div',classes:['mcc2-slide-head'],components:[{tagName:'span',classes:['mcc2-badge'],components:'Annecy'},{tagName:'div',classes:['mcc2-line']}]},
                                {tagName:'p',classes:['mcc2-addr'],components:'105, avenue de Genève, 74000 Annecy'},
                                {tagName:'div',classes:['mcc2-img-wrap'],components:[
                                    {type:'image',attributes:{src:'https://placehold.co/640x320/7a9e7e/fff?text=Annecy',alt:'Annecy'},style:{width:'100%',height:'320px','object-fit':'cover'}},
                                    {tagName:'div',classes:['mcc2-city'],components:'Annecy'}
                                ]}
                            ]},
                            {tagName:'div',classes:['mcc2-slide'],components:[
                                {tagName:'div',classes:['mcc2-slide-head'],components:[{tagName:'span',classes:['mcc2-badge'],components:'Paris'},{tagName:'div',classes:['mcc2-line']}]},
                                {tagName:'p',classes:['mcc2-addr'],components:'84, bd de Courcelles, 75017 Paris'},
                                {tagName:'div',classes:['mcc2-img-wrap'],components:[
                                    {type:'image',attributes:{src:'https://placehold.co/640x320/5a7aa0/fff?text=Paris',alt:'Paris'},style:{width:'100%',height:'320px','object-fit':'cover'}},
                                    {tagName:'div',classes:['mcc2-city'],components:'Paris'}
                                ]}
                            ]},
                            {tagName:'div',classes:['mcc2-slide'],components:[
                                {tagName:'div',classes:['mcc2-slide-head'],components:[{tagName:'span',classes:['mcc2-badge'],components:'Lyon'},{tagName:'div',classes:['mcc2-line']}]},
                                {tagName:'p',classes:['mcc2-addr'],components:'69, rue Vendôme, 69006 Lyon'},
                                {tagName:'div',classes:['mcc2-img-wrap'],components:[
                                    {type:'image',attributes:{src:'https://placehold.co/640x320/a07a5a/fff?text=Lyon',alt:'Lyon'},style:{width:'100%',height:'320px','object-fit':'cover'}},
                                    {tagName:'div',classes:['mcc2-city'],components:'Lyon'}
                                ]}
                            ]}
                        ]}]},
                        {tagName:'div',classes:['mcc2-nav'],components:[
                            {tagName:'button',classes:['mcc2-prev'],components:'&#8249;'},
                            {tagName:'button',classes:['mcc2-next'],components:'&#8250;'}
                        ]}
                    ]
                }]
            }]
        },
        attributes: { class: 'fa fa-map-marker' }
    });

    editor.DomComponents.addType('mc-campus', {
        model: {
            defaults: {
                'script-props': [],
                script: function() {
                    var el = this;
                    var track = el.querySelector('.mcc2-track');
                    var next = el.querySelector('.mcc2-next');
                    var prev = el.querySelector('.mcc2-prev');
                    var idx = 0;
                    var total = track ? track.children.length : 0;
                    function update() { if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)'; }
                    if (next) next.addEventListener('click', function() { idx = idx < total-1 ? idx+1 : 0; update(); });
                    if (prev) prev.addEventListener('click', function() { idx = idx > 0 ? idx-1 : total-1; update(); });
                    update();
                }
            }
        }
    });
}
