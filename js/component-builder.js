/**
 * Visual Component Builder Module
 * Allows assembling custom blocks and saving them to Supabase for specific schools.
 */
export class ComponentBuilder {
    constructor(editor, defaultSchoolId, allSchools = []) {
        this.editor = editor;
        this.defaultSchoolId = defaultSchoolId || 'global';
        this.allSchools = allSchools;
        this.elements = [];
        this.styles = {
            backgroundColor: '#ffffff',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'left'
        };
        this.config = {
            name: '',
            category: 'Custom Components',
            schoolId: this.defaultSchoolId
        };
        this.activeElementId = null;
        this.modal = null;
    }

    open() {
        this.renderModal();
        this.attachEventListeners();
        this.renderPreview();
    }

    renderModal() {
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-overlay';
        modalContainer.id = 'component-builder-overlay';

        modalContainer.innerHTML = `
            <div class="cb-modal">
                <div class="cb-header">
                    <div class="cb-header-title">
                        <h2>Component Builder</h2>
                        <p>Assemblez des blocs de base pour créer un composant réutilisable.</p>
                    </div>
                    <div class="cb-actions">
                        <button class="btn-cancel" id="cb-close">Annuler</button>
                        <button class="btn-primary" id="cb-save">
                            <i class="fas fa-save"></i> Sauvegarder
                        </button>
                    </div>
                </div>
                <div class="cb-main">
                    <aside class="cb-sidebar">
                        <div class="cb-sidebar-tabs">
                            <button class="cb-sidebar-tab active" data-cb-tab="elements">Éléments</button>
                            <button class="cb-sidebar-tab" data-cb-tab="style">Style Global</button>
                            <button class="cb-sidebar-tab" data-cb-tab="config">Configuration</button>
                        </div>
                        
                        <!-- Onglet Éléments -->
                        <div class="cb-sidebar-content" id="cb-tab-elements">
                            <div class="section-label" style="margin-bottom: 10px; font-weight: bold;">Ajouter un élément</div>
                            <div class="cb-field-library">
                                <div class="cb-field-item" data-type="title">
                                    <div class="cb-field-icon"><i class="fas fa-heading"></i></div>
                                    <span>Titre</span>
                                </div>
                                <div class="cb-field-item" data-type="text">
                                    <div class="cb-field-icon"><i class="fas fa-paragraph"></i></div>
                                    <span>Texte</span>
                                </div>
                                <div class="cb-field-item" data-type="list">
                                    <div class="cb-field-icon"><i class="fas fa-list"></i></div>
                                    <span>Liste</span>
                                </div>
                                <div class="cb-field-item" data-type="button">
                                    <div class="cb-field-icon"><i class="fas fa-square"></i></div>
                                    <span>Bouton</span>
                                </div>
                                <div class="cb-field-item" data-type="image">
                                    <div class="cb-field-icon"><i class="fas fa-image"></i></div>
                                    <span>Image</span>
                                </div>
                                <div class="cb-field-item" data-type="two-column">
                                    <div class="cb-field-icon"><i class="fas fa-columns"></i></div>
                                    <span>2 Colonnes</span>
                                </div>
                                <div class="cb-field-item" data-type="card">
                                    <div class="cb-field-icon"><i class="fas fa-address-card"></i></div>
                                    <span>Carte</span>
                                </div>
                                <div class="cb-field-item" data-type="quote">
                                    <div class="cb-field-icon"><i class="fas fa-quote-left"></i></div>
                                    <span>Citation</span>
                                </div>
                                <div class="cb-field-item" data-type="badge">
                                    <div class="cb-field-icon"><i class="fas fa-tag"></i></div>
                                    <span>Badge</span>
                                </div>
                                <div class="cb-field-item" data-type="divider">
                                    <div class="cb-field-icon"><i class="fas fa-minus"></i></div>
                                    <span>Séparateur</span>
                                </div>
                                <div class="cb-field-item" data-type="spacer">
                                    <div class="cb-field-icon"><i class="fas fa-ruler-vertical"></i></div>
                                    <span>Espace</span>
                                </div>
                            </div>
                            <div id="cb-element-properties" class="hidden" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                                <!-- Propriétés de l'élément sélectionné -->
                            </div>
                        </div>

                        <!-- Onglet Style Global -->
                        <div class="cb-sidebar-content hidden" id="cb-tab-style">
                            <div class="cb-control-group">
                                <label>Couleur de fond</label>
                                <input type="color" id="style-backgroundColor" value="${this.styles.backgroundColor}">
                            </div>
                            <div class="cb-control-group">
                                <label>Padding (ex: 20px)</label>
                                <input type="text" id="style-padding" value="${this.styles.padding}">
                            </div>
                            <div class="cb-control-group">
                                <label>Rayon des bordures (px)</label>
                                <input type="number" id="style-borderRadius" value="${parseInt(this.styles.borderRadius)}">
                            </div>
                            <div class="cb-control-group">
                                <label>Alignement du texte</label>
                                <select id="style-textAlign">
                                    <option value="left" ${this.styles.textAlign === 'left' ? 'selected' : ''}>Gauche</option>
                                    <option value="center" ${this.styles.textAlign === 'center' ? 'selected' : ''}>Centre</option>
                                    <option value="right" ${this.styles.textAlign === 'right' ? 'selected' : ''}>Droite</option>
                                </select>
                            </div>
                        </div>

                        <!-- Onglet Configuration -->
                        <div class="cb-sidebar-content hidden" id="cb-tab-config">
                            <div class="cb-control-group">
                                <label>Nom du composant</label>
                                <input type="text" id="config-name" placeholder="ex: Mon Super Bloc" value="${this.config.name}">
                            </div>
                            <div class="cb-control-group">
                                <label>Catégorie</label>
                                <input type="text" id="config-category" placeholder="ex: Custom Components" value="${this.config.category}">
                            </div>
                            <div class="cb-control-group">
                                <label>École cible</label>
                                <select id="config-schoolId">
                                    <option value="global" ${this.config.schoolId === 'global' ? 'selected' : ''}>Toutes (Global)</option>
                                    ${this.allSchools.map(school => `
                                        <option value="${school.id}" ${this.config.schoolId === school.id ? 'selected' : ''}>${school.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    </aside>
                    <main class="cb-preview-area">
                        <div class="cb-form-preview" id="cb-preview-container">
                            <!-- Live Preview -->
                        </div>
                    </main>
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer);
        this.modal = modalContainer;
    }

