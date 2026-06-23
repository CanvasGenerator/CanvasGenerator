/**
 * Visual Form Generator Module
 * Handles visual building, styling, and SFMC/Supabase integration.
 */
export class FormGenerator {
    constructor(schoolId, schoolConfig) {
        this.schoolId = schoolId;
        this.schoolConfig = schoolConfig;
        this.fields = [];
        this.styles = {
            layout: '1-col',
            maxWidth: '600px',
            borderRadius: '8px',
            borderColor: '#e5e7eb',
            backgroundColor: '#ffffff',
            inputPadding: '12px',
            labelColor: '#1f2937',
            buttonText: 'Envoyer',
            buttonColor: schoolConfig.color || '#3b82f6',
            successMessage: 'Merci ! Votre message a été envoyé.',
            errorMessage: 'Une erreur est survenue, veuillez réessayer.',
            redirectUrl: ''
        };
        this.activeFieldId = null;
        this.modal = null;
    }

    /**
     * Initialize and open the Form Generator modal
     */
    open() {
        this.renderModal();
        this.attachEventListeners();
        this.renderPreview();
    }

    /**
     * Load an existing form data
     */
    load(formData) {
        console.log('📂 Loading form data:', formData);
        this.fields = formData.fields || [];
        this.styles.buttonText = formData.button_text || this.styles.buttonText;
        this.styles.successMessage = formData.success_message || this.styles.successMessage;
        this.styles.redirectUrl = formData.redirect_url || this.styles.redirectUrl;
        
        // Store the form ID and name to pre-fill the config
        this.loadedFormId = formData.id;
        this.loadedFormName = formData.name;
    }

