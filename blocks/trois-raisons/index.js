export default function(editor, categories) {
    editor.BlockManager.add('trois-raisons', {
        label: '3 Bonnes Raisons',
        category: categories.BRASSART,
        content: `
            <section class="trois-raisons-section">
                <div class="trois-raisons-grid">
                    <div class="trois-raisons-photo">
                        <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80" alt="Étudiants campus" class="tr-photo-img">
                    </div>
                    <div class="trois-raisons-content">
                        <div class="tr-header">
                            <h2 class="tr-title">3 BONNES RAISONS<br>DE NOUS REJOINDRE</h2>
                            <div class="tr-title-line">
                                <div class="tr-line"></div>
                            </div>
                        </div>
                        <ul class="tr-list">
                            <li class="tr-item">
                                <div class="tr-icon">🏛️</div>
                                <div class="tr-text">
                                    <span class="tr-highlight">Découvrir</span> le campus
                                    <span class="tr-sub">à travers son atmosphère, la vie étudiante...</span>
                                </div>
                            </li>
                            <li class="tr-item">
                                <div class="tr-icon">🎓</div>
                                <div class="tr-text">
                                    <span class="tr-highlight">Échanger</span> avec nos étudiants
                                    <span class="tr-sub">et pouvoir leur poser toutes vos questions.</span>
                                </div>
                            </li>
                            <li class="tr-item">
                                <div class="tr-icon">🏆</div>
                                <div class="tr-text">
                                    <span class="tr-highlight">Vous immerger</span> dans notre culture
                                    <span class="tr-sub">en parcourant les travaux de nos étudiants exposés sur le campus.</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
            <style>
                .trois-raisons-section {
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                }
                .trois-raisons-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                }
                .trois-raisons-photo {
                    position: relative;
                    min-height: 400px;
                }
                .tr-photo-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .trois-raisons-content {
                    background-color: var(--brand-primary, #E8A020);
                    padding: 50px 40px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .tr-header {
                    margin-bottom: 32px;
                }
                .tr-title {
                    font-size: 24px;
                    font-weight: 900;
                    color: #fff;
                    line-height: 1.2;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: -0.01em;
                }
                .tr-title-line {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .tr-line {
                    flex: 1;
                    max-width: 80px;
                    height: 2px;
                    background: #fff;
                }
                .tr-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .tr-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                }
                .tr-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                    margin-top: 2px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .tr-text {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    color: #fff;
                    font-size: 13px;
                    line-height: 1.4;
                }
                .tr-highlight {
                    font-weight: 800;
                    background-color: #fff;
                    color: var(--brand-primary, #000);
                    padding: 1px 6px;
                    border-radius: 3px;
                    display: inline-block;
                    margin-bottom: 4px;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .tr-sub {
                    color: rgba(255,255,255,0.9);
                }
                @media (max-width: 768px) {
                    .trois-raisons-grid {
                        grid-template-columns: 1fr;
                    }
                    .trois-raisons-photo {
                        min-height: 280px;
                    }
                    .trois-raisons-content {
                        padding: 36px 24px;
                    }
                    .tr-title {
                        font-size: 20px;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });
}
