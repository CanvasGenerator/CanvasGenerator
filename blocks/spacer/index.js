export default function(editor, categories) {
    editor.BlockManager.add('spacer', {
        label: 'Spacer / Divider',
        category: categories.ESSENTIAL,
        content: `
            <div class="spacer-block"></div>
            <div class="divider-line"></div>
            <div class="spacer-block"></div>
            <style>
                .spacer-block {
                    height: 40px;
                }
                .divider-line {
                    height: 1px;
                    background: #eee;
                    max-width: 200px;
                    margin: 0 auto;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-spacing' }
    });
}