    attachEventListeners() {
        // Fermer la modale
        this.modal.querySelector('#cb-close').onclick = () => {
            this.modal.remove();
        };

        // Gestion des onglets
        this.modal.querySelectorAll('.cb-sidebar-tab').forEach(tab => {
            tab.onclick = () => {
                this.modal.querySelectorAll('.cb-sidebar-tab').forEach(t => t.classList.remove('active'));
                this.modal.querySelectorAll('.cb-sidebar-content').forEach(c => c.classList.add('hidden'));
                tab.classList.add('active');
                this.modal.querySelector(`#cb-tab-${tab.dataset.cbTab}`).classList.remove('hidden');
            };
        });

        // Ajouter un élément
        this.modal.querySelectorAll('.cb-field-item').forEach(item => {
            item.onclick = () => {
                this.addElement(item.dataset.type);
            };
        });

        // Mise à jour des styles globaux
        ['backgroundColor', 'padding', 'borderRadius', 'textAlign'].forEach(prop => {
            const input = this.modal.querySelector(`#style-${prop}`);
            if (input) {
                input.oninput = (e) => {
                    let val = e.target.value;
                    if (prop === 'borderRadius') val += 'px';
                    this.styles[prop] = val;
                    this.renderPreview();
                };
            }
        });

        // Sauvegarder
        this.modal.querySelector('#cb-save').onclick = () => {
            this.handleSave();
        };
    }

