export default function(editor, categories) {
    editor.BlockManager.add('chiffres-cles', {
        label: 'Chiffres Clés',
        category: categories.ESSENTIAL,
        content: `
            <section class="keyfig-section">
                <div class="keyfig-card">
                    <div class="keyfig-stats-grid">
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">75</div>
                            <div class="keyfig-label">ans d'expertise</div>
                        </div>
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">5 000</div>
                            <div class="keyfig-label">etudiants</div>
                        </div>
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">15</div>
                            <div class="keyfig-label">campus</div>
                        </div>
                        <div class="keyfig-stat-item">
                            <div class="keyfig-number">12 500</div>
                            <div class="keyfig-label">diplomes</div>
                        </div>
                    </div>
                    <div class="keyfig-cta-wrap">
                        <a href="#" class="keyfig-cta">Je telecharge la brochure</a>
                    </div>
                </div>
            </section>
            <style>
                .keyfig-section {
                    padding: 32px 20px;
                    background-color: #ffffff;
                    font-family: 'Inter', sans-serif;
                }
                .keyfig-card {
                    max-width: 920px;
                    margin: 0 auto;
                    padding: 28px 32px;
                    background-color: #f3f3f3;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 32px;
                }
                .keyfig-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(120px, 1fr));
                    gap: 18px 34px;
                    flex: 1;
                    max-width: 430px;
                }
                .keyfig-stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 6px;
                }
                .keyfig-number {
                    color: var(--brand-secondary, #a8174f);
                    font-size: 34px;
                    font-weight: 700;
                    line-height: 1;
                    letter-spacing: -0.02em;
                }
                .keyfig-label {
                    display: inline-block;
                    background-color: var(--brand-secondary, #a8174f);
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 600;
                    line-height: 1;
                    padding: 5px 8px;
                    text-transform: lowercase;
                }
                .keyfig-cta-wrap {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    flex-shrink: 0;
                }
                .keyfig-cta {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 220px;
                    padding: 14px 24px;
                    background-color: var(--brand-secondary, #a8174f);
                    color: #ffffff;
                    text-decoration: none;
                    text-align: center;
                    font-size: 13px;
                    font-weight: 700;
                    line-height: 1.2;
                    transition: all 0.2s ease;
                }
                .keyfig-cta:hover {
                    background-color: var(--brand-secondary, #8e1244);
                    filter: brightness(0.9);
                }
                @media (max-width: 768px) {
                    .keyfig-section {
                        padding: 24px 16px;
                    }
                    .keyfig-card {
                        flex-direction: column;
                        align-items: stretch;
                        padding: 24px 18px;
                        gap: 24px;
                    }
                    .keyfig-stats-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 16px 18px;
                        max-width: none;
                    }
                    .keyfig-number {
                        font-size: 28px;
                    }
                    .keyfig-label {
                        font-size: 10px;
                        padding: 5px 7px;
                    }
                    .keyfig-cta-wrap {
                        justify-content: stretch;
                    }
                    .keyfig-cta {
                        width: 100%;
                        min-width: 0;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });
}
