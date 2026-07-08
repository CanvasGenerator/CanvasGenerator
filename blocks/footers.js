// Footers des écoles — reproduction fidèle des maquettes "Maquettes headers & footers".
// Chaque footer : fond BLANC, logo NOIR + baseline (sous/à droite du nom), icônes sociales
// (cercles noirs, glyphe blanc), puis texte légal RGPD en dessous.
// Couleurs codées en dur (fond blanc) et volontairement NON pilotées par --brand-header.
// Les ids de blocs (footer-<id>) correspondent aux ids de schools.json.
export default function(editor, categories) {
    const ink = '#111111';
    const schools = [
        {
            id: 'footer-efap', label: 'EFAP Footer', category: categories.EFAP,
            logoFont: "'Georgia','Times New Roman',serif", logo: `E<i>|</i>F<i>|</i>A<i>|</i>P`,
            baseline: "L'école des nouveaux métiers<br>de la communication", legalName: "L'EFAP"
        },
        {
            id: 'footer-brassart', label: 'BRASSART Footer', category: categories.BRASSART,
            logoFont: "'Arial Black',Arial,sans-serif", logo: `BRASSART`,
            baseline: "L'école des métiers<br>de la création", legalName: "BRASSART"
        },
        {
            id: 'footer-cread', label: 'CREAD Footer', category: categories.CREAD,
            logoFont: "'Arial Black',Arial,sans-serif", logo: `CREAD`,
            baseline: "L'école des métiers<br>de l'architecture intérieure", legalName: "Le CREAD"
        },
        {
            id: 'footer-esec', label: 'ÉSEC Footer', category: categories.ESEC,
            logoFont: "'Arial Black',Arial,sans-serif", logo: `<span class="esec-box">ÉSEC</span>`,
            baseline: "L'école des métiers<br>du cinéma et de l'audiovisuel", legalName: "L'ÉSEC",
            extraCss: `.footer-esec .esec-box { display:inline-block; border:2px solid #D9000D; padding:4px 16px; letter-spacing:2px; }`
        },
        {
            id: 'footer-icart', label: 'ICART Footer', category: categories.ICART,
            logoFont: "'Inter',Arial,sans-serif", logo: `I<i>|</i>C<i>|</i>A<i>|</i>R<i>|</i>T`,
            baseline: "L'école du management<br>de la culture et du marché de l'art", legalName: "L'ICART"
        },
        {
            id: 'footer-ifa-paris', label: 'IFA Paris Footer', category: categories.IFA,
            logoFont: "'Georgia','Times New Roman',serif", logo: `IFA Paris`,
            baseline: "L'école internationale<br>des métiers de la <em>mode</em>", legalName: "IFA Paris"
        },
        {
            id: 'footer-mopa', label: 'MoPA Footer', category: categories.MOPA,
            logoFont: "'Arial Black',Arial,sans-serif", logo: `MoPA`,
            baseline: "L'école internationale<br>du cinéma d'animation", legalName: "MoPA"
        },
        {
            id: 'footer-ecole-bleue', label: 'École Bleue Footer', category: categories.BLEUE,
            logoFont: "'Arial Black',Arial,sans-serif", logo: `<span class="bleue-logo">ECOLE<br>BLEUE</span>`,
            baseline: "Architecture intérieure<br>et métiers du design", legalName: "L'École Bleue",
            extraCss: `.footer-ecole-bleue .bleue-logo { display:inline-block; line-height:0.95; letter-spacing:1px; }`
        },
        {
            id: 'footer-efj', label: 'EFJ Footer', category: categories.EFJ,
            logoFont: "'Arial Black',Arial,sans-serif", logo: `E<i>|</i>F<i>|</i>J`,
            baseline: "L'école du nouveau<br>journalisme", legalName: "L'EFJ"
        },
        {
            id: 'footer-3wa', label: '3W Academy Footer', category: categories['3WA'],
            logoFont: "'Arial Black',Arial,sans-serif",
            logo: `<span class="wa-logo"><b>3W</b><span class="wa-sub">ACADEMY</span></span>`,
            baseline: "L'école des nouveaux métiers<br>du code et du numérique", legalName: "La 3W Academy",
            extraCss: `.footer-3wa .wa-logo { display:inline-flex; flex-direction:column; line-height:1; }
                       .footer-3wa .wa-logo b { font-size:34px; }
                       .footer-3wa .wa-logo .wa-sub { font-size:13px; letter-spacing:4px; font-weight:700; }`
        }
    ];

    // Icônes sociales : cercles noirs, glyphe blanc (identique aux maquettes).
    const socialIcons = `
        <a href="#" class="ft-social" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.366-.333 2.633-1.308 3.608-.975.975-2.242 1.245-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.063-2.633-.333-3.608-1.308-.975-.975-1.245-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.35.061-2.68.327-3.684 1.332C2.364 2.409 2.098 3.739 2.037 5.088 1.979 6.368 1.965 6.776 1.965 10.035s.014 3.667.072 4.947c.061 1.35.327 2.68 1.332 3.684 1.004 1.004 2.335 1.27 3.684 1.332 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.35-.061 2.68-.327 3.684-1.332 1.004-1.004 1.27-2.335 1.332-3.684.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.061-1.35-.327-2.68-1.332-3.684-1.004-1.004-2.335-1.27-3.684-1.332-1.28-.058-1.688-.072-4.947-.072zM12 4.878a5.157 5.157 0 100 10.314 5.157 5.157 0 000-10.314zm0 8.541a3.384 3.384 0 110-6.768 3.384 3.384 0 010 6.768zm7.541-8.541a1.206 1.206 0 11-2.412 0 1.206 1.206 0 012.412 0z"/></svg></a>
        <a href="#" class="ft-social" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg></a>
        <a href="#" class="ft-social" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.032 2.62-.019 3.93-.006.156 5.225 4.056 5.59 5.535 5.893v3.916c-2.8-.127-5.232-1.416-6.037-3.213-.017 4.77-.031 9.542-.044 14.313-.157 8.164-11.412 8.503-12.32 1.032-.602-4.856 3.349-8.127 7.973-7.188 0 1.5.001 3.001.002 4.502-2.733-.581-5.124.837-4.746 3.227.621 2.358 4.83 2.461 5.427-.493.18-7.76.115-15.525.05-23.287l.23-.7z"/></svg></a>
        <a href="#" class="ft-social" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>
        <a href="#" class="ft-social" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505a3.017 3.017 0 00-2.122 2.136C0 8.055 0 12 0 12s0 3.945.501 5.814a3.017 3.017 0 002.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.945 24 12 24 12s0-3.945-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
    `;

    schools.forEach(school => {
        editor.BlockManager.add(school.id, {
            label: school.label,
            category: school.category || 'Footers',
            content: `
                <footer class="${school.id}">
                    <div class="ft-inner">
                        <div class="ft-top">
                            <div class="ft-brand">
                                <div class="ft-logo">${school.logo}</div>
                                <div class="ft-baseline">${school.baseline}</div>
                            </div>
                            <div class="ft-social-row">
                                ${socialIcons}
                            </div>
                        </div>
                        <p class="ft-legal">
                            ${school.legalName} collecte vos données afin de vous adresser de la documentation. Si vous le souhaitez, nous collectons également vos données afin de vous adresser des emails commerciaux. Pour en savoir plus sur le traitement de vos données et pour exercer vos droits, nous vous invitons à consulter la <a href="#" class="ft-legal-link">Politique de confidentialité</a>.
                        </p>
                    </div>
                </footer>
                <style>
                    .${school.id} {
                        background-color: #ffffff;
                        color: ${ink};
                        width: 100%;
                        margin: 0;
                        padding: 50px 90px 40px 90px;
                        font-family: 'Inter', sans-serif;
                    }
                    .${school.id} .ft-inner { max-width: 1240px; margin: 0 auto; }
                    .${school.id} .ft-top {
                        display: flex;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 40px;
                        flex-wrap: wrap;
                        margin-bottom: 40px;
                    }
                    .${school.id} .ft-brand { display: flex; align-items: center; gap: 28px; }
                    .${school.id} .ft-logo {
                        font-family: ${school.logoFont};
                        font-size: 30px;
                        font-weight: 900;
                        color: ${ink};
                        line-height: 1;
                        white-space: nowrap;
                    }
                    .${school.id} .ft-logo i { font-style: normal; font-weight: 300; opacity: 0.55; margin: 0 6px; }
                    .${school.id} .ft-logo em { font-style: italic; }
                    .${school.id} .ft-baseline { font-size: 12px; line-height: 1.3; font-weight: 600; color: ${ink}; }
                    .${school.id} .ft-social-row { display: flex; gap: 14px; }
                    .${school.id} .ft-social {
                        width: 40px; height: 40px; border-radius: 50%;
                        background-color: ${ink};
                        display: flex; align-items: center; justify-content: center;
                        text-decoration: none;
                    }
                    .${school.id} .ft-social svg { width: 19px; height: 19px; fill: #ffffff; }
                    .${school.id} .ft-legal {
                        font-size: 13px; line-height: 1.7; color: #333333; margin: 0;
                        border-top: 1px solid #ededed; padding-top: 26px;
                    }
                    .${school.id} .ft-legal-link { color: ${ink}; text-decoration: underline; }
                    ${school.extraCss || ''}
                    @media (max-width: 768px) {
                        .${school.id} { padding: 40px 24px 30px 24px; }
                        .${school.id} .ft-top { flex-direction: column; gap: 24px; }
                        .${school.id} .ft-brand { flex-direction: column; align-items: flex-start; gap: 12px; }
                    }
                </style>
            `,
            attributes: { class: 'gjs-fonts gjs-f-b1' }
        });
    });
}
