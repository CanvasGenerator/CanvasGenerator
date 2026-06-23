export default function(editor, categories) {
    editor.BlockManager.add('cta-button', {
        label: 'CTA Button',
        category: categories.ESSENTIAL,
        content: `
            <div class="cta-wrap">
                <a href="#" class="primary-cta">Postuler Maintenant</a>
            </div>
            <style>
                .cta-wrap {
                    padding: 40px;
                    text-align: center;
                    font-family: 'Inter', sans-serif;
                }
                .primary-cta {
                    display: inline-block;
                    background: var(--brand-primary, #3b82f6);
                    color: #fff;
                    padding: 14px 40px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 18px;
                    box-shadow: 0 10px 20px rgba(var(--brand-primary-rgb, 59, 130, 246), 0.2);
                    transition: all 0.3s;
                }
                .primary-cta:hover {
                    background: var(--brand-secondary, #2563eb);
                    transform: translateY(-3px);
                    box-shadow: 0 15px 30px rgba(var(--brand-primary-rgb, 59, 130, 246), 0.3);
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-button' }
    });
}
