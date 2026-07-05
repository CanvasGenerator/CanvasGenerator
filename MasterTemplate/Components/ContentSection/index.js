export default function(editor, categories) {
    const categoryName = categories && categories.MASTER ? categories.MASTER : 'Master Components';

    editor.BlockManager.add('master-content-section', {
        label: 'Content Section (Master)',
        category: categoryName,
        content: `
            <section class="master-content-section">
                <div class="master-content-container">
                    <div class="master-content-text">
                        <h2>Titre de la section</h2>
                        <p>Voici un texte descriptif générique pour cette section de contenu. Elle peut être utilisée pour présenter des chiffres clés, des avantages, ou un bloc de texte riche.</p>
                        <ul class="master-content-list">
                            <li>Point fort numéro un</li>
                            <li>Point fort numéro deux</li>
                            <li>Point fort numéro trois</li>
                        </ul>
                    </div>
                    <div class="master-content-image">
                        <!-- Espace image -->
                    </div>
                </div>
            </section>
            <style>
                .master-content-section {
                    padding: 80px 24px;
                    background-color: var(--bg-surface, #ffffff);
                    font-family: var(--font-family, 'Inter', sans-serif);
                }
                .master-content-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 48px;
                    align-items: center;
                }
                .master-content-text {
                    flex: 1;
                    min-width: 300px;
                }
                .master-content-text h2 {
                    font-size: 32px;
                    color: var(--text-main, #111827);
                    margin-bottom: 24px;
                    font-weight: 800;
                }
                .master-content-text p {
                    font-size: 16px;
                    color: var(--text-secondary, #4b5563);
                    line-height: 1.6;
                    margin-bottom: 24px;
                }
                .master-content-list {
                    list-style: none;
                    padding: 0;
                }
                .master-content-list li {
                    position: relative;
                    padding-left: 24px;
                    margin-bottom: 12px;
                    color: var(--text-main, #374151);
                }
                .master-content-list li::before {
                    content: "✓";
                    position: absolute;
                    left: 0;
                    color: var(--brand-primary, #2563eb);
                    font-weight: bold;
                }
                .master-content-image {
                    flex: 1;
                    min-width: 300px;
                    height: 350px;
                    background-color: var(--bg-surface-strong, #e5e7eb);
                    border-radius: 12px;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-section' }
    });
}
