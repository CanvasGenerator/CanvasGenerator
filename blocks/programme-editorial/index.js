export default function(editor, categories) {
    editor.BlockManager.add('programme-editorial', {
        label: 'Programme Editorial',
        category: categories.ESSENTIAL,
        content: `
            <section class="progx-section">
                <div class="progx-container">
                    <h3 class="progx-title">Au programme :</h3>
                    <ul class="progx-list">
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text"><strong>Conference de presentation</strong> par les equipes pedagogiques et intervenants professionnels</span>
                        </li>
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text"><strong>Visite du campus</strong> par nos etudiants et decouverte de leurs productions</span>
                        </li>
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text"><strong>Rendez-vous individuels de coaching d'orientation</strong></span>
                        </li>
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text">Echanges avec des <strong>professionnels de la communication qui recrutent</strong></span>
                        </li>
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text"><strong>Temoignages metiers</strong> en presence de diplomes de l'EFAP</span>
                        </li>
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text">Presentation par l'equipe des Relations Entreprises des <strong>dispositifs d'accompagnement</strong> dans la recherche de stages / alternance, projet professionnel</span>
                        </li>
                        <li class="progx-item">
                            <span class="progx-icon" aria-hidden="true">✓</span>
                            <span class="progx-text">Entrainements et <strong>conseils pour les admissions</strong></span>
                        </li>
                    </ul>
                </div>
            </section>
            <style>
                .progx-section {
                    padding: 56px 20px;
                    background-color: #ffffff;
                    font-family: 'Inter', sans-serif;
                    color: #111111;
                }
                .progx-container {
                    max-width: 900px;
                    margin: 0 auto;
                }
                .progx-title {
                    margin: 0 0 28px 0;
                    font-size: 22px;
                    font-weight: 800;
                    line-height: 1.2;
                }
                .progx-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 26px;
                }
                .progx-item {
                    display: grid;
                    grid-template-columns: 26px minmax(0, 1fr);
                    align-items: start;
                    column-gap: 18px;
                }
                .progx-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 700;
                    line-height: 1;
                    color: #111111;
                    transform: translateY(2px);
                }
                .progx-text {
                    font-size: 18px;
                    font-weight: 400;
                    line-height: 1.35;
                    color: #1a1a1a;
                }
                .progx-text strong {
                    font-weight: 800;
                    color: #111111;
                }
                @media (max-width: 768px) {
                    .progx-section {
                        padding: 40px 18px;
                    }
                    .progx-container {
                        max-width: 420px;
                    }
                    .progx-title {
                        margin-bottom: 22px;
                        font-size: 20px;
                    }
                    .progx-list {
                        gap: 22px;
                    }
                    .progx-item {
                        grid-template-columns: 22px minmax(0, 1fr);
                        column-gap: 14px;
                    }
                    .progx-icon {
                        font-size: 16px;
                    }
                    .progx-text {
                        font-size: 16px;
                        line-height: 1.32;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });
}
