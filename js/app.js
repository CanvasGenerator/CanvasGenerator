import { initStorage } from './storage.js';
import { initExport } from './export.js';
import { createImageUploadHandler, publishInlineImagesInString, collectAssetNames, applyImageMapToEditor } from './image-upload.js';
import { initAiAssistant } from './ai-assistant.js';
import { registerBlocks } from '../blocks/index.js';
import { FormGenerator } from './form-generator.js';
import { ComponentBuilder } from './component-builder.js';
import { initCampus, openCampusSettings } from './campus.js';
import { initCampusSelectSync } from '../blocks/forms/shared/campus-select.js';

// Custom Toast notification system to replace native alert popups
window.alert = function (message) {
    let container = document.getElementById('custom-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'custom-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 420px;
            width: calc(100% - 48px);
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #ffffff;
        color: #374151;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: start;
        gap: 14px;
        transform: translateX(120%);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        border-left: 4px solid #1a7a5e;
    `;

    const isError = message.toLowerCase().includes('erreur') || 
                    message.toLowerCase().includes('failed') || 
                    message.toLowerCase().includes('impossible') || 
                    message.toLowerCase().includes('vide') || 
                    message.toLowerCase().includes('veuillez') ||
                    message.toLowerCase().includes('ajoutez');

    let iconHtml = '<i class="fas fa-check-circle" style="color: #1a7a5e; font-size: 20px;"></i>';
    let title = 'Succès';
    
    if (isError) {
        toast.style.borderLeftColor = '#ef4444';
        iconHtml = '<i class="fas fa-exclamation-circle" style="color: #ef4444; font-size: 20px;"></i>';
        title = 'Attention';
    }

    toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; flex-shrink: 0;">
            ${iconHtml}
        </div>
        <div style="flex: 1; padding-top: 1px;">
            <div style="font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 3px;">${title}</div>
            <div style="color: #4b5563; font-size: 13px; font-weight: 400;">${message}</div>
        </div>
        <button style="background: none; border: none; padding: 2px; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none; margin-top: 2px; transition: color 0.2s;" onmouseover="this.style.color='#4b5563'" onmouseout="this.style.color='#9ca3af'" onclick="const p = this.parentElement; p.style.opacity='0'; p.style.transform='translateX(120%)'; setTimeout(() => p.remove(), 400)">
            <i class="fas fa-times" style="font-size: 14px;"></i>
        </button>
    `;

    container.prepend(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 400);
        }
    }, 6000);
};

const BLOCK_THUMBNAILS = {
    'header-efap': 'assets/block-thumbnails/header-efap.svg',
    'header-brassart': 'assets/block-thumbnails/header-brassart.svg',
    'footer-efap': 'assets/block-thumbnails/footer-efap.svg',
    'footer-brassart': 'assets/block-thumbnails/footer-brassart.svg',
    hero: 'assets/block-thumbnails/hero.svg',
    'two-column': 'assets/block-thumbnails/two-column.svg',
    'rich-text': 'assets/block-thumbnails/rich-text.svg',
    'cta-button': 'assets/block-thumbnails/cta-button.svg',
    'image-caption': 'assets/block-thumbnails/image-caption.svg',
    spacer: 'assets/block-thumbnails/spacer.svg',
    'horizontal-menu': 'assets/block-thumbnails/horizontal-menu.svg',
    'bande-rose': 'assets/block-thumbnails/bande-rose.svg',
    'programme-list': 'assets/block-thumbnails/programme-list.svg',
    'programme-editorial': 'assets/block-thumbnails/programme-editorial.svg',
    'trois-raisons': 'assets/block-thumbnails/trois-raisons.svg',
    'form-sfmc': 'assets/block-thumbnails/form-sfmc.svg',
    'form-salesforce-core': 'assets/block-thumbnails/form-sfmc.svg',
    'chiffres-cles': 'assets/block-thumbnails/chiffres-cles.svg',
    Carrousel: 'assets/block-thumbnails/carrousel.svg',
    CarrouselTemoignages: 'assets/block-thumbnails/carrousel-temoignages.svg',
    CarrouselCampus: 'assets/block-thumbnails/carrousel-campus.svg',
    default: 'assets/block-thumbnails/default.svg'
};

let CURRENT_SCHOOL = null;
let currentProjectIsNew = true;
let currentProjectLanguage = 'FR';
let currentStructuredPageId = null;

// ── Modèle « un projet, plusieurs langues » ────────────────────────────────
// Langue D'ORIGINE de la page (la variante originale). Les autres langues sont
// des variantes de traduction stockées dans la même page (table page_variants).
let currentOriginalLanguage = 'FR';
// Résumé des variantes renvoyé par le serveur : [{ language, isOriginal, exists, stale, status }]
let currentPageVariants = [];
// Langues « prêtes » (miroir de READY_LANGUAGES côté serveur). Seules celles-ci
// apparaissent dans le switch. Écrasé par la valeur serveur au chargement.
let READY_LANGUAGES = ['FR', 'EN'];
const LANG_FLAGS = { FR: '🇫🇷', EN: '🇬🇧', ES: '🇪🇸', DE: '🇩🇪', IT: '🇮🇹', PT: '🇵🇹' };
const LANG_LABELS = { FR: 'Français', EN: 'English', ES: 'Español', DE: 'Deutsch', IT: 'Italiano', PT: 'Português' };
function normLang(l) { return String(l || 'FR').trim().toUpperCase(); }
// Langue « cible » du bouton header (.hdr-lang) : la première langue prête différente
// de la langue courante. FR → EN, EN → FR. Sert d'indicateur + bouton de bascule.
function otherReadyLang(cur) {
    cur = normLang(cur);
    return normLang((READY_LANGUAGES || ['FR', 'EN']).find(l => normLang(l) !== cur) || cur);
}

// Rend cliquable l'élément DOM d'un composant .hdr-lang (dans le canvas) : un clic
// bascule vers la langue cible. Attaché directement sur le noeud DOM du composant
// (fiable, contrairement à un écouteur délégué sur le document de l'iframe).
function bindHdrLangClick(comp) {
    try {
        const node = comp && comp.getEl && comp.getEl();
        if (!node || node.__langBound) return;
        node.__langBound = true;
        node.style.cursor = 'pointer';
        node.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const cur = normLang(currentProjectLanguage);
            const target = otherReadyLang(cur);
            console.log('[hdr-lang] clic → bascule', cur, '→', target);
            if (normLang(target) !== cur) switchLanguage(target);
        }, true);
    } catch (e) { console.warn('bindHdrLangClick', e); }
}

// Blocs-formulaires déplacés de l'onglet Blocks vers l'onglet Forms.
// On capture leur contenu ici pour (1) les afficher dans l'onglet Forms et
// (2) que le template par défaut (qui utilise form-sfmc) fonctionne encore.
let formBlocksCache = [];        // [{ id, label, media, content }]
const formBlocksContentById = {}; // { id: content } — pour loadDefaultTemplate

function updatePageIdBadge() {
    const badge = document.getElementById('project-id-badge');
    if (!badge) return;
    
    const schoolId = window.CURRENT_SCHOOL?.id || new URLSearchParams(window.location.search).get('school')?.toLowerCase();
    const fullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);
    
    if (fullName && !currentProjectIsNew) {
        // Strip the school prefix to match SFMC logic (e.g. school-mopa__MyPage__FR -> MyPage__FR)
        const sfmcName = fullName.replace(new RegExp(`^school-[^_]+__`), '');
        
        badge.innerText = 'Nom SFMC : ' + sfmcName;
        badge.style.display = 'inline-block';
        badge.setAttribute('title', "Cliquez pour copier le nom de l'Asset pour SFMC");
        
        badge.onclick = function() {
            navigator.clipboard.writeText(sfmcName).then(() => {
                const original = badge.innerText;
                badge.innerText = 'Copié !';
                setTimeout(() => badge.innerText = original, 1500);
            });
        };

        try {
            const url = new URL(window.location);
            url.searchParams.set('project', fullName);
            url.searchParams.delete('pageId'); // Nettoyage de l'ancien paramètre
            window.history.replaceState({}, '', url);
        } catch(e) {}
    } else {
        badge.style.display = 'none';
    }

    updateStatusBadge();
}

// Badge brouillon / publié + visibilité du bouton « Dépublier ».
// Le bouton n'apparaît que lorsque la page est réellement publiée sur SFMC.
function updateStatusBadge() {
    const badge = document.getElementById('project-status-badge');
    const unpubBtn = document.getElementById('btn-unpublish-sfmc');
    if (!badge) return;

    if (currentProjectIsNew) {
        badge.style.display = 'none';
        if (unpubBtn) unpubBtn.style.display = 'none';
        return;
    }

    const status = (currentProjectProperties && currentProjectProperties.status) || 'draft';
    const isPublished = status === 'published';

    badge.style.display = 'inline-block';
    badge.textContent = isPublished ? '● Publié' : '● Brouillon';
    badge.style.background = isPublished ? '#dcfce7' : '#f3f4f6';
    badge.style.color = isPublished ? '#166534' : '#6b7280';
    badge.style.border = isPublished ? '1px solid #86efac' : '1px solid #d1d5db';

    if (unpubBtn) unpubBtn.style.display = isPublished ? 'inline-flex' : 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school')?.toLowerCase();
    if (!schoolId) { window.location.href = 'school-selector.html'; return; }

    try {
        const response = await fetch(`/api/school/${schoolId}?v=${Date.now()}`);
        if (response.ok) {
            CURRENT_SCHOOL = await response.json();
            window.CURRENT_SCHOOL = CURRENT_SCHOOL;

            // Security overrides for main schools
            if (CURRENT_SCHOOL.id === 'efap') {
                CURRENT_SCHOOL.secondaryColor = '#1a1a1a';
                if (!CURRENT_SCHOOL.color) CURRENT_SCHOOL.color = '#d9d0c1';
            } else if (CURRENT_SCHOOL.id === 'brassart') {
                if (!CURRENT_SCHOOL.secondaryColor) CURRENT_SCHOOL.secondaryColor = '#e91e63';
            }

            updateSchoolUI(CURRENT_SCHOOL);
            injectBrandVariables(null, CURRENT_SCHOOL, true);
        } else if (schoolId === 'master') {
            CURRENT_SCHOOL = { id: 'master', name: 'MASTER', color: '#e5e7eb', secondaryColor: '#6b7280', colorHeader: '#9ca3af', colorCarousel: '#e5e7eb', defaultBlocks: [] };
            updateSchoolUI(CURRENT_SCHOOL);
            injectBrandVariables(null, CURRENT_SCHOOL, true);
        }
    } catch (e) { console.error('Failed to load school config', e); }

    // Liens par école (site web + réseaux sociaux) pour pré-remplir automatiquement
    // les logos et icônes RS des headers/footers. DOIT être peuplé AVANT initEditor
    // (registerBlocks lit window.__SCHOOL_LINKS au moment de construire les blocs).
    try {
        const schoolsResp = await fetch(`/api/schools?v=${Date.now()}`);
        if (schoolsResp.ok) {
            const allSchools = await schoolsResp.json();
            const map = {};
            (Array.isArray(allSchools) ? allSchools : []).forEach(s => {
                map[String(s.id).toLowerCase()] = {
                    baseUrl: s.baseUrl || s.base_url || '',
                    social: (s.branding && s.branding.social) || {}
                };
            });
            window.__SCHOOL_LINKS = map;
        }
    } catch (e) { console.warn('Failed to load school links map', e); }

    initEditor(schoolId);

    // If opened from CMS dashboard with ?pageId=<id>, load the structured page first.
    // Fallback to ?project=<fullName> keeps the legacy flow working during migration.
    const pageIdParam = params.get('pageId');
    const projectParam = params.get('project');
    if (pageIdParam || projectParam) {
        // Wait for GrapesJS to be ready before loading
        const tryLoad = setInterval(async () => {
            if (!window.editor) return;
            clearInterval(tryLoad);
            try {
                if (pageIdParam) {
                    await loadStructuredPageIntoEditor(pageIdParam, schoolId);
                    return;
                }

                const res = await fetch(`/api/project/${encodeURIComponent(projectParam)}`);
                if (!res.ok) return;
                const project = await res.json();
                window.editor.loadProjectData(parseProjectData(project.project_data));
                injectBrandVariables(window.editor, CURRENT_SCHOOL);
                populateProperties(project.properties || {});
                setTimeout(() => window.__clearUndoHistory && window.__clearUndoHistory(), 300);
                currentProjectIsNew = false;
                currentStructuredPageId = project.page_id || null;
                updatePageIdBadge();
                localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, projectParam);
                const parts = projectParam.replace(/^school-[a-z0-9-]+__/, '').split('__');
                localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, parts[0] || projectParam);
                // Modèle multilingue : la langue affichée est la langue D'ORIGINE de la
                // page (les traductions se chargent ensuite via le switch). On lit le
                // résumé des variantes renvoyé par le serveur.
                const loadedLang = normLang(project.original_language || parts[1] || 'FR');
                currentProjectLanguage = loadedLang;
                applyVariantsSummary(project); // { variants, original_language, ready_languages }
                setActiveLangUI(loadedLang);
                applyLogoLanguage(window.editor, loadedLang);
                // Close the welcome overlay if visible
                const overlay = document.getElementById('welcome-overlay');
                if (overlay) overlay.classList.add('hidden');
                const openModal = document.getElementById('school-open-modal');
                if (openModal) openModal.classList.add('hidden');
            } catch (e) { console.error('Auto-load project failed:', e); }
        }, 200);
    }
});

function parseProjectData(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); }
    catch { return {}; }
}

function propertiesFromStructuredPage(page = {}) {
    const seo = page.seo || {};
    return {
        title: page.title || '',
        description: page.description || '',
        seoTitle: seo.title || '',
        seoDescription: seo.description || '',
        keywords: seo.keywords || '',
        canonical: seo.canonical || '',
        schemaLd: seo.schemaLd || ''
    };
}

function getCurrentVersion(page, versions = []) {
    if (!Array.isArray(versions) || versions.length === 0) return null;
    return versions.find(version => version.id === page.current_version_id) || versions[0];
}

