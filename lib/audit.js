/**
 * ============================================================================
 *  AUDIT — « modifié par » sur chaque objet + journal d'activité (admin)
 * ============================================================================
 *  Deux mécanismes distincts, une seule source d'identité.
 *
 *  1. auditFields(req)  → { updated_at, updated_by_name, updated_by_email }
 *     Champs à fusionner dans le payload d'écriture de l'objet modifié (FAQ,
 *     composant, école…). Dénormalisé : la liste s'affiche sans jointure.
 *
 *  2. recordActivity(req, {...})
 *     Ligne append-only dans `activity_logs`, destinée à une section ADMIN.
 *     Rien de visible côté client.
 *
 *  ── Règle absolue ─────────────────────────────────────────────────────────
 *  Le journal est de l'OBSERVATION, jamais un prérequis. recordActivity()
 *  n'échoue JAMAIS : toute erreur (table absente, colonne manquante, réseau)
 *  est avalée et journalisée en console. Perdre une ligne d'audit est
 *  acceptable ; faire échouer la sauvegarde d'une page parce que le journal
 *  est indisponible ne l'est pas.
 *
 *  L'identité vient TOUJOURS de la session SFMC, jamais du corps de la requête.
 * ============================================================================
 */
const { supabaseRequest } = require('./api-shared');
const sfmcAuth = require('./sfmc-auth');

/** Auteur courant, depuis la session SFMC. */
function actorOf(req) {
    return sfmcAuth.getActor(req);
}

/**
 * Champs d'audit à fusionner dans un payload d'UPDATE.
 * `withUpdatedAt: false` pour les tables qui n'ont pas de colonne `updated_at`
 * (ou dont elle est gérée ailleurs).
 */
function auditFields(req, { withUpdatedAt = true } = {}) {
    const a = actorOf(req);
    const out = {};
    if (withUpdatedAt) out.updated_at = new Date().toISOString();
    // Auth en veille ou session expirée : on horodate sans prétendre connaître
    // l'auteur. Écrire `null` explicitement effacerait un auteur légitime.
    if (a.name || a.email) {
        out.updated_by_name = a.name || null;
        out.updated_by_email = a.email || null;
    }
    return out;
}

/** Retire les champs d'audit d'un payload — repli quand les colonnes manquent. */
function withoutAudit(payload) {
    const out = { ...payload };
    delete out.updated_by_name;
    delete out.updated_by_email;
    return out;
}

function isMissingColumn(err, column) {
    const m = String((err && err.message) || err || '');
    return m.includes(column) && (m.includes('column') || m.includes('42703') || m.includes('schema'));
}

/**
 * Écriture tolérante : tente avec les champs d'audit, réessaie sans eux si les
 * colonnes n'existent pas encore (migration 009 non appliquée). Sans ce repli,
 * une migration oubliée casserait l'édition de FAQ, de blocs et d'écoles.
 *
 * @param {'POST'|'PATCH'} method
 * @param {string} endpoint  chemin PostgREST, ex. `/faq?id=eq.42`
 */
async function writeWithAudit(method, endpoint, payload, headers = null) {
    try {
        return headers ? await supabaseRequest(method, endpoint, payload, headers)
                       : await supabaseRequest(method, endpoint, payload);
    } catch (e) {
        const hasAudit = 'updated_by_name' in payload || 'updated_by_email' in payload;
        const missing = isMissingColumn(e, 'updated_by_name')
                     || isMissingColumn(e, 'updated_by_email')
                     || isMissingColumn(e, 'updated_at');
        if (!hasAudit || !missing) throw e;

        console.warn('[audit] colonnes d\'audit absentes sur', endpoint,
                     '— ecriture effectuee SANS auteur (migration 009 a appliquer).');
        const stripped = withoutAudit(payload);
        delete stripped.updated_at;
        return headers ? await supabaseRequest(method, endpoint, stripped, headers)
                       : await supabaseRequest(method, endpoint, stripped);
    }
}

/* ── Journal d'activité ──────────────────────────────────────────────────────*/

