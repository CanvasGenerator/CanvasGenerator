export default function(editor, categories) {
    editor.BlockManager.add('image-caption', {
        label: 'Image & Caption',
        category: categories.ESSENTIAL,
        content: `
            <figure class="img-caption-block">
                <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80" alt="Learning" class="caption-img">
                <figcaption class="img-caption">L'excellence académique au service de votre projet professionnel.</figcaption>
            </figure>
            <style>
                .img-caption-block {
                    margin: 40px auto;
                    max-width: 900px;
                    padding: 0 20px;
                    font-family: 'Inter', sans-serif;
                }
                .caption-img {
                    width: 100%;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }
                .img-caption {
                    text-align: center;
                    font-size: 14px;
                    color: #777;
                    font-style: italic;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-image' }
    });
}
