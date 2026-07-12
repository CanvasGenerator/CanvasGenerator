export default function(editor, categories) {
    const categoryName = categories && categories.MASTER ? categories.MASTER : 'Master Components';

    editor.BlockManager.add('master-hero', {
        label: 'Hero (Master)',
        category: categoryName,
        content: `
            <section class="master-hero">
                <div class="master-hero-overlay"></div>
                <div class="master-hero-content">
                    <h1 class="master-hero-title">Titre Principal de la Page</h1>
                    <p class="master-hero-subtitle">Sous-titre explicatif qui donne envie de découvrir la suite.</p>
                    <div class="master-hero-actions">
                        <a href="#" class="master-btn-primary">Découvrir</a>
                        <a href="#" class="master-btn-secondary">Contact</a>
                    </div>
                </div>
            </section>
            <style>
                .master-hero {
                    position: relative;
                    min-height: 60vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: var(--brand-primary, #1f2937);
                    background-size: cover;
                    background-position: center;
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                .master-hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                }
                .master-hero-content {
                    position: relative;
                    z-index: 1;
                    text-align: center;
                    color: #ffffff;
                    max-width: 800px;
                    padding: 0 24px;
                }
                .master-hero-title {
                    font-size: 48px;
                    font-weight: 800;
                    margin-bottom: 24px;
                    line-height: 1.2;
                }
                .master-hero-subtitle {
                    font-size: 20px;
                    margin-bottom: 32px;
                    opacity: 0.9;
                }
                .master-hero-actions {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                }
                .master-btn-primary {
                    background-color: var(--brand-primary, #2563eb);
                    color: #ffffff;
                    padding: 14px 28px;
                    border-radius: 4px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: filter 0.2s;
                }
                .master-btn-primary:hover {
                    filter: brightness(1.1);
                }
                .master-btn-secondary {
                    background-color: transparent;
                    color: #ffffff;
                    border: 2px solid #ffffff;
                    padding: 12px 28px;
                    border-radius: 4px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: background-color 0.2s, color 0.2s;
                }
                .master-btn-secondary:hover {
                    background-color: #ffffff;
                    color: #111827;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-hero' }
    });
}
