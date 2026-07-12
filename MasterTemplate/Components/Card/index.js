export default function(editor, categories) {
    const categoryName = categories && categories.MASTER ? categories.MASTER : 'Master Components';

    editor.BlockManager.add('master-card', {
        label: 'Card (Master)',
        category: categoryName,
        content: `
            <div class="master-card">
                <div class="master-card-image"></div>
                <div class="master-card-content">
                    <h3 class="master-card-title">Titre de la carte</h3>
                    <p class="master-card-text">Texte descriptif de la carte pour présenter brièvement un programme ou un point clé.</p>
                    <a href="#" class="master-card-link">En savoir plus &rarr;</a>
                </div>
            </div>
            <style>
                .master-card {
                    background-color: #ffffff;
                    border: 1px solid var(--border-color, #e5e7eb);
                    border-radius: 8px;
                    overflow: hidden;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    transition: transform 0.2s, box-shadow 0.2s;
                    max-width: 350px;
                }
                .master-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    border-color: var(--brand-primary, #2563eb);
                }
                .master-card-image {
                    width: 100%;
                    height: 200px;
                    background-color: var(--bg-surface-strong, #f3f4f6);
                }
                .master-card-content {
                    padding: 24px;
                }
                .master-card-title {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0 0 12px 0;
                    color: var(--text-main, #111827);
                }
                .master-card-text {
                    font-size: 15px;
                    color: var(--text-secondary, #4b5563);
                    line-height: 1.5;
                    margin: 0 0 20px 0;
                }
                .master-card-link {
                    color: var(--brand-primary, #2563eb);
                    font-weight: 600;
                    text-decoration: none;
                    font-size: 14px;
                }
                .master-card-link:hover {
                    text-decoration: underline;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b3' }
    });
}
