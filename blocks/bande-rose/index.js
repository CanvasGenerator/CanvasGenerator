export default function(editor, categories) {
    editor.BlockManager.add('bande-rose', {
        label: 'Brand Banner',
        category: categories.BRASSART,
        content: `
            <section class="bande-brand-wrapper">
                <div class="bande-brand-content">
                    <span class="bande-brand-text">Découvrez nos prochains événements</span>
                </div>
            </section>
            <style>
                .bande-brand-wrapper {
                    background-color: var(--brand-primary, #BE0D5C);
                    width: 100%;
                    min-height: 80px;
                    display: flex;
                    justify-content: center;
                    align-items: stretch;
                    position: relative;
                    overflow: hidden;
                }
                .bande-brand-content {
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .bande-brand-text {
                    color: #ffffff;
                    font-family: 'Inter', sans-serif;
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                @media (max-width: 768px) {
                    .bande-brand-wrapper {
                        min-height: 60px;
                    }
                    .bande-brand-text {
                        font-size: 16px;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}
