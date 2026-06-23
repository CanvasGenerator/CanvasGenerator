export default function(editor, categories) {
    editor.BlockManager.add('header-brassart', {
        label: 'BRASSART Header',
        category: categories.BRASSART,
        content: `
            <header class="header-brassart">
                <div class="logo-group">
                    <div class="brassart-logo-text">BRASSART</div>
                    <div class="header-tagline">
                        L'école des métiers<br>de la création
                    </div>
                </div>
            </header>
            <style>
                .header-brassart {
                    background-color: #ffffff;
                    padding: 20px 0;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    font-family: 'Inter', sans-serif;
                    border-bottom: 1px solid #f0f0f0;
                    width: 100%;
                }
                .logo-group {
                    display: flex;
                    flex-direction: column;
                    margin-left: 120px; /* Aligné avec le décalage EFAP */
                }
                .brassart-logo-text {
                    font-family: Arial Black, Arial, Helvetica, sans-serif;
                    font-size: 32px;
                    font-weight: 900;
                    color: #A8174F;
                    line-height: 1;
                    margin-bottom: 5px;
                }
                .header-tagline {
                    font-size: 11px;
                    line-height: 1.2;
                    color: #A8174F;
                    font-weight: 500;
                }
                @media (max-width: 768px) {
                    .logo-group {
                        margin-left: 40px;
                    }
                    .brassart-logo-text {
                        font-size: 24px;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}
