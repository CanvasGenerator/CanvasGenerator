export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-chiffres-cles', {
        label: 'Chiffres Clés',
        category: cat,
        content: `
<section class="mcc-section">
  <div class="mcc-card">
    <div class="mcc-grid">
      <div class="mcc-stat">
        <span class="mcc-number">75</span>
        <span class="mcc-badge">ans d'expertise</span>
      </div>
      <div class="mcc-stat">
        <span class="mcc-number">5 000</span>
        <span class="mcc-badge">étudiants</span>
      </div>
      <div class="mcc-stat">
        <span class="mcc-number">15</span>
        <span class="mcc-badge">campus</span>
      </div>
      <div class="mcc-stat">
        <span class="mcc-number">12 500</span>
        <span class="mcc-badge">diplômés</span>
      </div>
    </div>
    <div class="mcc-cta-col">
      <a href="#" class="mcc-btn">Je télécharge la brochure</a>
    </div>
  </div>
</section>
<style>
  .mcc-section {
    padding: 40px 24px;
    background: var(--brand-background, #ffffff);
    font-family: var(--brand-font, 'Inter', sans-serif);
  }
  .mcc-card {
    max-width: 860px;
    margin: 0 auto;
    background: #f4f4f4;
    border-radius: 4px;
    padding: 32px 36px;
    display: flex;
    align-items: center;
    gap: 32px;
  }
  .mcc-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px 32px;
  }
  .mcc-stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mcc-number {
    font-size: 42px;
    font-weight: 700;
    color: var(--bande-color, #1f2937);
    line-height: 1;
  }
  .mcc-badge {
    display: inline-block;
    background: var(--bande-color, #1f2937);
    color: #e5e7eb;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 2px;
    letter-spacing: 0.3px;
    width: fit-content;
  }
  .mcc-cta-col { flex-shrink: 0; }
  .mcc-btn {
    display: inline-block;
    background: var(--bande-color, #1f2937);
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 700;
    padding: 13px 22px;
    text-decoration: none;
    border-radius: 2px;
    white-space: nowrap;
    transition: opacity 0.2s;
  }
  .mcc-btn:hover { opacity: 0.85; }
  @media (max-width: 768px) {
    .mcc-card { flex-direction: column; padding: 24px 20px; }
    .mcc-cta-col { width: 100%; }
    .mcc-btn { display: block; text-align: center; }
    .mcc-number { font-size: 34px; }
  }
</style>`,
        attributes: { class: 'fa fa-bar-chart' }
    });
}
