/**
 * ============================================================================
 *  TOUT CHAMP AFFICHÉ EST OBLIGATOIRE
 * ============================================================================
 *  Règle arbitrée le 30/08 : si un champ est visible, c'est qu'on en a besoin.
 *  La liste des champs à contrôler n'est donc plus écrite à la main dans chaque
 *  formulaire — elle se déduit de ce que le visiteur a réellement sous les yeux.
 *
 *  C'est le seul moyen tenable ici : la cascade décide À L'EXÉCUTION si la
 *  spécialité, le rythme ou la langue apparaissent, et le socle rend les dates
 *  d'événement après coup. Une liste figée dans le code ne pouvait pas les
 *  connaître, et c'est bien ce qui se passait : ces champs-là n'étaient jamais
 *  contrôlés.
 *
 *  Inversement, un champ MASQUÉ n'est jamais exigé — un champ à valeur unique
 *  est masqué mais renseigné, et un champ hors périmètre de l'école est masqué
 *  et vide. Les deux doivent passer.
 * ============================================================================
 */

/* Les conteneurs visuels des quatre familles de formulaires. On remonte
   jusqu'à eux pour masquer/afficher et pour loger le message : masquer le
   <select> seul laisserait son libellé orphelin. */
const CONTENEURS = [
    '.cnd-field', '.brf-field', '.jpo-field', '.imf-field',
    '.cnd-rgpd', '.brf-rgpd', '.jpo-rgpd', '.imf-rgpd',
    '[data-socle-champ]', '.form-group'
];

/* Jamais exigés : le tracking (caché par nature), les boutons, et les champs
   que le formulaire déclare explicitement facultatifs. */
const IGNORES = ['hidden', 'submit', 'button', 'reset', 'image'];

function conteneurDe(el) {
    for (const sel of CONTENEURS) {
        const c = el.closest && el.closest(sel);
        if (c) return c;
    }
    return el.parentNode;
}

/** Le préfixe de la famille (« jpo », « cnd »…), lu sur le conteneur. */
function prefixeDe(conteneur) {
    const m = /(^|\s)([a-z]{3})-(field|rgpd)/.exec(conteneur.className || '');
    return m ? m[2] : '';
}

/**
 * Visible À L'ÉCRAN, pas seulement présent dans le DOM.
 *
 * On remonte toute la chaîne des parents : la cascade masque le conteneur, pas
 * le champ. `offsetParent` aurait suffi dans un navigateur, mais il vaut null
 * sur un élément en `position: fixed` — on préfère un test explicite.
 */
function estAffiche(el) {
    let n = el;
    const vue = el.ownerDocument && el.ownerDocument.defaultView;
    while (n && n.nodeType === 1) {
        if (n.classList && n.classList.contains('hidden')) return false;
        const style = vue && vue.getComputedStyle ? vue.getComputedStyle(n) : n.style;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        n = n.parentNode;
    }
    return true;
}

/** Le message d'erreur du conteneur, créé au besoin. */
function spanErreur(conteneur) {
    let span = conteneur.querySelector('[class*="-err-msg"]');
    if (span) return span;

    const prefixe = prefixeDe(conteneur);
    if (!prefixe) return null;
    span = conteneur.ownerDocument.createElement('span');
    span.className = `${prefixe}-err-msg`;
    conteneur.appendChild(span);
    return span;
}

/** Un groupe de boutons radio compte pour UN champ. */
function nomsRadio(form) {
    const vus = {};
    form.querySelectorAll('input[type="radio"][name]').forEach((r) => { vus[r.name] = 1; });
    return Object.keys(vus);
}

function videRadio(form, nom) {
    const boutons = [...form.querySelectorAll(`input[type="radio"][name="${nom}"]`)];
    if (!boutons.some(estAffiche)) return null;          // groupe masqué
    return boutons.some((b) => b.checked) ? null : boutons[0];
}

/**
 * Contrôle tous les champs affichés et signale les manquants.
 *
 * @param {HTMLFormElement} form
 * @param {object} opts
 * @param {string} opts.message      texte du message sous le champ
 * @param {string[]} [opts.facultatifs] attributs `name` à ne pas exiger
 * @returns {HTMLElement[]} les champs manquants, le premier en tête
 */
export function validerChampsAffiches(form, { message = 'Ce champ est requis.', facultatifs = [] } = {}) {
    if (!form) return [];
    const exclus = new Set(facultatifs);
    const manquants = [];

    const marquer = (el, enFaute) => {
        const conteneur = conteneurDe(el);
        const span = conteneur && spanErreur(conteneur);
        if (enFaute) {
            el.classList.add('err');
            if (span) {
                /* On n'écrase pas un libellé déjà écrit par le formulaire : il
                   est souvent plus précis que le message générique. */
                if (!span.textContent.trim()) span.textContent = message;
                span.classList.add('show');
            }
            manquants.push(el);
        } else {
            el.classList.remove('err');
            if (span) span.classList.remove('show');
        }
    };

    form.querySelectorAll('input, select, textarea').forEach((el) => {
        const type = (el.type || '').toLowerCase();
        if (IGNORES.indexOf(type) !== -1) return;
        if (type === 'radio') return;                     // traités par groupe
        if (el.name && exclus.has(el.name)) return;
        if (!estAffiche(el)) { marquer(el, false); return; }

        const vide = type === 'checkbox'
            ? !el.checked
            : !String(el.value || '').trim();
        marquer(el, vide);
    });

    nomsRadio(form).forEach((nom) => {
        if (exclus.has(nom)) return;
        const fautif = videRadio(form, nom);
        if (fautif) marquer(fautif, true);
    });

    return manquants;
}

/**
 * Contrôle, puis amène le premier champ manquant sous les yeux.
 *
 * Sans ce défilement, un formulaire long refusait de partir sans que rien ne
 * bouge à l'écran : le champ fautif était plus bas que le bouton.
 */
export function validerEtRevelerRequis(form, opts) {
    const manquants = validerChampsAffiches(form, opts);
    if (manquants.length && manquants[0].scrollIntoView) {
        try {
            manquants[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
            manquants[0].focus({ preventScroll: true });
        } catch (e) { /* vieux navigateur : le message suffit */ }
    }
    return manquants.length === 0;
}
