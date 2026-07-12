/**
 * Master Template — « Bloc images » (grille de logos)
 * ───────────────────────────────────────────────────────────────
 * Titre + sous-titre + grille de 12 logos remplaçables (double-clic sur une
 * image pour la changer via le gestionnaire d'images). CSS scopé sous
 * `.bloc-images`. Grille responsive 6 → 3 colonnes.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function makeLogo(n) {
        return {
            type: 'image',
            editable: true,
            selectable: true,
            classes: ['logo-item'],
            attributes: { src: 'https://placehold.co/160x60/f4f4f5/94a3b8?text=Logo+' + n, alt: 'Logo ' + n }
        };
    }

    const logos = [];
    for (let i = 1; i <= 12; i++) logos.push(makeLogo(i));

    editor.BlockManager.add('master-bloc-images', {
        label: 'Bloc images (logos)',
        category: cat,
        attributes: { class: 'fa fa-th-large' },
        content: {
            type: 'default',
            styles: `
  .bloc-images, .bloc-images * { box-sizing: border-box; }
  .bloc-images {
    font-family: var(--brand-font, 'Inter', sans-serif);
    background: var(--brand-background, #ffffff);
    padding: 60px 20px;
  }
  .bloc-images .bi-container { max-width: 900px; margin: 0 auto; text-align: center; }
  .bloc-images .bi-titre {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: var(--brand-text, #1a1a1a);
    margin-bottom: 12px;
  }
  .bloc-images .bi-subtitle {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--brand-text, #1a1a1a);
    margin-bottom: 40px;
  }
  .bloc-images .logo-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 24px;
    align-items: center;
  }
  .bloc-images .logo-item {
    height: 60px;
    width: 100%;
    object-fit: contain;
    background: #f4f4f5;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 8px;
  }
  @media (max-width: 700px) {
    .bloc-images .logo-grid { grid-template-columns: repeat(3, 1fr); }
  }
`,
            components: [{
                tagName: 'section',
                classes: ['bloc-images'],
                components: [{
                    tagName: 'div',
                    classes: ['bi-container'],
                    components: [
                        { type: 'text', tagName: 'h1', classes: ['bi-titre'], editable: true, selectable: true, components: 'ILS RECRUTENT NOS TALENTS' },
                        { type: 'text', tagName: 'div', classes: ['bi-subtitle'], editable: true, selectable: true, components: 'STAGE, ALTERNANCE &amp; PREMIER EMPLOI' },
                        { tagName: 'div', classes: ['logo-grid'], components: logos }
                    ]
                }]
            }]
        }
    });
}
