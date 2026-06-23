export default function(editor, categories) {
    editor.BlockManager.add('bande-rose', {
        label: 'Bande Rose',
        category: categories.BRASSART,
        content: `
            <div class="bande-rose-wrapper">
                <div class="bande-rose-container">
                    <div class="bande-rose-line"></div>
                </div>
            </div>
            <style>
                .bande-rose-wrapper {
                    width: 100%;
                    background-color: #ffffff;
                }
                .bande-rose-container {
                    width: 100%;
                    padding: 0 10px; /* 10px par rapport au début de la page pour s'aligner avec le menu */
                    display: flex;
                    justify-content: flex-start;
                }
                .bande-rose-line {
                    width: 100%;
                    height: 4px;
                    background-color: #A8174F;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}
