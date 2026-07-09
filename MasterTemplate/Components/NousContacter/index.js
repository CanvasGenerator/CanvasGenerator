/**
 * Master Template — « Nous contacter »
 * ───────────────────────────────────────────────────────────────
 * Grille de 6 cartes contact (campus / nom / mail / tél). Textes éditables.
 * CSS scopé sous `.nous-contacter`. Grille responsive 3 → 2 → 1 colonnes.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    const carte = `
      <div class="nc-card">
        <div class="nc-title">Campus (ville)</div>
        <div class="nc-line">Nom du contact</div>
        <div class="nc-line">email@ecole.fr</div>
        <div class="nc-line">01 23 45 67 89</div>
      </div>`;

    editor.BlockManager.add('master-nous-contacter', {
        label: 'Nous contacter',
        category: cat,
        attributes: { class: 'fa fa-address-book' },
        content: `
<section class="nous-contacter">
  <h1 class="nc-titre">NOUS CONTACTER</h1>
  <div class="nc-grid">
    ${carte}${carte}${carte}${carte}${carte}${carte}
  </div>
</section>
<style>
  .nous-contacter, .nous-contacter * { box-sizing: border-box; }
  .nous-contacter {
    font-family: Arial, Helvetica, sans-serif;
    padding: 40px 20px;
    background: #ffffff;
    color: #1a1a1a;
  }
  .nous-contacter .nc-titre {
    text-align: center;
    font-size: 1.8rem;
    letter-spacing: 1px;
    margin: 0 0 32px;
    color: #111;
  }
  .nous-contacter .nc-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 1000px;
    margin: 0 auto;
  }
  .nous-contacter .nc-card {
    background: #f0f0f0;
    padding: 24px 20px;
    text-align: center;
    line-height: 1.6;
  }
  .nous-contacter .nc-title { font-weight: 700; margin-bottom: 6px; }
  .nous-contacter .nc-line { font-size: 0.95rem; }

  @media (max-width: 800px) {
    .nous-contacter .nc-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 500px) {
    .nous-contacter .nc-grid { grid-template-columns: 1fr; }
    .nous-contacter .nc-titre { font-size: 1.4rem; }
  }
</style>`
    });
}
