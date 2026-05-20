import { initStorage } from './storage.js';
import { initExport } from './export.js';
import { initAiAssistant } from './ai-assistant.js';
import { registerBlocks } from '../blocks/index.js';
import { FormGenerator } from './form-generator.js';

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

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school');
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
            CURRENT_SCHOOL = { id: 'master', name: 'MASTER', color: '#c9b87a', secondaryColor: '#1a1a1a', defaultBlocks: [] };
            updateSchoolUI(CURRENT_SCHOOL);
            injectBrandVariables(null, CURRENT_SCHOOL, true);
        }
    } catch (e) { console.error('Failed to load school config', e); }

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
                populateProperties(project.properties || {});
                currentProjectIsNew = false;
                currentStructuredPageId = project.page_id || null;
                localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, projectParam);
                const parts = projectParam.replace(/^school-[a-z0-9-]+__/, '').split('__');
                localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, parts[0] || projectParam);
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

    const { page, versions = [] } = await res.json();
    const version = getCurrentVersion(page, versions);
    if (!version) throw new Error('Aucune version disponible pour cette page.');

    const projectData = parseProjectData(version.project_data);
    if (Object.keys(projectData).length) {
        window.editor.loadProjectData(projectData);
    } else {
        window.editor.setComponents(extractBodyHtml(version.html || ''));
        window.editor.setStyle(version.css || '');
    }

    const legacyProjectName = page.metadata?.legacyProjectName || '';
    const displayName = page.title || legacyProjectName || 'Projet';
    const language = page.language || 'FR';

    populateProperties(propertiesFromStructuredPage(page));
    currentProjectIsNew = false;
    currentStructuredPageId = page.id;
    currentProjectLanguage = language;
    document.getElementById('language-switcher').value = language;

    localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, displayName);
    if (legacyProjectName) {
        localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, legacyProjectName);
    } else {
        localStorage.removeItem(`reetain-builder__${schoolId}__currentFullName`);
    }

    const overlay = document.getElementById('welcome-overlay');
    if (overlay) overlay.classList.add('hidden');
    const openModal = document.getElementById('school-open-modal');
    if (openModal) openModal.classList.add('hidden');
}

function initEditor(schoolId) {
    const editor = grapesjs.init({
        container: '#gjs',
        height: '100%',
        width: 'auto',
        storageManager: {
            type: 'local',
            autosave: true,
            stepsBeforeSave: 1,
            key: `reetain-builder__${schoolId}__gjsProject`,
        },
        blockManager: { appendTo: '#blocks' },
        styleManager: { appendTo: '#styles-container' },
        layerManager: { appendTo: '#layers-container' },
        traitManager: { appendTo: '#traits-container' },
        panels: { defaults: [] },
        deviceManager: {
            devices: [
                { name: 'Desktop', width: '' },
                { name: 'Tablet', width: '600px', widthMedia: '600px' },
                { name: 'Mobile', width: '375px', widthMedia: '375px' },
            ],
        },
    });

    initUI(editor);
    initBlockThumbnailMedia(editor);
    initStorage(editor);
    initExport(editor);
    initAiAssistant(editor);
    registerBlocks(editor);

    editor.on('load', () => {
        filterBlocksBySchool(editor, schoolId);
        injectBrandVariables(editor, CURRENT_SCHOOL);
        loadCustomComponents(editor, schoolId);

        // Au lieu de charger directement le template, on affiche la popup de choix
        const params = new URLSearchParams(window.location.search);
        if (!params.get('project')) {
            showOpeningPopup();
        }
    });

    if (schoolId === 'icart') initIcartSpecifics(editor);
    window.editor = editor;
}

// ── Page Properties state ───────────────────────────────────────────────────
let currentProjectProperties = {
    title: '', description: '',
    seoTitle: '', seoDescription: '', keywords: '', canonical: '',
    schemaLd: ''
};

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

    // Modal SEO Counters
    const bindModalCounter = (inputId, counterId, min, max) => {
        const el = document.getElementById(inputId);
        const cnt = document.getElementById(counterId);
        if (!el || !cnt) return;
        const update = () => {
            const len = el.value.length;
            cnt.textContent = `${len} / ${max}`;
            cnt.style.color = len > max ? '#ef4444' : len >= min ? '#10b981' : '#6b7280';
        };
        el.addEventListener('input', update);
        update();
    };
    bindModalCounter('modal-seo-meta-title', 'modal-seo-title-counter', 50, 60);
    bindModalCounter('modal-seo-meta-desc', 'modal-seo-desc-counter', 120, 160);
}