async function loadStructuredPageIntoEditor(pageId, schoolId) {
    const res = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}`);
    if (!res.ok) throw new Error(await res.text());

    const payload = await res.json();
    const { page, versions = [] } = payload;
    const version = getCurrentVersion(page, versions);
    if (!version) throw new Error('Aucune version disponible pour cette page.');

    const projectData = parseProjectData(version.project_data);
    if (Object.keys(projectData).length) {
        window.editor.loadProjectData(projectData);
        injectBrandVariables(window.editor, CURRENT_SCHOOL);
    } else {
        window.editor.setComponents(extractBodyHtml(version.html || ''));
        window.editor.setStyle(version.css || '');
    }
    // Ouverture de page → historique undo vidé (undo n'agit que sur les modifs à venir).
    setTimeout(() => window.__clearUndoHistory && window.__clearUndoHistory(), 300);

    const legacyProjectName = page.metadata?.legacyProjectName || '';
    const displayName = page.title || legacyProjectName || 'Projet';
    const language = normLang(page.language || 'FR');

    populateProperties(propertiesFromStructuredPage(page));
    currentProjectIsNew = false;
    currentStructuredPageId = page.id;
    currentProjectLanguage = language;
    // Résumé des variantes de langue (switch + staleness). L'ouverture charge
    // toujours la variante d'origine (page.current_version_id).
    applyVariantsSummary(payload); // { variants, originalLanguage, readyLanguages }
    setActiveLangUI(language);
    applyLogoLanguage(window.editor, language);

    // IMPORTANT : écrire le fullName en localStorage AVANT updatePageIdBadge(),
    // car le badge + l'URL (?project=) sont lus depuis localStorage. Sinon le
    // badge/URL reflètent l'ancienne page (bug « l'URL ne change pas »).
    localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, displayName);
    if (legacyProjectName) {
        localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, legacyProjectName);
    } else {
        localStorage.removeItem(`reetain-builder__${schoolId}__currentFullName`);
    }
    updatePageIdBadge();

    const overlay = document.getElementById('welcome-overlay');
    if (overlay) overlay.classList.add('hidden');
    const openModal = document.getElementById('school-open-modal');
    if (openModal) openModal.classList.add('hidden');
}

// Un projet autosauvegardé corrompu (ou écrit par une autre version de GrapesJS)
// fait planter l'init ("Cannot read properties of undefined (reading 'getFrames')").
// On valide le blob avant l'init et on le purge s'il est inutilisable.
function cleanCorruptedAutosave(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        const pages = data && data.pages;
        const valid = Array.isArray(pages) && pages.length > 0
            && pages.every(p => p && Array.isArray(p.frames) && p.frames.length > 0);
        if (!valid) throw new Error('invalid project data');
    } catch (e) {
        console.warn(`⚠️ Autosave corrompu supprimé (${storageKey})`, e.message);
        localStorage.removeItem(storageKey);
    }
}

// ── WYSIWYG : ajuste le zoom du canvas pour que le device Desktop (1280px) tienne
// dans l'espace dispo entre les panneaux → rendu éditeur ≈ preview desktop, sans
// scroll horizontal. Tablet/Mobile restent à 100 %.
// DÉSACTIVÉ : le dézoom auto du canvas (setZoom + ResizeObserver) gelait l'éditeur
// et cassait la sélection (panneaux Style/Propriétés). No-op conservé pour ne pas
// casser les points d'appel. Le rendu 1280px est géré côté preview/SFMC (serveur).
function fitDesktopCanvas(editor) { /* no-op — voir device Desktop width:'' */ }
function scheduleFitDesktopCanvas(editor) { /* no-op */ }

// Active la barre de recherche de la sidebar Blocks : filtre les blocs (et masque
// les catégories vides) selon le texte saisi, en comparant le libellé du bloc.
// Un MutationObserver ré-applique le filtre quand GrapesJS re-rend la liste
// (changement d'école/mode, ajout de bloc…), sans dépendre d'un timing précis.
function initBlockSearch(editor) {
    const input = document.getElementById('block-search');
    const container = document.getElementById('blocks');
    if (!input || !container) return;

    let applying = false;
    const applyFilter = () => {
        if (applying) return;
        applying = true;
        try {
            const q = (input.value || '').trim().toLowerCase();
            // IMPORTANT : le CSS impose `.gjs-block{display:flex!important}` → il faut
            // masquer avec setProperty(...,'important') (inline !important) pour l'emporter,
            // et removeProperty pour réafficher (laisse le CSS reprendre la main).
            const hide = el => el.style.setProperty('display', 'none', 'important');
            const show = el => el.style.removeProperty('display');
            container.querySelectorAll('.gjs-block').forEach(el => {
                const text = ((el.textContent || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
                (!q || text.includes(q)) ? show(el) : hide(el);
            });
            // Masquer les catégories vides ; pendant une recherche, forcer l'ouverture
            // des catégories qui ont des résultats (elles peuvent être repliées par défaut).
            container.querySelectorAll('.gjs-block-category').forEach(cat => {
                const anyVisible = Array.from(cat.querySelectorAll('.gjs-block'))
                    .some(b => b.style.getPropertyValue('display') !== 'none');
                anyVisible ? show(cat) : hide(cat);
                const content = cat.querySelector('.gjs-blocks-c');
                if (content) {
                    if (q && anyVisible) content.style.setProperty('display', 'flex', 'important');
                    else content.style.removeProperty('display');
                }
            });
        } finally {
            applying = false;
        }
    };

    input.addEventListener('input', applyFilter);
    input.addEventListener('search', applyFilter); // croix "clear" des <input type=search>

    // Ré-appliquer le filtre courant quand la liste de blocs est reconstruite.
    // On n'observe que childList/subtree → nos changements de style (attribut) ne
    // relancent pas l'observer (pas de boucle).
    try {
        const obs = new MutationObserver(() => { if (!applying) applyFilter(); });
        obs.observe(container, { childList: true, subtree: true });
    } catch (e) { /* MutationObserver indispo : le filtre marche quand même à la saisie */ }

    editor.on('load', applyFilter);
}

function initEditor(schoolId) {
    const storageKey = `reetain-builder__${schoolId}__gjsProject`;
    cleanCorruptedAutosave(storageKey);

    // Palette de couleurs de l'école → échantillons du color picker (Spectrum).
    // Ce même picker est partagé par le Style Manager (Propriétés) ET les traits de
    // type couleur (Trait Manager) → toutes les couleurs choisies pour l'école sont
    // donc accessibles dans les DEUX panneaux.
    // On affiche la palette de marque COMPLÈTE (16 rôles : primary, secondary, accent,
    // background, surface, text, muted, border, boutons, liens, success/warning/error)
    // + les couleurs historiques de l'école.
    const _sc = CURRENT_SCHOOL || {};
    const RF_pal = window.ReetainFonts;
    const _brandColors = RF_pal
        ? Object.values(RF_pal.normalizeBranding(_sc.branding, _sc).colors || {})
        : Object.values((_sc.branding && _sc.branding.colors) || {});
    const favColors = [...new Set(
        [_sc.color, _sc.secondaryColor, _sc.colorHeader, _sc.colorCarousel, _sc.colorLight, ..._brandColors]
            .filter(c => typeof c === 'string' && c.trim())
            .map(c => c.trim().toLowerCase())
    )];
    // Découpe en lignes de 8 pour un affichage lisible (Spectrum affiche une grille).
    const _paletteRows = favColors.reduce((rows, c, i) => {
        if (i % 8 === 0) rows.push([]);
        rows[rows.length - 1].push(c);
        return rows;
    }, []);
    const neutralColors = ['#000000', '#ffffff', '#f5f5f5', '#9ca3af', '#1a1a1a'];

    const editor = grapesjs.init({
        container: '#gjs',
        height: '100%',
        width: 'auto',
        colorPicker: {
            palette: favColors.length ? [..._paletteRows, neutralColors] : [neutralColors],
            showPalette: true,
            showPaletteOnly: false,
            hideAfterPaletteSelect: false,
            showInitial: true,
            showInput: true,
            preferredFormat: 'hex',
            showSelectionPalette: false,
        },
        storageManager: {
            type: 'local',
            autosave: true,
            stepsBeforeSave: 1,
            // GrapesJS 0.23 : la clé du storage local se lit dans options.local.key
            // (cf. getCurrentOptions → config.options[type]). Un `key` à la racine est
            // IGNORÉ → GrapesJS retombait sur sa clé par défaut « gjsProject », partagée
            // par TOUTES les écoles + le Master (contamination croisée), et jamais purgée
            // par cleanCorruptedAutosave (qui vise reetain-builder__<school>__gjsProject).
            // Un blob corrompu/incompatible dans « gjsProject » plantait alors l'init
            // (« Cannot read properties of undefined (reading 'getFrames') »), laissant le
            // canvas à moitié initialisé → drag & drop KO (surtout sur un Master vierge).
            // On place la clé au bon endroit : storage par école + guard anti-corruption effectif.
            options: { local: { key: storageKey } },
        },
        assetManager: {
            // Les images uploadées sont compressées puis gardées en data URL ;
            // elles sont publiées dans SFMC (et remplacées par leur URL publique)
            // au moment de l'envoi de la page vers SFMC.
            embedAsBase64: false,
            uploadFile: createImageUploadHandler(() => editor),
        },
        blockManager: { appendTo: '#blocks' },
        styleManager: { appendTo: '#styles-container' },
        layerManager: { appendTo: '#layers-container' },
        traitManager: { appendTo: '#traits-container' },
        panels: { defaults: [] },
        // Undo/redo fiable : ne PAS tracer les simples SÉLECTIONS de composants
        // (sinon chaque clic crée une étape fantôme → Ctrl+Z « mangé », retour arrière
        // imprévisible qui fait perdre du travail). On ne trace que les vraies éditions
        // (ajout, suppression, style/dimension, typo, attributs).
        undoManager: { trackSelection: false, maximumStackLength: 500 },
        // NB : les @font-face (Gotham, Space Grotesk) sont chargés dans l'iframe
        // canvas via injectBrandVariables (link explicite en URL absolue), plus
        // fiable que l'option canvas.styles.
        deviceManager: {
            devices: [
                // Desktop = largeur fluide (canvas normal). NB : on avait tenté un
                // rendu forcé à 1280px + dézoom auto, mais ça gelait l'éditeur / cassait
                // la sélection (boucle ResizeObserver↔setZoom). Le rendu 1280px reste
                // appliqué côté PREVIEW et SFMC (serveur), pas dans l'éditeur.
                // widthMedia = le breakpoint où la règle CSS s'applique (peut différer
                // de la largeur d'aperçu). On l'aligne sur les breakpoints réels des
                // blocs (768px) et des vrais téléphones : ainsi une modif faite en mode
                // Mobile s'écrit dans @media(max-width:767px) → visible sur TOUS les
                // téléphones (≤767), plus besoin de repasser par Desktop.
                { name: 'Desktop', width: '' },
                { name: 'Tablet', width: '768px', widthMedia: '991px' },
                { name: 'Mobile', width: '375px', widthMedia: '767px' },
            ],
        },
        selectorManager: {
            componentFirst: true, // Applique les styles par ID plutôt que par classe par défaut
        },
    });

    // Ajout d'un bouton "Annuler la mise en forme" dans l'éditeur de texte enrichi (RTE)
    const rte = editor.RichTextEditor;
    rte.add('clear-format', {
        icon: '<i class="fa-solid fa-eraser" style="font-size: 14px; margin-top: 2px;"></i>',
        attributes: { title: 'Annuler la mise en forme (effacer le style)' },
        result: rte => {
            const doc = editor.Canvas.getDocument();
            const selection = doc.getSelection();
            if (selection && !selection.isCollapsed) {
                // Remplace tout le HTML collé par du texte brut
                const plainText = selection.toString();
                doc.execCommand('insertText', false, plainText);
            } else {
                rte.exec('removeFormat');
            }
        }
    });

    initUI(editor);
    initBlockThumbnailMedia(editor);
    initStorage(editor);
    initExport(editor);
    initAiAssistant(editor);
    registerBlocks(editor);
    // Filtrage synchrone dès l'enregistrement des blocs : ne pas dépendre uniquement
    // de l'événement asynchrone editor.on('load') (dont le timing varie selon le
    // cache/vitesse de chargement) sinon les composants des autres écoles peuvent
    // rester affichés ("parfois ça bug"). Le filtre est idempotent : rappelé sur
    // 'load', il ne retire rien de plus.
    filterBlocksBySchool(editor, schoolId);
    // Déplace les blocs-formulaires de l'onglet Blocks vers l'onglet Forms.
    extractFormBlocks(editor);
    // Active la barre de recherche de la sidebar Blocks.
    initBlockSearch(editor);

    // Ré-injecter les CSS vars à chaque fois que le canvas iframe est rechargé
    // (nécessaire pour les composants custom GrapesJS comme les carousels)
    editor.on('canvas:frame:load', () => {
        injectBrandVariables(editor, CURRENT_SCHOOL);
        injectComponentFixedStyles(editor);
        // Si l'aperçu est actif, réappliquer la largeur fixe 1280px + ancrage : le
        // canvas vient d'être rechargé (ex. switch de langue) et a perdu le style.
        if (window.__reapplyEditorPreview) window.__reapplyEditorPreview();
    });

    editor.on('load', () => {
        filterBlocksBySchool(editor, schoolId);
        injectBrandVariables(editor, CURRENT_SCHOOL);
        restrictFontSelector(editor, CURRENT_SCHOOL);
        addFontStyleControl(editor);
        setStyleManagerLabels(editor);
        loadCustomComponents(editor, schoolId);

        // Au lieu de charger directement le template, on affiche la popup de choix
        const params = new URLSearchParams(window.location.search);
        if (!params.get('project')) {
            showOpeningPopup();
        }
    });

    // ── Affichage des dimensions réelles dans le Style Manager ───────────
    // Quand un composant est sélectionné, on lit sa taille rendue (offsetWidth /
    // offsetHeight) dans le canvas et on l'affiche en placeholder sur les champs
    // Largeur et Hauteur du secteur Dimensions — aucune modification du style,
    // juste une indication visuelle de référence (lecture seule).
    editor.on('component:selected', (component) => {
        // Petit délai pour laisser le Style Manager se re-rendre
        setTimeout(() => {
            try {
                const el = component && component.getEl ? component.getEl() : null;
                if (!el) return;

                const w = Math.round(el.offsetWidth);
                const h = Math.round(el.offsetHeight);
                if (!w && !h) return;

                const sm = document.getElementById('styles-container');
                if (!sm) return;

                // Champ Largeur
                const wInput = sm.querySelector('.gjs-sm-property__width input');
                if (wInput) wInput.placeholder = `${w} px`;

                // Champ Hauteur
                const hInput = sm.querySelector('.gjs-sm-property__height input');
                if (hInput) hInput.placeholder = `${h} px`;

                // Champ Largeur max (info utile)
                const mwInput = sm.querySelector('.gjs-sm-property__max-width input');
                if (mwInput && !mwInput.value) mwInput.placeholder = `${w} px`;
            } catch(e) { /* silencieux */ }
        }, 80);
    });

    // Réinitialiser les placeholders quand rien n'est sélectionné
    editor.on('component:deselected', () => {
        try {
            const sm = document.getElementById('styles-container');
            if (!sm) return;
            ['.gjs-sm-property__width input',
             '.gjs-sm-property__height input',
             '.gjs-sm-property__max-width input'].forEach(sel => {
                const el = sm.querySelector(sel);
                if (el) el.placeholder = '';
            });
        } catch(e) { /* silencieux */ }
    });

    // ── Réordonner les blocs : flèches Monter / Descendre dans la toolbar ──
    // Retour client : la flèche « haut » actuelle (sélection du parent) ne sert à
    // rien. On la retire et on ajoute deux flèches qui changent l'ordre des blocs
    // (monter / descendre parmi les blocs voisins). Ne touche qu'à la barre d'outils
    // (affichage) — aucune incidence sur le HTML exporté.
    function lpMoveSelected(dir) {
        const sel = editor.getSelected();
        if (!sel) return;
        // Voisins = enfants du parent (plus fiable que sel.collection pour tous les
        // types de composants, y compris les <div>).
        const parent = sel.parent && sel.parent();
        const coll = parent ? parent.components() : sel.collection;
        if (!coll || typeof coll.indexOf !== 'function') return;
        const at = coll.indexOf(sel);
        if (at < 0) return;
        const newAt = dir === 'up' ? at - 1 : at + 1;
        if (newAt < 0 || newAt >= coll.length) return; // déjà tout en haut / en bas
        coll.remove(sel);              // détache (ne détruit pas le composant)
        coll.add(sel, { at: newAt });  // ré-insère à la nouvelle position
        editor.select(sel);
    }
    editor.Commands.add('lp-move-up',   { run: () => lpMoveSelected('up') });
    editor.Commands.add('lp-move-down', { run: () => lpMoveSelected('down') });

    editor.on('component:selected', () => {
        const sel = editor.getSelected();
        if (!sel) return;
        // Force la construction de la toolbar par défaut. Indispensable pour les
        // composants « par défaut » (div, blocs Essentiels…) : GrapesJS ne la
        // remplit que tardivement → sans ça, les flèches n'apparaissaient que sur
        // les <section> (type custom, toolbar déjà définie).
        if (typeof sel.initToolbar === 'function') { try { sel.initToolbar(); } catch (e) {} }
        let tb = Array.isArray(sel.get('toolbar')) ? [...sel.get('toolbar')] : [];
        // Retire l'ancienne flèche « sélectionner le parent » (jugée inutile).
        tb = tb.filter(item => {
            const cmd = item && item.command;
            const cls = (item && item.attributes && item.attributes.class) || '';
            return cmd !== 'select-parent' && !/fa-arrow-up/.test(cls);
        });
        // Ajoute Monter / Descendre en tête (une seule fois), pour tout bloc
        // déplaçable/copiable — sections ET div.
        if (!tb.some(i => i.command === 'lp-move-up')) {
            tb.unshift(
                { attributes: { class: 'fa fa-angle-up',   title: 'Monter le bloc' },   command: 'lp-move-up' },
                { attributes: { class: 'fa fa-angle-down', title: 'Descendre le bloc' }, command: 'lp-move-down' }
            );
        }
        sel.set('toolbar', tb);
    });

    // ── Verrouillage et ouverture automatique du picker FAQ ─────────────
    // Seul le .ma-title reste éditable ; tout le reste est verrouillé.
    function isFaqTitle(comp) {
        try { return comp.getClasses && comp.getClasses().includes('ma-title'); } catch(e) { return false; }
    }

    editor.on('component:add', (component) => {
        // Verrouiller si enfant d'un ma-faq-section (sauf le titre).
        // Mutation AUTOMATIQUE de flags → hors pile d'undo (skip) pour ne pas polluer.
        let parent = component.parent();
        while (parent) {
            if (parent.get('type') === 'ma-faq-section') {
                const lock = () => {
                    if (isFaqTitle(component)) {
                        component.set({ editable: true, selectable: true, hoverable: true, droppable: false, removable: false, copyable: false });
                    } else {
                        component.set({ editable: false, selectable: false, hoverable: false, droppable: false });
                    }
                };
                try { editor.UndoManager.skip(lock); } catch (e) { lock(); }
                return;
            }
            parent = parent.parent();
        }
        // NB : l'ouverture auto du picker FAQ se fait sur block:drag:stop (dépôt manuel),
        // PAS ici — sinon elle se déclenchait aussi au chargement d'une page enregistrée.
    });

    // 2. Clic sur un enfant → rediriger la sélection vers le ma-faq-section parent
    editor.on('component:selected', (component) => {
        if (component.get('type') === 'ma-faq-section') return;
        let parent = component.parent();
        while (parent) {
            if (parent.get('type') === 'ma-faq-section') {
                editor.select(parent);
                return;
            }
            parent = parent.parent();
        }
    });

    // ── Commande GrapesJS : sélecteur de FAQs ──────────────────────────
    // Déclenchée par le bouton ❓ dans la toolbar du composant ma-faq-section.
    // Ouvre un modal avec toutes les FAQs de la BDD sous forme de checkboxes.
    // Au submit, les FAQs sélectionnées sont intégrées statiquement dans le composant.
    editor.Commands.add('open-faq-picker', {
        run(ed) {
            const component = ed.getSelected();
            if (!component) return;

            const modal      = document.getElementById('faq-config-modal');
            const body       = document.getElementById('faq-config-body');
            const countEl    = document.getElementById('faq-config-count');
            const selCountEl = document.getElementById('faq-config-selected-count');

            // Récupérer les IDs déjà sélectionnés (stockés dans data-faq-ids)
            const existingIds = (component.getAttributes()['data-faq-ids'] || '')
                .split(',').filter(Boolean);

            modal.style.display = 'flex';
            body.innerHTML = '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">Chargement…</div>';
            countEl.textContent    = '';
            selCountEl.textContent = '';

            let allFaqs = [];

            function updateSelCount() {
                const checked = body.querySelectorAll('input[type=checkbox]:checked').length;
                selCountEl.textContent = checked
                    ? `${checked} question${checked > 1 ? 's' : ''} sélectionnée${checked > 1 ? 's' : ''}`
                    : '';
            }

            // Ne proposer que les FAQs associées à l'école courante (école parente de la page).
            // 'master' n'a pas d'associations → on retombe sur toute la banque.
            const currentSchoolId = CURRENT_SCHOOL?.id || window.CURRENT_SCHOOL?.id;
            const faqUrl = (currentSchoolId && currentSchoolId !== 'master')
                ? `/api/faq/school/${encodeURIComponent(currentSchoolId)}`
                : '/api/faq';

            fetch(faqUrl)
                .then(r => r.json())
                .then(rows => {
                    // /api/faq/school renvoie des associations { faq: {...} } → extraire + dédupliquer par id.
                    // /api/faq renvoie directement les FAQs.
                    let faqs;
                    if (faqUrl === '/api/faq') {
                        faqs = Array.isArray(rows) ? rows : [];
                    } else {
                        const seen = new Set();
                        faqs = (Array.isArray(rows) ? rows : [])
                            .map(r => r.faq)
                            .filter(f => f && !seen.has(f.id) && seen.add(f.id));
                    }
                    allFaqs = faqs;
                    countEl.textContent = `${faqs.length} FAQ${faqs.length > 1 ? 's' : ''} disponible${faqs.length > 1 ? 's' : ''}`;

                    if (!faqs.length) {
                        body.innerHTML = '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">Aucune FAQ dans la base de données.</div>';
                        return;
                    }

                    body.innerHTML = faqs.map(faq => `
                        <label style="display:flex;align-items:flex-start;gap:12px;padding:12px 20px;border-bottom:1px solid #f3f4f6;cursor:pointer;">
                            <input type="checkbox" value="${escapeHtml(faq.id)}"
                                ${existingIds.includes(faq.id) ? 'checked' : ''}
                                style="margin-top:3px;width:15px;height:15px;flex-shrink:0;cursor:pointer;accent-color:#1a7a5e;">
                            <div style="min-width:0;">
                                <div style="font-size:13px;font-weight:600;color:#111;line-height:1.35;">${escapeHtml(faq.question)}</div>
                                <div style="font-size:11px;color:#9ca3af;margin-top:3px;line-height:1.4;">${escapeHtml(faq.answer.slice(0, 110))}${faq.answer.length > 110 ? '…' : ''}</div>
                            </div>
                        </label>
                    `).join('');

                    body.querySelectorAll('input[type=checkbox]').forEach(cb => {
                        cb.addEventListener('change', updateSelCount);
                    });
                    updateSelCount();
                })
                .catch(() => {
                    body.innerHTML = '<div style="padding:32px;text-align:center;color:#ef4444;font-size:13px;">Erreur de chargement des FAQs.</div>';
                });

            // Tout cocher / tout décocher
            document.getElementById('btn-faq-select-all').onclick = () => {
                body.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = true; });
                updateSelCount();
            };
            document.getElementById('btn-faq-deselect-all').onclick = () => {
                body.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
                updateSelCount();
            };

            function confirmSelection() {
                const selectedIds  = [...body.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
                const selectedFaqs = allFaqs.filter(f => selectedIds.includes(f.id));

                // Stocker les IDs sélectionnés
                component.addAttributes({ 'data-faq-ids': selectedIds.join(',') });

                // Reconstruire le HTML statique de la liste
                if (selectedFaqs.length) {
                    const listComp = component.find('.ma-list')[0];
                    if (listComp) {
                        const itemsHtml = selectedFaqs.map((faq, i) => {
                            const first = i === 0;
                            return `<div class="ma-item${first ? ' ma-open' : ''}">
                                <div class="ma-q">
                                    <span>${escapeHtml(faq.question)}</span>
                                    <button class="ma-toggle" aria-label="Toggle">${first ? '&#8722;' : '&#43;'}</button>
                                </div>
                                <div class="ma-a"${first ? '' : ' style="display:none"'}>
                                    <p>${escapeHtml(faq.answer)}</p>
                                </div>
                            </div>`;
                        }).join('');
                        listComp.components(itemsHtml);
                        // Re-verrouiller tous les enfants après mise à jour du contenu (titre exclu)
                        const lockAll = (comp) => {
                            comp.get('components').each(child => {
                                if (isFaqTitle(child)) {
                                    child.set({ editable: true, selectable: true, hoverable: true, droppable: false, removable: false, copyable: false });
                                } else {
                                    child.set({ editable: false, selectable: false, hoverable: false, droppable: false });
                                    lockAll(child);
                                }
                            });
                        };
                        lockAll(component);
                    }
                }
                closeModal();
            }

            function closeModal() {
                modal.style.display = 'none';
                document.getElementById('btn-faq-config-confirm').onclick    = null;
                document.getElementById('btn-faq-config-skip').onclick       = null;
                document.getElementById('btn-faq-config-close').onclick      = null;
                document.getElementById('btn-faq-select-all').onclick        = null;
                document.getElementById('btn-faq-deselect-all').onclick      = null;
            }

            document.getElementById('btn-faq-config-confirm').onclick = confirmSelection;
            document.getElementById('btn-faq-config-skip').onclick    = closeModal;
            document.getElementById('btn-faq-config-close').onclick   = closeModal;
        }
    });
    // ── Campus block : auto-open picker on drop + child redirect ─────────
    // NB : l'ouverture auto du picker Campus se fait sur block:drag:stop (dépôt manuel),
    // PAS sur component:add — sinon elle se déclenchait aussi au chargement d'une page.

    // Ouverture auto des pickers UNIQUEMENT lors d'un dépôt manuel de bloc depuis
    // le panneau (pas au chargement d'une page enregistrée).
    editor.on('block:drag:stop', (component) => {
        if (!component || typeof component.get !== 'function') return;
        const type = component.get('type');
        if (type === 'ma-faq-section') {
            setTimeout(() => { editor.select(component); editor.Commands.run('open-faq-picker'); }, 150);
        }
        // Campus : la sélection se fait désormais au niveau de la page
        // (bouton « Campus » dans la barre d'outils), plus par composant.
    });

    // Auto-switch des logos header/footer FR↔EN : on réapplique la langue courante
    // dès que des composants apparaissent (chargement de page ou dépôt de bloc).
    // Débounce → une seule passe après un lot d'ajouts.
    let _logoLangTimer = null;
    const scheduleLogoLanguage = () => {
        clearTimeout(_logoLangTimer);
        // Le swap logo est une mutation AUTOMATIQUE/cosmétique → on l'exécute HORS de
        // la pile d'undo (UndoManager.skip), sinon il crée des étapes fantômes qui
        // « mangent » les Ctrl+Z et rendent le retour arrière imprévisible.
        _logoLangTimer = setTimeout(() => {
            const run = () => applyLogoLanguage(editor, currentProjectLanguage);
            try { editor.UndoManager.skip(run); } catch (e) { run(); }
        }, 150);
    };
    editor.on('component:add', scheduleLogoLanguage);
    editor.on('load', scheduleLogoLanguage);

    // ── Copier/coller : conserver la mise en forme du clone ──────────────
    // GrapesJS (avoidInlineStyle=true, défaut) stocke les surcharges de style de
    // l'utilisateur (font-weight, couleur…) en règles CSS liées à l'ID du composant
    // (#i123). Au collage, le clone reçoit un NOUVEL ID mais la règle n'est PAS
    // recopiée → le clone perd la mise en forme (cf. retour utilisateur : le bloc
    // collé n'a pas le même rendu que l'original).
    //
    // Correctif chirurgical : après le collage natif, on recopie EN PROFONDEUR le
    // style de chaque original (presse-papier) vers le clone correspondant, via
    // l'API publique getStyle()/setStyle(). N'affecte QUE le collage — ni le
    // stockage global, ni l'export HTML/SFMC, ni l'aperçu.
    const copyStyleDeep = (src, dst) => {
        if (!src || !dst) return;
        try {
            const st = src.getStyle && src.getStyle();
            if (st && Object.keys(st).length) {
                const cur = dst.getStyle ? dst.getStyle() : {};
                dst.setStyle(Object.assign({}, cur, st));
            }
        } catch (e) { /* jamais bloquer le collage */ }
        try {
            const sc = src.components && src.components();
            const dc = dst.components && dst.components();
            if (sc && dc) {
                const n = Math.min(sc.length, dc.length);
                for (let i = 0; i < n; i++) copyStyleDeep(sc.at(i), dc.at(i));
            }
        } catch (e) { /* idem */ }
    };

    const pasteCmd = editor.Commands.get('core:paste');
    if (pasteCmd && typeof pasteCmd.run === 'function') {
        const basePasteRun = pasteCmd.run;
        editor.Commands.extend('core:paste', {
            run(ed, sender, opts) {
                // Snapshot des originaux (le presse-papier) AVANT le collage.
                const clip = (ed.getModel().get('clipboard') || []).slice();
                // Chaque clone racine ajouté émet 'component:paste', dans l'ordre du
                // presse-papier (répété par cible sélectionnée) → mapping par modulo.
                const clones = [];
                const collect = (c) => clones.push(c);
                ed.on('component:paste', collect);
                let res;
                try {
                    res = basePasteRun.call(this, ed, sender, opts);
                } finally {
                    ed.off('component:paste', collect);
                }
                try {
                    if (clip.length) {
                        clones.forEach((clone, i) => copyStyleDeep(clip[i % clip.length], clone));
                    }
                } catch (e) { console.warn('paste style copy', e); }
                return res;
            }
        });
    }

    // Rend le bouton de langue du header (.hdr-lang) cliquable dans le canvas :
    // un clic bascule la langue (charge la variante ou lance la traduction).
    editor.on('load', () => attachHdrLangSwitch(editor));

    editor.on('component:selected', (component) => {
        if (component.get('type') === 'mc-nos-campus') return;
        let parent = component.parent();
        while (parent) {
            if (parent.get('type') === 'mc-nos-campus') {
                editor.select(parent);
                return;
            }
            parent = parent.parent();
        }
    });

    // ── Compat : la sélection Campus est désormais au niveau de la page ──
    // Ancien picker par composant remplacé par le bouton « Campus » (toolbar)
    // qui ouvre openCampusSettings() (js/campus.js).
    editor.Commands.add('open-campus-picker', {
        run() { if (window.openCampusSettings) window.openCampusSettings(); }
    });

    if (schoolId === 'icart') initIcartSpecifics(editor);
    window.editor = editor;

    // ── Campus : source unique + sélection au niveau page ────────────────
    initCampus({
        getSchoolId:    () => CURRENT_SCHOOL?.id || window.CURRENT_SCHOOL?.id || 'master',
        getProjectName: () => {
            const sid = CURRENT_SCHOOL?.id || window.CURRENT_SCHOOL?.id || 'unknown';
            return localStorage.getItem(`reetain-builder__${sid}__currentProject`) || '';
        },
        onSelectionChange: (ids) => { currentProjectProperties.campusIds = ids; }
    });
    initCampusSelectSync(editor);
    window.openCampusSettings = openCampusSettings;
}

// ── Page Properties state ───────────────────────────────────────────────────
let currentProjectProperties = {
    title: '', description: '',
    seoTitle: '', seoDescription: '', keywords: '', canonical: '',
    schemaLd: '', campusIds: []
};

// Helper to parse site name and url paths for preview
function getGooglePreviewData(canonicalUrl, schoolId, schoolName, pageTitle) {
    let favicon = 'assets/LogoReetain.png';
    if (schoolId === 'efap') favicon = 'assets/efap-logo.png';
    else if (schoolId === 'brassart') favicon = 'assets/brassart-logo.png';

    let domain = 'Reetain';
    let breadcrumb = 'https://www.reetain.com';

    if (schoolId && schoolId !== 'unknown') {
        domain = schoolName || schoolId.toUpperCase();
        breadcrumb = `https://www.${schoolId}.fr`;
    }

    if (canonicalUrl) {
        try {
            let urlStr = canonicalUrl.trim();
            if (!/^https?:\/\//i.test(urlStr)) {
                urlStr = 'https://' + urlStr;
            }
            const url = new URL(urlStr);
            const hostnameObj = url.hostname.replace('www.', '');
            domain = hostnameObj.split('.')[0];
            domain = domain.charAt(0).toUpperCase() + domain.slice(1);
            
            const paths = url.pathname.split('/').filter(p => p);
            breadcrumb = url.origin;
            if (paths.length > 0) {
                breadcrumb += ' › ' + paths.join(' › ');
            }
        } catch (err) {
            const parts = canonicalUrl.replace(/^https?:\/\//, '').replace('www.', '').split('/');
            if (parts[0]) {
                const domPart = parts[0].split('.')[0];
                domain = domPart.charAt(0).toUpperCase() + domPart.slice(1);
            }
            breadcrumb = canonicalUrl;
        }
    } else {
        const slug = pageTitle ? pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'page';
        breadcrumb += ` › ${slug}`;
    }

    return { favicon, domain, breadcrumb };
}

