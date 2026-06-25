export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-cta', {
        label: 'CTA Bouton',
        category: cat,
        content: `
<section class="mc-section">
  <div class="mc-inner">
    <div class="mc-text">
      <h2 class="mc-title">Prêt à rejoindre notre école ?</h2>
      <p class="mc-subtitle">Découvrez nos programmes et rejoignez-nous</p>
    </div>
    <div class="mc-btns">
      <a href="#" class="mc-btn mc-btn-primary">Je m'inscris</a>
      <a href="#" class="mc-btn mc-btn-outline">Télécharger la brochure</a>
    </div>
  </div>
</section>
<style>
  .mc-section { padding: 48px 24px; background: var(--bg-surface, #f8f8f8); font-family: Arial, sans-serif; }
  .mc-inner { max-width: 900px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 32px; }
  .mc-title { font-size: 24px; font-weight: 800; color: var(--text-main, #111); margin: 0 0 8px; }
  .mc-subtitle { font-size: 15px; color: #666; margin: 0; }
  .mc-btns { display: flex; gap: 14px; flex-shrink: 0; }
  .mc-btn { display: inline-block; padding: 13px 24px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 3px; transition: opacity 0.2s; }
  .mc-btn-primary { background: var(--brand-primary, #1f2937); color: #e5e7eb; }
  .mc-btn-outline { border: 2px solid var(--brand-primary, #1f2937); color: var(--brand-primary, #1f2937); background: transparent; }
  .mc-btn:hover { opacity: 0.85; }
  @media(max-width:768px) { .mc-inner { flex-direction: column; text-align: center; } .mc-btns { flex-direction: column; width: 100%; } .mc-btn { text-align: center; } }
</style>`,
        attributes: { class: 'fa fa-hand-pointer-o' }
    });

    editor.BlockManager.add('master-sticky-cta', {
        label: 'Sticky CTA (barre fixe)',
        category: cat,
        content: `
<div class="msc-bar" id="msc-bar">
  <a href="#brochure" class="msc-btn">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:middle"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
    BROCHURE
  </a>
  <a href="#portes-ouvertes" class="msc-btn">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:middle"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    PORTES OUVERTES
  </a>
  <a href="#webconferences" class="msc-btn">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;vertical-align:middle"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
    WEBCONFÉRENCES
  </a>
</div>
<style>
  .msc-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 9999;
    background: #111;
    display: flex;
    align-items: stretch;
    box-shadow: 0 -2px 12px rgba(0,0,0,0.25);
  }
  .msc-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    text-decoration: none;
    color: #e5e7eb;
    border-right: 1px solid rgba(255,255,255,0.15);
    background: var(--brand-primary, #1f2937);
    transition: opacity 0.2s;
    font-family: Arial, sans-serif;
  }
  .msc-btn:last-child { border-right: none; }
  .msc-btn:hover { opacity: 0.85; }
</style>`,
        attributes: { class: 'fa fa-arrow-up' }
    });
}
