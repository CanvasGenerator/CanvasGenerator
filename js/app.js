import { initStorage } from './storage.js';
import { initExport } from './export.js';
import { registerBlocks } from '../blocks/index.js';

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

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const schoolId = params.get('school');
    if (!schoolId) { window.location.href = 'school-selector.html'; return; }

    try {
        const response = await fetch(`/api/school/${schoolId}?v=${Date.now()}`);
        if (response.ok) {
            CURRENT_SCHOOL = await response.json();

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
});

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
    registerBlocks(editor);

    editor.on('load', () => {
        filterBlocksBySchool(editor, schoolId);
        injectBrandVariables(editor, CURRENT_SCHOOL);
        loadCustomComponents(editor, schoolId);

        const wrapper = editor.getWrapper();
        if (!wrapper || wrapper.components().length === 0) {
            loadDefaultTemplate(editor);
        }
    });

    if (schoolId === 'icart') initIcartSpecifics(editor);
    window.editor = editor;
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
    const allBlocks = bm.getAll().models;
    const targetSchoolName = schoolId.toUpperCase();
    const blocksToRemove = [];

    allBlocks.forEach(block => {
        const id = block.get('id');
        const category = block.get('category');
        const categoryLabel = (typeof category === 'object' ? category.get('id') : category) || '';
        const isTargetSchool = categoryLabel === `${targetSchoolName} Components`;
        const isOtherSchool = categoryLabel.includes(' Components') && !isTargetSchool;
        const isRequiredByDefault = (CURRENT_SCHOOL?.defaultBlocks || []).includes(id);

        if (isOtherSchool && !isRequiredByDefault) {
            blocksToRemove.push(id);
        }
    });

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
                content: typeof comp.content === 'string' ? JSON.parse(comp.content) : comp.content,
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

    modalCloseButton.onclick = closeModal;

    // Devices
    document.getElementById('device-desktop').onclick = () => editor.setDevice('Desktop');
    document.getElementById('device-tablet').onclick = () => editor.setDevice('Tablet');
    document.getElementById('device-mobile').onclick = () => editor.setDevice('Mobile');

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
            loadDefaultTemplate(editor);
        }
    };

    // Clear Canvas
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
            
            // Add dynamically to block manager
            editor.BlockManager.add(`custom-${Date.now()}`, {
                label: name,
                category: componentData.category,
                content: componentData.content,
                media: `<div class="block-thumbnail"><div class="block-thumbnail__frame"><img class="block-thumbnail__image" src="assets/block-thumbnails/default.svg" alt="${escapeHtml(name)}"></div></div>`
            });

            await showAlert({ title: 'Succès', message: 'Page entière sauvegardée comme composant et ajoutée aux blocs !' });
        } catch (e) {
            console.error(e);
            await showAlert({ title: 'Erreur', message: 'Impossible de sauvegarder le composant. ' + e.message });
        }
    };

    // Save Project
    document.getElementById('btn-save').onclick = async () => {
        const name = await getProjectName('Sauvegarder');
        if (!name) return;
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        const projectData = { projectName: `school-${schoolId}__${name}`, html: editor.getHtml(), css: editor.getCss(), projectData: editor.getProjectData() };
        try {
            const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
            if (!res.ok) throw new Error(await res.text());
            await showAlert({ title: 'Succès', message: 'Projet sauvegardé !' });
        } catch (e) { 
            console.error(e);
            await showAlert({ title: 'Erreur de sauvegarde', message: 'Impossible de sauvegarder le projet. ' + e.message });
        }
    };

    // Preview
    document.getElementById('btn-preview').onclick = async () => {
        const name = await getProjectName('Aperçu');
        if (!name) return;
        const schoolId = CURRENT_SCHOOL?.id || 'unknown';
        const projectData = { projectName: `school-${schoolId}__${name}`, html: editor.getHtml(), css: editor.getCss(), projectData: editor.getProjectData() };
        try {
            const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projectData) });
            if (!res.ok) throw new Error(await res.text());
            window.open(`/preview/school-${schoolId}__${name}`, '_blank');
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
            let listHtml = '<div class="project-list">';
            filtered.forEach(p => {
                const displayName = p.project_name.replace(`school-${schoolId}__`, '');
                listHtml += `<div class="project-row" style="cursor:pointer" onclick="window.loadProject('${p.project_name}', '${displayName}')"><strong>${displayName}</strong></div>`;
            });
            listHtml += '</div>';
            openModal({ title: 'Ouvrir un projet', body: listHtml });
        } catch (e) { console.error(e); }
    };

    window.loadProject = async (fullName, displayName) => {
        try {
            const response = await fetch(`/api/project/${fullName}`);
            const project = await response.json();
            editor.loadProjectData(JSON.parse(project.project_data));
            const schoolId = CURRENT_SCHOOL?.id || 'unknown';
            localStorage.setItem(`reetain-builder__${schoolId}__currentProject`, displayName);
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
