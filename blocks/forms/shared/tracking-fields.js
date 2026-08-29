/**
 * Champs cachés communs (tracking + mapping CRM)
 * ───────────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — colonnes
 * "Champ caché" présentes sur tous les formulaires.
 *
 * Deux exports :
 *   • buildHiddenFields()   → chaîne HTML des <input type="hidden">
 *   • populateHiddenFields()→ remplit les valeurs (URL utm_*, gclid,
 *                             clientId, consent, Marque, Langue…) à l'init.
 *
 * Note : « Rentrée générale » N'EST PAS incluse — poussée par Flow Builder
 * côté CRM (cf. onglet « Règles métier » §4).
 */

/* Champs de tracking alimentés depuis les paramètres d'URL. */
import { resolveRgpdConfig } from './rgpd-config.js';

export const UTM_FIELDS = [
    'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term', 'utm_id', 'utm_campus'
];

/* Autres identifiants publicitaires / consentement cookies. */
export const AD_FIELDS = ['gclid', 'fbclid'];

/**
 * Construit le bloc de champs cachés commun à tous les formulaires.
 *
 * @param {Object}  opts
 * @param {string}  opts.formName          - Nom logique du formulaire (ex: "Inscription_JPO")
 * @param {string}  opts.formType          - Type de formulaire (ex: "brochure", "evenement", "candidature")
 * @param {string}  opts.lang              - 'fr' | 'en' → Langue préférée de contact
 * @param {string}  [opts.marque='']       - Marque / école (rempli dynamiquement si vide)
 * @param {string}  [opts.langueSouhaitee=''] - Langue d'enseignement souhaitée (défaut IFA Paris = fr)
 * @returns {string} HTML des inputs cachés
 */
/**
 * L'école courante au moment de CONSTRUIRE le bloc.
 *
 * ⚠ Ne pas confondre avec le remplissage à l'exécution, plus bas : celui-ci
 * lit `window.CURRENT_SCHOOL`, qui n'existe QUE dans le builder. Sur une page
 * publiée il est absent, et le champ `Marque` restait donc vide — le socle
 * d'écriture ne pouvait ni résoudre la marque du consentement ni la campagne.
 * Figer la valeur ici, à la construction, règle les deux.
 */
