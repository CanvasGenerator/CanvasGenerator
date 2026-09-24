/**
 * Noms d'une LP côté builder.
 *
 * • lpSfmcName  : nom AFFICHÉ dans les listes (dashboard, projets). Les
 *   nouvelles pages s'affichent sous leur nom SFMC (properties.sfmcKey, figé à
 *   leur création) ; les pages existantes gardent leur affichage d'origine.
 *
 * • lpSfmcPublishKey : nom du bloc tel qu'il sera PUBLIÉ dans SFMC, pour
 *   toutes les pages : "<école>_<id>_<langue>" (ex. efap_brochure_fr).
 *   ⚠️ Même règle que buildSfmcKey / resolveSfmcNaming (lib/lp-naming.js),
 *   qui calcule la clé réellement envoyée : garder les deux identiques.
 */
(function () {
    window.lpSfmcName = function lpSfmcName(sfmcKey, fallback) {
        return sfmcKey || fallback || '';
    };

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
        const withoutSchool = lpId.replace(new RegExp(`^${schoolId}[-_]+`), '');
        if (withoutSchool) lpId = withoutSchool;
        if (!lpId) return null;
        return `${schoolId}_${lpId}_${(match[3] || 'FR').toLowerCase()}`;
    }

    window.lpSfmcPublishKey = function lpSfmcPublishKey(projectName, sfmcKey) {
        return sfmcKey
            || buildSfmcKey(projectName)
            || String(projectName || '').replace(/^school-[^_]+__/, '');
    };
})();
