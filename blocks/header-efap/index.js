export default function(editor, categories) {
    editor.BlockManager.add('header-efap', {
        label: 'EFAP Header',
        category: categories.EFAP,
        content: `
            <header class="header-efap">
                <div class="efap-logo">E|F|A|P</div>
                <div class="efap-lang">EN</div>
            </header>
            <style>
                .header-efap {
                    background-color: #1a1a1a;
                    padding: 18px 0; /* Collé au bord gauche */
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 2px solid #c9a96e;
                    font-family: 'Georgia', 'Times New Roman', serif;
                    width: 100%;
                }
                .efap-logo {
                    font-size: 22px;
                    letter-spacing: 10px;
                    color: #ffffff;
                    font-weight: 400;
                    margin-left: 120px; /* Décalage des lettres vers la droite */
                }
                .efap-lang {
                    font-size: 13px;
                    color: #ffffff;
                    font-weight: 400;
                    letter-spacing: 2px;
                    cursor: pointer;
                    margin-right: 20px;
                }
                @media (max-width: 768px) {
                    .header-efap {
                        padding: 14px 0;
                    }
                    .efap-logo {
                        font-size: 17px;
                        letter-spacing: 6px;
                        margin-left: 40px;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}
