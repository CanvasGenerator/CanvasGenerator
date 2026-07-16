/**
 * Header & Footer par école (10 écoles)
 * ───────────────────────────────────────────────────────────────
 * Génère, pour chaque école, 2 blocs personnalisés :
 *   • header-<id>  : fond = couleur de l'école, logo + baseline + CTA langue
 *   • footer-<id>  : fond blanc, logo + baseline noirs, réseaux, mentions légales
 *
 * Conforme aux maquettes « Maquettes headers & footers.pptx » et aux couleurs
 * « Codes couleurs écoles Reetain.xlsx ». Les ids/design remplacent les anciens
 * blocs header-efap / header-brassart (mêmes ids → aucune casse des defaultBlocks).
 *
 * Le fond utilise var(--brand-header, <couleur école>) → suit la déclinaison
 * de couleurs si présente, sinon la couleur d'origine de l'école.
 */

export const SCHOOLS = [
    { id: 'efap',        name: 'EFAP',        logo: 'E|F|A|P',     baseline: "L'école des nouveaux métiers<br>de la communication",     bg: '#000000', text: '#ffffff', serif: true },
    { id: 'brassart',    name: 'BRASSART',    logo: 'BRASSART',    baseline: "L'école des métiers<br>de la création",                   bg: '#C7005D', text: '#ffffff' },
    { id: 'icart',       name: 'ICART',       logo: 'ICART',       baseline: "Management de la culture<br>et du marché de l'art",        bg: '#E9540D', text: '#ffffff' },
    { id: 'cread',       name: 'CREAD',       logo: 'CREAD',       baseline: "Arts appliqués, design<br>& communication visuelle",       bg: '#463A8F', text: '#ffffff' },
    { id: 'esec',        name: 'ÉSEC',        logo: 'ÉSEC',        baseline: "École supérieure de l'image<br>et de la communication",    bg: '#D9000D', text: '#ffffff' },
    { id: 'ifa-paris',   name: 'IFA PARIS',   logo: 'IFA Paris',   baseline: "L'école internationale<br>des métiers de la mode",         bg: '#000000', text: '#ffffff', serif: true },
    { id: 'mopa',        name: 'MOPA',        logo: 'MOPA',        baseline: "École d'animation 3D<br>et d'effets visuels",              bg: '#FFE73E', text: '#000000' },
    { id: 'ecole-bleue', name: 'ÉCOLE BLEUE', logo: 'École Bleue', baseline: "Design d'objet, innovation<br>& créativité",                bg: '#000041', text: '#ffffff', serif: true },
    { id: 'efj',         name: 'EFJ',         logo: 'EFJ',         baseline: "École du journalisme<br>de Paris",                         bg: '#00858C', text: '#ffffff' },
    { id: '3wa',         name: '3W ACADEMY',  logo: '3W ACADEMY',  baseline: "École du web<br>et du digital",                            bg: '#CD1316', text: '#ffffff' },
];

/** Icônes réseaux (héritent la couleur via fill=currentColor). */
const SOCIAL_ICONS = [
    '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.366-.333 2.633-1.308 3.608-.975.975-2.242 1.245-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.063-2.633-.333-3.608-1.308-.975-.975-1.245-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608C4.516 2.567 5.783 2.297 7.15 2.234 8.416 2.176 8.796 2.163 12 2.163zm0 5.838a3.999 3.999 0 100 7.998 3.999 3.999 0 000-7.998zm0 6.598a2.599 2.599 0 110-5.198 2.599 2.599 0 010 5.198zm5.096-6.752a.936.936 0 11-1.872 0 .936.936 0 011.872 0z"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M22.675 0h-21.35C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24h11.495v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24h-1.918c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.407 24 24 23.407 24 22.676V1.325C24 .593 23.407 0 22.675 0z"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.134l4.713 6.231 5.397-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505a3.017 3.017 0 00-2.122 2.136C0 8.055 0 12 0 12s0 3.945.501 5.814a3.017 3.017 0 002.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.945 24 12 24 12s0-3.945-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
];

function socialsHtml(prefix) {
    return SOCIAL_ICONS.map(svg => `<a href="#" class="${prefix}-soc" aria-label="social">${svg}</a>`).join('');
}