// Helper to format/style character counter and input border
function updateFieldStatus(inputEl, counterEl, min, max) {
    if (!inputEl || !counterEl) return;
    const len = inputEl.value.length;
    counterEl.textContent = `${len} / ${max}`;
    
    let colorText, colorBg, colorBorder;
    if (len === 0 || len < min) {
        // Too short (orange)
        colorText = '#d97706';
        colorBg = '#fffbeb';
        colorBorder = '#fde68a';
    } else if (len <= max) {
        // Optimal (green)
        colorText = '#16a34a';
        colorBg = '#f0fdf4';
        colorBorder = '#bbf7d0';
    } else {
        // Too long (red)
        colorText = '#dc2626';
        colorBg = '#fef2f2';
        colorBorder = '#fecaca';
    }
    
    // Counter styling
    counterEl.style.color = colorText;
    counterEl.style.backgroundColor = colorBg;
    counterEl.style.borderColor = colorBorder;
    counterEl.style.borderWidth = '1px';
    counterEl.style.borderStyle = 'solid';
    counterEl.style.padding = '2px 8px';
    counterEl.style.borderRadius = '99px';
    counterEl.style.fontSize = '11px';
    counterEl.style.fontWeight = '600';
    
    // Input styling
    inputEl.style.borderColor = colorText;
    inputEl.style.boxShadow = `0 0 0 2px ${colorBg}`;
}

// Live update of Google Search Preview
function updateGooglePreview(type) {
    let metaTitleEl, metaDescEl, internalTitleEl, canonicalEl;
    let previewTitleEl, previewDescEl, previewDateEl, previewFavEl, previewSitenameEl, previewUrlEl;

    const schoolId = CURRENT_SCHOOL?.id || window.CURRENT_SCHOOL?.id || 'unknown';
    const schoolName = CURRENT_SCHOOL?.name || window.CURRENT_SCHOOL?.name || '';

    if (type === 'seo-settings') {
        metaTitleEl = document.getElementById('seo-settings-meta-title');
        metaDescEl = document.getElementById('seo-settings-meta-desc');
        internalTitleEl = document.getElementById('seo-settings-title');
        canonicalEl = document.getElementById('seo-settings-canonical');

        previewTitleEl = document.getElementById('seo-settings-preview-title');
        previewDescEl = document.getElementById('seo-settings-preview-desc');
        previewDateEl = document.getElementById('seo-settings-preview-date');
        previewFavEl = document.getElementById('seo-settings-preview-fav');
        previewSitenameEl = document.getElementById('seo-settings-preview-sitename');
        previewUrlEl = document.getElementById('seo-settings-preview-url');
    } else {
        metaTitleEl = document.getElementById('modal-seo-meta-title');
        metaDescEl = document.getElementById('modal-seo-meta-desc');
        internalTitleEl = document.getElementById('modal-seo-title');
        canonicalEl = null;

        previewTitleEl = document.getElementById('save-seo-preview-title');
        previewDescEl = document.getElementById('save-seo-preview-desc');
        previewDateEl = document.getElementById('save-seo-preview-date');
        previewFavEl = document.getElementById('save-seo-preview-fav');
        previewSitenameEl = document.getElementById('save-seo-preview-sitename');
        previewUrlEl = document.getElementById('save-seo-preview-url');
    }

    if (!metaTitleEl || !metaDescEl || !previewTitleEl || !previewDescEl) return;

    // 1. Title Text (truncated to 60 characters)
    const rawTitle = metaTitleEl.value.trim() || internalTitleEl?.value.trim() || 'Titre de la page';
    previewTitleEl.textContent = rawTitle.length > 60 ? rawTitle.slice(0, 60) + '...' : rawTitle;

    // 2. Description Text (truncated to 160 characters)
    const rawDesc = metaDescEl.value.trim() || 'Description de la page...';
    previewDescEl.textContent = rawDesc.length > 160 ? rawDesc.slice(0, 160) + '...' : rawDesc;

    // 3. Date
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    if (previewDateEl) {
        previewDateEl.textContent = today + ' — ';
    }

    // 4. Favicon & URL & Site name
    const canonicalVal = canonicalEl?.value.trim() || '';
    const pageTitle = internalTitleEl?.value.trim() || '';
    const previewData = getGooglePreviewData(canonicalVal, schoolId, schoolName, pageTitle);

    if (previewFavEl) previewFavEl.src = previewData.favicon;
    if (previewSitenameEl) previewSitenameEl.textContent = previewData.domain;
    if (previewUrlEl) previewUrlEl.textContent = previewData.breadcrumb;
}

function initProperties() {
    // Counter + bar helpers
    function bindCounter(inputId, counterId, barId, min, max) {
        const el  = document.getElementById(inputId);
        const cnt = document.getElementById(counterId);
        const bar = document.getElementById(barId);
        if (!el || !cnt || !bar) return;
        const update = () => {
            const len = el.value.length;
            cnt.textContent = `${len} / ${max}`;
            cnt.className = 'props-counter';
            const fill = bar.querySelector ? bar : bar;
            let pct, color;
            if (len === 0) { pct = 0; color = 'var(--accent)'; }
            else if (len < min) { pct = (len / min) * 60; color = '#f59e0b'; cnt.classList.add('warn'); }
            else if (len <= max) { pct = 60 + ((len - min) / (max - min)) * 40; color = '#10b981'; cnt.classList.add('good'); }
            else { pct = 100; color = '#ef4444'; cnt.classList.add('over'); }
            bar.style.width = pct + '%';
            bar.style.background = color;
        };
        el.addEventListener('input', update);
        update();
    }
    bindCounter('prop-seo-title', 'seo-title-counter', 'seo-title-bar', 50, 60);
    bindCounter('prop-seo-desc',  'seo-desc-counter',  'seo-desc-bar',  120, 160);

    // Live JSON-LD validation
    const schemaEl = document.getElementById('prop-schema');
    const schemaErr = document.getElementById('prop-schema-error');
    if (schemaEl && schemaErr) {
        schemaEl.addEventListener('input', () => {
            const val = schemaEl.value.trim();
            if (!val) { schemaErr.classList.add('hidden'); schemaErr.textContent = ''; return; }
            try { JSON.parse(val); schemaErr.classList.add('hidden'); schemaErr.textContent = ''; }
            catch (e) { schemaErr.classList.remove('hidden'); schemaErr.textContent = '⚠ ' + e.message; }
        });
    }

    // Modal SEO Counters & Real-Time Preview
    const bindModalCounter = (inputId, counterId, min, max, type) => {
        const el = document.getElementById(inputId);
        const cnt = document.getElementById(counterId);
        if (!el || !cnt) return;
        const update = () => {
            updateFieldStatus(el, cnt, min, max);
            updateGooglePreview(type);
        };
        ['input', 'change', 'keyup'].forEach(event => {
            el.addEventListener(event, update);
        });
        
        // Also listen to internal title to update preview
        const internalTitleId = type === 'seo-settings' ? 'seo-settings-title' : 'modal-seo-title';
        const internalTitleEl = document.getElementById(internalTitleId);
        if (internalTitleEl) {
            ['input', 'change', 'keyup'].forEach(event => {
                internalTitleEl.addEventListener(event, () => updateGooglePreview(type));
            });
        }
        update();
    };
    bindModalCounter('modal-seo-meta-title', 'modal-seo-title-counter', 50, 60, 'save-seo');
    bindModalCounter('modal-seo-meta-desc', 'modal-seo-desc-counter', 120, 160, 'save-seo');
}

function collectProperties() {
    return { ...currentProjectProperties };
}

function populateProperties(props = {}) {
    const schoolId = CURRENT_SCHOOL?.id || 'unknown';
    const currentProjectSimpleName = localStorage.getItem(`reetain-builder__${schoolId}__currentProject`) || 'Nouveau Projet';

    const pageTitle = (props.title || '').trim() || currentProjectSimpleName;
    const seoTitle = (props.seoTitle || '').trim() || pageTitle;
    const defaultDesc = `Page d'atterrissage officielle de l'école ${CURRENT_SCHOOL?.name || 'Reetain'}.`;
    const defaultSeoDesc = `Découvrez notre nouvelle page ${currentProjectSimpleName} pour l'école ${CURRENT_SCHOOL?.name || 'Reetain'}. Retrouvez toutes les informations.`;
    const defaultKeywords = `${CURRENT_SCHOOL?.name || 'école'}, formation, JPO, inscription`;

    // On spread props en dernier MAIS on s'assure que les champs SEO critiques
    // ne sont jamais écrasés par une valeur vide provenant des props brutes.
    // Exemple : props.keywords = '' → on garde defaultKeywords, pas ''
    const campusIds = Array.isArray(props.campusIds) ? props.campusIds : [];
    currentProjectProperties = {
        ...props,
        title:          pageTitle,
        description:    props.description || defaultDesc,
        seoTitle:       seoTitle,
        seoDescription: props.seoDescription || defaultSeoDesc,
        keywords:       props.keywords || defaultKeywords,
        canonical:      props.canonical || '',
        schemaLd:       props.schemaLd || '',
        campusIds,
    };

    // Applique la sélection de campus de la page à tous les composants.
    window.__LP_CAMPUS_IDS = campusIds;
    document.dispatchEvent(new CustomEvent('lp:campuses-changed'));
}

