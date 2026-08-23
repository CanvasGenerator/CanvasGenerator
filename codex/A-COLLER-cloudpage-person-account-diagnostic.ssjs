%%[
/* ============================================================================
   DIAGNOSTIC PERSON ACCOUNT — CREATION ET PRENOM
   ============================================================================
   A coller tel quel dans une CloudPage vierge, puis a publier.

   Objectif : isoler la PREMIERE operation Salesforce qui echoue, sans executer
   le handler complet (consentements, campagne, Summit, flows metier, etc.).

   Cette page propose quatre tests independants :
     1. create-min       : RecordTypeId + LastName
     2. create-email     : create-min + PersonEmail
     3. create-firstname : create-email + FirstName
     4. update-firstname : Account.FirstName sur un Person Account existant

   IMPORTANT :
     - La page ECRIT REELLEMENT dans Salesforce.
     - Elle ne supprime jamais les comptes de test.
     - Utiliser un nouveau nom/e-mail pour chaque creation.
     - Remplacer @ACCESS_KEY avant publication. Tant que la valeur par defaut
       est presente, toutes les ecritures sont bloquees.
     - En cas d'erreur Salesforce fatale, la derniere ligne du RunId dans
       LPB_Log_Soumissions indique l'appel qui a casse. Le message exact doit
       ensuite etre lu dans les Debug Logs Salesforce de l'utilisateur MC Connect.
   ============================================================================ */

VAR @ACCESS_KEY, @RT_PERSON_ACCOUNT, @LOG_ACTIF
SET @ACCESS_KEY = "TEST_KEY"
SET @RT_PERSON_ACCOUNT = "012MI00000CDN1VYAX"
SET @LOG_ACTIF = "true"

VAR @submitted, @providedKey, @operation, @diagnosticLabel
VAR @lastName, @firstName, @email, @targetAccountId
VAR @status, @message, @runId, @logOrder, @logResult
VAR @isCreate, @requiredOk, @writeAllowed
VAR @rows, @rowCount, @row, @resultId, @updateResult
VAR @beforeFirstName, @afterFirstName, @afterLastName, @afterEmail
VAR @personContactId, @isPersonAccount
VAR @rtRows, @rtCount, @rtRow, @rtName, @rtDeveloperName, @rtObject, @rtActive
VAR @emailRows, @emailCount

SET @submitted       = RequestParameter("submitted")
SET @providedKey     = RequestParameter("AccessKey")
SET @operation       = Lowercase(Trim(RequestParameter("Operation")))
SET @diagnosticLabel = Trim(RequestParameter("DiagnosticLabel"))
SET @lastName        = Trim(RequestParameter("LastName"))
SET @firstName       = Trim(RequestParameter("FirstName"))
SET @email           = Trim(RequestParameter("PersonEmail"))
SET @targetAccountId = Trim(RequestParameter("TargetAccountId"))

SET @status       = "idle"
SET @message      = ""
SET @resultId     = ""
SET @updateResult = ""
SET @runId        = Substring(Replace(GUID(), "-", ""), 1, 12)
SET @logOrder     = 0
SET @isCreate     = "false"
SET @requiredOk   = "true"
SET @writeAllowed = "false"

/* Verification en lecture seule du RecordType configure. */
SET @rtRows = RetrieveSalesforceObjects("RecordType",
    "Id,Name,DeveloperName,SobjectType,IsActive",
    "Id", "=", @RT_PERSON_ACCOUNT)
SET @rtCount = RowCount(@rtRows)

IF @rtCount > 0 THEN
    SET @rtRow           = Row(@rtRows, 1)
    SET @rtName          = Field(@rtRow, "Name")
    SET @rtDeveloperName = Field(@rtRow, "DeveloperName")
    SET @rtObject        = Field(@rtRow, "SobjectType")
    SET @rtActive        = Field(@rtRow, "IsActive")
ENDIF

IF @submitted == "true" THEN

    IF @ACCESS_KEY == "CHANGE_ME_BEFORE_PUBLISHING" THEN
        SET @status = "error"
        SET @message = "Configuration requise : remplacer @ACCESS_KEY dans le code avant de publier."
    ELSEIF Empty(@providedKey) OR @providedKey != @ACCESS_KEY THEN
        SET @status = "error"
        SET @message = "Cle d'acces incorrecte : aucune ecriture n'a ete tentee."
    ELSE
        SET @writeAllowed = "true"
    ENDIF

    IF @writeAllowed == "true" THEN

        IF @operation == "create-min" THEN
            SET @isCreate = "true"
            IF Empty(@lastName) THEN
                SET @requiredOk = "false"
                SET @message = "LastName est obligatoire pour create-min."
            ENDIF

        ELSEIF @operation == "create-email" THEN
            SET @isCreate = "true"
            IF Empty(@lastName) OR Empty(@email) THEN
                SET @requiredOk = "false"
                SET @message = "LastName et PersonEmail sont obligatoires pour create-email."
            ENDIF

        ELSEIF @operation == "create-firstname" THEN
            SET @isCreate = "true"
            IF Empty(@lastName) OR Empty(@email) OR Empty(@firstName) THEN
                SET @requiredOk = "false"
                SET @message = "LastName, PersonEmail et FirstName sont obligatoires pour create-firstname."
            ENDIF

        ELSEIF @operation == "update-firstname" THEN
            IF Empty(@targetAccountId) OR Empty(@firstName) THEN
                SET @requiredOk = "false"
                SET @message = "TargetAccountId et FirstName sont obligatoires pour update-firstname."
            ENDIF

        ELSE
            SET @requiredOk = "false"
            SET @message = "Operation inconnue : aucune ecriture n'a ete tentee."
        ENDIF

        IF @isCreate == "true" AND @rtCount == 0 THEN
            SET @requiredOk = "false"
            SET @message = "Le RecordTypeId configure est introuvable : creation bloquee."
        ELSEIF @isCreate == "true" AND (@rtObject != "Account" OR Lowercase(@rtActive) != "true") THEN
            SET @requiredOk = "false"
            SET @message = "Le RecordType configure n'est pas un RecordType Account actif : creation bloquee."
        ENDIF

        /* Evite qu'un test de creation avec e-mail ne bascule accidentellement
           vers un doublon. create-min n'a volontairement pas d'e-mail. */
        IF @requiredOk == "true" AND @isCreate == "true" AND NOT Empty(@email) THEN
            SET @emailRows = RetrieveSalesforceObjects("Account", "Id", "PersonEmail", "=", @email)
            SET @emailCount = RowCount(@emailRows)
            IF @emailCount > 0 THEN
                SET @requiredOk = "false"
                SET @message = "Un Account existe deja avec cet e-mail. Utiliser une nouvelle adresse de test."
            ENDIF
        ENDIF

        /* Pour l'update, on verifie AVANT l'appel que la cible existe et qu'il
           s'agit bien d'un Person Account. On ecrit toujours sur Account, jamais
           sur le PersonContactId. */
        IF @requiredOk == "true" AND @operation == "update-firstname" THEN
            SET @rows = RetrieveSalesforceObjects("Account",
                "Id,IsPersonAccount,PersonContactId,FirstName,LastName,PersonEmail",
                "Id", "=", @targetAccountId)
            SET @rowCount = RowCount(@rows)

            IF @rowCount == 0 THEN
                SET @requiredOk = "false"
                SET @message = "Aucun Account ne correspond a TargetAccountId."
            ELSE
                SET @row = Row(@rows, 1)
                SET @isPersonAccount = Field(@row, "IsPersonAccount")
                SET @beforeFirstName = Field(@row, "FirstName")
                SET @personContactId = Field(@row, "PersonContactId")

                IF Lowercase(@isPersonAccount) != "true" THEN
                    SET @requiredOk = "false"
                    SET @message = "La cible existe mais n'est pas un Person Account : update bloque."
                ENDIF
            ENDIF
        ENDIF

        IF @requiredOk != "true" THEN
            SET @status = "error"
        ELSE
            /* Journal AVANT l'appel Salesforce. Si la page meurt, cette ligne
               reste la preuve du dernier appel tente. */
            IF @LOG_ACTIF == "true" THEN
                SET @logOrder = Add(@logOrder, 1)
                SET @logResult = InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrder),
                    "RunId", @runId,
                    "Ordre", @logOrder,
                    "Horodatage", Now(),
                    "Etape", Concat("CODEX START ", @operation),
                    "Statut", "START",
                    "Objet", "Account",
                    "RecordId", @targetAccountId,
                    "Detail", Concat("label=", @diagnosticLabel, " rt=", @RT_PERSON_ACCOUNT),
                    "Email", @email,
                    "Ecole", "codex",
                    "FormType", "diagnostic")
            ENDIF

            /* Un seul appel d'ecriture Salesforce par branche. */
            IF @operation == "create-min" THEN
                SET @resultId = CreateSalesforceObject("Account", 2,
                    "RecordTypeId", @RT_PERSON_ACCOUNT,
                    "LastName", @lastName)

            ELSEIF @operation == "create-email" THEN
                SET @resultId = CreateSalesforceObject("Account", 3,
                    "RecordTypeId", @RT_PERSON_ACCOUNT,
                    "LastName", @lastName,
                    "PersonEmail", @email)

            ELSEIF @operation == "create-firstname" THEN
                SET @resultId = CreateSalesforceObject("Account", 4,
                    "RecordTypeId", @RT_PERSON_ACCOUNT,
                    "LastName", @lastName,
                    "PersonEmail", @email,
                    "FirstName", @firstName)

            ELSEIF @operation == "update-firstname" THEN
                SET @resultId = @targetAccountId
                SET @updateResult = UpdateSingleSalesforceObject("Account",
                    @targetAccountId, "FirstName", @firstName)
            ENDIF

            /* Controle du retour documente : create -> Id, update -> 1. */
            IF @isCreate == "true" AND Empty(@resultId) THEN
                SET @status = "error"
                SET @message = "CreateSalesforceObject n'a renvoye aucun Id."
            ELSEIF @operation == "update-firstname" AND @updateResult != 1 THEN
                SET @status = "error"
                SET @message = Concat("UpdateSingleSalesforceObject a renvoye ", @updateResult, " au lieu de 1.")
            ELSE
                SET @status = "success"
            ENDIF

            /* Relecture apres succes pour verifier la valeur reellement stockee. */
            IF @status == "success" THEN
                SET @rows = RetrieveSalesforceObjects("Account",
                    "Id,IsPersonAccount,PersonContactId,FirstName,LastName,PersonEmail",
                    "Id", "=", @resultId)
                SET @rowCount = RowCount(@rows)

                IF @rowCount == 0 THEN
                    SET @status = "error"
                    SET @message = "L'appel a reussi mais l'Account est introuvable a la relecture."
                ELSE
                    SET @row = Row(@rows, 1)
                    SET @afterFirstName = Field(@row, "FirstName")
                    SET @afterLastName = Field(@row, "LastName")
                    SET @afterEmail = Field(@row, "PersonEmail")
                    SET @personContactId = Field(@row, "PersonContactId")
                    SET @isPersonAccount = Field(@row, "IsPersonAccount")

                    IF @operation == "update-firstname" AND @afterFirstName != @firstName THEN
                        SET @status = "error"
                        SET @message = "L'update a renvoye 1, mais FirstName ne correspond pas a la relecture."
                    ELSE
                        SET @message = "Operation Salesforce terminee et verifiee par relecture."
                    ENDIF
                ENDIF
            ENDIF

            IF @LOG_ACTIF == "true" THEN
                SET @logOrder = Add(@logOrder, 1)
                SET @logResult = InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrder),
                    "RunId", @runId,
                    "Ordre", @logOrder,
                    "Horodatage", Now(),
                    "Etape", Concat("CODEX END ", @operation),
                    "Statut", Uppercase(@status),
                    "Objet", "Account",
                    "RecordId", @resultId,
                    "Detail", Concat("label=", @diagnosticLabel, " updateReturn=", @updateResult, " message=", @message),
                    "Email", @email,
                    "Ecole", "codex",
                    "FormType", "diagnostic")
            ENDIF
        ENDIF
    ENDIF
