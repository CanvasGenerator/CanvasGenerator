export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-programme', {
        label: 'Bloc Programme',
        category: cat,
        content: `
<section class="mp-section">
  <div class="mp-inner">
    <p class="mp-title">Au programme :</p>
    <ul class="mp-list">
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text"><strong>Conférence de présentation</strong> par les équipes pédagogiques et intervenants professionnels</span>
      </li>
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text"><strong>Visite du campus</strong> par nos étudiants et découverte de leurs productions</span>
      </li>
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text"><strong>Rendez-vous individuels de coaching d'orientation</strong></span>
      </li>
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text">Échanges avec des <strong>professionnels qui recrutent</strong></span>
      </li>
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text"><strong>Témoignages métiers</strong> en présence de diplômés</span>
      </li>
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text">Présentation par l'équipe des Relations Entreprises des <strong>dispositifs d'accompagnement</strong> dans la recherche de stages / alternance, projet professionnel</span>
      </li>
      <li class="mp-item">
        <span class="mp-check">✓</span>
        <span class="mp-text">Entraînements et <strong>conseils pour les admissions</strong></span>
      </li>
    </ul>
  </div>
</section>
<style>
  .mp-section {
    padding: 48px 24px;
    background: #fff;
    font-family: Arial, sans-serif;
  }
  .mp-inner { max-width: 760px; margin: 0 auto; }
  .mp-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-main, #111);
    margin: 0 0 20px;
  }
  .mp-list { list-style: none; margin: 0; padding: 0; }
  .mp-item {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 10px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .mp-item:last-child { border-bottom: none; }
  .mp-check {
    color: var(--brand-primary, #1f2937);
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .mp-text {
    font-size: 14px;
    color: var(--text-main, #222);
    line-height: 1.5;
  }
  @media (max-width: 768px) {
    .mp-section { padding: 32px 16px; }
  }
</style>`,
        attributes: { class: 'fa fa-check-square-o' }
    });
}