// ── NEW: Build complete HTML with SEO meta tags injected into <head> ─────────
// This ensures SFMC receives a full HTML document with all SEO metadata,
// instead of raw GrapesJS body HTML without any <head> or meta tags.
// Rend les URLs d'assets ABSOLUES depuis la racine ("/assets/…").
// Les blocs déclarent des chemins RELATIFS ("assets/efap/baseline-noir.png") qui
// fonctionnent dans l'éditeur (servi à la racine) mais CASSENT en preview
// ("/preview/<nom>") ou sur une URL publique profonde, car le navigateur les résout
// relativement au chemin courant (→ /preview/assets/… → 404, logos header/footer
// invisibles). On préfixe donc systématiquement par "/". Idempotent (ne double pas
// un "/assets/" déjà absolu) et sans effet sur les URLs http(s).
function toRootRelativeAssets(str) {
    return String(str || '')
        .replace(/((?:src|srcset|href)\s*=\s*["'])\.?\/?assets\//gi, '$1/assets/')
        .replace(/url\((\s*['"]?)\.?\/?assets\//gi, 'url($1/assets/');
}

// Feuille Google Fonts des familles additionnelles proposées dans l'éditeur
// (cf. ReetainFonts.GOOGLE_FONTS / export.js). Constante unique = source de vérité.
const GOOGLE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Lato:wght@400;700;900&family=Montserrat:wght@400;600;800&family=Open+Sans:wght@400;600;800&family=Oswald:wght@400;700&family=Poppins:wght@400;600;800&family=Raleway:wght@400;700&family=Roboto:wght@400;700;900&display=swap';

function buildFinalHtml(bodyHtml, css, properties = {}) {
    bodyHtml = toRootRelativeAssets(extractBodyHtml(bodyHtml));
    css = toRootRelativeAssets(css);

    // If SEO fields are empty, try to derive sensible defaults from the body
    function stripTags(input) {
        return String(input || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    function deriveFromBody(html) {
        const out = { title: '', desc: '' };
        try {
            const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1 && h1[1]) out.title = stripTags(h1[1]);

            if (!out.title) {
                const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                if (h2 && h2[1]) out.title = stripTags(h2[1]);
            }

            const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            if (p && p[1]) {
                const text = stripTags(p[1]);
                out.desc = text.length > 160 ? text.slice(0, 157) + '...' : text;
            }
        } catch (e) {
            // ignore extraction errors
        }
        return out;
    }

    const derived = deriveFromBody(bodyHtml);

    const title      = escapeHtml(properties.seoTitle || properties.title || derived.title || '');
    const metaDesc   = escapeHtml(properties.seoDescription || derived.desc || '');
    const keywords   = escapeHtml(properties.keywords || '');
    const canonical  = (properties.canonical || '').trim();
    const schemaLd   = (properties.schemaLd || '').trim();

    const canonicalTag = canonical
        ? `\n    <link rel="canonical" href="${escapeHtml(canonical)}">`
        : '';

    // Schema.org JSON-LD — already validated before this point, so safe to embed
    const schemaTag = schemaLd
        ? `\n    <script type="application/ld+json">\n    ${schemaLd}\n    </script>`
        : '';

    // Polices : @font-face auto-hébergés (Gotham, Space Grotesk) via /css/fonts.css
    // (URL root-relative → fonctionne en preview et sur les URLs publiques ; ses url()
    // internes '../assets/fonts/…' résolvent alors vers /assets/fonts/…), + Google Fonts
    // pour les familles additionnelles proposées dans l'éditeur. Sans ça, la page servie
    // hors éditeur retombe sur une police système.
    const fontLinks = `\n    <link href="${GOOGLE_FONTS_HREF}" rel="stylesheet">\n    <link rel="stylesheet" href="/css/fonts.css">`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${metaDesc}">
    <meta name="keywords" content="${keywords}">${canonicalTag}${schemaTag}${fontLinks}
    <style>html { scroll-behavior: smooth; }\n${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function extractBodyHtml(html = '') {
    const value = String(html || '');
    const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : value;
}

// Restreint la liste de fonts du Style Manager aux SEULES fonts configurées
// pour l'école (font par défaut + fonts supplémentaires). Le marketeur ne peut
// donc choisir que parmi celles-ci ; le mécanisme de changement par composant
// reste inchangé (écrit un font-family inline qui prime sur --brand-font).
function restrictFontSelector(editor, school) {
    const RF = window.ReetainFonts;
    if (!RF || !editor) return;
    try {
        const branding = RF.normalizeBranding(school && school.branding, school || {});
        const fonts = branding.availableFonts.map(id => RF.fontById(id)).filter(Boolean);
        if (!fonts.length) return;
        const options = fonts.map(f => ({ id: f.stack, value: f.stack, name: f.name + ' (Défaut)', label: f.name + ' (Défaut)' }));
        if (RF.GOOGLE_FONTS) {
            options.push({ id: '', value: '', name: '--- Google Fonts ---', label: '--- Google Fonts ---' });
            options.push(...RF.GOOGLE_FONTS.map(f => ({ id: f.stack, value: f.stack, name: f.name, label: f.name })));
        }
        const sm = editor.StyleManager;
        const prop = sm.getProperty('typography', 'font-family');
        if (!prop) return;
        if (typeof prop.setOptions === 'function') prop.setOptions(options);
        else prop.set('options', options);
        sm.render();
    } catch (e) {
        console.warn('restrictFontSelector: impossible de restreindre les fonts', e);
    }
}

// Ajoute un contrôle "Font Style" (Normal / Italic) au secteur Typography :
// GrapesJS ne l'expose pas par défaut. Idempotent (n'ajoute pas 2 fois).
function addFontStyleControl(editor) {
    if (!editor) return;
    try {
        const sm = editor.StyleManager;
        if (sm.getProperty('typography', 'font-style')) return; // déjà présent
        sm.addProperty('typography', {
            name: 'Font Style',
            property: 'font-style',
            type: 'select',
            defaults: 'normal',
            default: 'normal',
            // `list` (anciennes versions GrapesJS) + `options` (récentes)
            list: [
                { value: 'normal', name: 'Normal' },
                { value: 'italic', name: 'Italic' }
            ],
            options: [
                { id: 'normal', label: 'Normal' },
                { id: 'italic', label: 'Italic' }
            ]
        }, { at: 3 }); // placé juste après Font Weight
        sm.render();
    } catch (e) {
        console.warn('addFontStyleControl: impossible d’ajouter le contrôle italique', e);
    }
}


function setStyleManagerLabels(editor) {
    if (!editor) return;
    try {
        const sm = editor.StyleManager;
        const names = {
            // ── Général ──
            'display':          'Affichage',
            'float':            'Alignement flottant',
            'position':         'Position',
            'top':              'Haut',
            'right':            'Droite',
            'left':             'Gauche',
            'bottom':           'Bas',
            // ── Flex ──
            'flex-direction':   'Direction (flex)',
            'flex-wrap':        'Retour à la ligne',
            'justify-content':  'Alignement horizontal',
            'align-items':      'Alignement vertical',
            'align-content':    'Alignement du contenu',
            'order':            'Ordre',
            'flex-basis':       'Taille de base',
            'flex-grow':        'Facteur d’agrandissement',
            'flex-shrink':      'Facteur de rétrécissement',
            'align-self':       'Alignement individuel',
            // ── Dimensions ──
            'width':            'Largeur',
            'height':           'Hauteur',
            'max-width':        'Largeur maximale',
            'min-height':       'Hauteur minimale',
            'margin':           'Marges extérieures',
            'padding':          'Marges intérieures',
            // ── Typographie ──
            'font-family':      'Police',
            'font-size':        'Taille du texte',
            'font-weight':      'Graisse',
            'font-style':       'Style (italique)',
            'letter-spacing':   'Espacement des lettres',
            'color':            'Couleur du texte',
            'line-height':      'Interligne',
            'text-align':       'Alignement du texte',
            'text-shadow':      'Ombre du texte',
            // ── Décorations ──
            'background-color': 'Couleur de fond',
            'border-radius':    'Arrondi des angles',
            'border':           'Bordure',
            'border-width':     'Épaisseur',
            'border-style':     'Style',
            'border-color':     'Couleur',
            'box-shadow':       'Ombre',
            'background':       'Arrière-plan (image)',
            // ── Extra ──
            'opacity':          'Opacité',
            'transition':       'Transition (animation)',
            'transform':        'Transformation',
        };
        const sectors = sm.getSectors ? sm.getSectors() : null;
        if (!sectors || typeof sectors.forEach !== 'function') return;
        // Titres de secteurs en français (clé = nom natif GrapesJS en minuscules)
        const sectorNames = {
            'general':     'Général',
            'flex':        'Disposition (flex)',
            'dimension':   'Dimensions',
            'typography':  'Typographie',
            'decorations': 'Décorations',
            'extra':       'Effets & avancé',
        };
        sectors.forEach(sector => {
            const sid = (sector.get('name') || sector.get('id') || '').toString().toLowerCase();
            if (sectorNames[sid]) sector.set('name', sectorNames[sid]);

            const props = typeof sector.getProperties === 'function'
                ? sector.getProperties()
                : (sector.get && sector.get('properties'));
            if (!props || typeof props.forEach !== 'function') return;
            // Renomme la propriété + descend dans les sous-propriétés des
            // composites (ex. Bordure → Épaisseur / Style / Couleur).
            const applyName = p => {
                const id = (p.get('property') || p.get('id') || '').toString();
                if (names[id]) p.set('name', names[id]);
                const sub = typeof p.getProperties === 'function' ? p.getProperties() : null;
                if (sub && typeof sub.forEach === 'function') sub.forEach(applyName);
            };
            props.forEach(applyName);
        });
        sm.render();

        // GrapesJS 0.23 ne rafraîchit pas le titre des secteurs après set('name'),
        // on synchronise donc les libellés déjà rendus depuis les modèles (français).
        const cont = document.querySelector('#styles-container');
        if (cont) {
            const labelEls = cont.querySelectorAll('.gjs-sm-sector-label');
            const secs = sm.getSectors();
            labelEls.forEach((el, i) => {
                const s = secs.at ? secs.at(i) : secs[i];
                const nm = s && s.get('name');
                if (nm) el.textContent = nm;
            });
        }
    } catch (e) {
        console.warn('setStyleManagerLabels: impossible de renommer les propriétés', e);
    }
}

// Bascule automatiquement les logos header/footer entre FR et EN selon la langue
// du projet. Les fichiers EN sont nommés "<variant>-en.png" (ex: baseline-noir-en.png).
// On ne touche qu'aux logos AVEC baseline (les "nobaseline" n'ont pas de tagline à
// traduire). Toutes les écoles ont désormais leurs logos EN (baseline-<variant>-en.png).
function applyLogoLanguage(editor, lang) {
    if (!editor) return;
    try {
        const wrapper = editor.getWrapper && editor.getWrapper();
        if (!wrapper || typeof wrapper.find !== 'function') return;
        const isEN = /^(en|eng|english|anglais)$/i.test(String(lang || 'FR').trim());
        const imgs = [].concat(
            wrapper.find('.hdr-logo-img') || [],
            wrapper.find('.ft-logo-img') || []
        );
        imgs.forEach(img => {
            const cur = (img.getAttributes() || {}).src || '';
            // On ne touche qu'aux logos AVEC baseline. `\bbaseline-` matche aussi bien
            // "assets/x/baseline-…" que "baseline-…" (src normalisé sans chemin par
            // GrapesJS après loadProjectData) tout en excluant "nobaseline-" (pas de
            // frontière de mot avant "baseline" dans "nobaseline").
            if (!cur || !/\bbaseline-/i.test(cur)) return;
            const base = cur.replace(/-en\.png($|\?)/i, '.png$1');       // src FR de base
            const target = isEN ? base.replace(/\.png($|\?)/i, '-en.png$1') : base;
            if (target !== cur) img.addAttributes({ src: target });
        });
        // Indicateur/bouton de langue du header (.hdr-lang) : affiche la langue CIBLE
        // (celle vers laquelle on peut basculer) et sert de bouton. FR → "EN", EN → "FR".
        // Le clic est intercepté dans le canvas (voir attachHdrLangSwitch).
        const cur = isEN ? 'EN' : 'FR';
        const targetLang = otherReadyLang(cur);
        wrapper.find('.hdr-lang').forEach(el => {
            try {
                if ((el.getInnerHTML && el.getInnerHTML().trim()) !== targetLang) el.components(targetLang);
                el.addAttributes({ title: `Voir la page en ${LANG_LABELS[targetLang] || targetLang}`, 'data-lang-switch': targetLang });
                bindHdrLangClick(el); // rend le bouton cliquable dans le canvas
            } catch (e) {}
        });
    } catch (e) { console.warn('applyLogoLanguage', e); }
}

// Applique la langue (FR/EN) DIRECTEMENT dans le projectData GrapesJS, AVANT
// loadProjectData. Contrairement à applyLogoLanguage() qui agit sur l'éditeur APRÈS
// le chargement — donc parfois APRÈS la capture getHtml() dans le flux de traduction,
// car find() ne voit pas encore les composants fraîchement rechargés — ceci mute les
// données en mémoire. Le HTML et le projectData sauvegardés contiennent donc TOUJOURS
// la bonne version des logos header/footer (src baseline-…-en.png) et du libellé .hdr-lang.
function localizeBrandInProjectData(pd, lang) {
    if (!pd || !Array.isArray(pd.pages)) return;
    const isEN = /^(en|eng|english|anglais)$/i.test(String(lang || 'FR').trim());
    const cur = isEN ? 'EN' : 'FR';
    const targetLang = otherReadyLang(cur);
    const hasClass = (node, name) =>
        Array.isArray(node.classes) &&
        node.classes.some(c => (typeof c === 'string' ? c : c && c.name) === name);

    function visit(node) {
        if (!node || typeof node !== 'object') return;
        // 1) Logos header/footer : src "…baseline-….png" ↔ "…baseline-…-en.png"
        const attrs = node.attributes;
        if (attrs && typeof attrs.src === 'string' && /\bbaseline-/i.test(attrs.src)) {
            const base = attrs.src.replace(/-en\.png($|\?)/i, '.png$1');
            attrs.src = isEN ? base.replace(/\.png($|\?)/i, '-en.png$1') : base;
        }
        // 2) Bouton de langue du header (.hdr-lang) : affiche la langue CIBLE.
        if (hasClass(node, 'hdr-lang') && Array.isArray(node.components)) {
            node.components.forEach(c => {
                if (c && c.type === 'textnode' && typeof c.content === 'string') c.content = targetLang;
            });
        }
        if (Array.isArray(node.components)) node.components.forEach(visit);
    }
    pd.pages.forEach(p => (p.frames || []).forEach(f => visit(f.component)));
}

// ═══════════════════════════════════════════════════════════════════════════
// MODÈLE « UN PROJET, PLUSIEURS LANGUES »
// Une page = une structure partagée + N variantes de texte (une par langue).
// Le switch de langue charge instantanément une variante existante ; Gemini
// n'est appelé que lorsqu'une langue n'existe pas encore. On ne crée JAMAIS de
// nouveau projet pour traduire. Voir database/migrations/008_add_language_variants.sql
// ═══════════════════════════════════════════════════════════════════════════

// Mapping SEO : objet serveur { title, description, keywords, canonical, schemaLd }
// ⇄ propriétés éditeur { seoTitle, seoDescription, keywords, canonical, schemaLd }.
function seoToProps(seo = {}) {
    return {
        seoTitle: seo.title || '',
        seoDescription: seo.description || '',
        keywords: seo.keywords || '',
        canonical: seo.canonical || '',
        schemaLd: seo.schemaLd || ''
    };
}
function propsToSeo(props = {}) {
    return {
        title: props.seoTitle || '',
        description: props.seoDescription || '',
        keywords: props.keywords || '',
        canonical: props.canonical || '',
        schemaLd: props.schemaLd || ''
    };
}

// Collecte les textes traduisibles d'un projectData GrapesJS SANS toucher au markup.
// (titres, paragraphes, boutons + attributs placeholder/alt/title/aria-label)
function collectPdTextTargets(pd) {
    const targets = [];
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        const type = node.type || 'default';
        const tagName = (node.tagName || '').toLowerCase();
        const isTextLike = ['text', 'textnode', 'link', 'label', 'button'].includes(type) ||
            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'li', 'b', 'strong', 'i', 'em'].includes(tagName);
        if (isTextLike && node.content && typeof node.content === 'string' && /[a-zA-ZÀ-ÿ]/.test(node.content)) {
            targets.push({ obj: node, prop: 'content' });
        }
        if (node.attributes) {
            ['placeholder', 'alt', 'title', 'aria-label'].forEach(attr => {
                if (node.attributes[attr] && typeof node.attributes[attr] === 'string' && /[a-zA-ZÀ-ÿ]/.test(node.attributes[attr])) {
                    targets.push({ obj: node.attributes, prop: attr });
                }
            });
        }
        if (node.components) node.components.forEach(walk);
    }
    (pd.pages || []).forEach(p => (p.frames || []).forEach(f => walk(f.component)));
    return targets;
}

// Traduit un tableau de chaînes via /api/ai/translate (markup préservé côté serveur).
// Renvoie un tableau de MÊME longueur/ordre.
async function translateStringList(strings, targetLang) {
    if (!strings.length) return [];
    let htmlToTranslate = '';
    strings.forEach((s, i) => { htmlToTranslate += `<div id="t${i}">${s}</div>\n`; });
    const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlToTranslate, targetLang })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const doc = new DOMParser().parseFromString(data.html, 'text/html');
    return strings.map((s, i) => {
        const el = doc.getElementById('t' + i);
        return el ? el.innerHTML : s;
    });
}

// Traduit en place le texte d'un projectData + les champs SEO (title/desc/keywords).
async function translateProjectDataAndSeo(pd, seoProps, targetLang) {
    const targets = collectPdTextTargets(pd);
    const seoKeys = ['seoTitle', 'seoDescription', 'keywords'];
    const seoIdx = seoKeys.filter(k => (seoProps[k] || '').trim());
    // Un seul appel réseau : texte de page + SEO.
    const pageStrings = targets.map(t => t.obj[t.prop]);
    const seoStrings = seoIdx.map(k => seoProps[k]);
    const all = await translateStringList([...pageStrings, ...seoStrings], targetLang);
    targets.forEach((t, i) => { t.obj[t.prop] = all[i]; });
    seoIdx.forEach((k, i) => { seoProps[k] = all[pageStrings.length + i]; });
}

// ── UI du switch de langue ─────────────────────────────────────────────────
function renderLanguageSwitch() {
    const host = document.getElementById('language-switch');
    if (!host) return;
    const cur = normLang(currentProjectLanguage);
    const orig = normLang(currentOriginalLanguage);
    const byLang = new Map(currentPageVariants.map(v => [normLang(v.language), v]));
    const langs = (READY_LANGUAGES && READY_LANGUAGES.length ? READY_LANGUAGES : ['FR', 'EN']).map(normLang);
    const saved = !!currentStructuredPageId;
    host.innerHTML = '';
    langs.forEach(lang => {
        const v = byLang.get(lang);
        const isOriginal = lang === orig;
        const exists = isOriginal ? saved : !!(v && v.exists);
        const stale = !!(v && v.stale);
        const isActive = lang === cur;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-seg'
            + (isActive ? ' active' : '')
            + (exists ? '' : ' untranslated')
            + (stale ? ' stale' : '');
        btn.dataset.lang = lang;
        const label = LANG_LABELS[lang] || lang;
        btn.title = isActive ? `Langue actuelle : ${label}`
            : !saved ? `Sauvegardez la page avant de traduire`
            : exists ? (stale ? `${label} — traduction à mettre à jour` : `Afficher en ${label}`)
            : `Traduire en ${label}`;
        const icon = !exists ? ' <i class="fas fa-language lang-xicon"></i>'
            : (stale ? ' <i class="fas fa-arrows-rotate lang-xicon"></i>' : '');
        btn.innerHTML = `<span class="lang-flag">${LANG_FLAGS[lang] || ''}</span><span class="lang-code">${lang}</span>${icon}`;
        btn.addEventListener('click', () => switchLanguage(lang));
        host.appendChild(btn);
    });
}

// Met à jour l'état de langue courant + le switch (et le <select> caché de compat).
function setActiveLangUI(lang) {
    currentProjectLanguage = normLang(lang);
    const sel = document.getElementById('language-switcher');
    if (sel) sel.value = currentProjectLanguage;
    renderLanguageSwitch();
}

// Applique un résumé de variantes (renvoyé par le serveur) à l'état + l'UI.
function applyVariantsSummary(payload = {}) {
    const ready = payload.readyLanguages || payload.ready_languages;
    if (Array.isArray(ready) && ready.length) READY_LANGUAGES = ready.map(normLang);
    const orig = payload.originalLanguage || payload.original_language;
    if (orig) currentOriginalLanguage = normLang(orig);
    currentPageVariants = Array.isArray(payload.variants)
        ? payload.variants.map(v => ({ ...v, language: normLang(v.language) }))
        : [];
    renderLanguageSwitch();
}

// Pousse la page bilingue (toutes langues + switch) vers SFMC après ajout/màj d'une
// variante. Fire-and-forget : ne bloque pas l'UX. Le HTML bilingue est reconstruit serveur.
async function triggerSfmcResync() {
    try {
        const schoolId = (CURRENT_SCHOOL && CURRENT_SCHOOL.id) || 'unknown';
        const projectName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);
        if (!projectName) return;
        await fetch('/api/sfmc/resync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName })
        });
    } catch (e) { console.warn('triggerSfmcResync', e); }
}

// Recharge le résumé des variantes depuis le serveur (après un save/traduction).
async function refreshVariants(pageId) {
    if (!pageId) return;
    try {
        const res = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/variants`);
        if (!res.ok) return;
        applyVariantsSummary(await res.json());
    } catch (e) { console.warn('refreshVariants', e); }
}

// Charge instantanément une variante existante dans l'éditeur (aucun appel Gemini).
async function loadVariantIntoEditor(pageId, lang) {
    lang = normLang(lang);
    const res = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/variants/${encodeURIComponent(lang)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const pd = data.project_data && Object.keys(data.project_data).length ? data.project_data : null;
    // Fixer la langue AVANT loadProjectData (le swap logo débounced lit currentProjectLanguage).
    currentProjectLanguage = lang;
    if (pd) {
        localizeBrandInProjectData(pd, lang);
        window.editor.loadProjectData(pd);
        injectBrandVariables(window.editor, CURRENT_SCHOOL);
    } else {
        window.editor.setComponents(extractBodyHtml(data.html || ''));
        window.editor.setStyle(data.css || '');
    }
    applyLogoLanguage(window.editor, lang);
    attachHdrLangSwitch(window.editor);
    if (data.seo) populateProperties(seoToProps(data.seo));
    setActiveLangUI(lang);
    // Le canvas vient d'être rechargé : si on est en aperçu, restaurer la largeur
    // fixe 1280px (sinon la nouvelle langue s'étale sur toute la largeur).
    if (window.__reapplyEditorPreview) setTimeout(window.__reapplyEditorPreview, 60);
    setTimeout(() => window.__clearUndoHistory && window.__clearUndoHistory(), 300);
}

// Crée (ou met à jour) une variante de traduction : Gemini → enregistrement dans
// la MÊME page. La source est TOUJOURS la variante d'origine (texte de référence).
async function createOrUpdateTranslationVariant(pageId, targetLang) {
    targetLang = normLang(targetLang);
    const label = LANG_LABELS[targetLang] || targetLang;
    window.showLoading(`Création de la traduction en ${label}... Cela peut prendre quelques secondes.`);
    try {
        // 1) Charger la version d'ORIGINE (texte de référence) depuis le serveur.
        const srcRes = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/variants/${encodeURIComponent(currentOriginalLanguage)}`);
        if (!srcRes.ok) throw new Error("Impossible de charger la version d'origine.");
        const src = await srcRes.json();
        const pd = (src.project_data && Object.keys(src.project_data).length)
            ? src.project_data
            : window.editor.getProjectData();
        const seoProps = seoToProps(src.seo || {});

        // 2) Traduire le texte de la page + le SEO (un seul appel réseau).
        await translateProjectDataAndSeo(pd, seoProps, targetLang);

        // 3) Basculer header/footer/logos DANS les données AVANT loadProjectData.
        currentProjectLanguage = targetLang;
        localizeBrandInProjectData(pd, targetLang);
        window.editor.loadProjectData(pd);
        injectBrandVariables(window.editor, CURRENT_SCHOOL);
        applyLogoLanguage(window.editor, targetLang);

        // 4) Enregistrer comme variante de la même page (structuré uniquement).
        const bodyHtml = window.editor.getHtml();
        const finalHtml = buildFinalHtml(bodyHtml, window.editor.getCss(), { ...collectProperties(), ...seoProps });
        const payload = {
            html: finalHtml,
            css: window.editor.getCss(),
            project_data: window.editor.getProjectData(),
            seo: propsToSeo(seoProps)
        };
        const saveRes = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/variants/${encodeURIComponent(targetLang)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!saveRes.ok) throw new Error(await saveRes.text());

        // 5) Refléter dans l'UI (SEO panel + switch) + pousser la page bilingue vers SFMC.
        populateProperties(seoProps);
        setActiveLangUI(targetLang);
        await refreshVariants(pageId);
        triggerSfmcResync();
        window.hideLoading();
    } catch (e) {
        window.hideLoading();
        console.error('createOrUpdateTranslationVariant', e);
        await window.showAlert({ title: 'Erreur', message: 'Échec de la traduction. ' + e.message });
        throw e;
    }
}

// Orchestrateur du switch de langue (clic sur un bouton FR/EN ou sur le .hdr-lang).
let langSwitchBusy = false;
async function switchLanguage(targetLang) {
    targetLang = normLang(targetLang);
    if (langSwitchBusy) return;
    if (targetLang === normLang(currentProjectLanguage)) return;

    const pageId = currentStructuredPageId;
    if (!pageId) {
        await window.showAlert({
            title: 'Enregistrez d\'abord',
            message: 'Sauvegardez la page avant de créer une traduction dans une autre langue.'
        });
        renderLanguageSwitch();
        return;
    }

    const orig = normLang(currentOriginalLanguage);
    const v = currentPageVariants.find(x => normLang(x.language) === targetLang);
    const exists = targetLang === orig ? true : !!(v && v.exists);
    const stale = !!(v && v.stale);

    langSwitchBusy = true;
    try {
        if (exists) {
            // Variante déjà enregistrée → chargement instantané, AUCUN appel Gemini.
            window.showLoading(`Chargement de la version ${LANG_LABELS[targetLang] || targetLang}...`);
            await loadVariantIntoEditor(pageId, targetLang);
            window.hideLoading();

            // Ne jamais retraduire automatiquement : proposer la mise à jour si la
            // version d'origine a changé depuis la dernière traduction.
            if (targetLang !== orig && stale) {
                const choice = await new Promise(resolve => {
                    window.openModal({
                        title: 'Traduction à mettre à jour',
                        body: `<p class="modal-message">La version ${LANG_LABELS[orig] || orig} a été modifiée depuis la dernière traduction. Souhaitez-vous mettre à jour la traduction ${LANG_LABELS[targetLang] || targetLang} ?</p>`,
                        actions: [
                            { label: 'Mettre à jour la traduction', className: 'btn-primary', onClick: () => { window.closeModal(); resolve('update'); } },
                            { label: 'Conserver la traduction actuelle', className: 'btn-secondary', onClick: () => { window.closeModal(); resolve('keep'); } }
                        ]
                    });
                });
                if (choice === 'update') await createOrUpdateTranslationVariant(pageId, targetLang);
            }
        } else {
            // Langue pas encore traduite → première traduction, puis affichage.
            await createOrUpdateTranslationVariant(pageId, targetLang);
        }
    } catch (e) {
        window.hideLoading();
        renderLanguageSwitch();
    } finally {
        langSwitchBusy = false;
    }
}
window.switchLanguage = switchLanguage;
window.renderLanguageSwitch = renderLanguageSwitch;

// Rend cliquables tous les boutons de langue .hdr-lang du canvas (via l'API
// composant GrapesJS, fiable). Appelé à chaque chargement de page/variante.
function attachHdrLangSwitch(editor) {
    try {
        const wrapper = editor && editor.getWrapper && editor.getWrapper();
        if (!wrapper || typeof wrapper.find !== 'function') return;
        (wrapper.find('.hdr-lang') || []).forEach(bindHdrLangClick);
    } catch (e) { console.warn('attachHdrLangSwitch', e); }
}
window.attachHdrLangSwitch = attachHdrLangSwitch;

function injectBrandVariables(editor, school, intoMainDoc = false) {
    if (!school) return;
    const primary = school.color || '#3b82f6';
    const secondary = school.secondaryColor || '#1a1a1a';
    const colorHeader = school.colorHeader || primary;
    const colorCarousel = school.colorCarousel || primary;
    const rgb = hexToRgb(primary) || '59, 130, 246';
    let bandeColor = '#3b82f6';
    if (school.id === 'brassart') bandeColor = '#bc0b5d';
    if (school.id === 'efap') bandeColor = '#1a1a1a';
    if (school.id === 'cread') bandeColor = '#d4af37';

    // Branding : font par défaut + palette 16 rôles (normalizeBranding garantit
    // un objet complet, dérivé des couleurs de l'école si non configuré).
    const RF = window.ReetainFonts;
    const branding = RF ? RF.normalizeBranding(school.branding, school) : (school.branding || {});
    const c = branding.colors || {};
    // Résolution du stack de font RÉSILIENTE : on n'échoue pas si ReetainFonts
    // n'est pas chargé → la font choisie pour l'école s'applique quand même.
    const FONT_STACKS = {
        'gotham': "'Gotham', Arial, sans-serif",
        'space-grotesk': "'Space Grotesk', 'Segoe UI', sans-serif"
    };
    const FONT_NAMES = { 'gotham': 'Gotham', 'space-grotesk': 'Space Grotesk' };
    const brandFont =
        (RF && RF.fontStackById(branding.defaultFont)) ||
        FONT_STACKS[branding.defaultFont] ||
        FONT_STACKS.gotham;
    // Nom de famille (pas le stack) pour forcer le préchargement de la police.
    const brandFontName =
        (RF && RF.fontById(branding.defaultFont) && RF.fontById(branding.defaultFont).name) ||
        FONT_NAMES[branding.defaultFont] || 'Gotham';
    // Rôles de couleurs → CSS vars consommées par les blocs.
    const roleVars = `
      --brand-font: ${brandFont};
      --brand-background: ${c.background || '#ffffff'};
      --brand-surface: ${c.surface || '#f5f5f5'};
      --brand-text: ${c.text || '#1a1a1a'};
      --brand-muted: ${c.mutedText || '#6b7280'};
      --brand-border: ${c.border || '#e5e7eb'};
      --brand-accent: ${c.accent || secondary};
      --brand-button-bg: ${c.buttonBackground || primary};
      --brand-button-hover: ${c.buttonHover || primary};
      --brand-button-text: ${c.buttonText || '#ffffff'};
      --brand-link: ${c.link || primary};
      --brand-link-hover: ${c.linkHover || primary};
      --brand-success: ${c.success || '#16a34a'};
      --brand-warning: ${c.warning || '#f59e0b'};
      --brand-error: ${c.error || '#dc2626'};`;
    const css = `:root { --brand-primary: ${c.primary || primary}; --brand-secondary: ${c.secondary || secondary}; --brand-primary-rgb: ${rgb}; --brand-header: ${colorHeader}; --brand-carousel: ${colorCarousel}; --bande-color: ${bandeColor};${roleVars} }`;

    // Règles directes avec !important pour overrider les couleurs hardcodées
    // GrapesJS peut stocker des valeurs résolues (#hex) au lieu de var() → on force ici
    // NB : les headers/footers d'école ont leurs couleurs figées (maquettes) dans blocks/headers.js
    // et blocks/footers.js — on ne les repeint donc PAS ici. Seul le Master Template reste thémable.
    const headerOverrideCss = `
.mh-header { background-color: ${colorHeader} !important; background: ${colorHeader} !important; }
.mf-footer { background-color: ${colorHeader} !important; background: ${colorHeader} !important; }
.mc2a-section, .mc2b-section, .mc2c-section, .mcva-section, .mcd-colored-zone, .mc3c-section, .mce-section, .mcb-gray-zone { background-color: ${colorCarousel} !important; background: ${colorCarousel} !important; }`;

    // Font par défaut de l'école appliquée à la racine du canvas. La font-family
    // s'hérite naturellement en CSS : tout composant déposé qui ne fixe pas SA
    // propre font hérite donc automatiquement de celle-ci, en poids/style normal.
    // SANS !important et faible spécificité → un override de font sur un composant
    // précis (via le Style Manager, sélecteur #id) prime toujours.
    const fontBaseCss = `
body, #wrapper, .gjs-wrapper { font-family: var(--brand-font, 'Inter', sans-serif); }
[data-gjs-type] { font-family: inherit; font-weight: normal; font-style: normal; }
[data-gjs-type] * { font-family: inherit; }`;

    if (intoMainDoc) {
        let style = document.getElementById('brand-variables-main');
        if (!style) {
            style = document.createElement('style');
            style.id = 'brand-variables-main';
            document.head.appendChild(style);
        }
        style.innerHTML = css;
    }

    if (editor) {
        // GrapesJS reconstruit le canvas de façon asynchrone après loadProjectData.
        // On tente l'injection immédiatement, puis on retry après 100ms et 400ms
        // pour s'assurer que le canvas est prêt.
        function doInject() {
            try {
                const doc = editor.Canvas.getDocument();
                if (!doc) return false;
                // 1. Charger les @font-face (Gotham, Space Grotesk) DANS l'iframe.
                // On l'injecte explicitement ici (en plus de canvas.styles) car
                // cette option ne charge pas toujours la feuille dans l'iframe.
                // URL absolue → les url() relatives de fonts.css résolvent bien.
                if (!doc.getElementById('brand-fonts-link')) {
                    const link = doc.createElement('link');
                    link.id = 'brand-fonts-link';
                    link.rel = 'stylesheet';
                    link.href = location.origin + '/css/fonts.css';
                    doc.head.appendChild(link);
                }
                if (!doc.getElementById('google-fonts-link')) {
                    const gLink = doc.createElement('link');
                    gLink.id = 'google-fonts-link';
                    gLink.rel = 'stylesheet';
                    gLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Lato:wght@400;700;900&family=Montserrat:wght@400;600;800&family=Open+Sans:wght@400;600;800&family=Oswald:wght@400;700&family=Poppins:wght@400;600;800&family=Raleway:wght@400;700&family=Roboto:wght@400;700;900&display=swap';
                    doc.head.appendChild(gLink);
                }
                // 2. Variables de marque + font par défaut.
                let style = doc.getElementById('brand-variables');
                if (!style) {
                    style = doc.createElement('style');
                    style.id = 'brand-variables';
                    doc.head.appendChild(style);
                }
                style.innerHTML = css + headerOverrideCss + fontBaseCss;
                // 3. Forcer le chargement de la font de l'école (regular + bold)
                // pour qu'elle soit rendue immédiatement, sans attendre un repaint
                // (les @font-face sont chargés paresseusement par défaut).
                try {
                    if (doc.fonts && doc.fonts.load) {
                        doc.fonts.load("400 1em '" + brandFontName + "'");
                        doc.fonts.load("700 1em '" + brandFontName + "'");
                    }
                } catch(e) { /* noop */ }
                return true;
            } catch(e) { return false; }
        }
        if (!doInject()) {
            setTimeout(() => { if (!doInject()) setTimeout(doInject, 400); }, 100);
        } else {
            // Injection réussie immédiatement, mais on refait après 150ms
            // au cas où GrapesJS recrée le canvas ensuite
            setTimeout(doInject, 150);
        }
    }
}

// Force les styles de structure des composants master qui pourraient être
// écrasés par un project_data sauvegardé avec d'anciennes valeurs.
function injectComponentFixedStyles(editor) {
    try {
        const doc = editor.Canvas.getDocument();
        if (!doc) return;

        // Inject FontAwesome stylesheet link if it doesn't exist
        if (!doc.querySelector('link[href*="fontawesome"]')) {
            const link = doc.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'vendor/fontawesome/css/all.min.css';
            doc.head.appendChild(link);
        }

        let style = doc.getElementById('component-fixed-styles');
        if (!style) {
            style = doc.createElement('style');
            style.id = 'component-fixed-styles';
            doc.head.appendChild(style);
        }
        style.innerHTML = `
            html { scroll-behavior: smooth !important; }
            /* CarouselVariantC — force grille 3 colonnes desktop */
            @media (min-width: 769px) {
                .mcc-grid { grid-template-columns: repeat(3, 1fr) !important; display: grid !important; }
                .mcc-item { display: flex !important; }
            }
            /* Code pays des formulaires : ÉTROIT → champ numéro plus large. Fixe par
               design (l'utilisateur ne le redimensionne pas). S'applique aussi aux
               pages déjà créées (CSS figé). */
            [class*="-phone-prefix-wrap"] { width: 92px !important; flex-shrink: 0 !important; }
            /* Plus de drapeau dans les formulaires (même sur les pages figées). */
            .jpo-flag { display: none !important; }
            /* Logos header COMPACTS en MOBILE UNIQUEMENT (le desktop reste librement
               redimensionnable via le panneau Style). Corrige aussi les pages figées. */
            @media (max-width: 768px) {
                .mh-logo img, .mh-logo svg,
                .hdr-logo-img, .dh-logo-img,
                #logo img, #logo svg, a#logo img, a#logo svg {
                    max-height: 40px !important; height: auto !important; width: auto !important;
                }
                [class*="header-efap"] .hdr-logo-img,   [class*="dh-efap"] .dh-logo-img,
                [class*="header-brassart"] .hdr-logo-img, [class*="dh-brassart"] .dh-logo-img,
                [class*="header-ifa"] .hdr-logo-img,    [class*="dh-ifa"] .dh-logo-img {
                    max-height: 30px !important;
                }
            }
        `;
    } catch(e) { /* silencieux */ }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

function filterBlocksBySchool(editor, schoolId) {
    if (!schoolId) return;

    const bm = editor.BlockManager;
    const allBlocks = [...bm.getAll().models];

    if (schoolId === 'master') {
        // Mode Master : garder les blocs Master Template, Form Blocks, Essential Blocks
        // et les composants custom (Component Builder) enregistrés pour le master.
        const allowedCategories = ['master template', 'form blocks', 'essential blocks'];
        const toRemove = [];
        allBlocks.forEach(block => {
            const category = block.get('category');
            const categoryId = ((typeof category === 'object' ? category.get('id') : category) || '').toLowerCase();
            if (!allowedCategories.includes(categoryId)) toRemove.push(block.get('id'));
        });
        toRemove.forEach(id => bm.remove(id));
        bm.render();
        return;
    }
    const targetSchoolId = schoolId.toLowerCase();

    // Libellés EXACTS des catégories "<École> Components" par id d'école — miroir des
    // libellés définis dans blocks/index.js. On NE se base PAS sur CURRENT_SCHOOL.name
    // (qui provient de la BDD Supabase et peut différer, ex : "3WA" vs "3W ACADEMY"),
    // sinon le filtre risque de supprimer les composants de l'école COURANTE elle-même.
    // On ne retire que les catégories explicitement rattachées aux AUTRES écoles ;
    // tout le reste (Essential Blocks, Form Blocks, Master Template, école courante)
    // est conservé.
    const SCHOOL_CATEGORY_LABELS = {
        'efap':        'efap components',
        'brassart':    'brassart components',
        'icart':       'icart components',
        'efj':         'efj components',
        'mopa':        'mopa components',
        'cread':       'cread components',
        'esec':        'ésec components',
        '3wa':         '3w academy components',
        'ifa-paris':   'ifa paris components',
        'ecole-bleue': 'école bleue components',
    };

    const allSchoolsList = Object.keys(SCHOOL_CATEGORY_LABELS);
    const otherSchools = allSchoolsList.filter(s => s !== targetSchoolId);
    const otherSchoolCategoryLabels = new Set(otherSchools.map(s => SCHOOL_CATEGORY_LABELS[s]));

    const blocksToRemove = [];

    allBlocks.forEach(block => {
        let id, categoryLabel, blockId;
        try {
            blockId = block.get('id');
            id = String(blockId || '').toLowerCase();
            const category = block.get('category');
            categoryLabel = ((typeof category === 'object' && category ? category.get('id') : category) || '')
                .toString().toLowerCase();
        } catch (e) {
            return; // un bloc mal formé ne doit pas interrompre le filtrage des autres
        }

        // Toujours conserver les blocs par défaut de l'école courante.
        if ((CURRENT_SCHOOL?.defaultBlocks || []).includes(blockId)) return;

        // 1. Catégorie appartenant explicitement à une AUTRE école.
        const belongsToOtherSchoolCategory =
            otherSchoolCategoryLabels.has(categoryLabel) ||
            otherSchools.some(school => categoryLabel === school); // ancien format court "brassart"

        // 2. Id spécifique à une autre école (header-brassart, footer-efap, header-mopa-blanc…)
        const belongsToOtherSchoolId = otherSchools.some(school =>
            id.endsWith(`-${school}`) || id.includes(`-${school}-`) || id === school
        );

        if (belongsToOtherSchoolCategory || belongsToOtherSchoolId) {
            blocksToRemove.push(blockId);
        }
    });

    // Remove the blocks belonging to other schools
    blocksToRemove.forEach(id => bm.remove(id));
    
    bm.render();
}

// Déplace les blocs-formulaires (id commençant par « form- » ou « master-form »)
// hors de l'onglet Blocks : on capture leur contenu puis on les retire du
// BlockManager. L'onglet Forms les réaffiche via formBlocksCache. Idempotent.
function extractFormBlocks(editor) {
    if (formBlocksCache.length) return;
    const bm = editor.BlockManager;
    const isForm = id => /^form-/.test(String(id || '')) || id === 'master-form';
    const toMove = [...bm.getAll().models].filter(b => isForm(b.get('id')));
    toMove.forEach(b => {
        const id = b.get('id');
        const content = b.get('content');
        formBlocksCache.push({
            id,
            label: b.get('label') || id,
            media: b.get('media') || '',
            content
        });
        formBlocksContentById[id] = content;
    });
    toMove.forEach(b => bm.remove(b.get('id')));
    bm.render();
}

async function loadCustomComponents(editor, schoolId) {
    // NB : on charge aussi les composants du master (schoolId === 'master'),
    // sinon les composants créés dans le Component Builder du master template
    // ne réapparaissent jamais au rechargement de la page.
    if (!schoolId) return;
    try {
        const response = await fetch(`/api/components/${schoolId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const components = await response.json();
        
        components.forEach(comp => {
            const blockId = `db-comp-${comp.id}`;
            const categoryLabel = comp.category || `${CURRENT_SCHOOL?.name || schoolId} Components`;
            editor.BlockManager.add(blockId, {
                label: comp.name,
                category: categoryLabel,
                content: typeof comp.content === 'string' && comp.content.trim().startsWith('{') ? JSON.parse(comp.content) : comp.content,
                media: `<div class="block-thumbnail"><div class="block-thumbnail__frame"><img class="block-thumbnail__image" src="assets/block-thumbnails/default.svg" alt="${escapeHtml(comp.name)}"></div></div>`
            });
        });
        editor.BlockManager.render();
    } catch (e) {
        console.error('Failed to load custom components:', e);
    }
}

function updateSchoolUI(school) {
    const indicator = document.getElementById('school-indicator');
    const dot = document.getElementById('school-dot');
    const label = document.getElementById('school-label');
    if (indicator && school) {
        indicator.style.display = 'flex';
        dot.style.backgroundColor = school.color;
        label.textContent = school.name;
    }
}

function initBlockThumbnailMedia(editor) {
    const blockManager = editor.BlockManager;
    const originalAdd = blockManager.add.bind(blockManager);
    blockManager.add = (id, properties = {}) => {
        const label = properties.label || id;
        const thumbnail = BLOCK_THUMBNAILS[id] || BLOCK_THUMBNAILS.default;
        if (!properties.media) {
            properties.media = `<div class="block-thumbnail"><div class="block-thumbnail__frame"><img class="block-thumbnail__image" src="${escapeHtml(thumbnail)}" alt="${escapeHtml(label)}"></div></div>`;
        }
        return originalAdd(id, properties);
    };
}

function loadDefaultTemplate(editor) {
    editor.setComponents(''); editor.setStyle('');
    const defaultBlocks = CURRENT_SCHOOL?.defaultBlocks || ['hero', 'rich-text', 'cta-button'];
    defaultBlocks.forEach(blockId => {
        const block = editor.BlockManager.get(blockId);
        // Les blocs-formulaires ont été retirés du BlockManager (déplacés dans l'onglet
        // Forms) → on récupère leur contenu depuis le cache pour le template par défaut.
        const content = block ? block.get('content') : formBlocksContentById[blockId];
        if (content) editor.addComponents(content);
    });
}

function initUI(editor) {
    const modal = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');
    const modalFooter = modal.querySelector('.modal-footer');
    const modalCloseButton = modal.querySelector('.modal-header .close-modal');

    function closeModal() { modal.classList.add('hidden'); modalTitle.textContent = ''; modalBody.innerHTML = ''; modalFooter.innerHTML = ''; }

    function openModal({ title, body = '', actions = [], onOpen }) {
        modalTitle.textContent = title; modalBody.innerHTML = body; modalFooter.innerHTML = '';
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = action.label; button.className = action.className;
            button.onclick = () => action.onClick(); modalFooter.appendChild(button);
        });
        modal.classList.remove('hidden');
        if (onOpen) onOpen();
    }

    function showAlert({ title, message }) {
        return new Promise(resolve => {
            openModal({ title, body: `<p class="modal-message">${message}</p>`, actions: [{ label: 'OK', className: 'btn-primary', onClick: () => { closeModal(); resolve(); } }] });
        });
    }

    function showPrompt({ title, message, placeholder = '', defaultValue = '' }) {
        return new Promise(resolve => {
            const inputId = 'modal-prompt-input';
            openModal({
                title,
                body: `<p class="modal-message">${message}</p><input id="${inputId}" class="modal-input" type="text" value="${defaultValue}" placeholder="${placeholder}">`,
                actions: [
                    { label: 'Annuler', className: 'btn-secondary', onClick: () => { closeModal(); resolve(null); } },
                    { label: 'Valider', className: 'btn-primary', onClick: () => { const val = document.getElementById(inputId).value; closeModal(); resolve(val); } }
                ],
                onOpen: () => {
                    const input = document.getElementById(inputId);
                    input.focus(); input.select();
                }
            });
        });
    }

    function showConfirm({ title, message }) {
        return new Promise(resolve => {
            openModal({
                title,
                body: `<p class="modal-message">${message}</p>`,
                actions: [
                    { label: 'Annuler', className: 'btn-secondary', onClick: () => { closeModal(); resolve(false); } },
                    { label: 'Vider la page', className: 'btn-primary', onClick: () => { closeModal(); resolve(true); } }
                ]
            });
        });
    }

    function showLoading(message) {
        openModal({
            title: 'Veuillez patienter',
            body: `<div style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; color:#1A7A5E; margin-bottom:1rem;"></i><p>${message}</p></div>`,
            actions: []
        });
    }
    
    function hideLoading() {
        closeModal();
    }

    modalCloseButton.onclick = closeModal;
    
    // Expose globally
    window.showAlert = showAlert;
    window.showConfirm = showConfirm;
    window.showPrompt = showPrompt;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;

    // Init Properties panel
    initProperties();

    // Devices — bascule le device GrapesJS + met le bouton actif en surbrillance.
    // (Avant : la classe .active n'était jamais basculée → aucun retour visuel.)
    const deviceButtons = {
        Desktop: document.getElementById('device-desktop'),
        Tablet:  document.getElementById('device-tablet'),
        Mobile:  document.getElementById('device-mobile'),
    };
    function setActiveDeviceBtn(name) {
        Object.keys(deviceButtons).forEach(n => {
            const btn = deviceButtons[n];
            if (btn) btn.classList.toggle('active', n === name);
        });
    }
    Object.keys(deviceButtons).forEach(name => {
        const btn = deviceButtons[name];
        if (btn) btn.onclick = () => { editor.setDevice(name); setActiveDeviceBtn(name); };
    });
    // Garde les boutons synchronisés si le device change autrement.
    editor.on('change:device', () => {
        try { setActiveDeviceBtn(editor.getDevice()); } catch (e) {}
    });

    // Switch de langue segmenté (FR | EN …). Le comportement (chargement instantané
    // d'une variante existante, traduction Gemini si absente, staleness) est géré par
    // switchLanguage() ; renderLanguageSwitch() (re)construit les boutons.
    // On ne crée JAMAIS de nouveau projet pour traduire.
    renderLanguageSwitch();

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-panel`).classList.remove('hidden');
        };
    });

    const getProjectName = async (action) => {
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        let name = localStorage.getItem(`reetain-builder__${schoolId}__currentProject`);
        if (!name) {
            name = await showPrompt({ title: `${action} le projet`, message: 'Entrez un nom pour votre projet :', placeholder: 'ma-landing-page' });
            if (name) localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, name);
        }
        return name;
    };

    // New Project
    document.getElementById('btn-new').onclick = async () => {
        const name = await showPrompt({ title: 'Nouveau Projet', message: 'Nom du nouveau projet :', placeholder: 'ma-landing-page' });
        if (name) {
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, name);
            localStorage.removeItem(`reetain-builder__${schoolId}__currentFullName`);
            currentProjectIsNew = true;
            currentStructuredPageId = null;
            // Nouvelle page → aucune variante encore, langue d'origine FR par défaut
            // (le consultant choisit la langue de départ à la 1ʳᵉ sauvegarde).
            currentOriginalLanguage = 'FR';
            currentPageVariants = [];
            setActiveLangUI('FR');
            loadDefaultTemplate(editor);
            populateProperties({}); // immediately pre-fill SEO & Properties tab with defaults based on project name
        }
    };

    // Tab Switching Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            
            const panel = document.getElementById(`${tab}-panel`);
            if (panel) panel.classList.remove('hidden');

            if (tab === 'forms') {
                loadSchoolForms();
            }
        };
    });

    const FORMS_SECTION_TITLE = 'font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;padding:12px 4px 6px;';

    async function loadSchoolForms() {
        const container = document.getElementById('forms-list');
        if (!container) return;

        // ── Section 1 : blocs-formulaires (déplacés depuis l'onglet Blocks) ──
        const blockItems = formBlocksCache.map(fb => `
            <div class="form-list-item" data-form-block-id="${escapeHtml(fb.id)}">
                <i class="fas fa-file-lines"></i>
                <div class="form-list-item-content">
                    <div class="form-list-item-name">${escapeHtml(fb.label)}</div>
                    <div class="form-list-item-meta">Bloc formulaire</div>
                </div>
                <i class="fas fa-plus" style="font-size: 0.8rem; opacity: 0.5"></i>
            </div>
        `).join('');

        const blockSection = formBlocksCache.length
            ? `<div style="${FORMS_SECTION_TITLE}">Blocs formulaires</div>${blockItems}`
            : '';

        container.innerHTML = `
            ${blockSection}
            <div style="${FORMS_SECTION_TITLE}">Formulaires de l'école (SFMC)</div>
            <div id="sfmc-forms-list"><div style="text-align:center; padding: 1rem; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Chargement...</div></div>
        `;

        // Insertion des blocs-formulaires au clic (via cache, pas d'inline onclick)
        container.querySelectorAll('[data-form-block-id]').forEach(el => {
            el.onclick = () => {
                const fb = formBlocksCache.find(x => x.id === el.getAttribute('data-form-block-id'));
                if (fb && fb.content) editor.addComponents(fb.content);
            };
        });

        // ── Section 2 : formulaires SFMC de l'école (base de données) ──
        const sfmc = document.getElementById('sfmc-forms-list');
        if (!CURRENT_SCHOOL) {
            if (sfmc) sfmc.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/forms/${CURRENT_SCHOOL.id}`);
            const forms = await response.json();

            if (!Array.isArray(forms) || forms.length === 0) {
                if (sfmc) sfmc.innerHTML = `<div style="text-align:center; padding: 1rem; color: #9ca3af; font-size:12px;">
                    ${forms && forms.error ? 'Erreur: ' + forms.error : 'Aucun formulaire SFMC.'}
                </div>`;
                return;
            }

            sfmc.innerHTML = forms.map(f => {
                const formData = JSON.stringify({
                    html: f.html,
                    css: f.css,
                    ampscript: f.ampscript,
                    name: f.name
                }).replace(/'/g, "&#39;");

                return `
                <div class="form-list-item" onclick='window.insertForm(${formData})'>
                    <i class="fas fa-file-invoice"></i>
                    <div class="form-list-item-content">
                        <div class="form-list-item-name">${f.name}</div>
                        <div class="form-list-item-meta">DE: ${f.data_extension_name}</div>
                    </div>
                    <i class="fas fa-plus" style="font-size: 0.8rem; opacity: 0.5"></i>
                </div>
            `}).join('');

        } catch (e) {
            console.error('Error loading forms:', e);
            if (sfmc) sfmc.innerHTML = '<div style="text-align:center; padding: 1rem; color: #ef4444; font-size:12px;">Erreur de chargement.</div>';
        }
    }

    window.insertForm = (formData) => {
        const { html, css, ampscript, name } = formData;
        
        // We insert a container that includes the AMPscript and the Form
        // We wrap it in a custom component to identify it
        editor.addComponents(`
            <div class="sfmc-form-container" data-form-name="${name}" style="margin: 20px 0;">
                <div style="display:none">%%[ ${ampscript} ]%%</div>
                <style>${css}</style>
                ${html}
            </div>
        `);
        
        // Show success notification
        if (window.showAlert) {
            window.showAlert({ title: 'Succès', message: `Le formulaire "${name}" a été inséré dans votre page avec succès.` });
        } else {
            alert(`Formulaire "${name}" inséré avec succès.`);
        }
    };

    // Undo / Redo — câblés sur l'UndoManager de GrapesJS.
    // • Ne concerne que les modifications EN COURS (l'historique est vidé au chargement
    //   d'une page → on ne peut pas remonter avant l'état chargé).
    // • Boutons DÉSACTIVÉS quand il n'y a rien à annuler / refaire.
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    function setBtnDisabled(btn, disabled) {
        if (!btn) return;
        btn.disabled = disabled;
        btn.classList.toggle('is-disabled', disabled);
        btn.style.opacity = disabled ? '0.4' : '';
        btn.style.pointerEvents = disabled ? 'none' : '';
        btn.style.cursor = disabled ? 'default' : '';
    }
    function refreshUndoRedo() {
        try {
            const um = editor.UndoManager;
            setBtnDisabled(btnUndo, !um.hasUndo());
            setBtnDisabled(btnRedo, !um.hasRedo());
        } catch (e) { /* noop */ }
    }
    // Exposé pour vider l'historique à l'ouverture d'une page (voir points de load).
    window.__refreshUndoRedo = refreshUndoRedo;
    window.__clearUndoHistory = () => {
        try { editor.UndoManager.clear(); } catch (e) {}
        refreshUndoRedo();
    };
    if (btnUndo) btnUndo.onclick = () => { try { editor.UndoManager.undo(); } catch (e) {} refreshUndoRedo(); };
    if (btnRedo) btnRedo.onclick = () => { try { editor.UndoManager.redo(); } catch (e) {} refreshUndoRedo(); };
    // Mise à jour de l'état activé/désactivé à chaque édition et action undo/redo.
    editor.on('update', refreshUndoRedo);
    editor.on('undo', refreshUndoRedo);
    editor.on('redo', refreshUndoRedo);
    // Au chargement initial : historique vide → boutons désactivés.
    editor.on('load', () => { try { editor.UndoManager.clear(); } catch (e) {} refreshUndoRedo(); });
    refreshUndoRedo();

    // Sidebar Toggles
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
        btnClear.onclick = async () => {
            const confirm = await showConfirm({ title: 'Vider le canevas', message: 'Êtes-vous sûr de vouloir tout supprimer ? Vous perdrez tout le contenu actuel de la page.' });
            if (confirm) {
                editor.setComponents('');
                editor.setStyle('');
            }
        };
    }
    // Component Builder
    const btnComponentBuilder = document.getElementById('btn-component-builder');
    if (btnComponentBuilder) {
        btnComponentBuilder.onclick = async () => {
            const schoolId = CURRENT_SCHOOL?.id || 'global';
            let allSchools = [];
            try {
                const response = await fetch('/api/schools');
                allSchools = await response.json();
            } catch (e) {
                console.error("Impossible de récupérer la liste des écoles", e);
            }
            const builder = new ComponentBuilder(editor, schoolId, allSchools);
            builder.open();
        };
    }

    // Form Builder
    document.getElementById('btn-form-builder').onclick = async () => {
        const choice = await showFormSelectionModal();
        if (choice === 'new') {
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            const generator = new FormGenerator(schoolId, CURRENT_SCHOOL || {});
            generator.open();
        } else if (choice && typeof choice === 'object') {
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            const generator = new FormGenerator(schoolId, CURRENT_SCHOOL || {});
            generator.load(choice);
            generator.open();
        }
    };

    async function showFormSelectionModal() {
        return new Promise(async (resolve) => {
            const modalBody = document.getElementById('modal-body');
            const modalTitle = document.getElementById('modal-title');
            const modal = document.getElementById('modal-container');
            const modalContent = modal.querySelector('.modal-content');

            modalContent.classList.add('modal-lg'); // Make it wider
            modalTitle.textContent = 'Form Builder - Sélection';
            modalBody.innerHTML = `
                <div class="selection-grid">
                    <button class="selection-card primary" id="choice-new">
                        <div class="selection-card-icon"><i class="fas fa-magic"></i></div>
                        <div class="selection-card-text">
                            <strong>Nouveau formulaire</strong>
                            <span>Créer un design de zéro</span>
                        </div>
                    </button>
                    
                    <div class="selection-divider">
                        <span>OU</span>
                    </div>

                    <div class="selection-section">
                        <h4 class="selection-title">Modifier un formulaire existant</h4>
                        <div id="modal-forms-list" class="selection-list">
                            <div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Chargement...</div>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.remove('hidden');

            try {
                const response = await fetch(`/api/forms/${CURRENT_SCHOOL.id}`);
                const forms = await response.json();
                const list = document.getElementById('modal-forms-list');
                
                if (!Array.isArray(forms) || forms.length === 0) {
                    list.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center; padding: 1rem;">Aucun formulaire existant.</p>';
                } else {
                    list.innerHTML = forms.map(f => `
                        <div class="form-list-item" data-id="${f.id}">
                            <i class="fas fa-edit" onclick="event.stopPropagation(); window.loadFormToEdit('${f.id}')"></i>
                            <div class="form-list-item-content" onclick="window.loadFormToEdit('${f.id}')">
                                <div class="form-list-item-name">${f.name}</div>
                                <div class="form-list-item-meta">Créé le ${new Date(f.created_at).toLocaleDateString()}</div>
                            </div>
                            <button class="btn-icon-danger" onclick="event.stopPropagation(); window.deleteForm('${f.id}', '${f.name}')" title="Supprimer">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `).join('');

                    window.loadFormToEdit = (id) => {
                        const form = forms.find(f => f.id === id);
                        modal.classList.add('hidden');
                        modalContent.classList.remove('modal-lg');
                        resolve(form);
                    };

                    window.deleteForm = async (id, name) => {
                        if (await showConfirm({ title: 'Supprimer le formulaire', message: `Êtes-vous sûr de vouloir supprimer "${name}" ?` })) {
                            try {
                                await fetch(`/api/forms/${id}`, { method: 'DELETE' });
                                document.querySelector(`.form-list-item[data-id="${id}"]`).remove();
                            } catch (e) { console.error(e); }
                        }
                    };
                }
            } catch (e) {
                console.error(e);
                document.getElementById('modal-forms-list').innerHTML = '<p style="color: #ef4444;">Erreur lors du chargement.</p>';
            }

            document.getElementById('choice-new').onclick = () => {
                modal.classList.add('hidden');
                modalContent.classList.remove('modal-lg');
                resolve('new');
            };

            const closeBtn = modal.querySelector('.close-modal');
            const closeHandler = () => {
                modal.classList.add('hidden');
                modalContent.classList.remove('modal-lg');
                resolve(null);
            };
            closeBtn.onclick = closeHandler;
            modal.querySelector('.btn-secondary.close-modal').onclick = closeHandler;
            if (closeBtn) {
                closeBtn.onclick = () => {
                    modal.classList.add('hidden');
                    resolve(null);
                };
            }
        });
    }

    // Save Component removed as per user request

    async function performDirectSave(fullName) {
        // Validate JSON-LD before sending
        const propsToSave = collectProperties();
        if (propsToSave.schemaLd) {
            try { JSON.parse(propsToSave.schemaLd); }
            catch (jsonErr) {
                await showAlert({ title: 'JSON-LD invalide', message: 'Le champ Schema.org contient du JSON invalide.\n' + jsonErr.message });
                return;
            }
        }

        // ── CHANGED: wrap body HTML in a full document with SEO <head> ──────
        const finalHtml = buildFinalHtml(editor.getHtml(), editor.getCss(), propsToSave);

        const projectData = { 
            projectName: fullName, 
            html: finalHtml,           // full HTML with SEO meta tags
            css: editor.getCss(), 
            projectData: editor.getProjectData(),
            properties: propsToSave
        };

        try {
            showLoading('Sauvegarde en cours...');
            // Publier chaque image inline dans SFMC (une requête par image) pour
            // garder le payload de /api/save sous la limite Vercel de 4,5 Mo
            const { body: saveBody, mapping } = await publishInlineImagesInString(
                JSON.stringify(projectData), fullName, collectAssetNames(editor)
            );
            applyImageMapToEditor(editor, mapping);
            const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: saveBody });
            hideLoading();
            if (!res.ok) throw new Error(await res.text());
            currentProjectProperties.status = 'draft';
            updateStatusBadge();
            await showAlert({ title: 'Succès', message: 'Projet enregistré en brouillon. Utilisez « Publish to SFMC » pour le publier.' });
        } catch (e) { 
            hideLoading();
            console.error(e);
            await showAlert({ title: 'Erreur de sauvegarde', message: 'Impossible de sauvegarder le projet. ' + e.message });
        }
    }

    async function saveStructuredVersionOnly(pageId, selectedLanguage) {
        const propsToSave = collectProperties();
        if (propsToSave.schemaLd) {
            try { JSON.parse(propsToSave.schemaLd); }
            catch (jsonErr) {
                await showAlert({ title: 'JSON-LD invalide', message: 'Le champ Schema.org contient du JSON invalide.\n' + jsonErr.message });
                return;
            }
        }

        const finalHtml = buildFinalHtml(editor.getHtml(), editor.getCss(), propsToSave);
        showLoading('Sauvegarde en cours...');
        try {
            const imgProjectName = localStorage.getItem(`reetain-builder__${CURRENT_SCHOOL?.id || 'unknown'}__currentFullName`)
                || `school-${CURRENT_SCHOOL?.id || 'unknown'}__page`;
            const versionPayload = JSON.stringify({
                    html: finalHtml,
                    css: editor.getCss(),
                    project_data: editor.getProjectData(),
                    status: 'draft',
                    change_summary: `Saved from structured editor (${selectedLanguage || 'FR'})`,
                    metadata: { source: 'structured-editor' },
                    page: {
                        title: propsToSave.title || localStorage.getItem(`reetain-builder__${CURRENT_SCHOOL?.id || 'unknown'}__currentProject`) || 'Page',
                        language: selectedLanguage || 'FR',
                        seo: {
                            title: propsToSave.seoTitle || '',
                            description: propsToSave.seoDescription || '',
                            keywords: propsToSave.keywords || '',
                            canonical: propsToSave.canonical || '',
                            schemaLd: propsToSave.schemaLd || ''
                        }
                    }
            });
            const { body: versionBody, mapping } = await publishInlineImagesInString(
                versionPayload, imgProjectName, collectAssetNames(editor)
            );
            applyImageMapToEditor(editor, mapping);
            const res = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: versionBody
            });
            if (!res.ok) throw new Error(await res.text());
            hideLoading();
            await showAlert({ title: 'Succès', message: 'Page sauvegardée avec succès.' });
        } catch (e) {
            hideLoading();
            console.error(e);
            await showAlert({ title: 'Erreur de sauvegarde', message: 'Impossible de sauvegarder la page. ' + e.message });
        }
    }

    // Save Project
    document.getElementById('btn-save').onclick = async () => {
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        const selectedLanguage = normLang(currentProjectLanguage);

        if (!currentProjectIsNew) {
            const fullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);
            const pageId = currentStructuredPageId;
            const isOriginalLang = selectedLanguage === normLang(currentOriginalLanguage);

            // Validate JSON-LD before sending
            const propsToSave = collectProperties();
            if (propsToSave.schemaLd) {
                try { JSON.parse(propsToSave.schemaLd); }
                catch (jsonErr) {
                    await showAlert({ title: 'JSON-LD invalide', message: 'Le champ Schema.org contient du JSON invalide.\n' + jsonErr.message });
                    return;
                }
            }

            // ── Sauvegarde d'une VARIANTE DE TRADUCTION (langue ≠ origine) ──
            // On enregistre l'état courant de l'éditeur comme variante de CETTE page.
            // Aucune traduction Gemini ici (la traduction se fait via le switch), aucun
            // nouveau projet, pas de table Projects/SFMC (hors-scope V1).
            if (!isOriginalLang) {
                if (!pageId) {
                    await showAlert({ title: 'Erreur', message: 'Ouvrez la page depuis le Dashboard pour éditer une traduction.' });
                    return;
                }
                try {
                    showLoading(`Sauvegarde de la traduction ${selectedLanguage}...`);
                    applyLogoLanguage(editor, selectedLanguage); // header/footer dans la bonne langue
                    const finalHtml = buildFinalHtml(editor.getHtml(), editor.getCss(), propsToSave);
                    const payload = {
                        html: finalHtml,
                        css: editor.getCss(),
                        project_data: editor.getProjectData(),
                        seo: propsToSeo(propsToSave)
                    };
                    const res = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/variants/${encodeURIComponent(selectedLanguage)}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error(await res.text());
                    await refreshVariants(pageId);
                    triggerSfmcResync();
                    hideLoading();
                    await showAlert({ title: 'Succès', message: `Traduction ${selectedLanguage} sauvegardée !` });
                } catch (e) {
                    hideLoading();
                    console.error(e);
                    await showAlert({ title: 'Erreur de sauvegarde', message: 'Impossible de sauvegarder la traduction. ' + e.message });
                }
                return;
            }

            // ── Sauvegarde de la LANGUE D'ORIGINE (via /api/save : Projects + SFMC + structuré) ──
            if (!fullName) {
                if (pageId) {
                    await saveStructuredVersionOnly(pageId, selectedLanguage);
                    return;
                }
                await showAlert({ title: 'Erreur', message: 'Projet introuvable. Veuillez utiliser le Dashboard pour ouvrir une page.' });
                return;
            }

            try {
                showLoading('Sauvegarde en cours...');
                applyLogoLanguage(editor, selectedLanguage); // header/footer dans la langue d'origine (idempotent)
                const finalHtml = buildFinalHtml(editor.getHtml(), editor.getCss(), propsToSave);
                const projectData = {
                    projectName: fullName,
                    language: selectedLanguage,
                    html: finalHtml,
                    css: editor.getCss(),
                    projectData: editor.getProjectData(),
                    properties: propsToSave
                };

                const { body: saveBody, mapping } = await publishInlineImagesInString(
                    JSON.stringify(projectData), fullName, collectAssetNames(editor)
                );
                applyImageMapToEditor(editor, mapping);
                const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: saveBody });
                if (!res.ok) throw new Error(await res.text());

                const saveData = await res.json();
                const savedPageId = saveData.page_id || saveData.content?.pageId || null;
                if (savedPageId) {
                    currentStructuredPageId = savedPageId;
                    localStorage.setItem(`reetain-builder__${schoolId}__currentPageId`, savedPageId);
                }
                currentProjectLanguage = selectedLanguage;
                currentProjectProperties.status = 'draft';
                updatePageIdBadge();
                // Rafraîchir les variantes : les traductions existantes deviennent
                // « à mettre à jour » (stale) puisque l'original vient de changer.
                await refreshVariants(currentStructuredPageId);
                hideLoading();
                await showAlert({ title: 'Succès', message: `Projet sauvegardé en ${selectedLanguage} (brouillon).` });
            } catch (e) {
                hideLoading();
                console.error(e);
                await showAlert({ title: 'Erreur de sauvegarde', message: 'Impossible de sauvegarder le projet. ' + e.message });
            }
        } else {
            // New project -> Show language selection modal first
            const modal = document.getElementById('save-new-project-modal');
            if (!modal) return;
            document.getElementById('select-new-project-lang').value = selectedLanguage;
            modal.classList.remove('hidden');

            document.getElementById('btn-close-save-new').onclick = () => modal.classList.add('hidden');

            document.getElementById('btn-confirm-save-new').onclick = async () => {
                const lang = document.getElementById('select-new-project-lang')?.value || selectedLanguage;
                const nameInput = localStorage.getItem(`reetain-builder__${schoolId}__currentProject`);
                
                if (!nameInput || nameInput === 'Nouveau Projet') {
                    await showAlert({ title: 'Erreur', message: 'Nom du projet introuvable. Veuillez recharger la page.' });
                    return;
                }

                modal.classList.add('hidden');

                // Now show the SEO validation modal pre-filled with values before the actual save!
                document.getElementById('modal-seo-title').value = nameInput;
                
                // Default fallback properties
                const defaultSeoTitle = nameInput;
                const defaultSeoDesc = `Découvrez notre nouvelle page ${nameInput} pour l'école ${CURRENT_SCHOOL?.name || 'Reetain'}. Retrouvez toutes les informations.`;
                const defaultKeywords = `${CURRENT_SCHOOL?.name || 'école'}, formation, JPO, inscription`;

                document.getElementById('modal-seo-meta-title').value = defaultSeoTitle;
                document.getElementById('modal-seo-meta-desc').value = defaultSeoDesc;
                document.getElementById('modal-seo-keywords').value = defaultKeywords;

                // Trigger counters
                document.getElementById('modal-seo-meta-title').dispatchEvent(new Event('input'));
                document.getElementById('modal-seo-meta-desc').dispatchEvent(new Event('input'));

                const seoModal = document.getElementById('save-seo-modal');
                seoModal.classList.remove('hidden');

                document.getElementById('btn-close-save-seo').onclick = () => seoModal.classList.add('hidden');

                const proceedSaveNew = async (shouldUseModalValues) => {
                    seoModal.classList.add('hidden');

                    if (shouldUseModalValues) {
                        // Copy values back to memory
                        currentProjectProperties.title = document.getElementById('modal-seo-title').value.trim();
                        currentProjectProperties.seoTitle = document.getElementById('modal-seo-meta-title').value.trim();
                        currentProjectProperties.seoDescription = document.getElementById('modal-seo-meta-desc').value.trim();
                        currentProjectProperties.keywords = document.getElementById('modal-seo-keywords').value.trim();
                    } else {
                        // Pre-populate with defaults if direct
                        currentProjectProperties.title = nameInput;
                        currentProjectProperties.seoTitle = defaultSeoTitle;
                        currentProjectProperties.seoDescription = defaultSeoDesc;
                        currentProjectProperties.keywords = defaultKeywords;
                    }

                    // Création dans la LANGUE DE DÉPART choisie (= langue d'origine).
                    // AUCUNE traduction ici : les traductions se font ensuite via le switch.
                    // Un seul projet, identité SANS suffixe de langue.
                    showLoading('Sauvegarde en cours...');
                    currentProjectLanguage = lang;
                    currentOriginalLanguage = lang;
                    applyLogoLanguage(editor, lang);

                    const finalProjectTitle = currentProjectProperties.title || nameInput;
                    const fullName = `school-${schoolId}__${finalProjectTitle}`;
                    const propsToSave = collectProperties();

                    if (propsToSave.schemaLd) {
                        try { JSON.parse(propsToSave.schemaLd); }
                        catch (jsonErr) {
                            hideLoading();
                            await showAlert({ title: 'JSON-LD invalide', message: 'Le champ Schema.org contient du JSON invalide.\n' + jsonErr.message });
                            return;
                        }
                    }

                    // ── CHANGED: wrap body HTML in a full document with SEO <head> ──
                    const finalHtml = buildFinalHtml(editor.getHtml(), editor.getCss(), propsToSave);
                    const projectData = {
                        projectName: fullName,
                        language: lang,
                        html: finalHtml,
                        css: editor.getCss(),
                        projectData: editor.getProjectData(),
                        properties: propsToSave
                    };

                    try {
                        const { body: saveBody, mapping } = await publishInlineImagesInString(
                            JSON.stringify(projectData), fullName, collectAssetNames(editor)
                        );
                        applyImageMapToEditor(editor, mapping);
                        const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: saveBody });
                        if (!res.ok) throw new Error(await res.text());

                        const saveData = await res.json();
                        const savedPageId = saveData.page_id || saveData.content?.pageId || null;
                        if (savedPageId) {
                            currentStructuredPageId = savedPageId;
                            localStorage.setItem(`reetain-builder__${schoolId}__currentPageId`, savedPageId);
                        }

                        currentProjectIsNew = false;
                        currentProjectLanguage = lang;
                        currentProjectProperties.status = 'draft';
                        localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, fullName);
                        localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, finalProjectTitle);
                        setActiveLangUI(lang);
                        updatePageIdBadge(); // Met à jour le badge ET l'URL
                        await refreshVariants(currentStructuredPageId);

                        hideLoading();

                        const userChoice = await new Promise(resolve => {
                            openModal({
                                title: 'Succès',
                                body: `<p class="modal-message">Nouveau projet créé en ${LANG_LABELS[lang] || lang} avec succès !</p>`,
                                actions: [
                                    { label: 'Continuer l\'édition', className: 'btn-primary', onClick: () => { closeModal(); resolve(true); } },
                                    { label: 'Fermer', className: 'btn-secondary', onClick: () => { closeModal(); resolve(false); } }
                                ]
                            });
                        });

                        if (!userChoice) {
                            showOpeningPopup();
                        }
                    } catch (e) {
                        hideLoading();
                        console.error(e);
                        await showAlert({ title: 'Erreur de sauvegarde', message: 'Impossible de sauvegarder le projet. ' + e.message });
                    }
                };

                document.getElementById('btn-save-seo-cancel').onclick = () => seoModal.classList.add('hidden');
                document.getElementById('btn-save-seo-confirm').onclick = () => proceedSaveNew(true);
            };
        }
    };

    // Publish to SFMC — publication manuelle de l'asset webpage.
    // La sauvegarde garde la page en brouillon (html_sfmc + images prêts) ;
    // ce bouton pousse le HTML vers SFMC uniquement à la demande.
    document.getElementById('btn-publish-sfmc').onclick = async () => {
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        const fullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);

        // Il faut un projet déjà sauvegardé (brouillon en BD) avant de publier.
        if (currentProjectIsNew || !fullName) {
            await showAlert({
                title: 'Sauvegarde requise',
                message: 'Sauvegardez d\'abord le projet avec « Save Project » avant de le publier sur SFMC.'
            });
            return;
        }

        // ── Modal de confirmation ──────────────────────────────────────────
        const confirmed = await new Promise(resolve => {
            openModal({
                title: 'Publier sur SFMC',
                body: `<p class="modal-message">Cette action publie la page <strong>${fullName}</strong> sur Salesforce Marketing Cloud (création ou mise à jour de l'asset).<br><br>Assurez-vous d'avoir sauvegardé votre travail. Continuer ?</p>`,
                actions: [
                    { label: 'Annuler', className: 'btn-secondary', onClick: () => { closeModal(); resolve(false); } },
                    { label: 'Publier', className: 'btn-primary', onClick: () => { closeModal(); resolve(true); } }
                ]
            });
        });
        if (!confirmed) return;

        // ── Publication + loader ───────────────────────────────────────────
        showLoading('Publication sur SFMC en cours...');
        try {
            const res = await fetch('/api/publish-sfmc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: fullName })
            });
            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();
            const action = data?.sfmc?.action === 'created' ? 'créée' : 'mise à jour';
            const assetName = data?.sfmc?.name || fullName;

            // Marquer la page comme publiée dans l'UI.
            currentProjectProperties.status = 'published';
            updateStatusBadge();

            hideLoading();
            await showAlert({
                title: 'Publication réussie',
                message: `La page « ${assetName} » a été ${action} sur Salesforce Marketing Cloud.`
            });
        } catch (e) {
            hideLoading();
            console.error(e);
            await showAlert({ title: 'Échec de la publication', message: 'Impossible de publier sur SFMC. ' + e.message });
        }
    };

    // Dépublier — supprime l'asset page dans SFMC (par clé exacte, avec garde-fou
    // côté serveur) et repasse la page en brouillon.
    document.getElementById('btn-unpublish-sfmc').onclick = async () => {
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        const fullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);

        if (currentProjectIsNew || !fullName) {
            await showAlert({ title: 'Action impossible', message: 'Aucun projet publié à dépublier.' });
            return;
        }

        const confirmed = await new Promise(resolve => {
            openModal({
                title: 'Dépublier de SFMC',
                body: `<p class="modal-message">Cette action <strong>supprime l'asset</strong> de la page <strong>${fullName}</strong> sur Salesforce Marketing Cloud (recherche par clé exacte, aucun autre bloc n'est touché).<br><br>La page repassera en brouillon. Continuer ?</p>`,
                actions: [
                    { label: 'Annuler', className: 'btn-secondary', onClick: () => { closeModal(); resolve(false); } },
                    { label: 'Dépublier', className: 'btn-primary', onClick: () => { closeModal(); resolve(true); } }
                ]
            });
        });
        if (!confirmed) return;

        showLoading('Dépublication de SFMC en cours...');
        try {
            const res = await fetch('/api/unpublish-sfmc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: fullName })
            });
            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();
            const sfmcAction = data?.sfmc?.action;

            // Repasser en brouillon dans l'UI.
            currentProjectProperties.status = 'draft';
            updateStatusBadge();

            hideLoading();
            const msg = sfmcAction === 'deleted'
                ? 'La page a été dépubliée : son asset a été supprimé de Salesforce Marketing Cloud.'
                : sfmcAction === 'not_found'
                    ? 'Aucun asset correspondant trouvé sur SFMC. La page est repassée en brouillon.'
                    : sfmcAction === 'skipped_mismatch'
                        ? 'Un asset a été trouvé mais ne correspondait pas exactement à cette page : suppression annulée par sécurité. La page est repassée en brouillon.'
                        : 'Page repassée en brouillon.';
            await showAlert({ title: 'Dépublication terminée', message: msg });
        } catch (e) {
            hideLoading();
            console.error(e);
            await showAlert({ title: 'Échec de la dépublication', message: 'Impossible de dépublier sur SFMC. ' + e.message });
        }
    };

    // Preview
    // Contraint l'aperçu de l'éditeur à la MÊME largeur que l'aperçu dashboard/SFMC
    // (1280px centré). Sans ça, core:preview cache les panneaux et l'iframe s'étale
    // sur toute la largeur de la fenêtre → page plus large que dans l'éditeur.
    function setEditorPreviewViewport(on) {
        try {
            const doc = editor.Canvas && editor.Canvas.getDocument && editor.Canvas.getDocument();
            if (!doc) return;
            let st = doc.getElementById('editor-preview-viewport');
            if (on) {
                if (!st) {
                    st = doc.createElement('style');
                    st.id = 'editor-preview-viewport';
                    // Pleine largeur (pas de plafond) : la page s'affiche comme sur un
                    // vrai navigateur — sections pleine largeur, contenu centré par
                    // leurs propres conteneurs. Les espacements entre blocs (en px) et
                    // le texte restent intacts, seule la largeur totale change.
                    st.textContent = 'html{background:#e9e9ec;}'
                        + 'body{width:100%!important;margin-left:auto!important;margin-right:auto!important;background:#ffffff;}';
                    (doc.head || doc.documentElement).appendChild(st);
                }
            } else if (st) {
                st.remove();
            }
        } catch (e) { console.warn('setEditorPreviewViewport', e); }
    }

    // Fait défiler vers un fragment (#id) dans le document du canvas. Renvoie true
    // si une cible a été trouvée et le scroll effectué.
    function editorPreviewScrollToHash(raw, doc) {
        const id = decodeURIComponent(String(raw || '').replace(/^#/, ''));
        if (!id || !doc) return false;
        const esc = (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/"/g, '\\"');
        const target = doc.getElementById(id) || doc.querySelector('[name="' + esc + '"]');
        if (!target) return false;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    // Ancrage + liens image en aperçu. Dans l'éditeur :
    //  1) les liens internes (#id) ne défilent pas nativement (iframe canvas) → on
    //     simule le scroll vers le bloc ciblé ;
    //  2) les images du bloc « image-link » ne sont PAS enveloppées dans un <a>
    //     (le wrap n'a lieu qu'à l'export getHtml) → on lit data-href / data-link-target
    //     et on simule la redirection au clic.
    // Activé uniquement pendant l'aperçu, retiré à la sortie. ⚠️ Ne modifie ni le
    // HTML exporté ni la logique des blocs ni l'aperçu du dashboard.
    function editorPreviewAnchorHandler(e) {
        try {
            const el = e.target;
            if (!el || !el.closest) return;

            // 1) Image (ou élément) avec lien image-link : data-href renseigné.
            const linked = el.closest('[data-href]');
            if (linked) {
                const url = (linked.getAttribute('data-href') || '').trim();
                if (url) {
                    e.preventDefault();
                    if (url.charAt(0) === '#') {
                        editorPreviewScrollToHash(url, linked.ownerDocument);
                    } else if (linked.getAttribute('data-link-target') === '_blank') {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                        // Le canvas est un iframe : on redirige la fenêtre de l'éditeur.
                        window.location.href = url;
                    }
                    return;
                }
            }

            // 2) Lien <a> classique : ancre interne (#id) OU lien externe.
            const a = el.closest('a[href]');
            if (!a) return;
            const raw = (a.getAttribute('href') || '').trim();
            if (!raw || raw === '#') return; // href vide / "#" seul → rien à cibler

            // Ancre : soit "#id", soit une URL de la MÊME page contenant "#id"
            // (ex. "…/page#programmes"). Si un élément porte cet id → on défile.
            const hashPos = raw.indexOf('#');
            if (hashPos !== -1) {
                const frag = raw.slice(hashPos); // "#id"
                if (frag.length > 1 && editorPreviewScrollToHash(frag, a.ownerDocument)) {
                    e.preventDefault();
                    return;
                }
                if (raw.charAt(0) === '#') return; // ancre sans cible → ne rien faire
            }

            // Lien externe (http, https, //, mailto, tel) : le canvas est un iframe ;
            // le laisser naviguer dedans casse l'aperçu (site cible souvent bloqué en
            // iframe). On ouvre donc le lien dans un nouvel onglet — ainsi les icônes
            // réseaux sociaux et tous les liens sont cliquables en aperçu.
            if (/^(https?:|mailto:|tel:|\/\/)/i.test(raw)) {
                e.preventDefault();
                window.open(a.href, '_blank', 'noopener,noreferrer');
            }
        } catch (err) { /* ne jamais casser l'aperçu */ }
    }

    // Attache/détache le simulateur d'ancrage sur le document du canvas (idempotent).
    function setEditorPreviewAnchors(on) {
        try {
            const doc = editor.Canvas && editor.Canvas.getDocument && editor.Canvas.getDocument();
            if (!doc) return;
            doc.removeEventListener('click', editorPreviewAnchorHandler, true);
            if (on) doc.addEventListener('click', editorPreviewAnchorHandler, true);
        } catch (e) { console.warn('setEditorPreviewAnchors', e); }
    }

    // Ré-applique la contrainte d'aperçu (largeur fixe 1280px + ancrage) si l'aperçu
    // est actif. Un switch de langue recharge le canvas (loadProjectData/setComponents)
    // et perdrait sinon le style injecté → la page reprendrait toute la largeur.
    window.__reapplyEditorPreview = function () {
        if (!window.__editorPreviewActive) return;
        setEditorPreviewViewport(true);
        setEditorPreviewAnchors(true);
    };

    document.getElementById('btn-preview').onclick = () => {
        // Hide custom UI panels
        const tb = document.querySelector('.builder-toolbar');
        const sl = document.querySelector('.sidebar-left');
        const sr = document.querySelector('.sidebar-right');
        if (tb) tb.style.display = 'none';
        if (sl) sl.style.display = 'none';
        if (sr) sr.style.display = 'none';

        // Run GrapesJS preview
        window.__editorPreviewActive = true; // survit aux rechargements du canvas (switch de langue)
        editor.runCommand('core:preview');
        editor.refresh(); // Force resize
        setEditorPreviewViewport(true); // pleine largeur (comme un vrai navigateur)
        setEditorPreviewAnchors(true); // simule le défilement vers les blocs cibles (#id)

        // Create or show custom exit button
        let exitBtn = document.getElementById('custom-exit-preview');
        if (!exitBtn) {
            exitBtn = document.createElement('button');
            exitBtn.id = 'custom-exit-preview';
            exitBtn.className = 'btn-primary';
            exitBtn.innerHTML = '<i class="fas fa-times" style="margin-right:8px;"></i> Quitter l\'aperçu';
            exitBtn.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 10000; box-shadow: 0 10px 25px rgba(0,0,0,0.2); padding: 12px 24px; font-size: 15px; border-radius: 30px;';
            document.body.appendChild(exitBtn);
            
            exitBtn.onclick = () => {
                window.__editorPreviewActive = false;
                editor.stopCommand('core:preview');
                setEditorPreviewViewport(false); // retire la contrainte de largeur
                setEditorPreviewAnchors(false); // retire le simulateur d'ancrage
                if (tb) tb.style.display = '';
                if (sl) sl.style.display = '';
                if (sr) sr.style.display = '';
                exitBtn.style.display = 'none';
                editor.refresh();
            };
        }
        exitBtn.style.display = 'block';
    };

    // Open Project
    document.getElementById('btn-open').onclick = async () => {
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            const filtered = projects.filter(p =>
                p.project_name.startsWith(`school-${schoolId}__`) &&
                p.status !== 'deleted' && p.status !== 'archived'
            );

            let listHtml = `
                <div class="selection-grid">
                    <div class="selection-section">
                        <h4 class="selection-title">Sélectionnez un projet à charger</h4>
                        <div class="selection-list" style="max-height: 400px;">
            `;
            
            if (filtered.length === 0) {
                listHtml += '<div class="loading-state">Aucun projet trouvé pour cette école.</div>';
            } else {
                filtered.forEach(p => {
                    const fullName = p.project_name.replace(`school-${schoolId}__`, '');
                    const parts = fullName.split('__');
                    const displayName = parts[0];
                    const lang = parts[1] || 'FR';
                    const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
                    
                    listHtml += `
                        <div class="form-list-item" onclick="window.loadProject('${p.project_name}', '${displayName}')">
                            <i class="fas fa-folder-open"></i>
                            <div class="form-list-item-content">
                                <div class="form-list-item-name">
                                    ${displayName}
                                    <span class="language-badge" style="background: #EAF6F1; color: #1A7A5E; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">${lang}</span>
                                </div>
                                <div class="form-list-item-meta">Dernière modification : ${date}</div>
                            </div>
                            <i class="fas fa-chevron-right" style="opacity: 0.3"></i>
                        </div>
                    `;
                });
            }
            
            listHtml += `
                        </div>
                    </div>
                </div>
            `;
            
            const modal = document.getElementById('modal-container');
            const modalContent = modal.querySelector('.modal-content');
            modalContent.classList.add('modal-lg');
            openModal({ title: 'Ouvrir un projet', body: listHtml });
        } catch (e) { console.error(e); }
    };

    window.loadProject = async (fullName, displayName) => {
        try {
            const response = await fetch(`/api/project/${fullName}`);
            const project = await response.json();
            editor.loadProjectData(parseProjectData(project.project_data));
            injectBrandVariables(editor, CURRENT_SCHOOL);
            // Populate SEO / Properties panel
            populateProperties(project.properties || {});
            // Ouverture de page → historique undo vidé.
            setTimeout(() => window.__clearUndoHistory && window.__clearUndoHistory(), 300);
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, displayName);
            localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, fullName);
            currentStructuredPageId = project.page_id || null;
            currentProjectIsNew = false;
            updatePageIdBadge();

            // Langue d'origine + résumé des variantes (switch multilingue).
            const parts = fullName.replace(`school-${schoolId}__`, '').split('__');
            const lang = normLang(project.original_language || parts[1] || 'FR');
            currentProjectLanguage = lang;
            applyVariantsSummary(project);
            setActiveLangUI(lang);
            applyLogoLanguage(editor, lang);

            const modal = document.getElementById('modal-container');
            modal.querySelector('.modal-content').classList.remove('modal-lg');
            closeModal();
        } catch (e) { console.error(e); }
    };
}

