/**
 * Liens du footer (réseaux sociaux + politique de confidentialité).
 *
 * Les footers d'école (lib/school-blocks.js, blocks/footers.js) sont déposés
 * avec des liens `href="#"` quand l'URL n'est pas connue : au clic, la page
 * remontait en haut (retour client ESEC/CREAD, 10/2026). On complète ici,
 * au service et à la publication, tout lien de footer RESTÉ en `#` :
 *   • réseau social : configuration de l'école (branding.social, éditable dans
 *     la gestion des écoles), à défaut le lien relevé sur le site de l'école ;
 *   • politique de confidentialité : page relevée sur le site de l'école.
 * Un lien déjà renseigné (modifié à la main dans l'éditeur) n'est jamais touché.
 * Les pages existantes sont donc corrigées sans redéposer leur footer.
 *
 * Miroir côté éditeur : blocks/school-links.js (mêmes URL de secours).
 */
const { supabaseRequest } = require('./supabase');

// Relevés sur les sites des écoles le 08/10/2026.
const CONFIDENTIALITE = {
    '3wa':         'https://3wacademy.fr/politiques-confidentialites',
    'brassart':    'https://www.brassart.fr/politique-confidentialite',
    'cread':       'https://www.cread.fr/politique-confidentialite',
    'ecole-bleue': 'https://www.ecole-bleue.fr/politique-confidentialite',
    'efap':        'https://www.efap.com/politique-confidentialite',
    'efj':         'https://www.efj.fr/politique-confidentialite',
    'esec':        'https://www.esec.fr/confidentialite',
    'icart':       'https://www.icart.fr/politique-confidentialite',
    'ifa-paris':   'https://www.ifaparis.com/privacy-policy',
    'mopa':        'https://www.ecole-mopa.fr/politique-confidentialite',
};

// Réseaux sociaux de secours (écoles dont la configuration est incomplète).
const RESEAUX_SECOURS = {
    'efj': {
        facebook: 'https://www.facebook.com/EFJ.Officiel/',
        instagram: 'https://www.instagram.com/efj_officiel/',
        linkedin: 'https://www.linkedin.com/school/efj/',
        tiktok: 'https://www.tiktok.com/@efj_officiel',
        youtube: 'https://www.youtube.com/channel/UC9yn8FICaG0PtN21cOI9I3g',
    },
    'esec': {
        facebook: 'https://www.facebook.com/ESEC.officiel',
        instagram: 'https://www.instagram.com/esecofficiel/',
        linkedin: 'https://www.linkedin.com/school/esec-ecole-des-metiers-du-cinema-et-de-l-audiovisuel/',
        tiktok: 'https://www.tiktok.com/@esec_officiel',
        youtube: 'https://www.youtube.com/user/EsecCinema',
    },
    'icart': {
        facebook: 'https://www.facebook.com/icart.officiel',
        instagram: 'https://www.instagram.com/icart_officiel/',
        linkedin: 'https://www.linkedin.com/school/icart/',
        tiktok: 'https://www.tiktok.com/@icart_officiel',
        youtube: 'https://www.youtube.com/channel/UCbrNW-H-hAwpwZodLGUm-VQ',
    },
    'ifa-paris': {
        facebook: 'https://www.facebook.com/ifaparis',
        instagram: 'https://www.instagram.com/ifaparis',
        linkedin: 'https://www.linkedin.com/school/ifa-paris/',
        tiktok: 'https://www.tiktok.com/@ifaparisofficial',
        youtube: 'https://www.youtube.com/c/ifaparis',
    },
    'mopa': {
        facebook: 'https://www.facebook.com/ecole.mopa/',
        instagram: 'https://www.instagram.com/ecole_mopa/',
        linkedin: 'https://www.linkedin.com/school/%C3%A9cole-mopa/',
        tiktok: 'https://www.tiktok.com/@ecolemopa',
        youtube: 'https://www.youtube.com/channel/UC3HLzEA2zT9ofWp3HcT_9CA',
    },
};

const ECOLES = Object.keys(CONFIDENTIALITE);
const RESEAUX = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube'];

// Configuration des écoles (branding.social), relue au plus toutes les 10 min.
// La lecture est asynchrone et ne bloque jamais le rendu : en attendant, les
// liens de secours s'appliquent.
let configReseaux = {};
let derniereLecture = 0;
let lectureEnCours = null;

function rafraichirConfig() {
    if (lectureEnCours || Date.now() - derniereLecture < 10 * 60 * 1000) return lectureEnCours;
    lectureEnCours = supabaseRequest('GET', '/Schools?select=id,branding')
        .then(lignes => {
            const map = {};
            (Array.isArray(lignes) ? lignes : []).forEach(l => {
                const social = l && l.branding && l.branding.social;
                if (l && l.id && social && typeof social === 'object') map[String(l.id).toLowerCase()] = social;
            });
            configReseaux = map;
        })
        .catch(e => console.warn('footer-liens: configuration des écoles illisible —', e.message))
        .finally(() => { derniereLecture = Date.now(); lectureEnCours = null; });
    return lectureEnCours;
}

/** Charge la configuration (à appeler avant une publication pour être à jour). */
async function chargerLiensEcoles() {
    derniereLecture = 0;
    await rafraichirConfig();
}

function urlReseau(ecole, reseau) {
    const conf = configReseaux[ecole] || {};
    return (conf[reseau] && String(conf[reseau]).trim())
        || (RESEAUX_SECOURS[ecole] && RESEAUX_SECOURS[ecole][reseau])
        || '';
}