    renderModal() {
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-overlay';
        modalContainer.id = 'form-generator-overlay';

        modalContainer.innerHTML = `
            <div class="form-generator-modal">
                <div class="fg-header">
                    <div class="fg-header-title">
                        <h2>Visual Form Generator</h2>
                        <p>Créez votre formulaire et générez automatiquement la Data Extension SFMC.</p>
                    </div>
                    <div class="fg-actions">
                        <button class="btn-cancel" id="fg-close">Annuler</button>
                        <button class="btn-generate" id="fg-generate">
                            <i class="fas fa-magic"></i> GENERATE FORM
                        </button>
                    </div>
                </div>
                <div class="fg-main">
                    <aside class="fg-sidebar">
                        <div class="fg-sidebar-tabs">
                            <button class="fg-sidebar-tab active" data-fg-tab="fields">Champs</button>
                            <button class="fg-sidebar-tab" data-fg-tab="style">Style</button>
                            <button class="fg-sidebar-tab" data-fg-tab="config">Config</button>
                        </div>
                        <div class="fg-sidebar-content" id="fg-tab-fields">
                            <div class="section-label">Ajouter un champ</div>
                            <div class="fg-field-library">
                                ${this.renderFieldLibrary()}
                            </div>
                            <div id="fg-field-properties" class="hidden">
                                <!-- Properties for selected field -->
                            </div>
                        </div>
                        <div class="fg-sidebar-content hidden" id="fg-tab-style">
                            ${this.renderStyleControls()}
                        </div>
                        <div class="fg-sidebar-content hidden" id="fg-tab-config">
                            ${this.renderConfigControls()}
                        </div>
                    </aside>
                    <main class="fg-preview-area">
                        <div class="fg-form-preview" id="fg-preview-container">
                            <!-- Live Preview -->
                        </div>
                    </main>
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer);
        this.modal = modalContainer;
    }

    renderFieldLibrary() {
        const fieldTypes = [
            { type: 'text', label: 'Texte court', icon: 'fa-font' },
            { type: 'email', label: 'Email', icon: 'fa-envelope' },
            { type: 'phone', label: 'Téléphone', icon: 'fa-phone' },
            { type: 'textarea', label: 'Texte long', icon: 'fa-align-left' },
            { type: 'select', label: 'Liste déroulante', icon: 'fa-list' },
            { type: 'checkbox', label: 'Case à cocher', icon: 'fa-check-square' },
            { type: 'date', label: 'Date', icon: 'fa-calendar' }
        ];

        return fieldTypes.map(f => `
            <div class="fg-field-item" draggable="true" data-type="${f.type}">
                <div class="fg-field-icon"><i class="fas ${f.icon}"></i></div>
                <span>${f.label}</span>
                <i class="fas fa-plus-circle" style="margin-left: auto; opacity: 0.5"></i>
            </div>
        `).join('');
    }

    renderStyleControls() {
        return `
            <div class="fg-control-group">
                <label>Largeur max</label>
                <input type="text" id="style-maxWidth" value="${this.styles.maxWidth}">
            </div>
            <div class="fg-control-group">
                <label>Couleur du bouton</label>
                <input type="color" id="style-buttonColor" value="${this.styles.buttonColor}">
            </div>
            <div class="fg-control-group">
                <label>Texte du bouton</label>
                <input type="text" id="style-buttonText" value="${this.styles.buttonText}">
            </div>
            <div class="fg-control-group">
                <label>Rayon des bordures (px)</label>
                <input type="number" id="style-borderRadius" value="${parseInt(this.styles.borderRadius)}">
            </div>
            <div class="fg-control-group">
                <label>Couleur des labels</label>
                <input type="color" id="style-labelColor" value="${this.styles.labelColor}">
            </div>
        `;
    }

    renderConfigControls() {
        return `
            <div class="fg-control-group">
                <label>Nom du formulaire (pour SFMC)</label>
                <input type="text" id="config-formName" value="${this.loadedFormName || ''}" placeholder="ex: form_inscription_2024">
            </div>
            <div class="fg-control-group">
                <label>Message de succès</label>
                <textarea id="config-successMessage" rows="3">${this.styles.successMessage}</textarea>
            </div>
            <div class="fg-control-group">
                <label>URL de redirection (Optionnel)</label>
                <input type="text" id="config-redirectUrl" value="${this.styles.redirectUrl}">
            </div>
        `;
    }

    attachEventListeners() {
        // Close modal
        this.modal.querySelector('#fg-close').onclick = () => {
            this.modal.remove();
        };

        // Tabs
        this.modal.querySelectorAll('.fg-sidebar-tab').forEach(tab => {
            tab.onclick = () => {
                this.modal.querySelectorAll('.fg-sidebar-tab').forEach(t => t.classList.remove('active'));
                this.modal.querySelectorAll('.fg-sidebar-content').forEach(c => c.classList.add('hidden'));
                tab.classList.add('active');
                this.modal.querySelector(`#fg-tab-${tab.dataset.fgTab}`).classList.remove('hidden');
            };
        });

        // Add fields from library
        this.modal.querySelectorAll('.fg-field-item').forEach(item => {
            item.onclick = () => {
                this.addField(item.dataset.type);
            };
        });

        // Style updates
        ['maxWidth', 'buttonColor', 'buttonText', 'borderRadius', 'labelColor'].forEach(prop => {
            const input = this.modal.querySelector(`#style-${prop}`);
            input.oninput = (e) => {
                let val = e.target.value;
                if (prop === 'borderRadius') val += 'px';
                this.styles[prop] = val;
                this.renderPreview();
            };
        });

        // Generate
        this.modal.querySelector('#fg-generate').onclick = () => {
            this.handleGenerate();
        };
    }

    addField(type) {
        const id = 'field_' + Math.random().toString(36).substr(2, 9);
        const field = {
            id,
            type,
            label: `Nouveau champ ${type}`,
            name: `field_${this.fields.length + 1}`,
            required: false,
            placeholder: '',
            defaultValue: ''
        };

        if (type === 'email') field.label = 'Email';
        if (type === 'phone') field.label = 'Téléphone';
        if (type === 'select') {
            field.label = 'Liste déroulante';
            field.options = [
                { label: 'Option 1', value: 'option1' },
                { label: 'Option 2', value: 'option2' }
            ];
        }

        this.fields.push(field);
        this.activeFieldId = id;
        this.renderPreview();
        this.renderFieldProperties(field);
    }

    renderFieldProperties(field) {
        const propsContainer = this.modal.querySelector('#fg-field-properties');
        propsContainer.classList.remove('hidden');
        propsContainer.innerHTML = `
            <div class="section-label">Propriétés du champ</div>
            <div class="fg-control-group">
                <label>Label</label>
                <input type="text" id="prop-label" value="${field.label}">
            </div>
            <div class="fg-control-group">
                <label>Nom technique (SFMC Field Name)</label>
                <input type="text" id="prop-name" value="${field.name}">
            </div>
            <div class="fg-control-group">
                <label>Placeholder</label>
                <input type="text" id="prop-placeholder" value="${field.placeholder}">
            </div>
            <div class="fg-control-group">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="prop-required" ${field.required ? 'checked' : ''}> Obligatoire
                </label>
            </div>
            ${field.type === 'select' ? this.renderOptionsEditor(field) : ''}
            <button class="btn-cancel" id="prop-delete" style="width: 100%; color: #ef4444; margin-top: 1rem;">
                Supprimer le champ
            </button>
        `;

        // Manage options if it's a select
        if (field.type === 'select') {
            this.attachOptionsEvents(field);
        }

        // Listen for changes
        ['label', 'name', 'placeholder', 'required'].forEach(prop => {
            const input = propsContainer.querySelector(`#prop-${prop}`);
            input.oninput = (e) => {
                const val = prop === 'required' ? e.target.checked : e.target.value;
                field[prop] = val;
                this.renderPreview();
            };
        });

        propsContainer.querySelector('#prop-delete').onclick = () => {
            this.fields = this.fields.filter(f => f.id !== field.id);
            propsContainer.classList.add('hidden');
            this.renderPreview();
        };
    }

    renderPreview() {
        const container = this.modal.querySelector('#fg-preview-container');
        container.style.maxWidth = this.styles.maxWidth;
        container.style.borderRadius = this.styles.borderRadius;
        container.style.backgroundColor = this.styles.backgroundColor;

        let fieldsHtml = this.fields.map(f => {
            const activeClass = f.id === this.activeFieldId ? 'active' : '';
            return `
                <div class="preview-field-container ${activeClass}" onclick="window.fg_selectField('${f.id}')">
                    <label style="color: ${this.styles.labelColor}">${f.label} ${f.required ? '*' : ''}</label>
                    ${this.renderFieldInput(f)}
                    <div class="field-actions">
                        <button class="field-action-btn delete" onclick="event.stopPropagation(); window.fg_deleteField('${f.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        if (this.fields.length === 0) {
            fieldsHtml = `<div style="text-align:center; padding: 3rem; color: #9ca3af; border: 2px dashed #e5e7eb; border-radius: 8px;">
                <i class="fas fa-plus-circle" style="font-size: 2rem; margin-bottom: 1rem"></i>
                <p>Cliquez sur un champ à gauche pour commencer</p>
            </div>`;
        }

        container.innerHTML = `
            <form onsubmit="return false">
                ${fieldsHtml}
                <button type="button" style="background-color: ${this.styles.buttonColor}">
                    ${this.styles.buttonText}
                </button>
            </form>
        `;

        // Global functions for preview interaction
        window.fg_selectField = (id) => {
            this.activeFieldId = id;
            const field = this.fields.find(f => f.id === id);
            this.renderFieldProperties(field);
            this.renderPreview();
        };
        window.fg_deleteField = (id) => {
            this.fields = this.fields.filter(f => f.id !== id);
            this.renderPreview();
            this.modal.querySelector('#fg-field-properties').classList.add('hidden');
        };
    }

    renderOptionsEditor(field) {
        return `
            <div class="section-label" style="margin-top: 1.5rem">Options de la liste</div>
            <div id="options-list" class="fg-options-list">
                ${field.options.map((opt, i) => `
                    <div class="fg-option-item" data-index="${i}">
                        <input type="text" class="opt-label" value="${opt.label}" placeholder="Label">
                        <input type="text" class="opt-value" value="${opt.value}" placeholder="Valeur">
                        <button class="opt-delete"><i class="fas fa-times"></i></button>
                    </div>
                `).join('')}
            </div>
            <button class="btn-outline" id="add-option" style="width: 100%; font-size: 0.8rem; margin-top: 0.5rem">
                + Ajouter une option
            </button>
        `;
    }

    attachOptionsEvents(field) {
        const container = this.modal.querySelector('#options-list');
        const addBtn = this.modal.querySelector('#add-option');

        const updateOptions = () => {
            const items = container.querySelectorAll('.fg-option-item');
            field.options = Array.from(items).map(item => ({
                label: item.querySelector('.opt-label').value,
                value: item.querySelector('.opt-value').value
            }));
            this.renderPreview();
        };

        container.querySelectorAll('.fg-option-item').forEach(item => {
            item.querySelector('.opt-label').oninput = updateOptions;
            item.querySelector('.opt-value').oninput = updateOptions;
            item.querySelector('.opt-delete').onclick = () => {
                item.remove();
                updateOptions();
            };
        });

        addBtn.onclick = () => {
            field.options.push({ label: `Option ${field.options.length + 1}`, value: `val_${field.options.length + 1}` });
            this.renderFieldProperties(field);
            this.renderPreview();
        };
    }

    renderFieldInput(f) {
        const placeholder = f.placeholder ? `placeholder="${f.placeholder}"` : '';
        switch (f.type) {
            case 'textarea': return `<textarea ${placeholder} rows="3"></textarea>`;
            case 'select': return `<select>${(f.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}</select>`;
            case 'checkbox': return `<input type="checkbox" style="width: auto; margin-right: 8px;"> <span style="font-size: 0.875rem">Cochez cette case</span>`;
            default: return `<input type="${f.type}" ${placeholder}>`;
        }
    }

    async handleGenerate() {
        const formName = this.modal.querySelector('#config-formName').value.trim();
        if (!formName) {
            if (window.showAlert) {
                await window.showAlert({ title: 'Champ requis', message: 'Veuillez donner un nom au formulaire pour l\'identifier dans SFMC.' });
            } else {
                alert('Veuillez donner un nom au formulaire.');
            }
            return;
        }
        if (this.fields.length === 0) {
            if (window.showAlert) {
                await window.showAlert({ title: 'Formulaire vide', message: 'Veuillez ajouter au moins un champ à votre formulaire avant de le générer.' });
            } else {
                alert('Ajoutez au moins un champ.');
            }
            return;
        }

        this.showLoading('Génération en cours...');

        try {
            // STEP 1: Create Data Extension in SFMC
            console.log('🚀 Creating Data Extension...');
            const deResult = await fetch('/api/sfmc/create-data-extension', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formName, fields: this.fields })
            }).then(r => r.json());

            if (deResult.error) throw new Error('Erreur SFMC DE: ' + deResult.error);

            // STEP 2: Generate Code
            const { html, css, ampscript } = this.generateCode(formName, deResult.customerKey);

            // STEP 3: Save to Supabase
            console.log('💾 Saving to Supabase...');
            const supaResult = await fetch('/api/forms/save-to-supabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: this.loadedFormId, // Include ID for Upsert
                    name: formName,
                    school_id: this.schoolId,
                    fields: this.fields,
                    html,
                    css,
                    ampscript,
                    data_extension_name: formName,
                    data_extension_key: deResult.customerKey
                })
            }).then(r => r.json());

            // STEP 4: Create Asset in SFMC
            console.log('☁️ Creating SFMC Asset...');
            const assetResult = await fetch('/api/sfmc/create-form-asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formName,
                    schoolId: this.schoolId,
                    html,
                    css,
                    ampscript
                })
            }).then(r => r.json());

            this.hideLoading();
            if (window.showAlert) {
                const isUpdate = Boolean(this.loadedFormId);
                const title = isUpdate ? 'Modification réussie' : 'Création réussie';
                const message = isUpdate 
                    ? `Le formulaire "${formName}" a été mis à jour avec succès dans Supabase et SFMC.`
                    : `Le formulaire "${formName}" a été généré, sa Data Extension créée et l'Asset sauvegardé dans SFMC.`;
                
                await window.showAlert({ title, message });
            } else {
                alert('Succès ! L\'opération a été effectuée avec succès.');
            }
            this.modal.remove();

        } catch (e) {
            this.hideLoading();
            console.error(e);
            if (window.showAlert) {
                window.showAlert({ title: 'Erreur', message: 'Erreur lors de la génération : ' + e.message });
            } else {
                alert('Erreur lors de la génération : ' + e.message);
            }
        }
    }

    generateCode(formName, deKey) {
        // Generate AMPscript
        let ampscript = `
SET @formName = "${formName}"
SET @deKey = "${deKey}"

IF RequestParameter("submitted") == "true" THEN
    SET @SubmissionDate = Now()
`;
        this.fields.forEach(f => {
            ampscript += `    SET @${f.name} = RequestParameter("${f.name}")\n`;
        });

        ampscript += `
    InsertDE("${formName}", 
        "SubmissionDate", @SubmissionDate,
`;
        this.fields.forEach((f, i) => {
            ampscript += `        "${f.name}", @${f.name}${i === this.fields.length - 1 ? '' : ','}\n`;
        });
        ampscript += `    )\n`;

        if (this.styles.redirectUrl) {
            ampscript += `    Redirect("${this.styles.redirectUrl}")\n`;
        } else {
            ampscript += `    SET @success = "true"\n`;
        }
        ampscript += `ENDIF`;

        // Generate HTML
        let html = `<form method="post" action="%%=RequestParameter('PAGEURL')=%%" class="sfmc-form">
    <input type="hidden" name="submitted" value="true">
    <div class="form-container">
`;
        this.fields.forEach(f => {
            html += `        <div class="form-field">
            <label for="${f.name}">${f.label}${f.required ? ' *' : ''}</label>
            ${this.renderFinalInput(f)}
        </div>\n`;
        });

        html += `        <div class="form-messages">
            %%[ IF @success == "true" THEN ]%%
                <div class="msg-success">${this.styles.successMessage}</div>
            %%[ ENDIF ]%%
        </div>
        <button type="submit" class="btn-submit">${this.styles.buttonText}</button>
    </div>
</form>`;

        // Generate CSS
        const css = `
.sfmc-form { font-family: sans-serif; max-width: ${this.styles.maxWidth}; margin: 0 auto; }
.form-container { background: ${this.styles.backgroundColor}; padding: 30px; border-radius: ${this.styles.borderRadius}; border: 1px solid ${this.styles.borderColor}; }
.form-field { margin-bottom: 20px; }
.form-field label { display: block; margin-bottom: 8px; font-weight: 600; color: ${this.styles.labelColor}; }
.form-field input, .form-field select, .form-field textarea { width: 100%; padding: ${this.styles.inputPadding}; border-radius: 4px; border: 1px solid #ccc; box-sizing: border-box; }
.btn-submit { width: 100%; padding: 15px; background: ${this.styles.buttonColor}; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
.msg-success { padding: 15px; background: #dcfce7; color: #166534; border-radius: 4px; margin-bottom: 20px; text-align: center; }
`;

        return { html, css, ampscript };
    }

    renderFinalInput(f) {
        const required = f.required ? 'required' : '';
        const placeholder = f.placeholder ? `placeholder="${f.placeholder}"` : '';
        switch (f.type) {
            case 'textarea': return `<textarea name="${f.name}" id="${f.name}" ${placeholder} ${required}></textarea>`;
            case 'select': return `<select name="${f.name}" id="${f.name}" ${required}>
                <option value="">Sélectionnez...</option>
                ${(f.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('\n                ')}
            </select>`;
            case 'checkbox': return `<input type="checkbox" name="${f.name}" id="${f.name}" value="true" ${required}>`;
            default: return `<input type="${f.type}" name="${f.name}" id="${f.name}" ${placeholder} ${required}>`;
        }
    }

    showLoading(text) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'fg-loading';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p style="margin-top: 1rem; font-weight: 500">${text}</p>
        `;
        document.body.appendChild(overlay);
    }

    hideLoading() {
        const overlay = document.getElementById('fg-loading');
        if (overlay) overlay.remove();
    }
}
