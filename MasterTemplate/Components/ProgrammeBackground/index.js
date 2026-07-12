/**
 * Master Template — « Programme (avec fond) »
 * ───────────────────────────────────────────────────────────────
 * Section fond violet : titre + carte blanche avec checklist (✔),
 * note et bouton d'action. Textes éditables. CSS scopé sous `.programme-bg`.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-programme-background', {
        label: 'Programme (avec fond)',
        category: cat,
        attributes: { class: 'fa fa-list-alt' },
        content: `
<section class="programme-bg">
  <h1 class="pbg-titre">PROGRAMME DE L&rsquo;ATELIER DÉCOUVERTE</h1>

  <div class="pbg-card">
    <ul class="pbg-checklist">
      <li><strong>Présentation du métier</strong> par nos intervenants professionnels en activité.</li>
      <li><strong>Exercices pratiques</strong> d&rsquo;aménagement de pièces sur un cas type.</li>
      <li><strong>Réalisation de moodboards</strong> composés de matériaux et de planches d&rsquo;ambiance.</li>
      <li><strong>Découverte des codes du métier</strong> et des références spécialisées.</li>
      <li><strong>Initiation aux bases</strong> techniques et créatives.</li>
      <li><strong>Échanges avec l&rsquo;équipe pédagogique</strong> pour des conseils personnalisés sur votre orientation.</li>
    </ul>
    <p class="pbg-note">Ce programme peut être soumis à modification selon le campus.</p>
  </div>

  <div class="pbg-btn-wrapper">
    <a href="#formulaire" class="pbg-btn">RÉSERVER MA PLACE</a>
  </div>
</section>
<style>
  .programme-bg, .programme-bg * { box-sizing: border-box; }
  .programme-bg {
    font-family: var(--brand-font, 'Inter', sans-serif);
    background: #4b3a8e;
    padding: 50px 20px;
  }
  .programme-bg .pbg-titre {
    text-align: center;
    color: #fff;
    font-size: 1.4rem;
    letter-spacing: 1px;
    margin: 0 0 28px;
  }
  .programme-bg .pbg-card {
    background: #ffffff;
    max-width: 700px;
    margin: 0 auto 28px;
    padding: 28px 32px;
    border-radius: 4px;
  }
  .programme-bg .pbg-checklist {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
  }
  .programme-bg .pbg-checklist li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 14px;
    font-size: 0.9rem;
    color: #2b2b2b;
    line-height: 1.4;
  }
  .programme-bg .pbg-checklist li::before {
    content: "✔";
    color: #4b3a8e;
    font-weight: bold;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .programme-bg .pbg-checklist li strong { font-weight: 700; }
  .programme-bg .pbg-note { font-size: 0.8rem; color: #666; margin: 0; }
  .programme-bg .pbg-btn-wrapper { text-align: center; }
  .programme-bg .pbg-btn {
    display: inline-block;
    background: #ffffff;
    color: #4b3a8e;
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    text-decoration: none;
    padding: 12px 28px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  }
  .programme-bg .pbg-btn:hover { opacity: 0.9; }

  @media (max-width: 500px) {
    .programme-bg .pbg-titre { font-size: 1.1rem; }
    .programme-bg .pbg-card { padding: 20px; }
    .programme-bg .pbg-checklist li { font-size: 0.85rem; }
  }
</style>`
    });
}
