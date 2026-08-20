%%[
/* ============================================================================
   SONDE D'ECRITURE SALESFORCE — AMPscript, depuis une CloudPage
   ============================================================================
   Repond a UNE question, avant d'engager le portage du socle d'ecriture :
   AMPscript sait-il ECRIRE dans Salesforce depuis cette page, comme il sait
   deja y lire ?

   Ce n'est pas acquis. La lecture est prouvee ; l'ecriture passe par d'autres
   fonctions (CreateSalesforceObject / UpdateSingleSalesforceObject) et peut
   dependre de droits differents. Ecrire le socle d'ecriture sans cette reponse
   reviendrait a produire des centaines de lignes sur une supposition.

   --- SECURITE -------------------------------------------------------------
   Cette page est INERTE par defaut. Sans ?write=1 elle ne fait que LIRE et
   afficher. La publier ne modifie donc rien.

   Pour declencher l'ecriture, il faut fournir explicitement les trois :
       ?write=1&id=<RecordId>&val=<valeur>

   Elle n'ecrit QU'UN champ, sur UN enregistrement designe par l'appelant :
   Account.UTMSource__c, un champ de tracking marketing. Elle ne cree rien,
   ne supprime rien, ne touche a aucun champ d'identite ni de consentement.
   La valeur precedente est affichee AVANT modification, pour pouvoir la
   remettre a la main.
   ============================================================================ */
VAR @write, @id, @val, @rows, @n, @row, @avant, @res

SET @write = RequestParameter("write")
SET @id    = RequestParameter("id")
SET @val   = RequestParameter("val")
IF Empty(@val) THEN SET @val = "LPB-PROBE" ENDIF
]%%

<h2>Sonde d'&eacute;criture Salesforce &mdash; AMPscript</h2>

%%[ IF Empty(@id) THEN ]%%
    <p>Aucun enregistrement d&eacute;sign&eacute;. Cette page est <b>inerte</b>.</p>
    <p>Usage :<br>
    <code>?id=001AW00001igoPyYAI</code> &mdash; lecture seule, affiche la valeur actuelle<br>
    <code>?id=001AW00001igoPyYAI&amp;write=1&amp;val=LPB-PROBE-01</code> &mdash; &eacute;crit</p>

%%[ ELSE ]%%

    %%[ /* 1. Etat AVANT — sert aussi de preuve que l'Id existe et est lisible. */
    SET @rows = RetrieveSalesforceObjects("Account", "Id,Name,UTMSource__c", "Id", "=", @id)
    SET @n = RowCount(@rows)
    IF @n > 0 THEN
        SET @row = Row(@rows, 1)
        SET @avant = Field(@row, "UTMSource__c")
    ENDIF
    ]%%

    %%[ IF @n == 0 THEN ]%%
        <p style="color:#b91c1c">Aucun Account avec l'Id <code>%%=v(@id)=%%</code>.</p>
    %%[ ELSE ]%%
        <p>Cible : <b>%%=Field(@row,"Name")=%%</b> (<code>%%=v(@id)=%%</code>)</p>
        <p><code>UTMSource__c</code> AVANT : <b>[%%=v(@avant)=%%]</b>
           &mdash; noter cette valeur pour pouvoir la remettre.</p>

        %%[ IF @write == "1" THEN ]%%
            %%[ /* 2. L'ecriture. UpdateSingleSalesforceObject rend le nombre de
                   lignes modifiees. Toute erreur de droits ou de contexte se
                   manifestera ici, exactement comme le faisait le SSJS. */
            SET @res = UpdateSingleSalesforceObject("Account", @id, "UTMSource__c", @val)
            ]%%
            <p style="color:#065f46">&Eacute;criture tent&eacute;e &mdash; retour :
               <b>%%=v(@res)=%%</b> (1 = une ligne modifi&eacute;e)</p>

            %%[ /* 3. Relecture : le retour de la fonction ne suffit pas, on verifie. */
            SET @rows = RetrieveSalesforceObjects("Account", "Id,UTMSource__c", "Id", "=", @id)
            ]%%
            <p><code>UTMSource__c</code> APRES : <b>[%%=Field(Row(@rows,1),"UTMSource__c")=%%]</b></p>
            <p>Si la valeur APRES vaut <code>%%=v(@val)=%%</code>, <b>l'&eacute;criture AMPscript
               fonctionne</b> et le portage du socle d'&eacute;criture peut commencer.</p>
        %%[ ELSE ]%%
            <p>Lecture seule. Ajouter <code>&amp;write=1</code> pour tenter l'&eacute;criture.</p>
        %%[ ENDIF ]%%
    %%[ ENDIF ]%%
%%[ ENDIF ]%%