    addElement(type) {
        const id = 'el_' + Math.random().toString(36).substr(2, 9);
        const el = { id, type };

        switch (type) {
            case 'title':
                el.content = 'Nouveau Titre';
                el.tag = 'h2';
                el.color = '#111827';
                break;
            case 'text':
                el.content = 'Ceci est un paragraphe de texte par défaut.';
                el.color = '#4b5563';
                break;
            case 'list':
                el.content = '<li>Élément 1</li>\n<li>Élément 2</li>\n<li>Élément 3</li>';
                el.color = '#4b5563';
                break;
            case 'button':
                el.content = 'Cliquez-moi';
                el.href = '#';
                el.bgColor = '#3b82f6';
                el.textColor = '#ffffff';
                break;
            case 'image':
                el.src = 'https://via.placeholder.com/600x300';
                el.alt = 'Placeholder Image';
                break;
            case 'card':
                el.content = 'Titre de la carte';
                el.rightContent = 'Description de la carte. Vous pouvez modifier ce texte.';
                el.src = 'https://via.placeholder.com/350x200';
                el.bgColor = '#ffffff';
                el.color = '#111827';
                break;
            case 'quote':
                el.content = 'Ceci est une citation inspirante.';
                el.color = '#4b5563';
                el.bgColor = '#f9fafb';
                break;
            case 'badge':
                el.content = 'Nouveau';
                el.bgColor = '#3b82f6';
                el.textColor = '#ffffff';
                break;
            case 'two-column':
                el.leftContent = 'Contenu colonne gauche (HTML autorisé)';
                el.rightContent = 'Contenu colonne droite (HTML autorisé)';
                el.color = '#4b5563';
                break;
            case 'divider':
                el.color = '#e5e7eb';
                break;
            case 'spacer':
                el.height = '50';
                break;
        }

        this.elements.push(el);
        this.activeElementId = id;
        this.renderPreview();
        this.renderElementProperties(el);
    }

