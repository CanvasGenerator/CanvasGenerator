export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-footer', {
        label: 'Footer',
        category: cat,
        content: `
<footer class="mf-footer">
  <div class="mf-inner">
    <div class="mf-brand">
      <div class="mf-logo" data-brand-logo>LOGO_ECOLE</div>
      <p class="mf-tagline">L'école des nouveaux métiers<br>de la communication</p>
      <div class="mf-socials">
        <a href="#" class="mf-soc" aria-label="Instagram">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        </a>
        <a href="#" class="mf-soc" aria-label="Facebook">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </a>
        <a href="#" class="mf-soc" aria-label="LinkedIn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
        </a>
        <a href="#" class="mf-soc" aria-label="YouTube">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.95C18.88 4 12 4 12 4s-6.88 0-8.59.47a2.78 2.78 0 0 0-1.95 1.95A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.53C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#ffffff"/></svg>
        </a>
        <a href="#" class="mf-soc" aria-label="TikTok">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.86 4.86 0 0 1-1.01-.07z"/></svg>
        </a>
      </div>
    </div>
    <div class="mf-legal">
      <p class="mf-legal-text">
        L'école collecte vos données afin de vous adresser de la documentation. Si vous le souhaitez, nous collectons également vos données afin de vous adresser des emails commerciaux. Pour en savoir plus sur le traitement de vos données et pour exercer vos droits, nous vous invitons à consulter la <a href="#" class="mf-link">Politique de confidentialité</a>
      </p>
    </div>
  </div>
</footer>
<style>
  .mf-footer { background:var(--brand-footer, #ffffff); color: var(--brand-text, #1a1a1a); padding:40px 24px; font-family: var(--brand-font, 'Inter', sans-serif); border-top:1px solid var(--brand-border, #e5e7eb); }
  .mf-inner { max-width:1200px; margin:0 auto; display:flex; gap:48px; align-items:flex-start; }
  .mf-brand { flex:0 0 auto; min-width:180px; }
  .mf-logo { color: var(--brand-text, #1a1a1a); display:flex; align-items:center; font-weight:800; font-size:22px; letter-spacing:1px; margin-bottom:10px; }
  .mf-logo svg, .mf-logo img { height:52px; width:auto; display:block; }
  .mf-tagline { color: var(--brand-muted, #6b7280); font-size:12px; line-height:1.5; margin:0 0 18px; }
  .mf-socials { display:flex; gap:14px; align-items:center; }
  .mf-soc { color: var(--brand-text, #1a1a1a); display:flex; align-items:center; transition:opacity 0.2s; }
  .mf-soc:hover { opacity:0.6; }
  .mf-legal { flex:1; }
  .mf-legal-text { color: var(--brand-muted, #6b7280); font-size:12px; line-height:1.7; margin:0; }
  .mf-link { color: var(--brand-link, var(--brand-primary, #111)); text-decoration:underline; }
  @media(max-width:768px) {
    .mf-inner { flex-direction:column; gap:28px; }
    .mf-footer { text-align:center; }
    .mf-logo { justify-content:center; margin:0 0 10px; }
    .mf-socials { justify-content:center; }
  }
</style>`,
        attributes: { class: 'fa fa-window-minimize' }
    });
}
