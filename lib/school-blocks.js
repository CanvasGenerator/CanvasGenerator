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
const SCHOOL_FOOTER = {
    'efap':        { dir: 'assets/efap',        imgH: 88,  mt: -14, legalName: "L'EFAP" },
    'brassart':    { dir: 'assets/brassart',    imgH: 106, mt: -21, legalName: 'BRASSART' },
    'cread':       { dir: 'assets/cread',       imgH: 70,  mt: -8,  legalName: 'Le CREAD' },
    'esec':        { dir: 'assets/esec',        imgH: 67,  mt: -7,  legalName: "L'ÉSEC" },
    'icart':       { dir: 'assets/icart',       imgH: 85,  mt: -12, legalName: "L'ICART" },
    'ifa-paris':   { dir: 'assets/ifa',         imgH: 71,  mt: -2,  legalName: 'IFA Paris' },
    'mopa':        { dir: 'assets/mopa',        imgH: 77,  mt: -12, legalName: 'MoPA' },
    'ecole-bleue': { dir: 'assets/ecole-bleue', imgH: 65,  mt: -6,  legalName: "L'École Bleue" },
    'efj':         { dir: 'assets/efj',         imgH: 81,  mt: -13, legalName: "L'EFJ" },
    '3wa':         { dir: 'assets/3wa',         imgH: 65,  mt: -6,  legalName: 'La 3W Academy' }
};

// Icônes sociales (cercles noirs, glyphe blanc) — reprises de blocks/footers.js.
const SOCIAL_ICONS = `
    <a href="#" class="df-social" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.366-.333 2.633-1.308 3.608-.975.975-2.242 1.245-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.063-2.633-.333-3.608-1.308-.975-.975-1.245-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.35.061-2.68.327-3.684 1.332C2.364 2.409 2.098 3.739 2.037 5.088 1.979 6.368 1.965 6.776 1.965 10.035s.014 3.667.072 4.947c.061 1.35.327 2.68 1.332 3.684 1.004 1.004 2.335 1.27 3.684 1.332 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.35-.061 2.68-.327 3.684-1.332 1.004-1.004 1.27-2.335 1.332-3.684.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.061-1.35-.327-2.68-1.332-3.684-1.004-1.004-2.335-1.27-3.684-1.332-1.28-.058-1.688-.072-4.947-.072zM12 4.878a5.157 5.157 0 100 10.314 5.157 5.157 0 000-10.314zm0 8.541a3.384 3.384 0 110-6.768 3.384 3.384 0 010 6.768zm7.541-8.541a1.206 1.206 0 11-2.412 0 1.206 1.206 0 012.412 0z"/></svg></a>
    <a href="#" class="df-social" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg></a>
    <a href="#" class="df-social" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.032 2.62-.019 3.93-.006.156 5.225 4.056 5.59 5.535 5.893v3.916c-2.8-.127-5.232-1.416-6.037-3.213-.017 4.77-.031 9.542-.044 14.313-.157 8.164-11.412 8.503-12.32 1.032-.602-4.856 3.349-8.127 7.973-7.188 0 1.5.001 3.001.002 4.502-2.733-.581-5.124.837-4.746 3.227.621 2.358 4.83 2.461 5.427-.493.18-7.76.115-15.525.05-23.287l.23-.7z"/></svg></a>
    <a href="#" class="df-social" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>
    <a href="#" class="df-social" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505a3.017 3.017 0 00-2.122 2.136C0 8.055 0 12 0 12s0 3.945.501 5.814a3.017 3.017 0 002.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.945 24 12 24 12s0-3.945-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
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

function renderSchoolFooterHtml(schoolId) {
    const f = SCHOOL_FOOTER[schoolId];
    if (!f) return null;
    const c = 'df-' + schoolId;
    const ink = '#111111';
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
    .${c}{background-color:var(--brand-background,#ffffff);color:${ink};width:100%;margin:0;padding:50px 90px 40px 90px;font-family:var(--brand-font,'Inter',sans-serif);}
    .${c} .df-inner{max-width:1240px;margin:0 auto;}
    .${c} .df-top{display:flex;align-items:center;justify-content:space-between;gap:40px;flex-wrap:wrap;margin-bottom:40px;}
    .${c} .df-brand{display:flex;align-items:center;}
    .${c} .df-logo{display:inline-block;height:${LOGO_H}px;overflow:hidden;}
    .${c} .df-logo-img{height:${f.imgH}px;width:auto;display:block;margin-top:${f.mt}px;}
    .${c} .df-social-row{display:flex;gap:14px;}
    .${c} .df-social{width:40px;height:40px;border-radius:50%;background-color:${ink};display:flex;align-items:center;justify-content:center;text-decoration:none;}
    .${c} .df-social svg{width:19px;height:19px;fill:#ffffff;}
    .${c} .df-legal{font-size:13px;line-height:1.7;color:var(--brand-text,#1a1a1a);margin:0;border-top:1px solid #ededed;padding-top:26px;}
    .${c} .df-legal-link{color:${ink};text-decoration:underline;}
    @media (max-width:768px){
        .${c}{padding:40px 24px 30px 24px;}
        .${c} .df-top{flex-direction:column;align-items:flex-start;gap:24px;}
        .${c} .df-logo{height:auto;overflow:visible;max-width:100%;}
        .${c} .df-logo-img{height:${Math.round(f.imgH * MOBILE_H / LOGO_H)}px;width:auto;max-width:100%;margin-top:0;}
        .${c} .df-social-row{flex-wrap:wrap;}
    }
</style>`;
}

module.exports = { renderSchoolHeaderHtml, renderSchoolFooterHtml, SCHOOL_HEADER, SCHOOL_FOOTER };
