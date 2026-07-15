// Footers des écoles — style unique (maquette officielle) :
//   fond BLANC · logo NOIR (image, avec baseline) à gauche · réseaux sociaux
//   (cercles noirs, glyphe blanc) à droite · texte légal RGPD avec le nom de l'école.
// Le logo utilise l'image noire baseline-noir.png de chaque école, recadrée à la
// MÊME hauteur (LOGO_H = 54) que les headers (imgH + margin-top mesurés au pixel).
// Les ids de blocs (footer-<id>) correspondent aux ids de schools.json.
export default function(editor, categories) {
    const ink = '#111111';
    const LOGO_H = 54;
    const MOBILE_H = 38; // hauteur logo mobile (recadrage réduit)

    const schools = [
        { id: 'footer-efap',        label: 'EFAP Footer',        category: categories.EFAP,      A: 'assets/efap',        imgH: 88,  mt: -14, legalName: "L'EFAP" },
        { id: 'footer-brassart',    label: 'BRASSART Footer',    category: categories.BRASSART,  A: 'assets/brassart',    imgH: 34,  mt: 10,  legalName: "BRASSART" },
        { id: 'footer-cread',       label: 'CREAD Footer',       category: categories.CREAD,     A: 'assets/cread',       imgH: 70,  mt: -8,  legalName: "Le CREAD" },
        { id: 'footer-esec',        label: 'ÉSEC Footer',        category: categories.ESEC,      A: 'assets/esec',        imgH: 67,  mt: -7,  legalName: "L'ÉSEC" },
        { id: 'footer-icart',       label: 'ICART Footer',       category: categories.ICART,     A: 'assets/icart',       imgH: 85,  mt: -12, legalName: "L'ICART" },
        { id: 'footer-ifa-paris',   label: 'IFA Paris Footer',   category: categories.IFA,       A: 'assets/ifa',         imgH: 71,  mt: -2,  legalName: "IFA Paris" },
        { id: 'footer-mopa',        label: 'MoPA Footer',        category: categories.MOPA,      A: 'assets/mopa',        imgH: 77,  mt: -12, legalName: "MoPA" },
        { id: 'footer-ecole-bleue', label: 'École Bleue Footer', category: categories.BLEUE,     A: 'assets/ecole-bleue', imgH: 65,  mt: -6,  legalName: "L'École Bleue" },
        { id: 'footer-efj',         label: 'EFJ Footer',         category: categories.EFJ,       A: 'assets/efj',         imgH: 81,  mt: -13, legalName: "L'EFJ" },
        { id: 'footer-3wa',         label: '3W Academy Footer',  category: categories['3WA'],    A: 'assets/3wa',         imgH: 65,  mt: -6,  legalName: "La 3W Academy" }
    ];

    // Icônes sociales : jeu fourni par le client — cercles noirs, glyphes blancs
    // (couleurs codées en dur dans les SVG). Classe .reseau-icone.
    const socialIcons = `
        <a href="#" class="reseau-icone" aria-label="Instagram"><svg viewBox="0 0 24 24"><g fill="none" stroke="#ffffff" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.9" cy="7.1" r="1.15" fill="#ffffff" stroke="none"/></g></svg></a>
        <a href="#" class="reseau-icone" aria-label="Facebook"><svg viewBox="0 0 24 24"><path fill="#ffffff" d="M13.4 20v-6.2h2.1l.32-2.42H13.4V9.83c0-.7.2-1.18 1.2-1.18h1.3V6.48c-.23-.03-1-.1-1.9-.1-1.88 0-3.17 1.15-3.17 3.26v1.74H8.7v2.42h2.13V20h2.57z"/></svg></a>
        <a href="#" class="reseau-icone" aria-label="TikTok"><svg viewBox="0 0 24 24"><path fill="#ffffff" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12V9.77a5.76 5.76 0 0 0-.78-.05 5.68 5.68 0 1 0 5.68 5.68V9.29a7.35 7.35 0 0 0 4.3 1.38V7.58a4.34 4.34 0 0 1-3.24-1.76z"/></svg></a>
        <a href="#" class="reseau-icone" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path fill="#ffffff" d="M6.94 8.5H4.2V19.6h2.74V8.5zM5.57 7.34a1.62 1.62 0 1 0 0-3.24 1.62 1.62 0 0 0 0 3.24zM19.8 13.5c0-3.03-1.62-4.44-3.78-4.44-1.74 0-2.52.96-2.96 1.63V8.5h-2.74c.04.78 0 11.1 0 11.1h2.74v-6.2c0-.33.02-.66.12-.9.27-.66.87-1.35 1.89-1.35 1.33 0 1.99 1.02 1.99 2.51v5.94h2.74V13.5z"/></svg></a>
        <a href="#" class="reseau-icone" aria-label="YouTube"><svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="11" rx="3" fill="#ffffff"/><polygon points="10.4,9.5 15.2,12 10.4,14.5" fill="#000000"/></svg></a>
    `;

    schools.forEach(school => {
        // Brassart / IFA Paris / ICART ont des logos larges → on garde une hauteur
        // modérée (sinon ils débordent). Les autres écoles peuvent être un peu plus grandes.
        const logoH = ['footer-brassart', 'footer-ifa-paris', 'footer-icart'].includes(school.id) ? 46 : 58;
        editor.BlockManager.add(school.id, {
            label: school.label,
            category: school.category || 'Footers',
            content: `
                <footer class="${school.id}">
                    <div class="ft-inner">
                        <div class="ft-top">
                            <div class="ft-brand">
                                <span class="ft-logo"><img class="ft-logo-img" src="${school.A}/baseline-noir.png" alt="${school.label}"></span>
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
                        /* Footer TOUJOURS en noir & blanc, quelle que soit l'école
                           (on n'utilise PAS --brand-background qui peut être coloré). */
                        background-color: #ffffff;
                        color: ${ink};
                        width: 100%;
                        margin: 0;
                        padding: 50px 90px 40px 90px;
                        font-family: var(--brand-font, 'Inter', sans-serif);
                    }
                    .${school.id} .ft-inner { max-width: 1240px; margin: 0 auto; }
                    .${school.id} .ft-top {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 32px;
                        flex-wrap: nowrap;
                        margin-bottom: 40px;
                    }
                    /* Le logo se réduit si besoin → les réseaux restent à droite (desktop).
                       min-width:0 sur TOUTE la chaîne flex = indispensable pour qu'une
                       image puisse rétrécir sous sa taille intrinsèque. */
                    .${school.id} .ft-brand { display: flex; align-items: center; min-width: 0; flex: 0 1 auto; }
                    .${school.id} .ft-logo { display: flex; align-items: center; min-width: 0; max-width: 100%; overflow: hidden; }
                    .${school.id} .ft-logo-img { height: auto; width: auto; max-height: ${logoH}px; max-width: min(100%, 460px); display: block; }
                    .${school.id} .ft-social-row { display: flex; gap: 10px; flex: 0 0 auto; }
                    .${school.id} .reseau-icone {
                        width: 36px; height: 36px; border-radius: 50%;
                        background: #000000;
                        display: flex; align-items: center; justify-content: center;
                        text-decoration: none;
                    }
                    .${school.id} .reseau-icone svg { width: 20px; height: 20px; display: block; }
                    .${school.id} .ft-legal {
                        font-size: 13px; line-height: 1.7; color: ${ink}; margin: 0;
                        border-top: 1px solid #ededed; padding-top: 26px;
                    }
                    .${school.id} .ft-legal-link { color: ${ink}; text-decoration: underline; }
                    @media (max-width: 768px) {
                        .${school.id} { padding: 40px 24px 30px 24px; }
                        .${school.id} .ft-top { flex-direction: column; align-items: flex-start; gap: 24px; }
                        .${school.id} .ft-logo { height: auto; overflow: visible; max-width: 100%; }
                        .${school.id} .ft-logo-img { max-height: ${Math.round(logoH * 0.82)}px; max-width: 100%; height: auto; width: auto; }
                        .${school.id} .ft-social-row { flex-wrap: wrap; }
                    }
                </style>
            `,
            attributes: { class: 'gjs-fonts gjs-f-b1' }
        });
    });
}