function collectProperties() {
    return {
        title:          (document.getElementById('prop-title')?.value       || '').trim(),
        description:    (document.getElementById('prop-desc')?.value        || '').trim(),
        seoTitle:       (document.getElementById('prop-seo-title')?.value   || '').trim(),
        seoDescription: (document.getElementById('prop-seo-desc')?.value    || '').trim(),
        keywords:       (document.getElementById('prop-keywords')?.value    || '').trim(),
        canonical:      (document.getElementById('prop-canonical')?.value   || '').trim(),
        schemaLd:       (document.getElementById('prop-schema')?.value      || '').trim(),
    };
}

function populateProperties(props = {}) {
    const schoolId = CURRENT_SCHOOL?.id || 'unknown';
    const currentProjectSimpleName = localStorage.getItem(`reetain-builder__${schoolId}__currentProject`) || 'Nouveau Projet';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    
    // Elegant fallbacks using the current project name
    const pageTitle = (props.title || '').trim() || currentProjectSimpleName;
    const seoTitle = (props.seoTitle || '').trim() || pageTitle;
    const defaultDesc = `Page d'atterrissage officielle de l'école ${CURRENT_SCHOOL?.name || 'Reetain'}.`;
    const defaultSeoDesc = `Découvrez notre nouvelle page ${currentProjectSimpleName} pour l'école ${CURRENT_SCHOOL?.name || 'Reetain'}. Retrouvez toutes les informations.`;
    const defaultKeywords = `${CURRENT_SCHOOL?.name || 'école'}, formation, JPO, inscription`;

    set('prop-title',     pageTitle);
    set('prop-desc',      props.description || defaultDesc);
    set('prop-seo-title', seoTitle);
    set('prop-seo-desc',  props.seoDescription || defaultSeoDesc);
    set('prop-keywords',  props.keywords || defaultKeywords);
    set('prop-canonical', props.canonical);
    set('prop-schema',    props.schemaLd);
    
    // Re-trigger counters
    ['prop-seo-title', 'prop-seo-desc', 'prop-schema'].forEach(id => {
        document.getElementById(id)?.dispatchEvent(new Event('input'));
    });
}