/** Rend une valeur sûre dans un attribut HTML entre guillemets. */
function escapeAttr(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ecoleCourante() {
    try {
        const s = (typeof window !== 'undefined' && window.CURRENT_SCHOOL) || null;
        return s ? String(s.id || '') : '';
    } catch (e) { return ''; }
}

export function buildHiddenFields({ formName, formType = '', lang = 'fr', marque = '', langueSouhaitee = '' }) {
    /* L'ID de l'école, pas son nom : c'est lui qui sert de clé dans
       LPB_Mapping_Ecoles et dans la clé de campagne « brochure|efap|FR ». */
    if (!marque) marque = ecoleCourante();

    /* La PREUVE du consentement : la formulation exacte que la personne coche.
       Le socle la préfixe d'un numéro de version et l'écrit dans
       `Legal_Texte_Accepted__c`, un champ REQUIS. Sans elle, la trace se
       réduisait à « [v1] » — une version sans texte, qui ne prouve rien.

       Même source que le libellé affiché à côté de la case : les deux ne
       peuvent pas diverger au rendu. Si la config RGPD est rafraîchie ensuite
       en asynchrone, chaque formulaire remet le champ à jour (voir le
       fetchRgpdConfig de chaque bloc). */
    const preuve = escapeAttr(resolveRgpdConfig(lang).text || '');
    const utm = UTM_FIELDS.map(n => `<input type="hidden" name="${n}" value="">`).join('\n        ');
    const ads = AD_FIELDS.map(n => `<input type="hidden" name="${n}" value="">`).join('\n        ');
    return `
        <!-- ═══════════ CHAMPS CACHÉS (tracking + mapping CRM) ═══════════ -->
        <input type="hidden" name="submitted"            value="true">
        <input type="hidden" name="NomFormulaire"        value="${formName}">
        <input type="hidden" name="TypeFormulaire"       value="${formType}">
        <input type="hidden" name="Marque"               value="${marque}">
        <input type="hidden" name="LanguePreferee"       value="${lang}">
        <input type="hidden" name="LangueSouhaitee"      value="${langueSouhaitee}">
        <input type="hidden" name="LegalTexteAccepted"   value="${preuve}">
        <input type="hidden" name="DateDernierContact"   value="">
        <input type="hidden" name="TypeDernierContact"   value="">
        <input type="hidden" name="CampagneAssociee"     value="">
        ${utm}
        ${ads}
        <input type="hidden" name="clientId"                 value="">
        <input type="hidden" name="consent"                  value="">
        <input type="hidden" name="date_consentement_cookies" value="">
        <input type="hidden" name="canal"                    value="">
        <input type="hidden" name="sous_canal"               value="">`;
}

/**
 * Remplit les champs cachés à l'initialisation du formulaire.
 * - utm_* / gclid / fbclid : depuis les paramètres d'URL
 * - clientId               : localStorage (ou généré)
 * - consent / date         : depuis le cookie de consentement s'il existe
 * - Marque / Langue        : depuis window.CURRENT_SCHOOL
 *
 * @param {HTMLFormElement} form
 * @param {Object}          opts
 * @param {string}          opts.lang
 */
export function populateHiddenFields(form, { lang = 'fr' } = {}) {
    if (!form) return;

    const setVal = (name, value) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el && value != null && value !== '') el.value = value;
    };

    let params = null, win = null;
    try {
        win = (form.ownerDocument && form.ownerDocument.defaultView) || window;
        params = new win.URLSearchParams(win.location.search);
    } catch (e) { /* contexte iframe/canvas : pas d'URL exploitable */ }

    /* ── Paramètres d'URL : utm_* + identifiants pub ── */
    if (params) {
        UTM_FIELDS.concat(AD_FIELDS).forEach(name => {
            const v = params.get(name);
            if (v) setVal(name, v);
        });
    }

    /* ── clientId persistant (GA-like) ── */
    try {
        const store = win.localStorage;
        let cid = store.getItem('edh_client_id');
        if (!cid) {
            cid = 'cid_' + Math.abs(hashString(String(win.navigator.userAgent) + form.dataset.lang + form.action));
            store.setItem('edh_client_id', cid);
        }
        setVal('clientId', cid);
    } catch (e) { /* stockage indisponible */ }

    /* ── Consentement cookies (si bannière présente) ── */
    try {
        const cookieConsent = readCookie(win.document, 'cookie_consent');
        if (cookieConsent) {
            setVal('consent', cookieConsent);
            const dateConsent = readCookie(win.document, 'cookie_consent_date');
            if (dateConsent) setVal('date_consentement_cookies', dateConsent);
        }
    } catch (e) { /* pas de cookie */ }

    /* ── Marque + Langue souhaitée depuis le contexte école ── */
    try {
        const school = (typeof win !== 'undefined' && win.CURRENT_SCHOOL) ? win.CURRENT_SCHOOL : null;
        if (school) {
            const marqueEl = form.querySelector('[name="Marque"]');
            if (marqueEl && !marqueEl.value) marqueEl.value = school.name || school.id || '';

            /* IFA Paris : langue souhaitée par défaut = français */
            const isIfa = String(school.id || '').toLowerCase().indexOf('ifa') !== -1;
            const langueEl = form.querySelector('[name="LangueSouhaitee"]');
            if (langueEl && !langueEl.value && isIfa) langueEl.value = 'français';
        }
    } catch (e) { /* pas d'école courante */ }

    /* ── Langue préférée de contact = langue du formulaire ── */
    setVal('LanguePreferee', lang);
}

/* ── Utilitaires internes ─────────────────────────────────────────── */
function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
}

function readCookie(doc, name) {
    try {
        const m = doc.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
}
