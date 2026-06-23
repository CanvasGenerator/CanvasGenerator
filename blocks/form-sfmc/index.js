export default function(editor, categories) {
    editor.BlockManager.add('form-sfmc', {
        label: 'Formulaire SFMC',
        category: categories.ESSENTIAL,
        content: `
            <section class="form-section">
                <div class="form-container">
                    <h3 class="form-title">Inscrivez-vous</h3>
                    <form class="sfmc-form" method="POST" action="">
                        <div class="form-group-sfmc">
                            <label for="FirstName">Prénom</label>
                            <input type="text" id="FirstName" name="FirstName" required class="form-input">
                        </div>
                        <div class="form-group-sfmc">
                            <label for="LastName">Nom</label>
                            <input type="text" id="LastName" name="LastName" required class="form-input">
                        </div>
                        <div class="form-group-sfmc">
                            <label for="EmailAddress">Email</label>
                            <input type="email" id="EmailAddress" name="EmailAddress" required class="form-input">
                        </div>
                        <div class="form-group-sfmc checkbox-group">
                            <input type="checkbox" id="OptIn" name="OptIn" required>
                            <label for="OptIn">J'accepte de recevoir des communications marketing.</label>
                        </div>
                        <button type="submit" class="form-submit-btn">Envoyer</button>
                    </form>
                </div>
            </section>
            <style>
                .form-section {
                    padding: 50px 0;
                    background-color: #f9f9f9;
                    font-family: 'Inter', sans-serif;
                }
                .form-container {
                    max-width: 500px;
                    margin: 0 auto;
                    background: #fff;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                }
                .form-title {
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 24px;
                    text-align: center;
                    color: #111;
                }
                .sfmc-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .form-group-sfmc {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .form-group-sfmc label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #444;
                }
                .form-input {
                    padding: 12px 16px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    transition: border-color 0.2s;
                }
                .form-input:focus {
                    outline: none;
                    border-color: var(--brand-secondary, #3b82f6);
                }
                .checkbox-group {
                    flex-direction: row;
                    align-items: center;
                    gap: 10px;
                    margin-top: 8px;
                }
                .checkbox-group label {
                    font-weight: 400;
                    font-size: 12px;
                    color: #666;
                    cursor: pointer;
                }
                .form-submit-btn {
                    margin-top: 16px;
                    background-color: var(--brand-secondary, #3b82f6);
                    color: #fff;
                    border: none;
                    padding: 14px;
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .form-submit-btn:hover {
                    background-color: var(--brand-secondary, #2563eb);
                    filter: brightness(0.9);
                    transform: translateY(-1px);
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
