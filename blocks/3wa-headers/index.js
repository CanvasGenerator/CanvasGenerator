/**
 * Headers 3W ACADEMY — versions image (logos réels des maquettes).
 * ───────────────────────────────────────────────────────────────
 * 6 variantes (catégorie « 3W ACADEMY Components ») :
 *   • Rouge + baseline / sans baseline → fond blanc
 *   • Noir  + baseline / sans baseline → fond blanc
 *   • Blanc + baseline / sans baseline → fond rouge
 *
 * Le logo « 3W ACADEMY » (empilé) est affiché à la MÊME taille (LOGO_H) dans
 * toutes les variantes : recadrage sur le logo via conteneur de hauteur
 * LOGO_H + margin-top négatif (valeurs mesurées au pixel).
 * Le bloc principal garde l'id `header-3wa` (référencé dans schools.json).
 */
export default function(editor, categories) {
    const cat = (categories && categories['3WA']) ? categories['3WA'] : '3W ACADEMY Components';
    const ROUGE = '#CD1316';
    const LOGO_H = 54;   // identique à toutes les écoles → barre uniforme
    const MOBILE_H = 36; // hauteur logo mobile (recadrage réduit)

    const variants = [
        { id: 'header-3wa',           label: 'Header 3WA — Rouge + baseline',        img: 'assets/3wa/baseline-rouge.png',    bg: '#ffffff', fr: ROUGE,     imgH: 74,  mt: -9 },
        { id: 'header-3wa-sb-rouge',  label: 'Header 3WA — Rouge sans baseline',     img: 'assets/3wa/nobaseline-rouge.png',  bg: '#ffffff', fr: ROUGE,     imgH: 82,  mt: -11 },
        { id: 'header-3wa-noir',      label: 'Header 3WA — Noir + baseline',         img: 'assets/3wa/baseline-noir.png',     bg: '#ffffff', fr: '#111111', imgH: 65,  mt: -6 },
        { id: 'header-3wa-sb-noir',   label: 'Header 3WA — Noir sans baseline',      img: 'assets/3wa/nobaseline-noir.png',   bg: '#ffffff', fr: '#111111', imgH: 89,  mt: -21 },
        { id: 'header-3wa-blanc',     label: 'Header 3WA — Blanc + baseline (fond rouge)',       img: 'assets/3wa/baseline-blanc.png',    bg: ROUGE,     fr: '#ffffff', imgH: 72,  mt: -8 },
        { id: 'header-3wa-sb-blanc',  label: 'Header 3WA — Blanc sans baseline (fond rouge)',    img: 'assets/3wa/nobaseline-blanc.png',  bg: ROUGE,     fr: '#ffffff', imgH: 72,  mt: -9 }
    ];

    variants.forEach(v => {
        editor.BlockManager.add(v.id, {
            label: v.label,
            category: cat,
            attributes: { class: 'gjs-fonts gjs-f-b1' },
            content: `
                <header class="${v.id}">
                    <div class="hdr-inner">
                        <span class="hdr-logo"><img class="hdr-logo-img" src="${v.img}" alt="3W ACADEMY"></span>
                        <div class="hdr-lang">FR</div>
                    </div>
                </header>
                <style>
                    .${v.id} { background-color: ${v.bg}; width: 100%; margin: 0; }
                    .${v.id} .hdr-inner {
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 22px 90px; gap: 24px;
                    }
                    .${v.id} .hdr-logo { display: inline-block; height: ${LOGO_H}px; overflow: hidden; flex-shrink: 0; }
                    .${v.id} .hdr-logo-img { height: ${v.imgH}px; width: auto; display: block; margin-top: ${v.mt}px; }
                    .${v.id} .hdr-lang {
                        font-family: 'Inter', Arial, sans-serif; font-size: 15px; font-weight: 700;
                        letter-spacing: 1px; color: ${v.fr}; cursor: pointer; flex-shrink: 0;
                    }
                    @media (max-width: 768px) {
                        .${v.id} .hdr-inner { padding: 14px 18px; gap: 14px; }
                        .${v.id} .hdr-logo { height: auto; overflow: visible; max-width: calc(100% - 44px); }
                        .${v.id} .hdr-logo-img { height: ${Math.round(v.imgH * MOBILE_H / LOGO_H)}px; width: auto; max-width: 100%; margin-top: 0; }
                    }
                </style>
            `
        });
    });
}
