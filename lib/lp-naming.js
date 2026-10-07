/**
 * Nom SFMC des LP.
 *
 * NOUVELLES pages : le bloc SFMC s'appelle "<école>_<id>_<langue>"
 * (ex. efap_brochure_fr). La CloudPage du site reçoit école / id / langue
 * depuis l'URL (www.efap.com/en/pages/brochure) et les concatène pour charger
 * le bloc. Ce nom est calculé UNE fois, à la création de la page, et stocké
 * dans properties.sfmcKey : renommer la page ensuite ne le change pas.
 *
 * Pages EXISTANTES (sans properties.sfmcKey) : elles gardent leur affichage
 * dans le builder, mais sont PUBLIÉES dans SFMC sous le nouveau nom (calculé
 * depuis leur nom de projet). Elles ne sont jamais renommées dans le builder.
 */

const { supabaseRequest } = require('./supabase');

function stripSchoolPrefix(projectName) {
    if (!projectName) return projectName;
    return String(projectName).replace(/^school-[^_]+__/, '');
}

/**
 * From CustomerKey spec: "Code Snippet customer keys may only contain alpha-numeric
 * characters, underscores, dashes, periods, and slashes. No spaces are allowed."
 */
function slugifyKey(s) {
    return String(s || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_./-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '');
}

/** Ancienne clé : titre sans préfixe école (ex. BROCHURE__FR). */
function legacySfmcKey(projectName) {
    return slugifyKey(stripSchoolPrefix(projectName));
}

/** Ancien nom affiché dans Content Builder (casse et espaces conservés). */
function legacySfmcName(projectName) {
    return stripSchoolPrefix(projectName);
}

/**
 * Nouvelle clé "<école>_<id>_<langue>" pour un nom de projet
 * "school-<école>__<titre>[__<LANG>]" (sans suffixe = FR).
 *   • id = titre en minuscules, sans accents ; underscores conservés,
 *     espaces et autres caractères → tirets ;
 *   • un titre qui répète l'école est simplifié : « icart-brochure » → brochure.
 * Renvoie null si le nom ne suit pas la convention (ex. modèles master).
 */
function buildSfmcKey(projectName) {
    const match = String(projectName || '').match(/^school-([a-z0-9-]+)__(.+?)(?:__([A-Z]{2}))?$/i);
    if (!match) return null;
    const schoolId = match[1].toLowerCase();
    if (schoolId === 'master') return null;

    let lpId = match[2]
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '');
    // L'id d'école ne contient que [a-z0-9-] : pas de caractère regex à échapper.
    const withoutSchool = lpId.replace(new RegExp(`^${schoolId}[-_]+`), '');
    if (withoutSchool) lpId = withoutSchool;
    if (!lpId) return null;

    return `${schoolId}_${lpId}_${(match[3] || 'FR').toLowerCase()}`;
}

/**
 * À appeler avant d'écrire une page dans Projects : pose properties.sfmcKey.
 *   • la page existe déjà → on conserve sa clé (ou son absence : page
 *     ancienne, ancien nom) ; une clé envoyée par le client est ignorée ;
 *   • nouvelle page → nouvelle clé calculée depuis son nom.
 * Retourne l'objet properties (modifié sur place).
 */
async function withSfmcKey(projectName, properties) {
    const props = properties && typeof properties === 'object' ? properties : {};
    let existing = null;
    try {
        const rows = await supabaseRequest(
            'GET',
            `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=properties&limit=1`
        );
        existing = Array.isArray(rows) ? rows[0] : null;
    } catch (e) {
        // En cas de doute on ne touche à rien : mieux vaut l'ancien nom qu'un
        // renommage d'une page existante.
        console.warn('withSfmcKey: lecture impossible, clé inchangée :', e.message);
        return props;
    }

    if (existing) {
        const kept = existing.properties && existing.properties.sfmcKey;
        if (kept) props.sfmcKey = kept;
        else delete props.sfmcKey;
        return props;
    }

    const key = buildSfmcKey(projectName);
    if (key) props.sfmcKey = key;
    else delete props.sfmcKey;
    return props;
}

/**
 * Clé SFMC utilisée à la PUBLICATION d'une page (toutes les pages) :
 *   • properties.sfmcKey si présent (nouvelle page, clé figée à sa création) ;
 *   • sinon la clé école_id_langue calculée depuis son nom : une page existante
 *     garde son affichage dans le builder mais est publiée sous le nouveau nom ;
 *   • sinon (nom hors convention, ex. master) l'ancien nommage.
 * `legacyKey` sert à retrouver un asset publié avant ce changement.
 * `properties` peut être omis : il est alors lu en base.
 */
async function resolveSfmcNaming(projectName, properties) {
    let props = properties;
    if (props === undefined) {
        try {
            const rows = await supabaseRequest(
                'GET',
                `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=properties&limit=1`
            );
            props = Array.isArray(rows) && rows[0] ? rows[0].properties : null;
        } catch (e) {
            console.warn('resolveSfmcNaming: lecture impossible, clé calculée depuis le nom :', e.message);
            props = null;
        }
    }
    const legacyKey = legacySfmcKey(projectName);
    const key = (props && props.sfmcKey) || buildSfmcKey(projectName);
    if (key) return { customerKey: key, name: key, legacyKey, isNewNaming: true };
    return { customerKey: legacyKey, name: legacySfmcName(projectName), legacyKey, isNewNaming: false };
}

/**
 * Autre page PUBLIÉE de la même école qui a déjà cette clé SFMC.
 * Ex. « icart-brochure » et « ICART – BROCHURE__FR » donnent toutes deux
 * icart_brochure_fr : publier l'une écraserait le bloc de l'autre.
 * Renvoie le nom de la page en conflit, ou null.
 */
async function findSfmcKeyConflict(projectName, customerKey) {
    const schoolMatch = String(projectName || '').match(/^school-([a-z0-9-]+)__/i);
    if (!schoolMatch || !customerKey) return null;
    const rows = await supabaseRequest(
        'GET',
        `/Projects?project_name=like.${encodeURIComponent(`school-${schoolMatch[1]}__*`)}`
        + '&select=project_name,sfmcKey:properties->>sfmcKey,status:properties->>status'
    );
    const other = (Array.isArray(rows) ? rows : []).find(r =>
        r.project_name !== projectName
        && r.status === 'published'
        && (r.sfmcKey || buildSfmcKey(r.project_name)) === customerKey
    );
    return other ? other.project_name : null;
}

/**
 * Nom de la page dans son URL publique = partie centrale de la clé SFMC
 * (efj_candidature_fr → candidature, brassart_test_logo_en → test_logo).
 * La CloudPage du site refait la concaténation inverse : école + "_" + nom
 * + "_" + langue (fr si l'URL n'a pas de /en/) → clé du bloc à charger.
 * Renvoie null si la clé ne suit pas le format école_nom_langue.
 */
function sfmcUrlName(sfmcKey) {
    const match = String(sfmcKey || '').match(/^[a-z0-9-]+_(.+)_[a-z]{2}$/);
    return match ? match[1] : null;
}

module.exports = {
    buildSfmcKey,
    sfmcUrlName,
    legacySfmcKey,
    legacySfmcName,
    withSfmcKey,
    resolveSfmcNaming,
    findSfmcKeyConflict
};
