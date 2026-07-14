/**
 * Synchronisation des <select> campus des formulaires
 * ───────────────────────────────────────────────────────────────
 * Tous les selects marqués `.lp-campus-select` sont peuplés depuis la
 * liste de campus RÉSOLUE au niveau de la page (window.LPCampus).
 *
 * On modifie le MODÈLE GrapesJS (pas seulement le DOM du canvas) pour
 * que les options soient « bake » dans le HTML exporté / sauvegardé.
 *
 * Value de l'option = campus.id (identique aux slugs actuels → aucune
 * régression côté Salesforce). Le placeholder (1re option value="")
 * est préservé.
 */

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function resolved() {
    return (window.LPCampus && window.LPCampus.getResolvedCampuses)
        ? window.LPCampus.getResolvedCampuses() : [];
}

function syncOne(selectComp) {
    const campuses = resolved();
    if (!campuses.length) return; // pas de campus → on garde le fallback statique

    const sig = campuses.map(c => c.id + ':' + (c.name || '')).join('|');
    if (selectComp.get('__campusSig') === sig) return; // déjà à jour → évite les boucles

    // Préserve le placeholder (1re option sans value)
    let placeholderHtml = '';
    const kids = selectComp.components();
    if (kids && kids.length) {
        const first = kids.at(0);
        const attrs = (first.getAttributes && first.getAttributes()) || {};
        if (!attrs.value) {
            try { placeholderHtml = first.toHTML(); } catch (e) { placeholderHtml = ''; }
        }
    }

    const opts = campuses
        .map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
        .join('');

    selectComp.components(placeholderHtml + opts);
    selectComp.set('__campusSig', sig);
}

function syncAll(editor) {
    let selects = [];
    try {
        const wrapper = editor.getWrapper();
        selects = wrapper ? wrapper.find('select.lp-campus-select') : [];
    } catch (e) { return; }
    selects.forEach(syncOne);
}

export function initCampusSelectSync(editor) {
    if (!editor || editor.__campusSelectSyncInit) return;
    editor.__campusSelectSyncInit = true;

    let raf = null;
    const schedule = () => {
        if (raf) return;
        raf = (window.requestAnimationFrame || setTimeout)(() => {
            raf = null;
            syncAll(editor);
        }, 0);
    };

    editor.on('load', () => setTimeout(() => syncAll(editor), 300));
    editor.on('component:add', schedule);
    document.addEventListener('lp:campuses-changed', () => syncAll(editor));
}
