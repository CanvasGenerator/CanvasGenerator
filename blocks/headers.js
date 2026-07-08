// Headers des écoles — reproduction fidèle des maquettes "Maquettes headers & footers".
// Chaque header : fond couleur de marque, logo + baseline à droite (blanc, ou noir pour MoPA),
// CTA langue "FR" à l'extrême droite.
// Les couleurs sont codées en dur (identiques aux maquettes) et volontairement NON pilotées
// par --brand-header : voir server.js BRAND_HEADER_SELECTORS et app.js (override désactivé).
// Les ids de blocs (header-<id>) correspondent aux ids de schools.json.
export default function(editor, categories) {
    const schools = [
        {
            id: 'header-efap', label: 'EFAP Header', category: categories.EFAP,
            bg: '#000000', fg: '#ffffff', logoFont: "'Georgia','Times New Roman',serif",
            logo: `E<i>|</i>F<i>|</i>A<i>|</i>P`,
            baseline: "L'école des nouveaux métiers<br>de la communication"
        },
        {
            id: 'header-brassart', label: 'BRASSART Header', category: categories.BRASSART,
            bg: '#C7005D', fg: '#ffffff', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `BRASSART`,
            baseline: "L'école des métiers<br>de la création"
        },
        {
            id: 'header-cread', label: 'CREAD Header', category: categories.CREAD,
            bg: '#463A8F', fg: '#ffffff', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `CREAD`,
            baseline: "L'école des métiers<br>de l'architecture intérieure"
        },
        {
            id: 'header-esec', label: 'ÉSEC Header', category: categories.ESEC,
            bg: '#000000', fg: '#ffffff', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `<span class="esec-box">ÉSEC</span>`,
            baseline: "L'école des métiers<br>du cinéma et de l'audiovisuel",
            extraCss: `.header-esec .esec-box { display:inline-block; border:2px solid #D9000D; padding:4px 16px; letter-spacing:2px; }`
        },
        {
            id: 'header-icart', label: 'ICART Header', category: categories.ICART,
            bg: '#E9540D', fg: '#ffffff', logoFont: "'Inter',Arial,sans-serif",
            logo: `I<i>|</i>C<i>|</i>A<i>|</i>R<i>|</i>T`,
            baseline: "L'école du management<br>de la culture et du marché de l'art"
        },
        {
            id: 'header-ifa-paris', label: 'IFA Paris Header', category: categories.IFA,
            bg: '#000000', fg: '#ffffff', logoFont: "'Georgia','Times New Roman',serif",
            logo: `IFA Paris`,
            baseline: "L'école internationale<br>des métiers de la <em>mode</em>"
        },
        {
            id: 'header-mopa', label: 'MoPA Header', category: categories.MOPA,
            bg: '#FFE73E', fg: '#000000', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `MoPA`,
            baseline: "L'école internationale<br>du cinéma d'animation"
        },
        {
            id: 'header-ecole-bleue', label: 'École Bleue Header', category: categories.BLEUE,
            bg: '#000041', fg: '#ffffff', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `<span class="bleue-logo">ECOLE<br>BLEUE</span>`,
            baseline: "Architecture intérieure<br>et métiers du design",
            extraCss: `.header-ecole-bleue .bleue-logo { display:inline-block; line-height:0.95; letter-spacing:1px; }`
        },
        {
            id: 'header-efj', label: 'EFJ Header', category: categories.EFJ,
            bg: '#00858C', fg: '#ffffff', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `E<i>|</i>F<i>|</i>J`,
            baseline: "L'école du nouveau<br>journalisme"
        },
        {
            id: 'header-3wa', label: '3W Academy Header', category: categories['3WA'],
            bg: '#CD1316', fg: '#ffffff', logoFont: "'Arial Black',Arial,sans-serif",
            logo: `<span class="wa-logo"><b>3W</b><span class="wa-sub">ACADEMY</span></span>`,
            baseline: "L'école des nouveaux métiers<br>du code et du numérique",
            extraCss: `.header-3wa .wa-logo { display:inline-flex; flex-direction:column; line-height:1; }
                       .header-3wa .wa-logo b { font-size:38px; }
                       .header-3wa .wa-logo .wa-sub { font-size:14px; letter-spacing:4px; font-weight:700; }`
        }
    ];

    schools.forEach(school => {
        editor.BlockManager.add(school.id, {
            label: school.label,
            category: school.category || 'Headers',
            content: `
                <header class="${school.id}">
                    <div class="hdr-inner">
                        <div class="hdr-brand">
                            <div class="hdr-logo">${school.logo}</div>
                            <div class="hdr-baseline">${school.baseline}</div>
                        </div>
                        <div class="hdr-lang">FR</div>
                    </div>
                </header>
                <style>
                    .${school.id} {
                        background-color: ${school.bg};
                        color: ${school.fg};
                        width: 100%;
                        margin: 0;
                        font-family: 'Inter', sans-serif;
                    }
                    .${school.id} .hdr-inner {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 22px 90px;
                    }
                    .${school.id} .hdr-brand {
                        display: flex;
                        align-items: center;
                        gap: 32px;
                    }
                    .${school.id} .hdr-logo {
                        font-family: ${school.logoFont};
                        font-size: 32px;
                        font-weight: 900;
                        color: ${school.fg};
                        line-height: 1;
                        white-space: nowrap;
                    }
                    .${school.id} .hdr-logo i {
                        font-style: normal;
                        font-weight: 300;
                        opacity: 0.55;
                        margin: 0 7px;
                    }
                    .${school.id} .hdr-logo em { font-style: italic; }
                    .${school.id} .hdr-baseline {
                        font-size: 13px;
                        line-height: 1.25;
                        font-weight: 600;
                        color: ${school.fg};
                    }
                    .${school.id} .hdr-lang {
                        font-size: 15px;
                        font-weight: 700;
                        letter-spacing: 1px;
                        color: ${school.fg};
                        cursor: pointer;
                    }
                    ${school.extraCss || ''}
                    @media (max-width: 768px) {
                        .${school.id} .hdr-inner { padding: 16px 24px; }
                        .${school.id} .hdr-brand { gap: 16px; }
                        .${school.id} .hdr-logo { font-size: 24px; }
                        .${school.id} .hdr-baseline { font-size: 10px; }
                    }
                    @media (max-width: 520px) {
                        .${school.id} .hdr-baseline { display: none; }
                    }
                </style>
            `,
            attributes: { class: 'gjs-fonts gjs-f-b1' }
        });
    });
}