function initIcartSpecifics(editor) {
    editor.on('load', () => {
        setTimeout(() => {
            const bm = editor.BlockManager;
            const icartCat = bm.getCategories().find(c => (c.get('id') || '').includes('ICART'));
            if (icartCat) icartCat.set('open', true);
        }, 200);
    });
}

function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function showOpeningPopup() {
    const modal = document.getElementById('school-open-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Close button (X)
    document.getElementById('btn-close-dashboard').onclick = () => {
        modal.classList.add('hidden');
    };
    
    document.getElementById('btn-create-new-project').onclick = () => {
        modal.classList.add('hidden');
        currentProjectIsNew = true;
        document.getElementById('btn-new').click();
    };

    const listContainer = document.getElementById('dashboard-projects-list');
    const schoolId = CURRENT_SCHOOL?.id || 'unknown';

    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        const filtered = projects.filter(p =>
            p.project_name.startsWith(`school-${schoolId}__`) &&
            p.status !== 'deleted' && p.status !== 'archived'
        );

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: #6b7280; font-size: 14px;">Aucun projet récent. Créez-en un nouveau !</div>';
        } else {
            listContainer.innerHTML = filtered.map(p => {
                const fullName = p.project_name.replace(`school-${schoolId}__`, '');
                const parts = fullName.split('__');
                const displayName = parts[0];
                const lang = parts[1] || 'FR';
                const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                
                return `
                    <div class="form-list-item" style="cursor: default;">
                        <i class="fas fa-folder-open"></i>
                        <div class="form-list-item-content">
                            <div class="form-list-item-name" style="font-size: 14px;">
                                ${displayName}
                                <span class="language-badge" style="background: #EAF6F1; color: #1A7A5E; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">${lang}</span>
                            </div>
                            <div class="form-list-item-meta" style="font-size: 12px;">Modifié le ${date}</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-outline" title="Paramètres SEO" style="padding: 6px 10px; font-size: 12px; color: #374151; border-color: #D1D5DB;" onclick="window.openSeoSettings('${p.project_name}')">
                                <i class="fas fa-sliders-h"></i>
                            </button>
                            <button class="btn-outline" style="padding: 6px 12px; font-size: 12px;" onclick="window.editProject('${p.project_name}', '${displayName}')">
                                <i class="fas fa-pen"></i> Modifier
                            </button>
                            <button class="btn-outline" style="padding: 6px 12px; font-size: 12px; color: #4F46E5; border-color: #C7D2FE; background: #EEF2FF;" onclick="window.duplicateProject('${p.project_name}')">
                                <i class="fas fa-language"></i> Dupliquer
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef4444;">Erreur de chargement des projets.</div>';
    }
}

// Global handlers for the dashboard buttons
window.editProject = async (fullName, displayName) => {
    document.getElementById('school-open-modal').classList.add('hidden');
    currentProjectIsNew = false;
    await window.loadProject(fullName, displayName);
};

window.duplicateProject = (fullName) => {
    document.getElementById('school-open-modal').classList.add('hidden');
    const modal = document.getElementById('duplicate-project-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('duplicate-source-name').textContent = `Source: ${fullName}`;
    
    const typeSelect = document.getElementById('select-duplicate-type');
    const translateOpts = document.getElementById('duplicate-translate-options');
    const simpleOpts = document.getElementById('duplicate-simple-options');

    typeSelect.onchange = () => {
        if (typeSelect.value === 'translate') {
            translateOpts.classList.remove('hidden');
            simpleOpts.classList.add('hidden');
        } else {
            translateOpts.classList.add('hidden');
            simpleOpts.classList.remove('hidden');
        }
    };

    document.getElementById('btn-close-duplicate').onclick = () => modal.classList.add('hidden');

    document.getElementById('btn-confirm-duplicate').onclick = async () => {
        const type = typeSelect.value;
        modal.classList.add('hidden');
        
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';

        if (type === 'translate') {
            const targetLang = document.getElementById('select-duplicate-lang').value;
            const newDisplayName = await window.showPrompt({ title: 'Nom du projet traduit', message: 'Entrez le nouveau nom :', placeholder: 'nom-projet-traduit' });
            if (!newDisplayName) {
                showOpeningPopup();
                return;
            }

            try {
                window.showLoading('Traduction en cours par l\'IA Gemini... Cela peut prendre quelques secondes.');
                
                const response = await fetch(`/api/project/${fullName}`);
                const sourceProject = await response.json();
                
                const translateRes = await fetch('/api/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: sourceProject.html, targetLang })
                });

                if (!translateRes.ok) throw new Error(await translateRes.text());
                const translateData = await translateRes.json();
                
                const newFullName = `school-${schoolId}__${newDisplayName}__${targetLang}`;

                // ── CHANGED: wrap translated HTML in full document with SEO ──
                const sourceProps = sourceProject.properties || {};
                const finalHtml = buildFinalHtml(translateData.html, sourceProject.css || '', sourceProps);

                const projectData = { 
                    projectName: newFullName, 
                    html: finalHtml,           // full HTML with SEO meta tags
                    css: sourceProject.css, 
                    projectData: sourceProject.project_data,
                    is_original_language: false,
                    page_group_id: fullName
                };

                console.log('🔴 projectData envoyé:', JSON.stringify(projectData).substring(0, 300));

                const { body: translateBody } = await publishInlineImagesInString(JSON.stringify(projectData), newFullName);
                const saveRes = await fetch('/api/save', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: translateBody
                });
                if (!saveRes.ok) throw new Error(await saveRes.text());
                
                window.hideLoading();
                const userChoice = await new Promise(resolve => {
                    window.openModal({
                        title: 'Succès',
                        body: `<p class="modal-message">Page ${targetLang} créée avec succès !</p>`,
                        actions: [
                            { label: 'Ouvrir la page traduite', className: 'btn-primary', onClick: () => { window.closeModal(); resolve(true); } },
                            { label: 'Fermer', className: 'btn-secondary', onClick: () => { window.closeModal(); resolve(false); } }
                        ]
                    });
                });
                if (userChoice) {
                    window.editProject(newFullName, newDisplayName);
                } else {
                    showOpeningPopup(); // Refresh dashboard
                }
            } catch (e) {
                window.hideLoading();
                console.error(e);
                await window.showAlert({ title: 'Erreur', message: 'Échec de la traduction. ' + e.message });
            }
        } else {
            const newDisplayName = document.getElementById('input-duplicate-name').value;
            if (!newDisplayName) {
                await window.showAlert({ title: 'Attention', message: 'Veuillez saisir un nom pour la copie.' });
                showOpeningPopup();
                return;
            }
            try {
                window.showLoading('Copie du projet en cours...');
                const response = await fetch(`/api/project/${fullName}`);
                const sourceProject = await response.json();
                
                const originalParts = fullName.replace(`school-${schoolId}__`, '').split('__');
                const lang = originalParts[1] || 'FR';

                const newFullName = `school-${schoolId}__${newDisplayName}__${lang}`;

                // ── CHANGED: wrap copied HTML in full document with SEO ──────
                const sourceProps = sourceProject.properties || {};
                const finalHtml = buildFinalHtml(sourceProject.html || '', sourceProject.css || '', sourceProps);

                const projectData = { 
                    projectName: newFullName, 
                    html: finalHtml,           // full HTML with SEO meta tags
                    css: sourceProject.css, 
                    projectData: sourceProject.project_data 
                };

                const { body: duplicateBody } = await publishInlineImagesInString(JSON.stringify(projectData), newFullName);
                const saveRes = await fetch('/api/save', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: duplicateBody
                });
                if (!saveRes.ok) throw new Error(await saveRes.text());
                
                window.hideLoading();
                const userChoice = await new Promise(resolve => {
                    window.openModal({
                        title: 'Succès',
                        body: `<p class="modal-message">Projet copié avec succès !</p>`,
                        actions: [
                            { label: 'Ouvrir la copie', className: 'btn-primary', onClick: () => { window.closeModal(); resolve(true); } },
                            { label: 'Fermer', className: 'btn-secondary', onClick: () => { window.closeModal(); resolve(false); } }
                        ]
                    });
                });
                if (userChoice) {
                    window.editProject(newFullName, newDisplayName);
                } else {
                    showOpeningPopup(); // Refresh dashboard
                }
            } catch (e) {
                window.hideLoading();
                console.error(e);
                await window.showAlert({ title: 'Erreur', message: 'Échec de la copie. ' + e.message });
            }
        }
    };
};
// ── SEO Settings from Dashboard ─────────────────────────────────────────────
const _seoModal   = document.getElementById('seo-settings-modal');
const _seoStatus  = document.getElementById('seo-settings-status');

document.getElementById('btn-close-seo-settings').onclick = () => _seoModal.classList.add('hidden');
document.getElementById('btn-seo-settings-cancel').onclick = () => _seoModal.classList.add('hidden');

// Character counters and live preview setup
const setupSeoSettingsListeners = () => {
    const titleInput = document.getElementById('seo-settings-meta-title');
    const descInput = document.getElementById('seo-settings-meta-desc');
    const canonicalInput = document.getElementById('seo-settings-canonical');
    const internalTitleInput = document.getElementById('seo-settings-title');

    if (titleInput && descInput) {
        ['input', 'change', 'keyup'].forEach(event => {
            titleInput.addEventListener(event, () => {
                updateFieldStatus(titleInput, document.getElementById('seo-settings-title-counter'), 50, 60);
                updateGooglePreview('seo-settings');
            });
            descInput.addEventListener(event, () => {
                updateFieldStatus(descInput, document.getElementById('seo-settings-desc-counter'), 120, 160);
                updateGooglePreview('seo-settings');
            });
            if (canonicalInput) {
                canonicalInput.addEventListener(event, () => updateGooglePreview('seo-settings'));
            }
            if (internalTitleInput) {
                internalTitleInput.addEventListener(event, () => updateGooglePreview('seo-settings'));
            }
        });
    }
};
setupSeoSettingsListeners();

function _seoShowStatus(msg, type) {
    _seoStatus.style.display = 'block';
    _seoStatus.textContent = msg;
    if (type === 'success') {
        _seoStatus.style.background = '#D1FAE5';
        _seoStatus.style.color = '#065F46';
        _seoStatus.style.border = '1px solid #6EE7B7';
    } else if (type === 'error') {
        _seoStatus.style.background = '#FEE2E2';
        _seoStatus.style.color = '#991B1B';
        _seoStatus.style.border = '1px solid #FCA5A5';
    } else {
        _seoStatus.style.background = '#EFF6FF';
        _seoStatus.style.color = '#1D4ED8';
        _seoStatus.style.border = '1px solid #BFDBFE';
    }
}

function validateSeoCustomCode(taId, fbId) {
    const ta = document.getElementById(taId);
    const fb = document.getElementById(fbId);
    if (!ta || !fb) return;
    const code = ta.value.trim();
    if (!code) { fb.textContent = ''; return; }
    const open  = (code.match(/<script\b/gi) || []).length;
    const close = (code.match(/<\/script>/gi) || []).length;
    if (open !== close) {
        fb.textContent = `❌ Balise <script> non fermée (${open} ouvrante(s), ${close} fermante(s)).`;
        fb.style.color = '#c0392b';
        return;
    }
    const providers = [
        { re: /googletagmanager\.com\/gtm|GTM-[A-Z0-9]/i, name: 'Google Tag Manager' },
        { re: /gtag\(|googletagmanager\.com\/gtag|\bG-[A-Z0-9]{6,}/i, name: 'Google Analytics (GA4)' },
        { re: /connect\.facebook\.net|fbq\(/i, name: 'Meta Pixel' },
        { re: /snap\.licdn\.com|_linkedin_partner_id/i, name: 'LinkedIn' },
        { re: /analytics\.tiktok\.com|\bttq\./i, name: 'TikTok' },
        { re: /static\.hotjar\.com|\bhj\(/i, name: 'Hotjar' }
    ];
    const found = providers.filter(p => p.re.test(code)).map(p => p.name);
    if (found.length) {
        fb.textContent = '✅ Détecté : ' + found.join(', ');
        fb.style.color = '#1a7a5e';
    } else {
        fb.textContent = '⚠️ Aucun outil connu détecté — vérifie que le code est correct.';
        fb.style.color = '#b7791f';
    }
}
['seo-settings-head-code', 'seo-settings-body-code'].forEach(id => {
    const ta = document.getElementById(id);
    if (ta) ta.addEventListener('input', () => validateSeoCustomCode(id, id + '-feedback'));
});

window.openSeoSettings = async (projectName) => {
    // Reset
    _seoStatus.style.display = 'none';
    document.getElementById('seo-settings-title').value = '';
    document.getElementById('seo-settings-meta-title').value = '';
    document.getElementById('seo-settings-meta-desc').value = '';
    document.getElementById('seo-settings-keywords').value = '';
    document.getElementById('seo-settings-canonical').value = '';
    document.getElementById('seo-settings-title-counter').textContent = '0 / 60';
    document.getElementById('seo-settings-desc-counter').textContent = '0 / 160';
    document.getElementById('seo-settings-project-name').value = projectName;
    document.getElementById('btn-seo-settings-save').disabled = false;
    document.getElementById('btn-seo-settings-save').innerHTML = '<i class="fas fa-save" style="margin-right: 6px;"></i> Sauvegarder le SEO';

    _seoModal.classList.remove('hidden');
    _seoShowStatus('Chargement des données...', 'info');

    try {
        const nameParts = projectName.split('__');
        const displayName = nameParts.length > 1 ? nameParts[1] : projectName;

        // Charger en parallèle le projet et l'historique SEO
        const [projRes, histRes] = await Promise.all([
            fetch(`/api/project/${encodeURIComponent(projectName)}`),
            fetch(`/api/seo-history?projectName=${encodeURIComponent(projectName)}`)
        ]);

        if (!projRes.ok) throw new Error('Projet introuvable');
        const project = await projRes.json();
        const props = project.properties || {};

        // seo_history est la source de vérité : on l'utilise en priorité
        let seoProps = {};
        if (histRes.ok) {
            const histText = await histRes.text();
            if (!histText.startsWith('<!DOCTYPE') && !histText.startsWith('<html')) {
                const hist = JSON.parse(histText);
                if (hist && hist.length > 0) {
                    seoProps = hist[0].properties || {};
                }
            }
        }

        // Fusionner : seo_history prime sur project.properties,
        // MAIS seulement pour les champs non-vides (une valeur "" dans l'historique
        // signifie "jamais renseigné", pas "vidé intentionnellement au niveau du modal")
        const merged = { ...props };
        Object.entries(seoProps).forEach(([k, v]) => {
            if (v !== '' && v !== null && v !== undefined) merged[k] = v;
        });

        document.getElementById('seo-settings-title').value       = merged.title || displayName;
        document.getElementById('seo-settings-meta-title').value  = merged.seoTitle || merged.title || displayName;
        document.getElementById('seo-settings-meta-desc').value   = merged.seoDescription || '';
        document.getElementById('seo-settings-keywords').value    = merged.keywords || '';
        document.getElementById('seo-settings-canonical').value   = merged.canonical || '';
        document.getElementById('seo-settings-head-code').value   = merged.pageHeadCode || '';
        document.getElementById('seo-settings-body-code').value   = merged.pageBodyCode || '';
        validateSeoCustomCode('seo-settings-head-code', 'seo-settings-head-code-feedback');
        validateSeoCustomCode('seo-settings-body-code', 'seo-settings-body-code-feedback');

        updateFieldStatus(document.getElementById('seo-settings-meta-title'), document.getElementById('seo-settings-title-counter'), 50, 60);
        updateFieldStatus(document.getElementById('seo-settings-meta-desc'), document.getElementById('seo-settings-desc-counter'), 120, 160);
        updateGooglePreview('seo-settings');

        _seoStatus.style.display = 'none';
    } catch(e) {
        _seoShowStatus('Erreur lors du chargement : ' + e.message, 'error');
    }
};

document.getElementById('btn-seo-settings-save').onclick = async () => {
    const projectName = document.getElementById('seo-settings-project-name').value;
    if (!projectName) return;

    const newProps = {
        title:          document.getElementById('seo-settings-title').value.trim(),
        seoTitle:       document.getElementById('seo-settings-meta-title').value.trim(),
        seoDescription: document.getElementById('seo-settings-meta-desc').value.trim(),
        keywords:       document.getElementById('seo-settings-keywords').value.trim(),
        canonical:      document.getElementById('seo-settings-canonical').value.trim(),
        pageHeadCode:   document.getElementById('seo-settings-head-code').value,
        pageBodyCode:   document.getElementById('seo-settings-body-code').value,
    };

    // Mettre à jour l'objet en mémoire pour ne pas l'écraser lors d'un "Save" ultérieur
    Object.assign(currentProjectProperties, newProps);


    const btn = document.getElementById('btn-seo-settings-save');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i> Sauvegarde...';
    _seoShowStatus('Sauvegarde en cours...', 'info');

    try {
        const res = await fetch('/api/save-seo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName, properties: newProps })
        });
        if (!res.ok) throw new Error(await res.text());

        // ── Synchroniser l'URL et le badge SFMC si le titre a changé ──────────
        // Le project_name a le format : school-<id>__<DisplayName>[__<LANG>]
        // Si le titre est modifié, on renomme project_name pour garder la cohérence
        // entre l'URL (?project=), le badge "Nom SFMC" et properties.title.
        const newTitle = newProps.title;
        if (newTitle) {
            // IMPORTANT : on utilise (.+?) lazy + ((?:__[A-Z]{2})?)$ pour gérer
            // les noms contenant des underscores (ex: test_efap, my_page, etc.)
            const nameParts    = projectName.match(/^(school-[a-z0-9-]+__)(.+?)((?:__[A-Z]{2})?)$/i);
            const currentTitle = nameParts ? nameParts[2] : null;
            if (nameParts && currentTitle && currentTitle !== newTitle) {
                const newProjectName = nameParts[1] + newTitle + nameParts[3];
                try {
                    const renameRes = await fetch('/api/project/rename', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ oldName: projectName, newName: newProjectName })
                    });
                    if (renameRes.ok) {
                        // Mettre à jour le hidden input pour éviter un double-rename si on clique encore
                        const pnInput = document.getElementById('seo-settings-project-name');
                        if (pnInput) pnInput.value = newProjectName;
                        // Mettre à jour le localStorage → badge SFMC + URL
                        const schoolId = window.CURRENT_SCHOOL?.id
                            || new URLSearchParams(window.location.search).get('school')?.toLowerCase();
                        if (schoolId) {
                            localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, newProjectName);
                            localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, newTitle);
                        }
                        updatePageIdBadge();
                    }
                } catch (renameErr) {
                    console.warn('[SEO] Renommage échoué (non bloquant) :', renameErr.message);
                }
            }
        }

        _seoShowStatus('✅ SEO sauvegardé ! L\'envoi vers SFMC se fait en arrière-plan.', 'success');
        btn.innerHTML = '<i class="fas fa-check" style="margin-right: 6px;"></i> Sauvegardé !';
        btn.style.background = '#059669';
        setTimeout(() => {
            _seoModal.classList.add('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save" style="margin-right: 6px;"></i> Sauvegarder le SEO';
            btn.style.background = '';
        }, 2000);
    } catch(e) {
        _seoShowStatus('❌ Erreur : ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save" style="margin-right: 6px;"></i> Sauvegarder le SEO';
    }
};
