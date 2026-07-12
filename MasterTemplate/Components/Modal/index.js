export default function(editor, categories) {
    const categoryName = categories && categories.MASTER ? categories.MASTER : 'Master Components';

    editor.BlockManager.add('master-modal', {
        label: 'Modal (Master)',
        category: categoryName,
        content: `
            <div class="master-modal-trigger-wrapper">
                <button class="master-modal-btn">Ouvrir la Modale</button>
            </div>
            
            <div class="master-modal-overlay">
                <div class="master-modal-content">
                    <div class="master-modal-header">
                        <h3>Titre de la modale</h3>
                        <button class="master-modal-close">&times;</button>
                    </div>
                    <div class="master-modal-body">
                        <p>Ceci est le contenu générique de la modale. Vous pouvez y placer un formulaire, une vidéo ou des informations supplémentaires.</p>
                    </div>
                </div>
            </div>
            <style>
                .master-modal-trigger-wrapper {
                    padding: 20px;
                    text-align: center;
                }
                .master-modal-btn {
                    padding: 12px 24px;
                    background: var(--brand-button-bg, var(--brand-primary, #2563eb));
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                /* La modale est cachée par défaut (display: none). Géré via JS */
                .master-modal-overlay {
                    display: none; 
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 9999;
                    justify-content: center;
                    align-items: center;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                .master-modal-content {
                    background: var(--bg-surface, #ffffff);
                    border-radius: 8px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                    animation: modalScale 0.3s ease;
                }
                @keyframes modalScale {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .master-modal-header {
                    padding: 16px 24px;
                    border-bottom: 1px solid var(--border-color, #e5e7eb);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .master-modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: var(--text-main, #111827);
                }
                .master-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--text-secondary, #6b7280);
                }
                .master-modal-body {
                    padding: 24px;
                    color: var(--text-secondary, #4b5563);
                    line-height: 1.5;
                }
            </style>
        `,
        attributes: { class: 'fa fa-window-maximize' }
    });
}
