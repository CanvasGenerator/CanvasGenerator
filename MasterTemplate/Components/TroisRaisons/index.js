export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-trois-raisons', {
        label: '3 Bonnes Raisons',
        category: cat,
        content: `
<section class="mtr-section">
  <div class="mtr-inner">
    <div class="mtr-image-col">
      <img src="https://placehold.co/600x600/cccccc/555555?text=Photo+campus" alt="Photo campus" class="mtr-img">
    </div>
    <div class="mtr-content-col">
      <div class="mtr-title-wrap">
          <h2 class="mtr-title">3 BONNES RAISONS<br>DE PARTICIPER</h2>
          <div class="mtr-title-deco"><div class="mtr-line"></div><strong>B</strong></div>
      </div>
      <div class="mtr-items">
        <div class="mtr-item">
          <div class="mtr-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
          </div>
          <div class="mtr-item-text">
            <span class="mtr-keyword">Découvrir</span> le campus<br>à travers son atmosphère, la vie étudiante...
          </div>
        </div>
        <div class="mtr-item">
          <div class="mtr-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <div class="mtr-item-text">
            <span class="mtr-keyword">Échanger</span> avec nos étudiants et nos équipes<br>et pouvoir leur poser toutes vos questions.
          </div>
        </div>
        <div class="mtr-item">
          <div class="mtr-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.5"><circle cx="17" cy="8" r="3"/><circle cx="7" cy="8" r="3"/><circle cx="12" cy="16" r="3"/><path d="M14.5 14.5L16 11M9.5 14.5L8 11M10 8h4"/></svg>
          </div>
          <div class="mtr-item-text">
            <span class="mtr-keyword">Vous immerger</span> dans la culture BRASSART<br>en parcourant les travaux de nos étudiants exposés sur le campus.
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
<style>
  .mtr-section {
    font-family: var(--brand-font, 'Inter', sans-serif);
    overflow: hidden;
  }
  .mtr-inner {
    display: flex;
    min-height: 400px;
  }
  .mtr-image-col {
    flex: 0 0 45%;
    position: relative;
    overflow: hidden;
  }
  .mtr-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mtr-content-col {
    flex: 1;
    background: #E9A036;
    padding: 60px 50px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-top: 12px solid var(--bande-color, #bc0b5d);
  }
  .mtr-title-wrap {
    display: flex;
    align-items: flex-end;
    margin-bottom: 35px;
    gap: 15px;
  }
  .mtr-title {
    font-size: 24px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.5px;
    margin: 0;
    line-height: 1.2;
  }
  .mtr-title-deco {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 4px;
  }
  .mtr-line {
    width: 40px;
    height: 1px;
    background: rgba(255,255,255,0.3);
  }
  .mtr-title-deco strong {
    font-size: 14px;
    color: rgba(255,255,255,0.8);
    font-weight: 900;
  }
  .mtr-items { display: flex; flex-direction: column; gap: 28px; }
  .mtr-item { display: flex; gap: 16px; align-items: flex-start; }
  .mtr-icon { flex-shrink: 0; margin-top: 2px; }
  .mtr-item-text { color: #fff; font-size: 13px; line-height: 1.5; font-weight: 500; }
  .mtr-keyword {
    display: inline-block;
    font-weight: 700;
    background: #1a1a1a;
    color: #fff;
    padding: 2px 8px;
    border-radius: 2px;
    margin-right: 4px;
    margin-bottom: 2px;
    font-size: 12px;
  }
  @media (max-width: 768px) {
    .mtr-inner { flex-direction: column; }
    .mtr-image-col { flex: 0 0 250px; }
    .mtr-img { height: 250px; }
    .mtr-content-col { padding: 40px 24px; }
    .mtr-title { font-size: 20px; }
    .mtr-title-wrap { margin-bottom: 25px; }
  }
</style>`,
        attributes: { class: 'fa fa-star' }
    });
}
