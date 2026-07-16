export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-header', {
        label: 'Header',
        category: cat,
        content: `
<header class="mh-header">
  <div class="mh-inner">
    <div class="mh-brand">
      <div class="mh-logo" data-brand-logo>LOGO_ECOLE</div>
      <span class="mh-baseline">L'école des nouveaux métiers<br>de la communication</span>
    </div>
    <div class="mh-right">
      <a href="#" class="mh-lang-btn">FR</a>
    </div>
  </div>
</header>
<style>
  .mh-header {
    background: var(--brand-header, var(--brand-primary, #1a1a1a));
    color: var(--brand-header-text, #ffffff);
    font-family: var(--brand-font, 'Inter', sans-serif);
    width: 100%;
  }
  .mh-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .mh-brand {
    display: flex;
    align-items: center;
    gap: 20px;
    min-width: 0;
  }
  .mh-logo {
    color: var(--brand-header-text, #ffffff);
    display: flex;
    align-items: center;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: 1px;
    flex-shrink: 0;
  }
  .mh-logo svg, .mh-logo img { height: 56px; width: auto; display: block; }
  .mh-baseline {
    color: var(--brand-header-text, #ffffff);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
  }
  .mh-lang-btn {
    color: var(--brand-header-text, #ffffff);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-decoration: none;
    border: 1px solid currentColor;
    padding: 5px 13px;
    border-radius: 2px;
    opacity: 0.9;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }
  .mh-lang-btn:hover { opacity: 1; }
  @media (max-width: 768px) {
    .mh-inner { padding: 10px 14px; gap: 10px; }
    .mh-brand { gap: 10px; }
    .mh-logo { font-size: 18px; }
    .mh-logo svg, .mh-logo img { height: 40px; }
    /* Baseline conservée en mobile (compacte) → logo + baseline + langue, comme
       les headers d'école (maquette). */
    .mh-baseline { display: block; font-size: 9px; line-height: 1.2; }
    .mh-lang-btn { padding: 4px 9px; font-size: 11px; }
  }
</style>`,
        attributes: { class: 'fa fa-window-maximize' }
    });
}