    renderElementProperties(el) {
        const propsContainer = this.modal.querySelector('#cb-element-properties');
        propsContainer.classList.remove('hidden');
        
        let html = `<div style="font-weight:bold; margin-bottom:10px;">Propriétés de l'élément</div>`;
        
        if (el.type === 'title' || el.type === 'text' || el.type === 'list') {
            html += `
                <div class="cb-control-group">
                    <label>Contenu ${el.type === 'list' ? '(Balises &lt;li&gt; requises)' : ''}</label>
                    <textarea id="prop-content" rows="4">${el.content}</textarea>
                </div>
                <div class="cb-control-group">
                    <label>Couleur du texte</label>
                    <input type="color" id="prop-color" value="${el.color}">
                </div>
            `;
            if (el.type === 'title') {
                html += `
                    <div class="cb-control-group">
                        <label>Taille (Balise)</label>
                        <select id="prop-tag">
                            <option value="h1" ${el.tag === 'h1' ? 'selected' : ''}>Titre 1 (H1)</option>
                            <option value="h2" ${el.tag === 'h2' ? 'selected' : ''}>Titre 2 (H2)</option>
                            <option value="h3" ${el.tag === 'h3' ? 'selected' : ''}>Titre 3 (H3)</option>
                        </select>
                    </div>
                `;
            }
        } else if (el.type === 'two-column') {
            html += `
                <div class="cb-control-group">
                    <label>Contenu Gauche</label>
                    <textarea id="prop-leftContent" rows="3">${el.leftContent}</textarea>
                </div>
                <div class="cb-control-group">
                    <label>Contenu Droite</label>
                    <textarea id="prop-rightContent" rows="3">${el.rightContent}</textarea>
                </div>
                <div class="cb-control-group">
                    <label>Couleur du texte</label>
                    <input type="color" id="prop-color" value="${el.color}">
                </div>
            `;
        } else if (el.type === 'button') {
            html += `
                <div class="cb-control-group">
                    <label>Texte du bouton</label>
                    <input type="text" id="prop-content" value="${el.content}">
                </div>
                <div class="cb-control-group">
                    <label>Lien (URL)</label>
                    <input type="text" id="prop-href" value="${el.href}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur de fond</label>
                    <input type="color" id="prop-bgColor" value="${el.bgColor}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur du texte</label>
                    <input type="color" id="prop-textColor" value="${el.textColor}">
                </div>
            `;
        } else if (el.type === 'image') {
            html += `
                <div class="cb-control-group">
                    <label>URL de l'image</label>
                    <input type="text" id="prop-src" value="${el.src}">
                </div>
                <div class="cb-control-group">
                    <label>Texte alternatif (Alt)</label>
                    <input type="text" id="prop-alt" value="${el.alt}">
                </div>
            `;
        } else if (el.type === 'card') {
            html += `
                <div class="cb-control-group">
                    <label>Titre de la carte</label>
                    <input type="text" id="prop-content" value="${el.content}">
                </div>
                <div class="cb-control-group">
                    <label>Description</label>
                    <textarea id="prop-rightContent" rows="3">${el.rightContent}</textarea>
                </div>
                <div class="cb-control-group">
                    <label>URL de l'image</label>
                    <input type="text" id="prop-src" value="${el.src}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur de fond</label>
                    <input type="color" id="prop-bgColor" value="${el.bgColor}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur du texte</label>
                    <input type="color" id="prop-color" value="${el.color}">
                </div>
            `;
        } else if (el.type === 'quote') {
            html += `
                <div class="cb-control-group">
                    <label>Citation</label>
                    <textarea id="prop-content" rows="3">${el.content}</textarea>
                </div>
                <div class="cb-control-group">
                    <label>Couleur du texte</label>
                    <input type="color" id="prop-color" value="${el.color}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur de fond</label>
                    <input type="color" id="prop-bgColor" value="${el.bgColor}">
                </div>
            `;
        } else if (el.type === 'badge') {
            html += `
                <div class="cb-control-group">
                    <label>Texte du badge</label>
                    <input type="text" id="prop-content" value="${el.content}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur de fond</label>
                    <input type="color" id="prop-bgColor" value="${el.bgColor}">
                </div>
                <div class="cb-control-group">
                    <label>Couleur du texte</label>
                    <input type="color" id="prop-textColor" value="${el.textColor}">
                </div>
            `;
        } else if (el.type === 'divider') {
            html += `
                <div class="cb-control-group">
                    <label>Couleur de la ligne</label>
                    <input type="color" id="prop-color" value="${el.color}">
                </div>
            `;
        } else if (el.type === 'spacer') {
            html += `
                <div class="cb-control-group">
                    <label>Hauteur (px)</label>
                    <input type="number" id="prop-height" value="${el.height}">
                </div>
            `;
        }

        html += `
            <button class="btn-cancel" id="prop-delete" style="width: 100%; color: #ef4444; border-color: #fecaca; margin-top: 10px;">
                Supprimer l'élément
            </button>
        `;

        propsContainer.innerHTML = html;

        // Écouteurs d'événements pour les propriétés
        ['content', 'leftContent', 'rightContent', 'color', 'tag', 'href', 'bgColor', 'textColor', 'src', 'alt', 'height'].forEach(prop => {
            const input = propsContainer.querySelector(`#prop-${prop}`);
            if (input) {
                input.oninput = (e) => {
                    el[prop] = e.target.value;
                    this.renderPreview();
                };
            }
        });

        propsContainer.querySelector('#prop-delete').onclick = () => {
            this.elements = this.elements.filter(e => e.id !== el.id);
            propsContainer.classList.add('hidden');
            this.renderPreview();
        };
    }

