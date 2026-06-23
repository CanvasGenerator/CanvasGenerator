export default function(editor, categories) {
    editor.BlockManager.add('programme-list', {
        label: 'Programme List',
        category: categories.ESSENTIAL,
        content: `
            <section class="programme-section">
                <div class="programme-container">
                    <h3 class="programme-title">Au programme :</h3>
                    <ul class="programme-list">
                        <li><strong>Conférence de présentation</strong> par les équipes pédagogiques et intervenants professionnels</li>
                        <li><strong>Visite du campus</strong> par nos étudiants et découverte de leurs productions</li>
                        <li><strong>Rendez-vous individuels de coaching</strong> d'orientation</li>
                        <li><strong>Échanges avec des professionnels de la communication</strong> qui recrutent</li>
                        <li><strong>Témoignages métiers</strong> en présence de diplômés de l'EFAP</li>
                        <li>Présentation par l'équipe des Relations Entreprises des <strong>dispositifs d'accompagnement</strong> dans la recherche de stages / alternance, projet professionnel</li>
                        <li><strong>Entraînements et conseils pour les admissions</strong></li>
                    </ul>
                </div>
            </section>
            <style>
                .programme-section {
                    padding: 40px 0;
                    font-family: 'Inter', sans-serif;
                    background-color: #fff;
                    color: #000;
                }
                .programme-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 0 20px;
                }
                .programme-title {
                    font-size: 18px;
                    font-weight: 700;
                    margin-bottom: 24px;
                }
                .programme-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .programme-list li {
                    position: relative;
                    padding-left: 35px;
                    margin-bottom: 20px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .programme-list li::before {
                    content: '✓';
                    position: absolute;
                    left: 0;
                    top: 0;
                    font-weight: bold;
                    font-size: 16px;
                }
                .programme-list li strong {
                    font-weight: 700;
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });
}
