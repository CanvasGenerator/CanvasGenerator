export default function (editor, categories) {
    editor.BlockManager.add('form-salesforce-core', {
        label: 'Formulaire SF Core (Snippets)',
        category: categories.ESSENTIAL,
        content: `
            <section class="form-core-section">
                <!-- INJECTION DU SNIPPET SFMC POUR LE TRAITEMENT DU FORMULAIRE -->
                <div class="sfmc-snippet-logic" id="i7g8au">
                    %%=ContentBlockByKey("LPB_Form_Handler_AG")=%%
                </div>
                <div class="form-core-container">
                    <div class="form-header-premium">
                        <div class="sf-logo-badge"><i class="fab fa-salesforce"></i></div>
                        <h3 class="form-title">Contact CRM</h3>
                        <p class="form-subtitle">Formulaire intelligent Salesforce Core</p>
                    </div>
                    <!-- INJECTION DU SNIPPET SFMC POUR LES MESSAGES DE RETOUR -->
                   <div class="sfmc-snippet-messages" id="ipkr0e">
                        <div style="display:none;">%%[
                        /* Removed the invalid SET = v() lines. 
                        The variables are already populated by SSJS */
                        IF @sfStatus == "success" OR @sfStatus == "error" THEN
                        ]%%</div>
                        <style>
                            /* Rend le conteneur des messages visible */
                            #ipkr0e {
                                display: block !important;
                            }
                            .sfmc-msg {
                                display: flex;
                                align-items: flex-start;
                                gap: 12px;
                                padding: 16px 20px;
                                border-radius: 10px;
                                font-family: Outfit, sans-serif;
                                font-size: 14px;
                                line-height: 1.5;
                                margin-bottom: 20px;
                            }
                            .sfmc-msg i {
                                font-size: 20px;
                                flex-shrink: 0;
                                margin-top: 2px;
                            }
                            .sfmc-msg--success {
                                background-color: #ecfdf5;
                                color: #065f46;
                                border: 1px solid #6ee7b7;
                            }
                            .sfmc-msg--success i {
                                color: #059669;
                            }
                            .sfmc-msg--error {
                                background-color: #fef2f2;
                                color: #991b1b;
                                border: 1px solid #fca5a5;
                            }
                            .sfmc-msg--error i {
                                color: #dc2626;
                            }
                        </style>

                        <div style="display:none;">%%[ IF @sfStatus == "success" THEN ]%%</div>

                        <style>
                            /* Masque le formulaire en cas de succès */
                            #ibbb9b, .sf-core-form-wrapper { 
                                display: none !important; 
                            }
                        </style>

                        <div class="sfmc-msg sfmc-msg--success">
                            <i class="fas fa-check-circle"></i>
                            <div>
                                <strong>Merci pour votre inscription !</strong>

                                Votre demande a bien été transmise à notre équipe. Nous vous contacterons prochainement pour confirmer votre visite.
                            </div>
                        </div>

                        <div style="display:none;">%%[ ELSEIF @sfStatus == "error" THEN ]%%</div>

                        <div class="sfmc-msg sfmc-msg--error">
                            <i class="fas fa-exclamation-circle"></i>
                            <div>
                                <strong>Une erreur est survenue</strong>

                                Nous n'avons pas pu traiter votre demande. (%%=v(@sfErrorMsg)=%%)
                            </div>
                        </div>

                        <div style="display:none;">%%[ ENDIF ]%%
                        %%[ ENDIF ]%%</div>
                    </div>
                    <form method="POST" action="%%=RequestParameter('PAGEURL')=%%" class="sf-core-form"><input
                            type="hidden" name="submitted" value="true" />
                        <div class="form-group-core"><label>École souhaitée</label><select name="SchoolId" required
                                class="form-select-core">
                                <option value="">Choisir une école...</option>
                                <!-- VALEURS STATIQUES POUR L'APERÇU DU BUILDER -->
                                <option value="efap">EFAP</option>
                                <option value="brassart">BRASSART</option>
                                <option value="icart">ICART</option>
                                <!-- INJECTION DU SNIPPET POUR LA PICKLIST DYNAMIQUE SFMC -->

                                %%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%
                            </select></div>
                        <div class="form-row">
                            <div class="form-group-core"><label>Nom</label><input type="text" name="LastName" required
                                    placeholder="Dupont" /></div>
                            <div class="form-group-core"><label>Prénom</label><input type="text" name="FirstName"
                                    required placeholder="Jean" /></div>
                        </div>
                        <div class="form-group-core"><label>Email</label><input type="email" name="EmailAddress"
                                required placeholder="jean@exemple.com" /></div><button type="submit"
                            class="form-core-submit"><span>Envoyer au CRM</span><i class="fas fa-database"></i></button>
                    </form>
                </div>
            </section>

            <style>
                .sfmc-snippet-logic, .sfmc-snippet-messages { display: none !important; }
                .form-core-section { padding: 60px 20px; background: #f1f5f9; font-family: 'Outfit', sans-serif; }
                .form-core-container { max-width: 480px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
                .sf-logo-badge { width: 40px; height: 40px; background: #00A1E0; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; color: white; font-size: 18px; }
                .form-header-premium { text-align: center; margin-bottom: 25px; }
                .form-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
                .form-subtitle { color: #64748b; font-size: 13px; margin-top: 5px; }
                .sf-core-form { display: flex; flex-direction: column; gap: 15px; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .form-group-core { display: flex; flex-direction: column; gap: 5px; }
                .form-group-core label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; }
                .form-group-core input, .form-select-core { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: #f8fafc; }
                .form-core-submit { margin-top: 5px; background: #00A1E0; color: white; border: none; padding: 15px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}

