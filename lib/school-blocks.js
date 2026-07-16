/**
 * Rendu SERVEUR du vrai header (baseline) + footer de chaque école, pour la
 * déclinaison (server.js / api/router.js). Reproduit les maquettes officielles
 * (mêmes images PNG baseline que les blocs navigateur blocks/*-headers &
 * blocks/footers.js), sans dépendre d'un éditeur GrapesJS.
 *
 * Classes préfixées `dh-`/`df-` (declined header/footer) → aucun conflit avec
 * les blocs du palette ni avec les overrides couleur de la déclinaison.
 */
'use strict';

const LOGO_H = 54;
const MOBILE_H = 38;

// Header — variante « baseline » par défaut de chaque école (id header-<école>).
// { png, bg, fr, [imgH, mt] } — si imgH absent → rendu "contain" (cas brassart).
const SCHOOL_HEADER = {
    'efap':        { png: 'assets/efap/baseline-noir.png',        bg: '#ffffff', fr: '#111111', imgH: 88,  mt: -14 },
    'brassart':    { png: 'assets/brassart/baseline-rose.png',    bg: '#ffffff', fr: '#C7005D' },
    '3wa':         { png: 'assets/3wa/baseline-rouge.png',        bg: '#ffffff', fr: '#CD1316', imgH: 74,  mt: -9 },
    'cread':       { png: 'assets/cread/baseline-violet.png',     bg: '#ffffff', fr: '#463A8F', imgH: 74,  mt: -10 },
    'efj':         { png: 'assets/efj/baseline-vert.png',         bg: '#ffffff', fr: '#00858C', imgH: 87,  mt: -16 },
    'icart':       { png: 'assets/icart/baseline-orange.png',     bg: '#ffffff', fr: '#E9540D', imgH: 101, mt: -21 },
    'ifa-paris':   { png: 'assets/ifa/baseline-noir.png',         bg: '#ffffff', fr: '#111111', imgH: 71,  mt: -2 },
    'mopa':        { png: 'assets/mopa/baseline-noir.png',        bg: '#FFE73E', fr: '#111111', imgH: 77,  mt: -12 },
    'ecole-bleue': { png: 'assets/ecole-bleue/baseline-bleu.png', bg: '#ffffff', fr: '#000041', imgH: 71,  mt: -9 },
    'esec':        { png: 'assets/esec/baseline-couleur.png',     bg: '#000000', fr: '#ffffff', imgH: 73,  mt: -8 }
};

// Footer — logo noir baseline sur fond blanc + texte légal par école.
// legalName = préfixe exact du texte RGPD (identique à blocks/footers.js).
const SCHOOL_FOOTER = {
    'efap':        { dir: 'assets/efap',        legalName: "L'EFAP" },
    'brassart':    { dir: 'assets/brassart',    legalName: 'BRASSART' },
    'cread':       { dir: 'assets/cread',       legalName: 'Le CREAD' },
    'esec':        { dir: 'assets/esec',        legalName: "L'ÉSEC" },
    'icart':       { dir: 'assets/icart',       legalName: "L'ICART" },
    'ifa-paris':   { dir: 'assets/ifa',         legalName: 'IFA Paris' },
    'mopa':        { dir: 'assets/mopa',        legalName: 'MoPA' },
    'ecole-bleue': { dir: 'assets/ecole-bleue', legalName: "L'École Bleue" },
    'efj':         { dir: 'assets/efj',         legalName: "L'EFJ" },
    '3wa':         { dir: 'assets/3wa',         legalName: 'La 3W Academy' }
};

// Icônes sociales — jeu IDENTIQUE à blocks/footers.js (cercles noirs, glyphe blanc).
// Classe df-social pour rester namespacé (immunisé aux overrides couleur de la
// déclinaison), mais SVG strictement identiques au bloc palette.
const SOCIAL_ICONS = `
    <a href="#" class="df-social" aria-label="Instagram"><svg viewBox="0 0 24 24"><g fill="none" stroke="#ffffff" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.9" cy="7.1" r="1.15" fill="#ffffff" stroke="none"/></g></svg></a>
    <a href="#" class="df-social" aria-label="Facebook"><svg viewBox="0 0 24 24"><path fill="#ffffff" d="M13.4 20v-6.2h2.1l.32-2.42H13.4V9.83c0-.7.2-1.18 1.2-1.18h1.3V6.48c-.23-.03-1-.1-1.9-.1-1.88 0-3.17 1.15-3.17 3.26v1.74H8.7v2.42h2.13V20h2.57z"/></svg></a>
    <a href="#" class="df-social" aria-label="TikTok"><svg viewBox="0 0 24 24"><path fill="#ffffff" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12V9.77a5.76 5.76 0 0 0-.78-.05 5.68 5.68 0 1 0 5.68 5.68V9.29a7.35 7.35 0 0 0 4.3 1.38V7.58a4.34 4.34 0 0 1-3.24-1.76z"/></svg></a>
    <a href="#" class="df-social" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path fill="#ffffff" d="M6.94 8.5H4.2V19.6h2.74V8.5zM5.57 7.34a1.62 1.62 0 1 0 0-3.24 1.62 1.62 0 0 0 0 3.24zM19.8 13.5c0-3.03-1.62-4.44-3.78-4.44-1.74 0-2.52.96-2.96 1.63V8.5h-2.74c.04.78 0 11.1 0 11.1h2.74v-6.2c0-.33.02-.66.12-.9.27-.66.87-1.35 1.89-1.35 1.33 0 1.99 1.02 1.99 2.51v5.94h2.74V13.5z"/></svg></a>
    <a href="#" class="df-social" aria-label="YouTube"><svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="11" rx="3" fill="#ffffff"/><polygon points="10.4,9.5 15.2,12 10.4,14.5" fill="#000000"/></svg></a>
`;

