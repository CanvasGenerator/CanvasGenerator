/**
 * AI Assistant Module
 * Handles AI-powered content generation and translation.
 */
export function initAiAssistant(editor) {
    const btnAi = document.getElementById('btn-ai-assistant');
    if (!btnAi) return;

    btnAi.onclick = () => {
        openAiModal();
    };

    function openAiModal() {
        const body = `
            <div class="ai-container">
                <div class="ai-tabs">
                    <button class="ai-tab active" data-tab="generate">🪄 Générer</button>
                    <button class="ai-tab" data-tab="translate">🌍 Traduire</button>
                </div>
                
                <div id="ai-content-generate" class="ai-pane">
                    <p class="ai-hint">Décrivez le contenu que vous souhaitez générer pour le composant sélectionné.</p>
                    <textarea id="ai-prompt" placeholder="ex: Un titre accrocheur pour une JPO Master en Communication à l'EFAP..." rows="4"></textarea>
                    <div class="ai-actions">
                        <button class="btn-ai-magic" id="btn-do-generate">
                            <i class="fas fa-sparkles"></i> Générer le texte
                        </button>
                    </div>
                </div>

                <div id="ai-content-translate" class="ai-pane hidden">
                    <p class="ai-hint">Traduisez toute votre page en un clic.</p>
                    <div class="ai-lang-selector">
                        <label>Langue cible :</label>
                        <select id="ai-target-lang">
                            <option value="en">Anglais 🇬🇧</option>
                            <option value="es">Espagnol 🇪🇸</option>
                            <option value="de">Allemand 🇩🇪</option>
                            <option value="it">Italien 🇮🇹</option>
                        </select>
                    </div>
                    <div class="ai-actions">
                        <button class="btn-ai-magic" id="btn-do-translate">
                            <i class="fas fa-globe"></i> Traduire la page entière
                        </button>
                    </div>
                </div>

                <div id="ai-result-container" class="ai-result hidden">
                    <div class="ai-result-header">Résultat suggéré :</div>
                    <div id="ai-result-text" contenteditable="true"></div>
                    <div class="ai-result-footer">
                        <button class="btn-secondary" id="btn-ai-discard">Ignorer</button>
                        <button class="btn-primary" id="btn-ai-apply">Appliquer au composant</button>
                    </div>
                </div>
            </div>
        `;

        if (window.openModal) {
            window.openModal({ 
                title: 'Reetain AI Assistant', 
                body: body 
            });
            attachAiEvents();
        }
    }

    function attachAiEvents() {
        const modal = document.getElementById('modal-container');
        
        // Tabs logic
        modal.querySelectorAll('.ai-tab').forEach(tab => {
            tab.onclick = () => {
                modal.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
                modal.querySelectorAll('.ai-pane').forEach(p => p.classList.add('hidden'));
                tab.classList.add('active');
                modal.querySelector(`#ai-content-${tab.dataset.tab}`).classList.remove('hidden');
            };
        });

        // Generate Logic
        document.getElementById('btn-do-generate').onclick = async () => {
            const prompt = document.getElementById('ai-prompt').value;
            if (!prompt) return;

            showLoading(true);
            try {
                const res = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, schoolId: window.CURRENT_SCHOOL?.id })
                });
                const data = await res.json();
                
                showResult(data.text);
            } catch (e) {
                console.error(e);
                alert("Erreur lors de la génération IA.");
            } finally {
                showLoading(false);
            }
        };

        // Translate Logic
        document.getElementById('btn-do-translate').onclick = async () => {
            const lang = document.getElementById('ai-target-lang').value;
            
            if (await window.showConfirm({ 
                title: 'Confirmation de traduction', 
                message: 'Voulez-vous traduire toute la page ? Cette action modifiera tous les textes existants.' 
            })) {
                showLoading(true);
                try {
                    const html = editor.getHtml();
                    const res = await fetch('/api/ai/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ html, targetLang: lang })
                    });
                    const data = await res.json();
                    
                    editor.setComponents(data.html);
                    window.closeModal();
                    window.showAlert({ title: 'Succès', message: 'La page a été traduite avec succès !' });
                } catch (e) {
                    console.error(e);
                    alert("Erreur lors de la traduction.");
                } finally {
                    showLoading(false);
                }
            }
        };

        function showResult(text) {
            const container = document.getElementById('ai-result-container');
            const resultText = document.getElementById('ai-result-text');
            resultText.innerText = text;
            container.classList.remove('hidden');
        }

        function showLoading(isLoading) {
            const btn = document.getElementById('btn-do-generate');
            if (isLoading) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Magie en cours...';
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sparkles"></i> Générer le texte';
            }
        }

        document.getElementById('btn-ai-discard').onclick = () => {
            document.getElementById('ai-result-container').classList.add('hidden');
        };

        document.getElementById('btn-ai-apply').onclick = () => {
            const selected = editor.getSelected();
            if (selected && selected.is('text')) {
                selected.set('content', document.getElementById('ai-result-text').innerText);
                window.closeModal();
            } else {
                window.showAlert({ title: 'Attention', message: 'Veuillez sélectionner un bloc de texte dans l\'éditeur pour appliquer le résultat.' });
            }
        };
    }
}
