/**
 * Statut de publication d'une page — trois valeurs seulement :
 *   • draft        Brouillon : jamais publiée sur SFMC ;
 *   • published    Publiée   : l'asset est en ligne sur SFMC ;
 *   • unpublished  Dépubliée : elle a été publiée, puis retirée de SFMC.
 *
 * POURQUOI CE MODULE. Le statut était écrit à deux endroits qui ne se
 * parlaient pas :
 *   1. la publication mettait `Projects.properties.status` à « published »,
 *      mais le tableau de bord lit `pages.status`, jamais mis à jour → les 87
 *      pages publiées s'affichaient « Brouillon » (constat du 09/10/2026) ;
 *   2. tout enregistrement remettait le statut à « draft », alors que la page
 *      restait en ligne sur SFMC (seule une publication change ce qui est servi).
 * Désormais : publier / dépublier écrit le statut aux DEUX endroits, et un
 * enregistrement ne change plus le statut d'une page publiée ou dépubliée.
 */
const { supabaseRequest } = require('./supabase');

const STATUTS_PUBLICATION = ['draft', 'published', 'unpublished'];

/** Statut à garder lors d'un simple enregistrement (aucune action SFMC). */
function statutApresEnregistrement(statutPrecedent) {
    return (statutPrecedent === 'published' || statutPrecedent === 'unpublished') ? statutPrecedent : 'draft';
}

/**
 * Statut à écrire lors d'un enregistrement de `projectName` : celui déjà en
 * base s'il est « published » ou « unpublished », sinon « draft » (nouvelle
 * page ou brouillon). Une lecture en échec retombe sur « draft », comme avant.
 */
async function statutPourEnregistrement(projectName) {
    try {
        const lignes = await supabaseRequest(
            'GET',
            `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=status:properties->>status&limit=1`
        );
        return statutApresEnregistrement(lignes && lignes[0] && lignes[0].status);
    } catch (e) {
        return 'draft';
    }
}

/**
 * Écrit le statut de publication d'une page dans `Projects.properties` ET dans
 * la page structurée (`pages`, lue par le tableau de bord). La page structurée
 * peut ne pas exister (projet jamais migré) : ce n'est pas une erreur.
 */
async function marquerStatutPublication(projectName, statut) {
    if (!projectName || !STATUTS_PUBLICATION.includes(statut)) return;
    const maintenant = new Date().toISOString();

    const lignes = await supabaseRequest(
        'GET',
        `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=properties&limit=1`
    );
    const projet = lignes && lignes[0];
    if (projet) {
        const properties = { ...(projet.properties || {}), status: statut };
        if (statut === 'published') properties.publishedAt = maintenant;
        if (statut === 'unpublished') properties.unpublishedAt = maintenant;
        await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, { properties });
    }

    const pagePatch = { status: statut, updated_at: maintenant };
    if (statut === 'published') pagePatch.published_at = maintenant;
    try {
        await supabaseRequest(
            'PATCH',
            `/pages?metadata->>legacyProjectName=eq.${encodeURIComponent(projectName)}&status=neq.deleted`,
            pagePatch
        );
    } catch (e) {
        console.warn(`statut-page: page structurée de « ${projectName} » non mise à jour —`, e.message);
    }
}

module.exports = { STATUTS_PUBLICATION, statutApresEnregistrement, statutPourEnregistrement, marquerStatutPublication };
