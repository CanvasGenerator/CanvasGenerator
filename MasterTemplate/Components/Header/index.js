export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-header', {
        label: 'Header',
        category: cat,
        content: `
<header class="mh-header">
  <div class="mh-inner">
    <div class="mh-logo">
      <img src="https://placehold.co/200x52/ffffff/1a1a1a?text=LOGO+ÉCOLE" alt="Logo école" class="mh-logo-img">
    </div>
    <div class="mh-right">
      <a href="#" class="mh-lang-btn">EN</a>
    </div>
  </div>
</header>
<style>
  .mh-header {
    background: var(--brand-header, var(--brand-primary, #1a1a1a));
    border-bottom: 3px solid rgba(0,0,0,0.2);
    font-family: Arial, sans-serif;
    width: 100%;
  }
  .mh-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .mh-logo-img {
    height: 64px;
    object-fit: contain;
    display: block;
  }
  .mh-lang-btn {
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-decoration: none;
    border: 1px solid rgba(255,255,255,0.45);
    padding: 5px 13px;
    border-radius: 2px;
    transition: background 0.2s;
  }
  .mh-lang-btn:hover { background: rgba(255,255,255,0.1); }
  @media (max-width: 768px) {
    .mh-inner { padding: 10px 16px; }
    .mh-logo-img { height: 48px; }
  }
</style>`,
        attributes: { class: 'fa fa-window-maximize' }
    });
}
