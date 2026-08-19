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
                                font-family: var(--brand-font, 'Inter', sans-serif);
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
                            </select></div>
                        <div class="form-row">
                            <div class="form-group-core"><label>Nom</label><input type="text" name="LastName" required
                                    placeholder="Dupont" /></div>
                            <div class="form-group-core"><label>Prénom</label><input type="text" name="FirstName"
                                    required placeholder="Jean" /></div>
                        </div>
                        <div class="form-group-core"><label>Email</label><input type="email" name="EmailAddress"
                                required placeholder="jean@exemple.com" /></div>

                        <!-- LISTES ALIMENTÉES PAR LE CRM (LPB_Picklist_Handler_AG).
                             Chaque option vide sert de placeholder : le handler la conserve
                             et ajoute les valeurs Salesforce derrière. Un name[] retiré ici
                             est simplement ignoré côté handler. -->
                        <div class="form-row">
                            <div class="form-group-core"><label>Pays de résidence</label><select name="Country"
                                    class="form-select-core">
                                    <option value="">Chargement…</option>
                                </select></div>
                            <div class="form-group-core"><label>Niveau d'études</label><select name="StudyLevel"
                                    class="form-select-core">
                                    <option value="">Chargement…</option>
                                </select></div>
                        </div>
                        <div class="form-group-core"><label>Campus</label><select name="Campus"
                                class="form-select-core">
                                <option value="">Choisir un campus…</option>
                            </select></div>
                        <div class="form-row">
                            <div class="form-group-core"><label>Niveau visé</label><select name="Niveau"
                                    class="form-select-core">
                                    <option value="">Choisir…</option>
                                </select></div>
                            <div class="form-group-core"><label>Spécialité</label><select name="Speciality"
                                    class="form-select-core">
                                    <option value="">Choisir…</option>
                                </select></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group-core"><label>Rythme</label><select name="Rhythm"
                                    class="form-select-core">
                                    <option value="">Choisir…</option>
                                </select></div>
                            <div class="form-group-core"><label>Langue</label><select name="Language"
                                    class="form-select-core">
                                    <option value="">Choisir…</option>
                                </select></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group-core"><label>Rentrée</label><select name="Rentree"
                                    class="form-select-core">
                                    <option value="">Choisir…</option>
                                </select></div>
                            <div class="form-group-core"><label>Programme</label><select name="Programme"
                                    class="form-select-core">
                                    <option value="">Choisir…</option>
                                </select></div>
                        </div>

                        <!-- Résolu par la cascade, transmis à l'écriture -->
                        <input type="hidden" name="PTAT_Id" value="" />

                        <button type="submit"
                            class="form-core-submit"><span>Envoyer au CRM</span><i class="fas fa-database"></i></button>
                    </form>

                    <!-- INJECTION DU HANDLER DE PICKLISTS — APRÈS le formulaire :
                         il émet un <script> et a besoin que les <select> existent
                         déjà dans le DOM. Ne jamais le remettre dans un <select>. -->
                    <div class="sfmc-snippet-picklists">
                        %%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%
                    </div>
                </div>
            </section>

            <style>
                .sfmc-snippet-logic, .sfmc-snippet-messages, .sfmc-snippet-picklists { display: none !important; }
                .form-select-core:disabled { opacity: .55; cursor: not-allowed; }
                .form-core-section { padding: 60px 20px; background: var(--brand-surface, #f5f5f5); font-family: var(--brand-font, 'Inter', sans-serif); }
                .form-core-container { max-width: 480px; margin: 0 auto; background: var(--brand-background, #ffffff); padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
                .sf-logo-badge { width: 40px; height: 40px; background: #00A1E0; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; color: white; font-size: 18px; }
                .form-header-premium { text-align: center; margin-bottom: 25px; }
                .form-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
                .form-subtitle { color: #64748b; font-size: 13px; margin-top: 5px; }
                .sf-core-form { display: flex; flex-direction: column; gap: 15px; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .form-group-core { display: flex; flex-direction: column; gap: 5px; }
                .form-group-core label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; }
                .form-group-core input, .form-select-core { padding: 12px 14px; border: 1px solid var(--brand-border, #e5e7eb); border-radius: 8px; font-size: 14px; background: #f8fafc; }
                .form-core-submit { margin-top: 5px; background: #00A1E0; color: white; border: none; padding: 15px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}

