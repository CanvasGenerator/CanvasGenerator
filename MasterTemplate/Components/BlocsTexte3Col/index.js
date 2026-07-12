export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-blocs-texte-3col', {
        label: 'Blocs Texte 3 colonnes',
        category: cat,
        attributes: { class: 'fa fa-th-large' },
        content: `
<section class="mbt3-section">
  <div class="mbt3-inner">

    <h2 class="mbt3-title">QUELS SONT LES PROGRAMMES ?</h2>

    <div class="mbt3-grid">

      <div class="mbt3-card">
        <h3 class="mbt3-card-title">PÉDAGOGIE ACTIVE</h3>
        <p class="mbt3-card-text">L'école propose une expérience fondée sur l'action. Tout au long de leur cursus, nos étudiants bénéficient de haut niveau et vivent des « Challenges Créatifs » réguliers.</p>
      </div>

      <div class="mbt3-card">
        <h3 class="mbt3-card-title">EXPERTISE IA</h3>
        <p class="mbt3-card-text">Le métier de communicant évolue. L'IA est intégrée comme un outil stratégique au service de la créativité et de la performance digitale.</p>
      </div>

      <div class="mbt3-card">
        <h3 class="mbt3-card-title">RÉSEAU DES DIPLÔMÉS</h3>
        <p class="mbt3-card-text">Depuis 1961, l'école construit des ponts avec les plus grandes entreprises. Notre réseau de 30 000 Alumni est une force de frappe unique.</p>
      </div>

    </div>
  </div>
</section>
<style>
  .mbt3-section {
    background: var(--brand-background, #ffffff);
    padding: 56px 24px;
    font-family: var(--brand-font, 'Inter', sans-serif);
  }
  .mbt3-inner {
    max-width: 1100px;
    margin: 0 auto;
  }
  .mbt3-title {
    text-align: center;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--text-main, #111);
    margin: 0 0 40px;
  }
  .mbt3-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .mbt3-card {
    background: #f2f0eb;
    padding: 28px 24px;
    border-radius: 2px;
  }
  .mbt3-card-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-main, #111);
    margin: 0 0 14px;
  }
  .mbt3-card-text {
    font-size: 14px;
    line-height: 1.65;
    color: #444;
    margin: 0;
  }
  @media (max-width: 768px) {
    .mbt3-grid { grid-template-columns: 1fr; }
    .mbt3-title { font-size: 20px; }
  }
</style>`
    });
}