/** École de la page, déduite des classes de son footer (df-<id>, <id>…). */
function ecoleDuFooter(html) {
    const footers = String(html).match(/<footer\b[^>]*class="([^"]*)"/gi) || [];
    for (const f of footers) {
        const classes = (f.match(/class="([^"]*)"/i) || [])[1].toLowerCase().split(/\s+/);
        const id = ECOLES.find(e => classes.some(c => c === e || c === 'df-' + e || c === 'footer-' + e || c === 'ft-' + e));
        if (id) return id;
    }
    return null;
}

const echapper = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Ancre du texte de confidentialité du footer (retour client du 09/10) : le
 * « ici » du texte RGPD des formulaires doit faire DESCENDRE jusqu'à ce texte,
 * pas ouvrir la politique de confidentialité.
 *
 * Repère invisible id="privacy-policy" posé juste AVANT le texte légal du
 * footer (df-legal, ft-legal, mf-legal) — l'id du texte lui-même n'est pas
 * touché (le CSS de l'éditeur s'y accroche). « #privacy-policy » est justement
 * l'adresse que le script des formulaires remet au lien au chargement
 * (blocks/forms/shared/rgpd-config.js) : les deux concordent.
 * Renvoie le HTML et si l'ancre existe. Idempotent.
 */
const ID_ANCRE = 'privacy-policy';
const RE_TEXTE_LEGAL = /<(p|div)\b[^>]*\sclass\s*=\s*["'](?:[^"']*\s)?(df-legal|ft-legal|mf-legal)(?:\s[^"']*)?["'][^>]*>/i;
function poserAncreConfidentialite(html) {
    const source = String(html || '');
    if (new RegExp(`\\sid\\s*=\\s*["']${ID_ANCRE}["']`, 'i').test(source)) return { html: source, ancre: true };
    const m = RE_TEXTE_LEGAL.exec(source);
    if (!m) return { html: source, ancre: false };
    const repere = `<span id="${ID_ANCRE}" class="lp-ancre-confidentialite" aria-hidden="true"></span>`;
    return { html: source.slice(0, m.index) + repere + source.slice(m.index), ancre: true };
}

/**
 * Remplace les href="#" des icônes réseaux et du lien de confidentialité du
 * footer par les URL de l'école. Idempotent. Sans école reconnue, inchangé.
 */
function completerLiensFooter(html, ecoleForcee) {
    const source = String(html || '');
    if (!/(df-social|reseau-icone|df-legal-link|ft-legal-link|data-rgpd-link)/.test(source)) return source;
    rafraichirConfig();
    // Texte RGPD des formulaires : « décrites » + lien « ici » collés quand
    // l'espace a été perdu à l'enregistrement (formulaires événement).
    let avecEspace = source.replace(/(<span\b[^>]*data-rgpd-text[^>]*>[^<]*<\/span>)(<a\b[^>]*data-rgpd-link)/gi, '$1 $2');

    // « ici » → texte de confidentialité du footer quand la page en a un
    // (même onglet, quelle que soit l'adresse posée avant). Sinon : politique
    // de confidentialité de l'école, plus bas.
    let ancre = false;
    if (/\sdata-rgpd-link\b/i.test(avecEspace)) {
        const r = poserAncreConfidentialite(avecEspace);
        avecEspace = r.html;
        ancre = r.ancre;
    }
    if (ancre) {
        avecEspace = avecEspace.replace(/<a\b[^>]*\sdata-rgpd-link\b[^>]*>/gi, balise => balise
            .replace(/\shref\s*=\s*(["'])[^"']*\1/i, '')
            .replace(/\s(target|rel)\s*=\s*(["'])[^"']*\2/gi, '')
            .replace(/^<a\b/i, `<a href="#${ID_ANCRE}"`));
    }

    const ecole = (ecoleForcee && String(ecoleForcee).toLowerCase()) || ecoleDuFooter(avecEspace);
    if (!ecole || !CONFIDENTIALITE[ecole]) return avecEspace;

    return avecEspace.replace(/<a\b[^>]*>/gi, balise => {
        // Lien « ici » du texte RGPD des formulaires : adresse provisoire
        // #privacy-policy (blocks/forms/shared/rgpd-config.js), jamais remplacée.
        // Avec l'ancre du footer, il reste sur #privacy-policy (ci-dessus).
        const rgpd = !ancre && /\sdata-rgpd-link\b/i.test(balise) && /\shref\s*=\s*["']#(privacy-policy)?["']/i.test(balise);
        if (ancre && /\sdata-rgpd-link\b/i.test(balise)) return balise;
        if (!rgpd && !/\shref\s*=\s*["']#["']/i.test(balise)) return balise;
        const classes = (balise.match(/\sclass\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
        let url = '';
        if (rgpd) {
            url = CONFIDENTIALITE[ecole];
        } else if (/\b(df-social|reseau-icone)\b/.test(classes)) {
            const label = ((balise.match(/\saria-label\s*=\s*["']([^"']*)["']/i) || [])[1] || '').toLowerCase();
            const reseau = RESEAUX.find(r => label.includes(r));
            url = reseau ? urlReseau(ecole, reseau) : '';
        } else if (/\b(df-legal-link|ft-legal-link)\b/.test(classes)) {
            url = CONFIDENTIALITE[ecole];
        }
        if (!url) return balise;
        let out = balise.replace(/\shref\s*=\s*["']#(privacy-policy)?["']/i, ` href="${echapper(url)}"`);
        if (!/\starget\s*=/i.test(out)) out = out.replace(/^<a\b/i, '<a target="_blank"');
        if (!/\srel\s*=/i.test(out)) out = out.replace(/^<a\b/i, '<a rel="noopener"');
        return out;
    });
}

module.exports = { completerLiensFooter, chargerLiensEcoles, CONFIDENTIALITE, RESEAUX_SECOURS };
