/**
 * Headers EFAP — versions image (logos réels des maquettes).
 * ───────────────────────────────────────────────────────────────
 * 4 variantes (catégorie « EFAP Components ») :
 *   • Noir  + baseline / sans baseline → fond blanc
 *   • Blanc + baseline / sans baseline → fond noir
 *
 * Le mot « E|F|A|P » est affiché à la MÊME taille (LOGO_H) dans toutes les
 * variantes : chaque image est recadrée sur les lettres via un conteneur de
 * hauteur LOGO_H + margin-top négatif (valeurs mesurées au pixel).
 * Le bloc principal garde l'id `header-efap` (référencé dans schools.json).
 */
export default function(editor, categories) {
    const cat = (categories && categories.EFAP) ? categories.EFAP : 'EFAP Components';
    const NOIR = '#000000';
    const LOGO_H = 54;   // identique à toutes les écoles → barre uniforme
    const MOBILE_H = 36; // hauteur logo mobile (recadrage réduit)

    const variants = [
        { id: 'header-efap',            label: 'Header EFAP — Noir + baseline',        img: 'assets/efap/baseline-noir.png',    bg: '#ffffff', fr: '#111111', imgH: 88,  mt: -14 },
        { id: 'header-efap-sb-noir',    label: 'Header EFAP — Noir sans baseline',     img: 'assets/efap/nobaseline-noir.png',  bg: '#ffffff', fr: '#111111', imgH: 112, mt: -23 },
        { id: 'header-efap-blanc',      label: 'Header EFAP — Blanc + baseline (fond noir)',       img: 'assets/efap/baseline-blanc.png',   bg: NOIR,      fr: '#ffffff', imgH: 73,  mt: -8 },
        { id: 'header-efap-sb-blanc',   label: 'Header EFAP — Blanc sans baseline (fond noir)',    img: 'assets/efap/nobaseline-blanc.png', bg: NOIR,      fr: '#ffffff', imgH: 115, mt: -20 }
    ];

    variants.forEach(v => {
        editor.BlockManager.add(v.id, {
            label: v.label,
            category: cat,
            attributes: { class: 'gjs-fonts gjs-f-b1' },
            content: `
                <header class="${v.id}">
                    <div class="hdr-inner">
                        <span class="hdr-logo"><img class="hdr-logo-img" src="${v.img}" alt="EFAP"></span>
                        <div class="hdr-lang">FR</div>
                    </div>
                </header>
                <style>
                    .${v.id} { background-color: ${v.bg}; width: 100%; margin: 0; }
                    .${v.id} .hdr-inner {
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 22px 90px; gap: 24px;
                    }
                    .${v.id} .hdr-logo { display: inline-block; height: auto; overflow: visible; flex-shrink: 0; max-width: 100%; }
                    /* Taille libre via Style Manager : classe simple + hauteur concrete sans
                       max-height. Garde-fou responsive sur la regle mobile scopee plus bas. */
                    .hdr-logo-img { height: 56px; width: auto; max-width: 100%; display: block; }
                    .${v.id} .hdr-lang {
                        font-family: var(--brand-font, 'Inter', sans-serif); font-size: 15px; font-weight: 700;
                        letter-spacing: 1px; color: ${v.fr}; cursor: pointer; flex-shrink: 0;
                    }
                    /* Responsive mobile des logos (retour client). Le logo scale
                       proportionnellement (height:auto → aucune déformation), reste lisible
                       (baseline >= ~48px, jamais sous 40px), aligné à gauche, et laisse la
                       place au sélecteur de langue à droite. Desktop INCHANGÉ. */
                    @media (max-width: 768px) {
                        .${v.id} .hdr-inner { padding: 16px 20px; gap: 14px; }
                        .${v.id} .hdr-logo { height: auto; overflow: visible; max-width: 72%; }
                        .${v.id} .hdr-logo-img { max-height: 56px; height: auto; width: auto; max-width: 100%; margin-top: 0; }
                    }
                    @media (max-width: 480px) {
                        .${v.id} .hdr-inner { padding: 14px 16px; gap: 12px; min-height: 80px; box-sizing: border-box; }
                        .${v.id} .hdr-logo { max-width: 70%; }
                        .${v.id} .hdr-logo-img { max-height: 52px; }
                    }
                </style>
            `
        });
    });
}
