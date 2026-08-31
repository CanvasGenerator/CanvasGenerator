/**
 * ============================================================================
 *  ENVOI RÉEL AU SOCLE D'ÉCRITURE
 * ============================================================================
 *  Jusqu'ici les six formulaires validaient, puis résolvaient une promesse
 *  factice : rien ne partait au CRM. Ce module fait le POST.
 *
 *  --- Pourquoi un fetch et non une soumission de formulaire -----------------
 *  Un `<form method="post">` recharge la page. La confirmation, le libellé de
 *  succès, la liste des brochures — tout cela est rendu en JS, et disparaîtrait
 *  au rechargement. Le fetch garde l'écran intact et laisse le socle écrire.
 *
 *  --- La page se poste à elle-même ------------------------------------------
 *  Le socle d'écriture est un Content Block INCLUS dans la page, aux côtés du
 *  socle de lecture (voir socle-read-snippet.js). Il s'exécute donc à chaque
 *  requête, et n'agit que
 *  si `submitted=true` est posté. L'URL cible est celle de la page courante :
 *  aucun endpoint à déclarer, aucune CORS à ouvrir.
 *
 *  --- Comment on sait que ça a marché ---------------------------------------
 *  Le socle écrit son bilan en commentaire HTML :
 *      <!-- socle ecriture: statut=success pa=001... journal=... -->
 *  On le relit dans la réponse.
 *
 *  ⚠ AMPscript n'a PAS de try/catch : une écriture refusée par Salesforce
 *  remplace la page entière, commentaire compris. L'ABSENCE de marqueur est
 *  donc un échec, pas un imprévu — et c'est le seul symptôme qu'on obtiendra.
 * ============================================================================
 */

/* Le socle de LECTURE publie `window.SOCLE_DATA`. Sa présence signe une page
   publiée : dans le builder GrapesJS, rien de tout cela n'existe, et poster
   l'URL du builder n'aurait aucun sens. */
export function socleEstPresent(doc) {
    try {
        const vue = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null);
        return !!(vue && vue.SOCLE_DATA);
    } catch (e) { return false; }
}

/* On s'arrete a la fermeture du commentaire, pas au premier `>` : `-->` aurait
   laisse les deux tirets dans la valeur capturee. */
const RE_STATUT  = /socle ecriture:\s*statut=(\w+)/i;
const RE_ERREUR  = /socle erreur:\s*([\s\S]*?)\s*-->/i;
const RE_JOURNAL = /socle ecriture:[\s\S]*?journal=([\s\S]*?)\s*-->/i;

/** Lit le bilan que le socle laisse dans la page. */
export function lireBilan(html) {
    const texte = String(html || '');
    const statut = RE_STATUT.exec(texte);
    if (!statut) {
        return {
            ok: false,
            statut: 'inconnu',
            message: 'Le socle n\'a rien répondu — écriture probablement refusée par le CRM.',
            journal: '',
        };
    }
    const err = RE_ERREUR.exec(texte);
    const jrn = RE_JOURNAL.exec(texte);
    return {
        ok: statut[1] === 'success',
        statut: statut[1],
        message: err ? err[1].trim() : '',
        journal: jrn ? jrn[1].trim() : '',
    };
}

/**
 * Poste les données du formulaire à la page courante.
 *
 * @param {object} data  toutes les valeurs, champs cachés compris
 * @param {Document} doc le document du formulaire (l'iframe du builder, sinon)
 * @returns {Promise<{ok: boolean, statut: string, message: string, journal: string}>}
 */
export async function envoyerAuSocle(data, doc) {
    const vue = (doc && doc.defaultView) || window;

    const corps = [];
    Object.keys(data || {}).forEach((cle) => {
        const v = data[cle];
        corps.push(encodeURIComponent(cle) + '=' + encodeURIComponent(v == null ? '' : String(v)));
    });
    /* Le drapeau que le socle attend. Il est déjà dans les champs cachés, mais
       on le réaffirme : sans lui le socle ne fait rien, en silence. */
    if (!Object.prototype.hasOwnProperty.call(data || {}, 'submitted')) {
        corps.push('submitted=true');
    }

    /* La page elle-même, query string comprise : le socle de LECTURE la relira
       au passage, et les paramètres (campus, TypeEvenement…) doivent survivre. */
    const cible = vue.location.href;

    let reponse;
    try {
        reponse = await vue.fetch(cible, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: corps.join('&'),
            credentials: 'same-origin',
        });
    } catch (e) {
        return { ok: false, statut: 'reseau', message: e && e.message ? e.message : 'Envoi impossible.', journal: '' };
    }

    /* Un 500 de CloudPage renvoie tout de même du HTML : on le lit avant de
       conclure, le bilan y est parfois. */
    const html = await reponse.text().catch(() => '');
    const bilan = lireBilan(html);
    if (!reponse.ok && bilan.statut === 'inconnu') {
        bilan.message = `Le serveur a répondu ${reponse.status}.`;
    }
    return bilan;
}

/**
 * Le point d'entrée des formulaires : envoi réel si la page le permet,
 * simulation sinon.
 *
 * La simulation n'est pas un reste de développement : c'est ce qui fait
 * fonctionner l'aperçu du builder, où aucun socle ne tourne.
 */
export function soumettre(data, doc, { delaiSimulation = 900 } = {}) {
    if (!socleEstPresent(doc)) {
        return new Promise((r) => setTimeout(() => r({ ok: true, statut: 'simule', message: '', journal: '' }), delaiSimulation));
    }
    return envoyerAuSocle(data, doc);
}