    renderPreview() {
        const container = this.modal.querySelector('#cb-preview-container');
        
        container.style.backgroundColor = this.styles.backgroundColor;
        container.style.padding = this.styles.padding;
        container.style.borderRadius = this.styles.borderRadius;
        container.style.textAlign = this.styles.textAlign;

        if (this.elements.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: #9ca3af; border: 2px dashed #d1d5db; border-radius: 8px;">
                <i class="fas fa-plus-circle" style="font-size: 2rem; margin-bottom: 10px"></i>
                <p>Cliquez sur un élément à gauche pour commencer</p>
            </div>`;
            return;
        }

        let html = '';
        this.elements.forEach(el => {
            const activeClass = el.id === this.activeElementId ? 'active' : '';
            html += `<div class="preview-element-container ${activeClass}" onclick="window.cb_selectElement('${el.id}')">`;
            
            if (el.type === 'title') {
                html += `<${el.tag} style="color: ${el.color}; margin-top: 0;">${el.content}</${el.tag}>`;
            } else if (el.type === 'text') {
                html += `<p style="color: ${el.color};">${el.content}</p>`;
            } else if (el.type === 'list') {
                html += `<ul style="color: ${el.color}; padding-left: 20px;">${el.content}</ul>`;
            } else if (el.type === 'button') {
                html += `<a href="${el.href}" style="display: inline-block; padding: 10px 20px; background-color: ${el.bgColor}; color: ${el.textColor}; text-decoration: none; border-radius: 4px; font-weight: bold; pointer-events: none;">${el.content}</a>`;
            } else if (el.type === 'image') {
                html += `<img src="${el.src}" alt="${el.alt}" style="max-width: 100%; height: auto; border-radius: 4px;">`;
            } else if (el.type === 'card') {
                html += `<div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: ${el.bgColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 350px;">
                    <img src="${el.src}" style="width: 100%; height: 200px; object-fit: cover; display: block;">
                    <div style="padding: 20px;">
                        <h3 style="margin-top: 0; margin-bottom: 10px; color: ${el.color}; font-size: 20px;">${el.content}</h3>
                        <p style="color: #6b7280; margin: 0; line-height: 1.5;">${el.rightContent}</p>
                    </div>
                </div>`;
            } else if (el.type === 'quote') {
                html += `<blockquote style="font-size: 18px; font-style: italic; border-left: 4px solid #3b82f6; padding: 10px 20px; margin: 20px 0; color: ${el.color}; background-color: ${el.bgColor};">${el.content}</blockquote>`;
            } else if (el.type === 'badge') {
                html += `<span style="display: inline-block; padding: 4px 8px; background-color: ${el.bgColor}; color: ${el.textColor}; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${el.content}</span>`;
            } else if (el.type === 'divider') {
                html += `<hr style="border: 0; border-top: 1px solid ${el.color}; margin: 20px 0;">`;
            } else if (el.type === 'spacer') {
                html += `<div style="height: ${el.height}px; width: 100%; background: repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 10px, #ffffff 10px, #ffffff 20px); border: 1px dashed #d1d5db; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px;">Espace de ${el.height}px</div>`;
            } else if (el.type === 'two-column') {
                html += `<div style="display: flex; gap: 20px; color: ${el.color};">
                    <div style="flex: 1;">${el.leftContent}</div>
                    <div style="flex: 1;">${el.rightContent}</div>
                </div>`;
            }

            html += `
                <div class="element-actions">
                    <button class="element-action-btn delete" onclick="event.stopPropagation(); window.cb_deleteElement('${el.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        });

        container.innerHTML = html;

        window.cb_selectElement = (id) => {
            this.activeElementId = id;
            const el = this.elements.find(e => e.id === id);
            this.renderElementProperties(el);
            this.renderPreview();
        };

        window.cb_deleteElement = (id) => {
            this.elements = this.elements.filter(e => e.id !== id);
            this.renderPreview();
            this.modal.querySelector('#cb-element-properties').classList.add('hidden');
        };
    }

    async handleSave() {
        const name = this.modal.querySelector('#config-name').value.trim();
        const category = this.modal.querySelector('#config-category').value.trim() || 'Custom Components';
        const schoolId = this.modal.querySelector('#config-schoolId').value;

        if (!name) {
            alert('Veuillez donner un nom à votre composant.');
            return;
        }

        if (this.elements.length === 0) {
            alert('Votre composant est vide.');
            return;
        }

        // Génération du HTML final du composant
        let finalHtml = `<div style="background-color: ${this.styles.backgroundColor}; padding: ${this.styles.padding}; border-radius: ${this.styles.borderRadius}; text-align: ${this.styles.textAlign};">`;
        
        this.elements.forEach(el => {
            if (el.type === 'title') {
                finalHtml += `<${el.tag} style="color: ${el.color}; margin-top: 0;">${el.content}</${el.tag}>\n`;
            } else if (el.type === 'text') {
                finalHtml += `<p style="color: ${el.color}; margin: 0 0 15px 0;">${el.content}</p>\n`;
            } else if (el.type === 'list') {
                finalHtml += `<ul style="color: ${el.color}; padding-left: 20px; margin: 0 0 15px 0;">${el.content}</ul>\n`;
            } else if (el.type === 'button') {
                finalHtml += `<a href="${el.href}" style="display: inline-block; padding: 10px 20px; background-color: ${el.bgColor}; color: ${el.textColor}; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 10px; margin-bottom: 10px;">${el.content}</a>\n`;
            } else if (el.type === 'image') {
                finalHtml += `<img src="${el.src}" alt="${el.alt}" style="max-width: 100%; height: auto; border-radius: 4px; margin-top: 10px; margin-bottom: 10px;">\n`;
            } else if (el.type === 'card') {
                finalHtml += `<div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: ${el.bgColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 350px; margin-bottom: 15px;">
                    <img src="${el.src}" style="width: 100%; height: 200px; object-fit: cover; display: block;">
                    <div style="padding: 20px;">
                        <h3 style="margin-top: 0; margin-bottom: 10px; color: ${el.color}; font-size: 20px;">${el.content}</h3>
                        <p style="color: #6b7280; margin: 0; line-height: 1.5;">${el.rightContent}</p>
                    </div>
                </div>\n`;
            } else if (el.type === 'quote') {
                finalHtml += `<blockquote style="font-size: 18px; font-style: italic; border-left: 4px solid #3b82f6; padding: 10px 20px; margin: 20px 0; color: ${el.color}; background-color: ${el.bgColor};">${el.content}</blockquote>\n`;
            } else if (el.type === 'badge') {
                finalHtml += `<span style="display: inline-block; padding: 4px 8px; background-color: ${el.bgColor}; color: ${el.textColor}; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px;">${el.content}</span>\n`;
            } else if (el.type === 'divider') {
                finalHtml += `<hr style="border: 0; border-top: 1px solid ${el.color}; margin: 20px 0;">\n`;
            } else if (el.type === 'spacer') {
                finalHtml += `<div style="height: ${el.height}px; width: 100%;"></div>\n`;
            } else if (el.type === 'two-column') {
                finalHtml += `<div style="display: flex; gap: 20px; color: ${el.color}; margin: 0 0 15px 0;">
                    <div style="flex: 1;">${el.leftContent}</div>
                    <div style="flex: 1;">${el.rightContent}</div>
                </div>\n`;
            }
        });
        
        finalHtml += `</div>`;

        try {
            const btn = this.modal.querySelector('#cb-save');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';

            const payload = {
                school_id: schoolId,
                name: name,
                category: category,
                content: finalHtml,
                properties: { generatedBy: 'ComponentBuilder', elements: this.elements, styles: this.styles }
            };

            const response = await fetch('/api/components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Erreur lors de la sauvegarde');

            const result = await response.json();
            
            // Ajouter le composant à l'éditeur GrapesJS
            if (this.editor && (schoolId === 'global' || schoolId === this.defaultSchoolId)) {
                const compData = result.component;
                this.editor.BlockManager.add(`db-comp-${compData.id}`, {
                    label: compData.name,
                    category: compData.category,
                    content: compData.content
                });
            }

            alert('Composant sauvegardé avec succès ! Il est maintenant disponible dans la bibliothèque de blocs.');
            this.modal.remove();

        } catch (e) {
            console.error(e);
            alert('Erreur: ' + e.message);
            this.modal.querySelector('#cb-save').disabled = false;
            this.modal.querySelector('#cb-save').innerHTML = '<i class="fas fa-save"></i> Sauvegarder';
        }
    }
}
