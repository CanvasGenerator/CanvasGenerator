export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-chiffres-cles-2', {
        label: 'Chiffres Clés 2 (ligne)',
        category: cat,
        attributes: { class: 'fa fa-bar-chart' },
        content: `
<section class="mcc2-section">
  <div class="mcc2-inner">

    <div class="mcc2-stat">
      <span class="mcc2-number">64</span>
      <span class="mcc2-label">ANS D'EXPERTISE</span>
    </div>

    <div class="mcc2-divider"></div>

    <div class="mcc2-stat">
      <span class="mcc2-number">30K</span>
      <span class="mcc2-label">DIPLÔMÉS</span>
    </div>

    <div class="mcc2-divider"></div>

    <div class="mcc2-stat">
      <span class="mcc2-number">15</span>
      <span class="mcc2-label">CAMPUS</span>
    </div>

    <div class="mcc2-divider"></div>

    <div class="mcc2-stat">
      <span class="mcc2-number">TITRES<br>RNCP</span>
      <span class="mcc2-label">RECONNUS PAR L'ÉTAT</span>
    </div>

  </div>
</section>
<style>
  .mcc2-section {
    background: var(--brand-background, #ffffff);
    padding: 32px 24px;
    font-family: var(--brand-font, 'Inter', sans-serif);
  }
  .mcc2-inner {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
  .mcc2-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    padding: 0 24px;
  }
  .mcc2-number {
    font-size: 36px;
    font-weight: 800;
    line-height: 1.1;
    color: var(--text-main, #111);
    letter-spacing: -0.5px;
  }
  .mcc2-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary, #666);
  }
  .mcc2-divider {
    width: 1px;
    height: 48px;
    background: #e5e7eb;
    flex-shrink: 0;
  }
  @media (max-width: 600px) {
    .mcc2-inner {
      flex-wrap: wrap;
      gap: 24px;
    }
    .mcc2-divider { display: none; }
    .mcc2-stat { flex: 0 0 45%; }
  }
</style>`
    });
}
