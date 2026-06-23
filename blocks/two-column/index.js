export default function(editor, categories) {
    editor.BlockManager.add('two-column', {
        label: 'Two Columns',
        category: categories.ESSENTIAL,
        content: `
            <section class="two-col-section">
                <div class="col-container">
                    <div class="col-text">
                        <h2 class="col-title">Expertise & Innovation</h2>
                        <p class="col-desc">Nos programmes sont conçus pour répondre aux exigences du marché actuel. Apprenez auprès de professionnels reconnus et forgez votre propre voie dans l'industrie de la création.</p>
                        <ul class="col-list">
                            <li>Apprentissage par projet</li>
                            <li>Stages en entreprises leaders</li>
                            <li>Réseau d'alumni mondial</li>
                        </ul>
                    </div>
                    <div class="col-image">
                        <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80" alt="Students" class="rounded-img">
                    </div>
                </div>
            </section>
            <style>
                .two-col-section {
                    padding: 80px 0;
                    background: #fff;
                    font-family: 'Inter', sans-serif;
                }
                .col-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 60px;
                    align-items: center;
                    padding: 0 20px;
                }
                .col-title {
                    font-size: 32px;
                    font-weight: 700;
                    margin-bottom: 20px;
                    color: #111;
                }
                .col-desc {
                    font-size: 18px;
                    line-height: 1.6;
                    color: #555;
                    margin-bottom: 30px;
                }
                .col-list {
                    list-style: none;
                    padding: 0;
                }
                .col-list li {
                    padding-left: 30px;
                    position: relative;
                    margin-bottom: 12px;
                    font-weight: 500;
                    color: #333;
                }
                .col-list li::before {
                    content: '✓';
                    position: absolute;
                    left: 0;
                    color: #3b82f6;
                    font-weight: bold;
                }
                .rounded-img {
                    width: 100%;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }
                @media (max-width: 768px) {
                    .col-container { grid-template-columns: 1fr; gap: 40px; }
                    .col-text { order: 2; }
                    .col-image { order: 1; }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });
}
