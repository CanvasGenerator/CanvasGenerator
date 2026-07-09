/**
 * Headers BRASSART — versions image (logos réels des maquettes).
 * ───────────────────────────────────────────────────────────────
 * 6 variantes (catégorie « BRASSART Components ») :
 *   • Rose  + baseline / sans baseline → fond blanc
 *   • Noir  + baseline / sans baseline → fond blanc
 *   • Blanc + baseline / sans baseline → fond rose
 *
 * Les PNG ont été ROGNÉS (marges transparentes supprimées) : le mot « BRASSART »
 * remplit désormais l'image. Un simple `max-height` suffit donc pour que le logo
 * ait la même taille partout, et `max-width` le rend responsive (mobile) sans
 * débordement ni découpe.
 * Le bloc principal garde l'id `header-brassart` (référencé dans schools.json).
 */
export default function(editor, categories) {
    const cat = (categories && categories.BRASSART) ? categories.BRASSART : 'BRASSART Components';
    const ROSE = '#C7005D';
    const LOGO_H = 54;    // hauteur logo desktop
    const MOBILE_H = 38;  // hauteur logo mobile

    const variants = [
        { id: 'header-brassart',          label: 'Header BRASSART — Rose + baseline',        img: 'assets/brassart/baseline-rose.png',    bg: '#ffffff', fr: ROSE },
        { id: 'header-brassart-sb-rose',  label: 'Header BRASSART — Rose sans baseline',     img: 'assets/brassart/nobaseline-rose.png',  bg: '#ffffff', fr: ROSE },
        { id: 'header-brassart-noir',     label: 'Header BRASSART — Noir + baseline',        img: 'assets/brassart/baseline-noir.png',    bg: '#ffffff', fr: '#111111' },
        { id: 'header-brassart-sb-noir',  label: 'Header BRASSART — Noir sans baseline',     img: 'assets/brassart/nobaseline-noir.png',  bg: '#ffffff', fr: '#111111' },
        { id: 'header-brassart-blanc',    label: 'Header BRASSART — Blanc + baseline (fond rose)',   img: 'assets/brassart/baseline-blanc.png',   bg: ROSE, fr: '#ffffff' },
        { id: 'header-brassart-sb-blanc', label: 'Header BRASSART — Blanc sans baseline (fond rose)', img: 'assets/brassart/nobaseline-blanc.png', bg: ROSE, fr: '#ffffff' }
    ];

    variants.forEach(v => {
        editor.BlockManager.add(v.id, {
            label: v.label,
            category: cat,
            attributes: { class: 'gjs-fonts gjs-f-b1' },
            content: `
                <header class="${v.id}">
                    <div class="hdr-inner">
                        <img class="hdr-logo-img" src="${v.img}" alt="BRASSART">
                        <div class="hdr-lang">FR</div>
                    </div>
                </header>
                <style>
                    .${v.id} { background-color: ${v.bg}; width: 100%; margin: 0; }
                    .${v.id} .hdr-inner {
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 22px 90px; gap: 24px;
                    }
                    .${v.id} .hdr-logo-img {
                        max-height: ${LOGO_H}px; max-width: calc(100% - 60px);
                        height: auto; width: auto; display: block; object-fit: contain;
                    }
                    .${v.id} .hdr-lang {
                        font-family: 'Inter', Arial, sans-serif; font-size: 15px; font-weight: 700;
                        letter-spacing: 1px; color: ${v.fr}; cursor: pointer; flex-shrink: 0;
                    }
                    @media (max-width: 768px) {
                        .${v.id} .hdr-inner { padding: 14px 18px; gap: 14px; }
                        .${v.id} .hdr-logo-img { max-height: ${MOBILE_H}px; max-width: calc(100% - 44px); }
                    }
                </style>
            `
        });
    });
}
