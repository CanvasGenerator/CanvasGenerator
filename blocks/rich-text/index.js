export default function(editor, categories) {
    editor.BlockManager.add('rich-text', {
        label: 'Rich Text',
        category: categories.ESSENTIAL,
        content: `
            <div class="rich-text-block">
                <h3 class="text-title">Titre de contenu</h3>
                <p class="text-p">Ceci est un bloc de texte riche. Vous pouvez le modifier pour ajouter des informations détaillées sur vos programmes, vos campus ou vos actualités. La typographie est optimisée pour la lisibilité.</p>
                <p class="text-p">Utilisez ce bloc pour le storytelling ou pour donner plus de contexte à vos visiteurs.</p>
            </div>
            <style>
                .rich-text-block {
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                    font-family: 'Inter', sans-serif;
                }
                .text-title {
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 16px;
                    color: #111;
                }
                .text-p {
                    font-size: 16px;
                    line-height: 1.7;
                    color: #444;
                    margin-bottom: 20px;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-text' }
    });
}