/**
 * Vocabulaire des actions : `<objet>.<verbe>`. Stable, car c'est sur lui que
 * filtrera l'écran admin. Ne pas renommer une valeur déjà écrite en base.
 */
const ACTIONS = {
    PAGE_CREATED:      'page.created',
    PAGE_UPDATED:      'page.updated',
    PAGE_DELETED:      'page.deleted',
    PAGE_RESTORED:     'page.restored',
    PAGE_PUBLISHED:    'page.published',
    PAGE_UNPUBLISHED:  'page.unpublished',
    PAGE_MOVED:        'page.moved',
    PAGE_TRANSLATED:   'page.translated',
    PAGE_RENAMED:      'page.renamed',
    PAGE_SEO_UPDATED:  'page.seo_updated',

    MASTER_CREATED:    'master.created',
    MASTER_UPDATED:    'master.updated',
    MASTER_DELETED:    'master.deleted',
    MASTER_DECLINED:   'master.declined',

    FAQ_CREATED:       'faq.created',
    FAQ_UPDATED:       'faq.updated',
    FAQ_DELETED:       'faq.deleted',
    FAQ_LINKED:        'faq.linked',
    FAQ_UNLINKED:      'faq.unlinked',

    BLOCK_CREATED:     'block.created',
    BLOCK_UPDATED:     'block.updated',
    BLOCK_DELETED:     'block.deleted',

    SCHOOL_CREATED:    'school.created',
    SCHOOL_UPDATED:    'school.updated',
    SCHOOL_DELETED:    'school.deleted',
    SCHOOL_COLORS:     'school.colors_updated',
    SCHOOL_GTM:        'school.gtm_updated',
    SCHOOL_SETTINGS:   'school.settings_updated',

    FORM_CREATED:      'form.created',
    FORM_UPDATED:      'form.updated',
    FORM_DELETED:      'form.deleted'
};

/**
 * Champs d'une école qui portent le tracking GTM. Sert à distinguer « code GTM
 * modifié » de « couleur modifiée » : les deux passent par la MÊME route
 * (PUT /api/school/:id), donc sans ça le journal afficherait « école modifiée »
 * sans dire quoi.
 */
const GTM_FIELDS = ['custom_head_code', 'custom_body_code', 'customHeadCode', 'customBodyCode'];
const COLOR_FIELDS = ['color', 'secondary_color', 'color_light', 'colorHeader', 'colorCarousel',
                      'color_header', 'color_carousel', 'header_text_color', 'branding', 'emoji', 'logo'];

/**
 * Propriétés SEO d'une page. Le journal ne retient QUE celles-ci : `properties`
 * transporte aussi le HTML brut et l'état de publication, qui n'ont rien à
 * faire dans une ligne « SEO modifié ».
 */
const SEO_FIELDS = ['seoTitle', 'seoDescription', 'pageTitle', 'keywords',
                    'canonical', 'schemaLd', 'favicon'];

/** Ne garde d'un objet de propriétés que les champs SEO réellement présents. */
function seoOnly(properties = {}) {
    const out = {};
    for (const k of SEO_FIELDS) {
        if (properties && k in properties) out[k] = properties[k];
    }
    return out;
}

/**
 * École portée par un nom de projet (`school-efap__ma-page__EN` → `efap`).
 * Sert à renseigner `school` pour que l'écran admin puisse filtrer. Volontairement
 * sans expression régulière : le nom peut contenir n'importe quel libellé.
 */
function schoolFromProjectName(projectName) {
    const s = String(projectName || '');
    if (!s.toLowerCase().startsWith('school-')) return null;
    const rest = s.slice('school-'.length);
    const cut = rest.indexOf('_');
    return ((cut > 0 ? rest.slice(0, cut) : rest) || '').toLowerCase() || null;
}

/**
 * Déduit l'action précise d'une modification d'école à partir des champs qui
 * ont RÉELLEMENT changé.
 */
