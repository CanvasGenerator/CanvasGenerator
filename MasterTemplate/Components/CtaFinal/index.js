/**
 * Master Template — « CTA final »
 * ───────────────────────────────────────────────────────────────
 * Bandeau de conversion en fin de page : fond pêche, titre, phrase
 * d'accroche et bouton d'appel à l'action. Titre / texte / bouton éditables.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-cta-final', {
        label: 'CTA final',
        category: cat,
        attributes: { class: 'fa fa-flag-checkered' },
        content: `
<section class="cta-final">
  <h2>Vivez l&rsquo;expérience</h2>
  <p>Venez ressentir l&rsquo;ambiance de nos campus et échanger avec ceux qui font l&rsquo;école au quotidien.</p>
  <a href="#formulaire" class="btn-cta-final">S&rsquo;inscrire aux portes ouvertes <span class="fleche">&rarr;</span></a>
</section>
<style>
  .cta-final, .cta-final * { box-sizing: border-box; }
  .cta-final {
    background: #fbdeba;
    text-align: center;
    padding: 52px 24px 60px;
    font-family: var(--brand-font, 'Inter', sans-serif);
    color: var(--brand-text, #1a1a1a);
  }
  .cta-final h2 {
    font-size: 32px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--brand-text, #1a1a1a);
    letter-spacing: .5px;
    margin: 0;
  }
  .cta-final p {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--brand-text, #1a1a1a);
    margin: 18px 0 30px;
  }
  .cta-final .btn-cta-final {
    display: inline-block;
    background: #000000;
    color: var(--brand-button-text, #ffffff);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: .4px;
    padding: 13px 30px;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity .2s;
  }
  .cta-final .btn-cta-final:hover { opacity: .85; }
  .cta-final .btn-cta-final .fleche { margin-left: 10px; }
</style>`
    });
}
