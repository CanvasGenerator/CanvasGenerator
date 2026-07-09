// Headers des écoles — reproduction fidèle des maquettes "Maquettes headers & footers".
// Chaque header : fond couleur de marque, logo + baseline à droite (blanc, ou noir pour MoPA),
// CTA langue "FR" à l'extrême droite.
// Les couleurs sont codées en dur (identiques aux maquettes) et volontairement NON pilotées
// par --brand-header : voir server.js BRAND_HEADER_SELECTORS et app.js (override désactivé).
// Les ids de blocs (header-<id>) correspondent aux ids de schools.json.
export default function(editor, categories) {
    const schools = [
        // Tous les headers d'école sont désormais en version IMAGE (logos réels) :
        //   • EFAP        → blocks/efap-headers/index.js
        //   • Brassart    → blocks/brassart-headers/index.js
        //   • 3W ACADEMY  → blocks/3wa-headers/index.js
        //   • CREAD, EFJ, ICART, IFA PARIS, MOPA, ÉCOLE BLEUE, ÉSEC → blocks/more-school-headers/index.js
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