function schoolActionFor(changedKeys = []) {
    const k = changedKeys.filter(Boolean);
    if (!k.length) return ACTIONS.SCHOOL_UPDATED;
    if (k.some(x => GTM_FIELDS.includes(x)))   return ACTIONS.SCHOOL_GTM;
    if (k.every(x => COLOR_FIELDS.includes(x))) return ACTIONS.SCHOOL_COLORS;
    return ACTIONS.SCHOOL_SETTINGS;
}

/**
 * Liste des clés dont la valeur diffère entre before et after. Utilisée pour
 * ne stocker QUE le delta : pas de HTML complet de page dans le journal.
 */
function changedKeys(before = {}, after = {}) {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const out = [];
    for (const k of keys) {
        const b = before ? before[k] : undefined;
        const a = after ? after[k] : undefined;
        if (a === undefined) continue;           // champ non soumis → non modifié
        if (JSON.stringify(b) !== JSON.stringify(a)) out.push(k);
    }
    return out;
}

/** Tronque les valeurs volumineuses : le journal n'est pas une sauvegarde. */
const MAX_VALUE = 500;
function trim(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
        return value.length > MAX_VALUE ? value.slice(0, MAX_VALUE) + `… (+${value.length - MAX_VALUE} car.)` : value;
    }
    if (typeof value !== 'object') return value;
    const out = {};
    for (const k of Object.keys(value)) out[k] = trim(value[k]);
    return out;
}

/** Réduit before/after aux seules clés modifiées, valeurs tronquées. */
function delta(before, after, keys) {
    const b = {}, a = {};
    for (const k of keys) {
        if (before && k in before) b[k] = trim(before[k]);
        if (after && k in after)   a[k] = trim(after[k]);
    }
    return { before: Object.keys(b).length ? b : null, after: Object.keys(a).length ? a : null };
}

/**
 * Enregistre une ligne de journal. NE LÈVE JAMAIS.
 *
 * @param {object}  req
 * @param {object}  o
 * @param {string}  o.action        une valeur de ACTIONS
 * @param {string} [o.targetLabel]  libellé lisible (nom de page, question FAQ…)
 * @param {string} [o.targetId]     identifiant de l'objet
 * @param {string} [o.school]       école concernée, pour filtrer côté admin
 * @param {string} [o.pageId]       si l'objet est une page
 * @param {object} [o.before]       état avant (réduit au delta)
 * @param {object} [o.after]        état après
 * @param {object} [o.metadata]     complément libre
 * @returns {Promise<void>}
 */
async function recordActivity(req, o = {}) {
    try {
        if (!o.action) return;
        const a = actorOf(req);

        let before = o.before ? trim(o.before) : null;
        let after  = o.after  ? trim(o.after)  : null;
        if (o.before && o.after) {
            const keys = changedKeys(o.before, o.after);
            // Aucune valeur modifiée : ne pas polluer le journal.
            if (!keys.length && !o.metadata) return;
            const d = delta(o.before, o.after, keys);
            before = d.before; after = d.after;
        }

        await supabaseRequest('POST', '/activity_logs', {
            action: o.action,
            page_id: o.pageId || null,
            entity_id: o.entityId || null,
            organization_id: o.organizationId || null,
            actor_name: a.name || null,
            actor_email: a.email || null,
            before_state: before,
            after_state: after,
            metadata: {
                ...(o.metadata || {}),
                ...(o.targetId ? { targetId: String(o.targetId) } : {}),
                ...(o.targetLabel ? { targetLabel: String(o.targetLabel).slice(0, 200) } : {}),
                ...(o.school ? { school: o.school } : {})
            }
        }, { Prefer: 'return=minimal' });
    } catch (e) {
        // Volontairement silencieux côté fonctionnel : le journal ne doit jamais
        // empêcher l'action métier d'aboutir.
        console.warn('[audit] journalisation ignoree (' + (o && o.action) + ') :',
                     (e && e.message) || e);
    }
}

module.exports = {
    ACTIONS,
    actorOf,
    auditFields,
    withoutAudit,
    writeWithAudit,
    recordActivity,
    schoolActionFor,
    schoolFromProjectName,
    seoOnly,
    changedKeys,
    delta,
    trim,
    GTM_FIELDS,
    COLOR_FIELDS,
    SEO_FIELDS
};
