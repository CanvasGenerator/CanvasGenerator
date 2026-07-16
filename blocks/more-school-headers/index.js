/**
 * Headers image des écoles restantes : CREAD, EFJ, ICART, IFA PARIS, MOPA,
 * ÉCOLE BLEUE, ÉSEC.
 * ───────────────────────────────────────────────────────────────
 * Même logique que Brassart / EFAP / 3WA :
 *   • logo couleur / noir → fond blanc ; logo blanc → fond couleur de marque
 *   • MOPA (marque jaune claire) : logo noir sur jaune (marque) ou blanc,
 *     + version blanche sur fond noir pour contextes sombres.
 *   • hauteur de logo IDENTIQUE partout (LOGO_H = 54) → barres uniformes.
 *   • recadrage par variante (imgH + margin-top) mesuré au pixel.
 * Les ids principaux (header-cread, header-efj, header-icart, header-ifa-paris,
 * header-mopa, header-ecole-bleue, header-esec) sont conservés (schools.json).
 */
export default function(editor, categories) {
    const LOGO_H = 54;
    const MOBILE_H = 36; // hauteur logo mobile (recadrage réduit)
    const cat = k => (categories && categories[k]) ? categories[k] : (k + ' Components');

    const schools = [
        { catKey: 'CREAD', A: 'assets/cread', variants: [
            { id: 'header-cread',            label: 'Header CREAD — Violet + baseline',  f: 'baseline-violet',   bg: '#ffffff', fr: '#463A8F', imgH: 74,  mt: -10 },
            { id: 'header-cread-sb-violet',  label: 'Header CREAD — Violet sans baseline',f: 'nobaseline-violet', bg: '#ffffff', fr: '#463A8F', imgH: 85,  mt: -12 },
            { id: 'header-cread-noir',       label: 'Header CREAD — Noir + baseline',    f: 'baseline-noir',     bg: '#ffffff', fr: '#111111', imgH: 70,  mt: -8 },
            { id: 'header-cread-sb-noir',    label: 'Header CREAD — Noir sans baseline', f: 'nobaseline-noir',   bg: '#ffffff', fr: '#111111', imgH: 96,  mt: -20 },
            { id: 'header-cread-blanc',      label: 'Header CREAD — Blanc + baseline (fond violet)',   f: 'baseline-blanc',   bg: '#463A8F', fr: '#ffffff', imgH: 65, mt: -5 },
            { id: 'header-cread-sb-blanc',   label: 'Header CREAD — Blanc sans baseline (fond violet)',f: 'nobaseline-blanc', bg: '#463A8F', fr: '#ffffff', imgH: 69, mt: -6 }
        ]},
        { catKey: 'EFJ', A: 'assets/efj', variants: [
            { id: 'header-efj',            label: 'Header EFJ — Vert + baseline',   f: 'baseline-vert',   bg: '#ffffff', fr: '#00858C', imgH: 87,  mt: -16 },
            { id: 'header-efj-sb-vert',    label: 'Header EFJ — Vert sans baseline',f: 'nobaseline-vert', bg: '#ffffff', fr: '#00858C', imgH: 104, mt: -20 },
            { id: 'header-efj-noir',       label: 'Header EFJ — Noir + baseline',   f: 'baseline-noir',   bg: '#ffffff', fr: '#111111', imgH: 81,  mt: -13 },
            { id: 'header-efj-sb-noir',    label: 'Header EFJ — Noir sans baseline',f: 'nobaseline-noir', bg: '#ffffff', fr: '#111111', imgH: 97,  mt: -17 },
            { id: 'header-efj-blanc',      label: 'Header EFJ — Blanc + baseline (fond vert)',   f: 'baseline-blanc',   bg: '#00858C', fr: '#ffffff', imgH: 83, mt: -14 },
            { id: 'header-efj-sb-blanc',   label: 'Header EFJ — Blanc sans baseline (fond vert)',f: 'nobaseline-blanc', bg: '#00858C', fr: '#ffffff', imgH: 85, mt: -13 }
        ]},
        { catKey: 'ICART', A: 'assets/icart', variants: [
            { id: 'header-icart',            label: 'Header ICART — Orange + baseline',   f: 'baseline-orange',   bg: '#ffffff', fr: '#E9540D', imgH: 101, mt: -21 },
            { id: 'header-icart-sb-orange',  label: 'Header ICART — Orange sans baseline',f: 'nobaseline-orange', bg: '#ffffff', fr: '#E9540D', imgH: 104, mt: -23 },
            { id: 'header-icart-noir',       label: 'Header ICART — Noir + baseline',     f: 'baseline-noir',     bg: '#ffffff', fr: '#111111', imgH: 85,  mt: -12 },
            { id: 'header-icart-sb-noir',    label: 'Header ICART — Noir sans baseline',  f: 'nobaseline-noir',   bg: '#ffffff', fr: '#111111', imgH: 127, mt: -29 },
            { id: 'header-icart-blanc',      label: 'Header ICART — Blanc + baseline (fond orange)',   f: 'baseline-blanc',   bg: '#E9540D', fr: '#ffffff', imgH: 96,  mt: -19 },
            { id: 'header-icart-sb-blanc',   label: 'Header ICART — Blanc sans baseline (fond orange)',f: 'nobaseline-blanc', bg: '#E9540D', fr: '#ffffff', imgH: 114, mt: -25 }
        ]},
        { catKey: 'IFA', A: 'assets/ifa', variants: [
            { id: 'header-ifa-paris',        label: 'Header IFA PARIS — Noir + baseline',    f: 'baseline-noir',     bg: '#ffffff', fr: '#111111', imgH: 71,  mt: -2 },
            { id: 'header-ifa-paris-sb-noir',label: 'Header IFA PARIS — Noir sans baseline', f: 'nobaseline-noir',   bg: '#ffffff', fr: '#111111', imgH: 115, mt: -27 },
            { id: 'header-ifa-paris-blanc',  label: 'Header IFA PARIS — Blanc + baseline (fond noir)',   f: 'baseline-blanc',   bg: '#000000', fr: '#ffffff', imgH: 81,  mt: -7 },
            { id: 'header-ifa-paris-sb-blanc',label:'Header IFA PARIS — Blanc sans baseline (fond noir)',f: 'nobaseline-blanc', bg: '#000000', fr: '#ffffff', imgH: 98,  mt: -20 }
        ]},
        { catKey: 'MOPA', A: 'assets/mopa', variants: [
            { id: 'header-mopa',             label: 'Header MOPA — Noir + baseline (fond jaune)',    f: 'baseline-noir',   bg: '#FFE73E', fr: '#111111', imgH: 77, mt: -12 },
            { id: 'header-mopa-sb-jaune',    label: 'Header MOPA — Noir sans baseline (fond jaune)', f: 'nobaseline-noir', bg: '#FFE73E', fr: '#111111', imgH: 69, mt: -3 },
            { id: 'header-mopa-fondblanc',   label: 'Header MOPA — Noir + baseline (fond blanc)',    f: 'baseline-noir',   bg: '#ffffff', fr: '#111111', imgH: 77, mt: -12 },
            { id: 'header-mopa-sb-fondblanc',label: 'Header MOPA — Noir sans baseline (fond blanc)', f: 'nobaseline-noir', bg: '#ffffff', fr: '#111111', imgH: 69, mt: -3 },
            { id: 'header-mopa-blanc',       label: 'Header MOPA — Blanc + baseline (fond noir)',    f: 'baseline-blanc',  bg: '#000000', fr: '#ffffff', imgH: 67, mt: -6 },
            { id: 'header-mopa-sb-blanc',    label: 'Header MOPA — Blanc sans baseline (fond noir)', f: 'nobaseline-blanc',bg: '#000000', fr: '#ffffff', imgH: 75, mt: -8 }
        ]},
        { catKey: 'BLEUE', A: 'assets/ecole-bleue', variants: [
            { id: 'header-ecole-bleue',            label: 'Header ÉCOLE BLEUE — Bleu + baseline',   f: 'baseline-bleu',   bg: '#ffffff', fr: '#000041', imgH: 71, mt: -9 },
            { id: 'header-ecole-bleue-sb-bleu',    label: 'Header ÉCOLE BLEUE — Bleu sans baseline',f: 'nobaseline-bleu', bg: '#ffffff', fr: '#000041', imgH: 75, mt: -11 },
            { id: 'header-ecole-bleue-noir',       label: 'Header ÉCOLE BLEUE — Noir + baseline',   f: 'baseline-noir',   bg: '#ffffff', fr: '#111111', imgH: 65, mt: -6 },
            { id: 'header-ecole-bleue-sb-noir',    label: 'Header ÉCOLE BLEUE — Noir sans baseline',f: 'nobaseline-noir', bg: '#ffffff', fr: '#111111', imgH: 92, mt: -16 },
            { id: 'header-ecole-bleue-blanc',      label: 'Header ÉCOLE BLEUE — Blanc + baseline (fond bleu nuit)',   f: 'baseline-blanc',   bg: '#000041', fr: '#ffffff', imgH: 67, mt: -6 },
            { id: 'header-ecole-bleue-sb-blanc',   label: 'Header ÉCOLE BLEUE — Blanc sans baseline (fond bleu nuit)',f: 'nobaseline-blanc', bg: '#000041', fr: '#ffffff', imgH: 77, mt: -10 }
        ]},
        { catKey: 'ESEC', A: 'assets/esec', variants: [
            { id: 'header-esec',            label: 'Header ÉSEC — Couleur + baseline (fond noir)',   f: 'baseline-couleur',   bg: '#000000', fr: '#ffffff', imgH: 73, mt: -8 },
            { id: 'header-esec-sb-couleur', label: 'Header ÉSEC — Couleur sans baseline (fond noir)',f: 'nobaseline-couleur', bg: '#000000', fr: '#ffffff', imgH: 78, mt: -13 },
            { id: 'header-esec-noir',       label: 'Header ÉSEC — Noir + baseline',      f: 'baseline-noir',      bg: '#ffffff', fr: '#111111', imgH: 67, mt: -7 },
            { id: 'header-esec-sb-noir',    label: 'Header ÉSEC — Noir sans baseline',   f: 'nobaseline-noir',    bg: '#ffffff', fr: '#111111', imgH: 78, mt: -11 },
            { id: 'header-esec-blanc',      label: 'Header ÉSEC — Blanc + baseline (fond rouge)',   f: 'baseline-blanc',   bg: '#D9000D', fr: '#ffffff', imgH: 69, mt: -6 },
            { id: 'header-esec-sb-blanc',   label: 'Header ÉSEC — Blanc sans baseline (fond rouge)',f: 'nobaseline-blanc', bg: '#D9000D', fr: '#ffffff', imgH: 71, mt: -9 }
        ]}
    ];

    schools.forEach(school => {
        const category = cat(school.catKey);
        school.variants.forEach(v => {
            editor.BlockManager.add(v.id, {
                label: v.label,
                category,
                attributes: { class: 'gjs-fonts gjs-f-b1' },
                content: `
                    <header class="${v.id}">
                        <div class="hdr-inner">
                            <span class="hdr-logo"><img class="hdr-logo-img" src="${school.A}/${v.f}.png" alt="${school.catKey}"></span>
                            <div class="hdr-lang">FR</div>
                        </div>
                    </header>
                    <style>
                        .${v.id} { background-color: ${v.bg}; width: 100%; margin: 0; }
                        .${v.id} .hdr-inner {
                            display: flex; align-items: center; justify-content: space-between;
                            padding: 22px 90px; gap: 24px;
                        }
                        /* Logo affiché EN ENTIER (pas de recadrage) → la baseline n'est jamais
                           coupée, que ce soit le logo FR ou EN (proportions différentes). */
                        .${v.id} .hdr-logo { display: inline-block; height: auto; overflow: visible; flex-shrink: 0; max-width: 100%; }
                        .${v.id} .hdr-logo-img { height: auto; max-height: 56px; width: auto; max-width: 100%; display: block; }
                        .${v.id} .hdr-lang {
                            font-family: var(--brand-font, 'Inter', sans-serif); font-size: 15px; font-weight: 700;
                            letter-spacing: 1px; color: ${v.fr}; cursor: pointer; flex-shrink: 0;
                        }
                        @media (max-width: 768px) {
                            .${v.id} .hdr-inner { padding: 14px 18px; gap: 14px; }
                            .${v.id} .hdr-logo { height: auto; overflow: visible; max-width: calc(100% - 44px); }
                            .${v.id} .hdr-logo-img { max-height: 44px; height: auto; width: auto; max-width: 100%; margin-top: 0; }
                        }
                    </style>
                `
            });
        });
    });
}
