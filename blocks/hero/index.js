export default function(editor, categories) {
    editor.BlockManager.add('hero', {
        label: 'Hero Section',
        category: categories.ESSENTIAL,
        content: `
            <section class="hero-section">
                <div class="hero-overlay"></div>
                <div class="hero-content">
                    <h1 class="hero-title">L'avenir de la création commence ici.</h1>
                    <p class="hero-subtitle">Rejoignez une communauté passionnée et développez vos talents avec nos experts.</p>
                    <div class="hero-btns">
                        <a href="#" class="btn-main">Découvrir nos cursus</a>
                        <a href="#" class="btn-alt">Portes Ouvertes</a>
                    </div>
                </div>
            </section>
            <style>
                .hero-section {
                    position: relative;
                    min-height: 600px;
                    background-image: url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80');
                    background-size: cover;
                    background-position: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: #fff;
                    font-family: 'Inter', sans-serif;
                }
                .hero-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: linear-gradient(135deg, rgba(var(--brand-primary-rgb, 0,0,0), 0.8) 0%, rgba(0,0,0,0.4) 100%);
                }
                .hero-content {
                    position: relative;
                    z-index: 1;
                    max-width: 800px;
                    padding: 0 20px;
                }
                .hero-title {
                    font-size: 56px;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-bottom: 24px;
                    letter-spacing: -0.02em;
                }
                .hero-subtitle {
                    font-size: 20px;
                    line-height: 1.6;
                    color: rgba(255, 255, 255, 0.9);
                    margin-bottom: 40px;
                }
                .hero-btns {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                }
                .btn-main {
                    background: #fff;
                    color: var(--brand-primary, #000);
                    padding: 16px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 700;
                    transition: all 0.3s;
                }
                .btn-main:hover {
                    background: #f0f0f0;
                    transform: scale(1.05);
                }
                .btn-alt {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                    padding: 16px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 700;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    transition: all 0.3s;
                }
                .btn-alt:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                @media (max-width: 768px) {
                    .hero-title { font-size: 36px; }
                    .hero-subtitle { font-size: 16px; }
                    .hero-btns { flex-direction: column; }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-hero' }
    });
}
