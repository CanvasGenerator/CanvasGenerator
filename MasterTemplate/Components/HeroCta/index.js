/**
 * Master Template — « Hero + CTA »
 * ───────────────────────────────────────────────────────────────
 * Bandeau d'accroche : fond pêche, titre en majuscules, sous-titre et
 * bouton d'appel à l'action. Titre / sous-titre / bouton éditables.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-hero-cta', {
        label: 'Hero + CTA',
        category: cat,
        attributes: { class: 'fa fa-bullhorn' },
        content: `
<section class="hero">
  <h1>Venez découvrir<br>votre futur métier</h1>
  <p class="hero-sous-titre">Découvrez notre école de communication hors Parcoursup.<br>Rencontrez nos étudiants, nos experts et plongez au c&oelig;ur de l&rsquo;école.</p>
  <a href="#formulaire" class="btn-cta">S&rsquo;inscrire aux portes ouvertes <span class="fleche">&rarr;</span></a>
</section>
<style>
  .hero, .hero * { box-sizing: border-box; }
  .hero {
    background: #f9dfbc;
    text-align: center;
    padding: 64px 24px 56px;
    font-family: var(--brand-font, 'Inter', sans-serif);
    color: var(--brand-text, #1a1a1a);
  }
  .hero h1 {
    font-size: 42px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    line-height: 1.15;
    margin: 0;
  }
  .hero .hero-sous-titre {
    font-size: 16px;
    font-weight: 600;
    margin: 22px auto 30px;
    max-width: 640px;
  }
  .hero .btn-cta {
    display: inline-block;
    background: #000000;
    color: var(--brand-button-text, #ffffff);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .5px;
    padding: 14px 32px;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity .2s;
  }
  .hero .btn-cta:hover { opacity: .85; }
  .hero .btn-cta .fleche { margin-left: 10px; }

  @media (max-width: 860px) {
    .hero h1 { font-size: 30px; }
  }
</style>`
    });
}