export function buildHeader(s) {
    const fontStack = s.serif ? "'Georgia', 'Times New Roman', serif" : "'Arial', 'Helvetica', sans-serif";
    return `
<header class="header-${s.id}">
  <div class="hdr-inner">
    <div class="hdr-brand">
      <div class="hdr-logo">${s.logo}</div>
      <div class="hdr-baseline">${s.baseline}</div>
    </div>
    <a href="#" class="hdr-lang">FR</a>
  </div>
</header>
<style>
  .header-${s.id} {
    background-color: var(--brand-header, ${s.bg});
    color: ${s.text};
    width: 100%;
    font-family: ${fontStack};
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .header-${s.id} .hdr-inner {
    max-width: 1200px; margin: 0 auto; padding: 16px 24px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .header-${s.id} .hdr-brand { display: flex; align-items: center; gap: 20px; min-width: 0; }
  .header-${s.id} .hdr-logo {
    font-size: 30px; font-weight: 800; letter-spacing: 2px; line-height: 1;
    color: ${s.text}; white-space: nowrap; flex-shrink: 0;
  }
  .header-${s.id} .hdr-baseline { font-size: 12px; font-weight: 600; line-height: 1.3; color: ${s.text}; }
  .header-${s.id} .hdr-lang {
    font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-decoration: none;
    color: ${s.text}; border: 1px solid currentColor; padding: 5px 13px; border-radius: 2px;
    opacity: 0.9; flex-shrink: 0;
  }
  .header-${s.id} .hdr-lang:hover { opacity: 1; }
  @media (max-width: 768px) {
    .header-${s.id} .hdr-inner { padding: 12px 16px; }
    .header-${s.id} .hdr-logo { font-size: 22px; }
    .header-${s.id} .hdr-baseline { display: none; }
  }
</style>`;
}

export function buildFooter(s) {
    const fontStack = s.serif ? "'Georgia', 'Times New Roman', serif" : "'Arial', 'Helvetica', sans-serif";
    return `
<footer class="footer-${s.id}">
  <div class="ftr-inner">
    <div class="ftr-main">
      <div class="ftr-brand">
        <div class="ftr-logo">${s.logo}</div>
        <div class="ftr-baseline">${s.baseline}</div>
      </div>
      <div class="ftr-socials">${socialsHtml('ftr-' + s.id)}</div>
    </div>
    <div class="ftr-legal">
      <p>${s.name} collecte vos données afin de vous adresser de la documentation. Pour en savoir plus sur le traitement de vos données et pour exercer vos droits, consultez la <a href="#" class="ftr-link">Politique de confidentialité</a>.</p>
    </div>
  </div>
</footer>
<style>
  .footer-${s.id} {
    background-color: #ffffff !important; color: #1a1a1a;
    padding: 48px 24px 32px; font-family: ${fontStack}; border-top: 1px solid #e5e7eb;
  }
  .footer-${s.id} .ftr-inner { max-width: 1200px; margin: 0 auto; }
  .footer-${s.id} .ftr-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 48px; margin-bottom: 32px; }
  .footer-${s.id} .ftr-brand { display: flex; flex-direction: column; }
  .footer-${s.id} .ftr-logo { font-size: 38px; font-weight: 800; letter-spacing: 2px; line-height: 1; color: #1a1a1a; margin-bottom: 10px; }
  .footer-${s.id} .ftr-baseline { font-size: 12px; font-weight: 600; line-height: 1.3; color: #6b7280; }
  .footer-${s.id} .ftr-socials { display: flex; gap: 12px; flex-wrap: wrap; }
  .footer-${s.id} .ftr-${s.id}-soc { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border-radius: 50%; color: #1a1a1a; }
  .footer-${s.id} .ftr-${s.id}-soc svg { width: 18px; height: 18px; fill: currentColor; }
  .footer-${s.id} .ftr-legal { border-top: 1px solid #f2f2f2; padding-top: 24px; }
  .footer-${s.id} .ftr-legal p { font-size: 11px; line-height: 1.8; color: #999999; max-width: 1000px; margin: 0; }
  .footer-${s.id} .ftr-link { color: #1a1a1a; text-decoration: underline; }
  @media (max-width: 768px) {
    .footer-${s.id} .ftr-main { flex-direction: column; align-items: center; gap: 24px; text-align: center; }
    .footer-${s.id} .ftr-brand { align-items: center; }
    .footer-${s.id} .ftr-socials { justify-content: center; }
  }
</style>`;
}

export function getSchoolBrand(id) {
    return SCHOOLS.find(s => s.id === String(id).toLowerCase()) || null;
}

/** Enregistre le bloc header-<id> pour une école. */
export function registerSchoolHeader(editor, id) {
    const s = getSchoolBrand(id);
    if (!s) return;
    editor.BlockManager.add(`header-${s.id}`, {
        label: `${s.name} Header`,
        category: `${s.name} Components`,
        content: buildHeader(s),
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}

/** Enregistre le bloc footer-<id> pour une école. */
export function registerSchoolFooter(editor, id) {
    const s = getSchoolBrand(id);
    if (!s) return;
    editor.BlockManager.add(`footer-${s.id}`, {
        label: `${s.name} Footer`,
        category: `${s.name} Components`,
        content: buildFooter(s),
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}