// ── NEW: Build complete HTML with SEO meta tags injected into <head> ─────────
// This ensures SFMC receives a full HTML document with all SEO metadata,
// instead of raw GrapesJS body HTML without any <head> or meta tags.
function buildFinalHtml(bodyHtml, css, properties = {}) {
    bodyHtml = extractBodyHtml(bodyHtml);

    const title      = escapeHtml(properties.seoTitle || properties.title || '');
    const metaDesc   = escapeHtml(properties.seoDescription || '');
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

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${metaDesc}">
    <meta name="keywords" content="${keywords}">${canonicalTag}${schemaTag}
    <style>${css}</style>
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

function injectBrandVariables(editor, school, intoMainDoc = false) {
    if (!school) return;
    const primary = school.color || '#3b82f6';
    const secondary = school.secondaryColor || '#1a1a1a';
    const rgb = hexToRgb(primary) || '59, 130, 246';
    const css = `:root { --brand-primary: ${primary}; --brand-secondary: ${secondary}; --brand-primary-rgb: ${rgb}; }`;

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
        const doc = editor.Canvas.getDocument();
        if (doc) {
            let style = doc.getElementById('brand-variables');
            if (!style) {
                style = doc.createElement('style');
                style.id = 'brand-variables';
                doc.head.appendChild(style);
            }
            style.innerHTML = css;
        }
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
}

function filterBlocksBySchool(editor, schoolId) {
    if (!schoolId || schoolId === 'master') return;
    const bm = editor.BlockManager;
    const allBlocks = [...bm.getAll().models];
    const targetSchoolId = schoolId.toLowerCase();
    
    // List of all known schools in the ecosystem
    const allSchoolsList = [
        'efap', 'brassart', 'icart', 'efj', 'mopa', 'cread', 'esec', '3wa', 'ifa', 'bleue', 'cesine', 'creanavarra', 'miami'
    ];
    
    const otherSchools = allSchoolsList.filter(s => s !== targetSchoolId);
    const blocksToRemove = [];

    allBlocks.forEach(block => {
        const id = block.get('id').toLowerCase();
        const category = block.get('category');
        const categoryLabel = ((typeof category === 'object' ? category.get('id') : category) || '').toLowerCase();
        
        // 1. Check if the category belongs to another school (e.g. 'brassart components', 'efap components')
        const belongsToOtherSchoolCategory = otherSchools.some(school => 
            categoryLabel === `${school} components` || categoryLabel === school
        );
        
        // 2. Check if the block ID is school-specific and belongs to another school (e.g. 'header-brassart', 'footer-efap')
        const belongsToOtherSchoolId = otherSchools.some(school => {
            return id.endsWith(`-${school}`) || id.includes(`-${school}-`) || id === school;
        });

        const isRequiredByDefault = (CURRENT_SCHOOL?.defaultBlocks || []).includes(block.get('id'));

        if ((belongsToOtherSchoolCategory || belongsToOtherSchoolId) && !isRequiredByDefault) {
            blocksToRemove.push(block.get('id'));
        }
    });

    // Remove the blocks belonging to other schools
    blocksToRemove.forEach(id => bm.remove(id));
    
    bm.render();
}

async function loadCustomComponents(editor, schoolId) {
    if (!schoolId || schoolId === 'master') return;
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
        if (block) editor.addComponents(block.get('content'));
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

    // Devices
    document.getElementById('device-desktop').onclick = () => editor.setDevice('Desktop');
    document.getElementById('device-tablet').onclick = () => editor.setDevice('Tablet');
    document.getElementById('device-mobile').onclick = () => editor.setDevice('Mobile');

    // Language Switcher
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) {
        languageSwitcher.addEventListener('change', async (e) => {
            const newLang = e.target.value;
            
            // Only show dialog if language actually changed and project is open
            if (newLang !== currentProjectLanguage && !currentProjectIsNew) {
                const schoolId = CURRENT_SCHOOL?.id || 'unknown';
                const fullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);
                const projectNamePart = fullName.replace(`school-${schoolId}__`, '').split('__')[0];
                
                const choice = await new Promise(resolve => {
                    window.openModal({
                        title: 'Changement de langue',
                        body: `<p class="modal-message">Voulez-vous Changer la Langue actuelle en ${newLang}?</p>`,
                        actions: [
                            { label: 'Changer', className: 'btn-primary', onClick: () => { window.closeModal(); resolve('new'); } },
                            { label: 'Annuler', className: 'btn-secondary', onClick: () => { window.closeModal(); resolve('cancel'); } }
                        ]
                    });
                });

                if (choice === 'cancel') {
                    languageSwitcher.value = currentProjectLanguage;
                    return;
                }

                if (choice === 'new') {
                    // Create new version with different name
                    const newName = await window.showPrompt({ 
                        title: 'Nouveau nom pour la version en ' + newLang, 
                        message: 'Entrez un nom pour la nouvelle version :', 
                        placeholder: projectNamePart + '-' + newLang.toLowerCase(),
                        defaultValue: projectNamePart + '-' + newLang.toLowerCase()
                    });
                    
                    if (!newName) {
                        languageSwitcher.value = currentProjectLanguage;
                        return;
                    }
                    
                    // This will save as a new project
                    localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, newName);
                    localStorage.removeItem(`reetain-builder__${schoolId}__currentFullName`);
                    currentProjectIsNew = true;
                } else if (choice === 'replace') {
                    // Replace current version in new language - ensure it's treated as existing project
                    currentProjectIsNew = false;
                }
                
                // Trigger save with new language
                document.getElementById('btn-save').click();
            }
        });
    }

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
            currentProjectLanguage = 'FR';
            document.getElementById('language-switcher').value = 'FR';
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

    async function loadSchoolForms() {
        const container = document.getElementById('forms-list');
        if (!CURRENT_SCHOOL) return;

        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

        try {
            const response = await fetch(`/api/forms/${CURRENT_SCHOOL.id}`);
            const forms = await response.json();

            if (!Array.isArray(forms) || forms.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #6b7280;">
                    ${forms.error ? 'Erreur: ' + forms.error : 'Aucun formulaire trouvé.'}
                </div>`;
                return;
            }

            container.innerHTML = forms.map(f => {
                // Prepare form data for insertion
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
            container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #ef4444;">Erreur de chargement.</div>';
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

    // Save Component
    document.getElementById('btn-save-component').onclick = async () => {
        const html = editor.getHtml();
        const css = editor.getCss();
        
        if (!html || !html.trim()) {
            await showAlert({ title: 'Attention', message: 'Le canevas est vide. Veuillez ajouter des éléments avant de sauvegarder.' });
            return;
        }

        const name = await showPrompt({ title: 'Sauvegarder la page entière comme composant', message: 'Nom du composant :', placeholder: 'Mon Layout Complet' });
        if (!name) return;

        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        const contentStr = `<style>${css}</style>${html}`;

        const componentData = {
            school_id: schoolId,
            name: name,
            category: `${CURRENT_SCHOOL?.name || 'Custom'} Components`,
            content: contentStr
        };

        try {
            const res = await fetch('/api/components', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(componentData) 
            });
            if (!res.ok) throw new Error(await res.text());

            const resData = await res.json();
            const comp = resData.component;
            
            if (!comp) throw new Error("Données du composant manquantes dans la réponse.");

            // Add dynamically to block manager using the real Database ID
            const blockId = comp.id.toString().startsWith('db-') ? comp.id : `db-comp-${comp.id}`;
            const schoolName = (CURRENT_SCHOOL?.name || 'Custom').toUpperCase();
            const targetCategory = comp.category || `${schoolName} Components`;

            editor.BlockManager.add(blockId, {
                label: comp.name,
                category: targetCategory,
                content: comp.content, // HTML/CSS string
                media: `<div class="block-thumbnail"><div class="block-thumbnail__frame"><img class="block-thumbnail__image" src="assets/block-thumbnails/default.svg" alt="${escapeHtml(comp.name)}"></div></div>`
            });

            // Focus and open category
            const bm = editor.BlockManager;
            const category = bm.getCategories().find(c => c.get('id') === targetCategory);
            if (category) category.set('open', true);
            bm.render();

            await showAlert({ title: 'Succès', message: 'Composant sauvegardé dans Supabase et Salesforce ! Il est maintenant synchronisé avec la base de données.' });
        } catch (e) {
            console.error(e);
            await showAlert({ title: 'Erreur', message: 'Impossible de sauvegarder le composant. ' + e.message });
        }
    };

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
            const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
            hideLoading();
            if (!res.ok) throw new Error(await res.text());
            await showAlert({ title: 'Succès', message: 'Projet mis à jour avec succès et synchronisé avec Salesforce !' });
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
            const res = await fetch(`/api/content/pages/${encodeURIComponent(pageId)}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                })
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
        const selectedLanguage = document.getElementById('language-switcher').value || 'FR';

        if (!currentProjectIsNew) {
            // Existing project -> Show SEO Modal
            const fullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);
            if (!fullName) {
                if (currentStructuredPageId) {
                    await saveStructuredVersionOnly(currentStructuredPageId, selectedLanguage);
                    return;
                }
                await showAlert({ title: 'Erreur', message: 'Projet introuvable. Veuillez utiliser le Dashboard pour ouvrir une page.' });
                return;
            }

            // Extract original name and language
            const projectNamePart = fullName.replace(`school-${schoolId}__`, '').split('__')[0];
            const originalLanguage = fullName.split('__')[2] || 'FR';
            const newFullName = `school-${schoolId}__${projectNamePart}__${selectedLanguage}`;

            // Validate JSON-LD before sending
            const propsToSave = collectProperties();
            if (propsToSave.schemaLd) {
                try { JSON.parse(propsToSave.schemaLd); }
                catch (jsonErr) {
                    await showAlert({ title: 'JSON-LD invalide', message: 'Le champ Schema.org contient du JSON invalide.\n' + jsonErr.message });
                    return;
                }
            }

            let finalHtml = editor.getHtml();

            // If language changed, translate
            if (selectedLanguage !== originalLanguage && selectedLanguage !== 'FR') {
                try {
                    showLoading(`Traduction en cours vers ${selectedLanguage}... Cela peut prendre quelques secondes.`);
                    const translateRes = await fetch('/api/ai/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ html: finalHtml, targetLang: selectedLanguage })
                    });

                    if (!translateRes.ok) throw new Error(await translateRes.text());
                    const translateData = await translateRes.json();
                    finalHtml = translateData.html;
                    
                    // Update the canvas to show translated content
                    editor.setComponents(finalHtml);
                } catch (e) {
                    hideLoading();
                    console.error(e);
                    await showAlert({ title: 'Erreur', message: 'Échec de la traduction. ' + e.message });
                    return;
                }
            } else {
                showLoading('Sauvegarde en cours...');
            }

            // ── CHANGED: wrap body HTML in a full document with SEO <head> ──
            finalHtml = buildFinalHtml(finalHtml, editor.getCss(), propsToSave);

            const projectData = { 
                projectName: newFullName, 
                html: finalHtml,           // full HTML with SEO meta tags
                css: editor.getCss(), 
                projectData: editor.getProjectData(),
                properties: propsToSave
            };

            try {
                const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
                if (!res.ok) throw new Error(await res.text());
                
                // Update stored fullName to reflect language change
                localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, newFullName);
                currentProjectLanguage = selectedLanguage;
                
                hideLoading();
                await showAlert({ title: 'Succès', message: `Projet sauvegardé en ${selectedLanguage} !` });
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

                    // Start the translation & save process
                    let finalBodyHtml = editor.getHtml();
                    
                    if (lang !== 'FR') {
                        try {
                            showLoading(`Traduction en cours vers ${lang}... Cela peut prendre quelques secondes.`);
                            const translateRes = await fetch('/api/ai/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ html: finalBodyHtml, targetLang: lang })
                            });

                            if (!translateRes.ok) throw new Error(await translateRes.text());
                            const translateData = await translateRes.json();
                            finalBodyHtml = translateData.html;
                            editor.setComponents(finalBodyHtml);
                        } catch (e) {
                            hideLoading();
                            console.error(e);
                            await showAlert({ title: 'Erreur', message: 'Échec de la traduction. ' + e.message });
                            return;
                        }
                    } else {
                        showLoading('Sauvegarde en cours...');
                    }

                    const fullName = `school-${schoolId}__${nameInput}__${lang}`;
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
                    const finalHtml = buildFinalHtml(finalBodyHtml, editor.getCss(), propsToSave);

                    const projectData = { 
                        projectName: fullName, 
                        html: finalHtml,           // full HTML with SEO meta tags
                        css: editor.getCss(), 
                        projectData: editor.getProjectData(),
                        properties: propsToSave
                    };

                    try {
                        const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
                        if (!res.ok) throw new Error(await res.text());
                        
                        currentProjectIsNew = false;
                        currentProjectLanguage = lang;
                        document.getElementById('language-switcher').value = lang;
                        localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, fullName);
                        localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, nameInput);
                        
                        hideLoading();
                        
                        const userChoice = await new Promise(resolve => {
                            openModal({
                                title: 'Succès',
                                body: `<p class="modal-message">Nouveau projet sauvegardé${lang !== 'FR' ? ' et traduit' : ''} avec succès !</p>`,
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

    // Preview
    document.getElementById('btn-preview').onclick = async () => {
        const name = await getProjectName('Aperçu');
        if (!name) return;
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';

        const currentFullName = localStorage.getItem(`reetain-builder__${schoolId}__currentFullName`);
        const selectedLanguage = document.getElementById('language-switcher')?.value || currentProjectLanguage || 'FR';
        const previewProjectName = currentFullName || `school-${schoolId}__${name}__${selectedLanguage}`;

        if (!currentProjectIsNew && currentFullName) {
            window.open(`/preview/${encodeURIComponent(previewProjectName)}`, '_blank');
            return;
        }

        // New pages still need a temporary save before preview can resolve a URL.
        const propsToSave = collectProperties();
        const finalHtml = buildFinalHtml(editor.getHtml(), editor.getCss(), propsToSave);

        const projectData = { 
            projectName: previewProjectName,
            html: finalHtml,           // full HTML with SEO meta tags
            css: editor.getCss(), 
            projectData: editor.getProjectData() 
        };
        try {
            const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
            if (!res.ok) throw new Error(await res.text());
            window.open(`/preview/${encodeURIComponent(previewProjectName)}`, '_blank');
        } catch (e) { 
            console.error(e);
            await showAlert({ title: 'Erreur Preview', message: 'Impossible de générer l\'aperçu. La sauvegarde a échoué. ' + e.message });
        }
    };

    // Open Project
    document.getElementById('btn-open').onclick = async () => {
        try {
            const response = await fetch('/api/projects');
            const projects = await response.json();
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            const filtered = projects.filter(p => p.project_name.startsWith(`school-${schoolId}__`));
            
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
            // Populate SEO / Properties panel
            populateProperties(project.properties || {});
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, displayName);
            localStorage.setItem(`reetain-builder__${schoolId}__currentFullName`, fullName);
            currentStructuredPageId = project.page_id || null;
            
            // Extract and set current language
            const parts = fullName.replace(`school-${schoolId}__`, '').split('__');
            const lang = parts[1] || 'FR';
            currentProjectLanguage = lang;
            document.getElementById('language-switcher').value = lang;
            
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
        const filtered = projects.filter(p => p.project_name.startsWith(`school-${schoolId}__`));
        
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
                    projectData: sourceProject.project_data 
                };

                const saveRes = await fetch('/api/save', { 
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) 
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

                const saveRes = await fetch('/api/save', { 
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) 
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