ENDIF
]%%

<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Diagnostic Person Account</title>
  <style>
    body{font:14px/1.5 Arial,sans-serif;background:#f5f7fa;color:#182230;margin:0;padding:24px}
    main{max-width:780px;margin:auto;background:#fff;border:1px solid #dce1e8;border-radius:10px;padding:24px}
    h1{margin:0 0 6px;font-size:24px} h2{margin:24px 0 10px;font-size:17px}
    .note,.result,.rt{padding:12px 14px;border-radius:7px;margin:14px 0}
    .note{background:#fff7db;border:1px solid #e8c75b}.rt{background:#edf5ff;border:1px solid #9dc7ef}
    .ok{background:#e9f8ef;border:1px solid #68bf86}.ko{background:#fff0f0;border:1px solid #e19595}
    label{display:block;font-weight:700;margin-top:12px} input,select{box-sizing:border-box;width:100%;padding:9px;margin-top:4px;border:1px solid #b8c1cc;border-radius:5px}
    button{margin-top:18px;padding:11px 18px;border:0;border-radius:5px;background:#163b65;color:#fff;font-weight:700;cursor:pointer}
    code{background:#eef1f5;padding:2px 5px;border-radius:4px;word-break:break-all}
    table{border-collapse:collapse;width:100%;margin-top:10px}td{border-bottom:1px solid #e1e5ea;padding:7px 5px;vertical-align:top}td:first-child{width:190px;font-weight:700}
  </style>
</head>
<body>
<main>
  <h1>Diagnostic Person Account</h1>
  <p>Un seul appel d'ecriture Salesforce est execute par soumission.</p>

  <div class="note">
    Cette page ecrit reellement dans le CRM et ne supprime rien. Notez les Ids crees
    et faites supprimer les comptes de test apres le diagnostic.
  </div>

  <div class="rt">
    <strong>RecordType configure</strong><br>
    Id : <code>%%=v(@RT_PERSON_ACCOUNT)=%%</code><br>
    %%[ IF @rtCount > 0 THEN ]%%
      Objet : <code>%%=v(@rtObject)=%%</code> &middot;
      Name : <code>%%=v(@rtName)=%%</code> &middot;
      DeveloperName : <code>%%=v(@rtDeveloperName)=%%</code> &middot;
      Actif : <code>%%=v(@rtActive)=%%</code>
    %%[ ELSE ]%%
      <strong>INTROUVABLE</strong> — ne lancez aucune creation.
    %%[ ENDIF ]%%
  </div>

  %%[ IF @submitted == "true" THEN ]%%
    <div class="result %%[ IF @status == "success" THEN ]%%ok%%[ ELSE ]%%ko%%[ ENDIF ]%%">
      <strong>Statut : %%=v(@status)=%%</strong><br>
      %%=v(@message)=%%<br>
      RunId : <code>%%=v(@runId)=%%</code>
      %%[ IF NOT Empty(@resultId) THEN ]%%<br>Account Id : <code>%%=v(@resultId)=%%</code>%%[ ENDIF ]%%
    </div>

    %%[ IF @status == "success" THEN ]%%
      <table>
        <tr><td>IsPersonAccount</td><td><code>%%=v(@isPersonAccount)=%%</code></td></tr>
        <tr><td>PersonContactId</td><td><code>%%=v(@personContactId)=%%</code></td></tr>
        <tr><td>FirstName avant</td><td><code>%%=v(@beforeFirstName)=%%</code></td></tr>
        <tr><td>FirstName apres</td><td><code>%%=v(@afterFirstName)=%%</code></td></tr>
        <tr><td>LastName apres</td><td><code>%%=v(@afterLastName)=%%</code></td></tr>
        <tr><td>PersonEmail apres</td><td><code>%%=v(@afterEmail)=%%</code></td></tr>
        <tr><td>Retour update</td><td><code>%%=v(@updateResult)=%%</code></td></tr>
      </table>
    %%[ ENDIF ]%%
  %%[ ENDIF ]%%

  <h2>Lancer un test</h2>
  <form method="post" action="">
    <input type="hidden" name="submitted" value="true">

    <label for="AccessKey">Cle d'acces configuree dans le code</label>
    <input id="AccessKey" name="AccessKey" type="password" autocomplete="off" required>

    <label for="DiagnosticLabel">Libelle du test</label>
    <input id="DiagnosticLabel" name="DiagnosticLabel" value="T1" required>

    <label for="Operation">Operation</label>
    <select id="Operation" name="Operation" required>
      <option value="create-min">1 — Create : RecordTypeId + LastName</option>
      <option value="create-email">2 — Create : + PersonEmail</option>
      <option value="create-firstname">3 — Create : + FirstName</option>
      <option value="update-firstname">4 — Update Account.FirstName</option>
    </select>

    <label for="LastName">LastName (tests 1, 2 et 3)</label>
    <input id="LastName" name="LastName" value="CODEX-DIAG">

    <label for="PersonEmail">PersonEmail (tests 2 et 3 — adresse nouvelle)</label>
    <input id="PersonEmail" name="PersonEmail" type="email" placeholder="adresse-test-unique@example.com">

    <label for="FirstName">FirstName (tests 3 et 4)</label>
    <input id="FirstName" name="FirstName" value="Alpha">

    <label for="TargetAccountId">Target Account Id (test 4 uniquement)</label>
    <input id="TargetAccountId" name="TargetAccountId" placeholder="001...">

    <button type="submit">Executer un seul test CRM</button>
  </form>

  <h2>Ordre recommande</h2>
  <ol>
    <li>Lancer le test 1. S'il echoue, arreter : RecordType, permissions, VR, Flow ou Apex.</li>
    <li>Lancer le test 2 avec un e-mail neuf. S'il echoue, isoler PersonEmail/duplicate rules.</li>
    <li>Lancer le test 3 avec un autre e-mail neuf. S'il echoue, isoler FirstName.</li>
    <li>Lancer le test 4 sur un Person Account de test. Le retour doit valoir <code>1</code>.</li>
  </ol>

  <p>Si la page Salesforce remplace tout le contenu par une erreur, cherchez la derniere
     ligne <code>CODEX START</code> dans <code>LPB_Log_Soumissions</code>, puis consultez
     les Debug Logs Salesforce de l'utilisateur Marketing Cloud Connect.</p>
</main>
</body>
</html>