function renderSchoolHeaderHtml(schoolId) {
    const h = SCHOOL_HEADER[schoolId];
    if (!h) return null;
    const c = 'dh-' + schoolId;
    const crop = (h.imgH != null);
    const logoHtml = crop
        ? `<span class="dh-logo"><img class="dh-logo-img" src="${h.png}" alt=""></span>`
        : `<img class="dh-logo-img-contain" src="${h.png}" alt="">`;
    const logoCss = crop
        ? `.${c} .dh-logo{display:inline-block;height:${LOGO_H}px;overflow:hidden;flex-shrink:0;}
           .${c} .dh-logo-img{height:${h.imgH}px;width:auto;display:block;margin-top:${h.mt}px;}`
        : `.${c} .dh-logo-img-contain{max-height:${LOGO_H}px;max-width:calc(100% - 60px);height:auto;width:auto;display:block;object-fit:contain;}`;
    return `<header class="${c}">
    <div class="dh-inner">
        ${logoHtml}
        <div class="dh-lang">FR</div>
    </div>
</header>
<style>
    .${c}{background-color:${h.bg};width:100%;margin:0;}
    .${c} .dh-inner{display:flex;align-items:center;justify-content:space-between;padding:22px 90px;gap:24px;}
    ${logoCss}
    .${c} .dh-lang{font-family:var(--brand-font,'Inter',sans-serif);font-size:15px;font-weight:700;letter-spacing:1px;color:${h.fr};cursor:pointer;flex-shrink:0;}
    @media (max-width:768px){
        .${c} .dh-inner{padding:14px 18px;gap:14px;}
        .${c} .dh-logo{height:auto;overflow:visible;max-width:calc(100% - 44px);}
        .${c} .dh-logo-img{height:${crop ? Math.round(h.imgH * 36 / LOGO_H) : 36}px;width:auto;max-width:100%;margin-top:0;}
        .${c} .dh-logo-img-contain{max-height:36px;max-width:calc(100% - 44px);}
    }
</style>`;
}

// Rendu IDENTIQUE au bloc palette blocks/footers.js (buildFooter) : logo non rogné
// (max-height), icônes reseau-icone, légal noir. Seule différence : préfixe df-*
// (namespacing, immunité aux overrides couleur de la déclinaison). Toute modif du
// design footer doit être répercutée dans blocks/footers.js et inversement.
function renderSchoolFooterHtml(schoolId) {
    const f = SCHOOL_FOOTER[schoolId];
    if (!f) return null;
    const c = 'df-' + schoolId;
    // Mêmes hauteurs de logo que blocks/footers.js : 46px pour les logos larges
    // (Brassart, IFA Paris, ICART), 58px pour les autres.
    const logoH = ['brassart', 'ifa-paris', 'icart'].includes(schoolId) ? 46 : 58;
    return `<footer class="${c}">
    <div class="df-inner">
        <div class="df-top">
            <div class="df-brand"><span class="df-logo"><img class="df-logo-img" src="${f.dir}/baseline-noir.png" alt=""></span></div>
            <div class="df-social-row">${SOCIAL_ICONS}</div>
        </div>
        <p class="df-legal">${f.legalName} collecte vos données afin de vous adresser de la documentation. Si vous le souhaitez, nous collectons également vos données afin de vous adresser des emails commerciaux. Pour en savoir plus sur le traitement de vos données et pour exercer vos droits, nous vous invitons à consulter la <a href="#" class="df-legal-link">Politique de confidentialité</a>.</p>
    </div>
</footer>
<style>
    .${c}{background-color:#ffffff;color:#1a1a1a;width:100%;margin:0;padding:50px 90px 40px 90px;font-family:var(--brand-font,'Inter',sans-serif);}
    .${c} .df-inner{max-width:1240px;margin:0 auto;}
    .${c} .df-top{display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:nowrap;margin-bottom:40px;}
    .${c} .df-brand{display:flex;align-items:center;min-width:0;flex:0 1 auto;}
    .${c} .df-logo{display:flex;align-items:center;min-width:0;max-width:100%;overflow:hidden;}
    .${c} .df-logo-img{height:auto;width:auto;max-height:${logoH}px;max-width:min(100%,460px);display:block;}
    .${c} .df-social-row{display:flex;gap:10px;flex:0 0 auto;}
    .${c} .df-social{width:36px;height:36px;border-radius:50%;background:#000000;display:flex;align-items:center;justify-content:center;text-decoration:none;}
    .${c} .df-social svg{width:20px;height:20px;display:block;}
    .${c} .df-legal{font-size:13px;line-height:1.7;color:#111111;margin:0;border-top:1px solid #ededed;padding-top:26px;}
    .${c} .df-legal-link{color:#111111;text-decoration:underline;}
    @media (max-width:768px){
        .${c}{padding:40px 24px 30px 24px;}
        .${c} .df-top{flex-direction:column;align-items:flex-start;gap:24px;}
        .${c} .df-logo{height:auto;overflow:visible;max-width:100%;}
        .${c} .df-logo-img{max-height:${Math.round(logoH * 0.82)}px;max-width:100%;height:auto;width:auto;}
        .${c} .df-social-row{flex-wrap:wrap;}
    }
</style>`;
}

module.exports = { renderSchoolHeaderHtml, renderSchoolFooterHtml, SCHOOL_HEADER, SCHOOL_FOOTER };
