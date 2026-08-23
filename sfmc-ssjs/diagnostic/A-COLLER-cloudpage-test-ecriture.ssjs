%%[
/* ============================================================================
   HANDLER FORMULAIRE — ECRITURE SALESFORCE EN AMPSCRIPT
   ============================================================================
   Porte `handler-form.ssjs` + `socle-upsert.ssjs`. A inclure EN HAUT de la
   CloudPage, avant l'affichage du formulaire.

   Pourquoi AMPscript : sur cette org, ni une CloudPage ni une Automation ne
   peuvent atteindre Salesforce en SSJS (« Unable to retrieve security
   descriptor for this frame »). AMPscript y lit ET y ecrit — ecriture verifiee
   le 2026-08-17. Cf. ../diagnostic/README.md. Ne pas re-tenter en SSJS.

   Sequence, identique pour tous les formulaires de la famille campagne :
       1. Account (Person Account)  upsert sur PersonEmail, fill-if-blank
       2. ContactPointConsent       upsert sur ContactPointId + Channel__c
       3. CampaignMember            upsert sur CampaignId + PA

   --- Ce qu'AMPscript impose, et qui explique la forme du code --------------
   1. PAS de fonctions utilisateur. `fillIfBlank` et `mapTracking`, factorises
      en SSJS, sont donc deroules ici. C'est verbeux et c'est assume : le seul
      moyen de le raccourcir serait de perdre le fill-if-blank.
   2. `UpdateSingleSalesforceObject` ne prend PAS de compteur de champs,
      contrairement a `CreateSalesforceObject` — asymetrie facile a rater.
   3. Le nombre d'arguments ne peut pas etre construit dynamiquement : le
      fill-if-blank se fait donc en UN APPEL PAR CHAMP a completer. Seuls les
      champs reellement vides declenchent un appel, donc en pratique zero ou un
      sur un contact deja connu.
   4. PAS de try/catch : une erreur remplace la page. Chaque appel est donc
      precede de ses garde-fous (email present, Id resolu, valeur non vide).
   ============================================================================ */

/* ⚠⚠ A RENSEIGNER AVANT TOUTE MISE EN SERVICE ⚠⚠
   RecordTypeId du Person Account de l'org (UAT != Prod).
   Tant qu'il est vide, ce handler NE CREE AUCUN compte : il se limite a
   completer les comptes existants. C'est volontaire — creer un Account sans
   RecordType produirait des comptes ENTREPRISE au lieu de comptes personnels,
   erreur silencieuse et penible a rattraper en masse. */
VAR @RT_PERSON_ACCOUNT
/* Releve sur l'org RECETTE le 2026-08-17 : RecordType DeveloperName
   = "PersonAccount", libelle "Compte personnel". A REVERIFIER en Prod, les
   RecordTypeId ne sont pas portables d'une org a l'autre. */
SET @RT_PERSON_ACCOUNT = "012Wx000000KF9NIAW"

/* ---- CIBLE DES CHAMPS D'IDENTITE -----------------------------------------
   Account ou Contact ? Les DEUX fonctionnent, verifie le 2026-08-23 :
     Account.FirstName sur 001AW00001igoPyYAI -> OK
     Contact.FirstName sur 003AW00000zuDx7YAE -> OK

   On garde le Contact par defaut : sur un Person Account, FirstName y est un
   champ autonome, alors que sur Account c'est un composant du champ compose
   `Name` (visible dans l'Object Manager, indente sous « Account Name »). Ecrire
   la ou le champ existe vraiment est plus sur, meme si l'org tolere les deux.

   "false" pour ecrire directement sur l'Account. */
VAR @IDENTITE_SUR_CONTACT
SET @IDENTITE_SUR_CONTACT = "true"

/* ---- ECRITURE DE L'IDENTITE : ACTIVE ------------------------------------
   ⚠ CORRECTION du 2026-08-23. Les runs dd774885111d et b8b0b6d5ea58 avaient
   conclu que FirstName etait refuse sur Account ET sur Contact. C'ETAIT FAUX :
   les deux essais visaient le meme enregistrement, `001AW00001ihDOvYAM`
   (bob.martin.test@edh-test.com), qui refuse TOUTE ecriture — y compris sur un
   simple champ custom.

   Verifie par les blocs de diagnostic sur deux autres comptes :
     Account.FirstName  sur 001AW00001igoPyYAI et 001AW00001xraQIYAY -> OK
     Contact.FirstName  sur 003AW00000zuDx7YAE                       -> OK
     Account.UTMSource__c sur les memes                              -> OK

   Lecon : ne jamais conclure sur un champ a partir d'un seul enregistrement.
   Le compte 001AW00001ihDOvYAM est a ecarter des jeux de test (verrou ou
   partage propre a ce record, non diagnostique). */
VAR @ECRIRE_IDENTITE
SET @ECRIRE_IDENTITE = "true"
/* ⚠ REGLES DE BLOCAGE CANDIDATURE — noms NON VERIFIES sur l'org.
   Ils viennent du document de cadrage. Tant que @REGLES_ACTIVES vaut "false",
   aucune lecture n'est tentee : publier ce handler est donc sans risque.
   Passer a "true" UNIQUEMENT apres avoir confirme les 5 noms ci-dessous avec
   la sonde (?champs=IndividualApplication). Un nom faux tue la page a chaque
   soumission de candidature. */
VAR @REGLES_ACTIVES, @OBJ_APPLICATION, @F_APP_PERSON, @F_APP_PTAT, @F_APP_STATUS
VAR @F_APP_YEAR, @VAL_REFUSE
SET @REGLES_ACTIVES  = "false"
SET @OBJ_APPLICATION = "IndividualApplication"
SET @F_APP_PERSON    = "ContactId"
SET @F_APP_PTAT      = "ProgramTermApplnTimelineId"
SET @F_APP_STATUS    = "Status"
SET @F_APP_YEAR      = "AcademicYear__c"
/* Compare en minuscules et en SOUS-CHAINE : les libelles de statut varient
   ("Refused", "Decision defavorable", "Rejected"). A ajuster au value set. */
SET @VAL_REFUSE      = "refus"

VAR @sfBlockMsg, @candContactId, @candRows, @nCand, @candStatut
SET @sfBlockMsg = ""

VAR @submitted, @email, @ecole, @formType
VAR @lastName, @firstName, @country, @indicatif, @mobile, @studyLevel, @vousEtes
VAR @ptatId, @campaignId, @brandId, @legalText, @legalFooter
VAR @utmS, @utmM, @utmC, @utmCo, @utmT, @utmI, @gclid, @fbclid, @clientId, @canal, @sousCanal
VAR @rows, @n, @row, @paId, @paContactId, @isNew, @schoolAccId
VAR @i, @canalParam, @canalValue, @coche, @cpcId, @cmId, @preuve, @cpEmail, @cpPhone, @cpId
VAR @isEvent, @instanceId, @extId, @regId, @appts, @apptRows, @nA, @apptType
VAR @zone, @cleCampagne, @campActif, @typeEvt, @mode, @langue, @typeForm
VAR @sfStatus, @sfErrorMsg, @journal

/* ---- JOURNAL DE SOUMISSION ------------------------------------------------
   Une ligne par etape, ecrite AU FUR ET A MESURE dans LPB_Log_Soumissions.

   Pourquoi au fur et a mesure et non a la fin : AMPscript n'a pas de try/catch.
   Une erreur Salesforce remplace la page entiere et TOUT ce qui suit est perdu,
   y compris un journal ecrit en bloc a la sortie. Ecrire etape par etape rend
   donc la panne lisible : la DERNIERE ligne d'un RunId designe l'etape fautive.
   C'est le seul moyen de savoir ou ca casse sur cette plateforme.

   Coup : une ecriture de DE par etape, ~10 par soumission. Acceptable en
   recette, a passer a "false" avant la Prod. */
VAR @LOG_ACTIF, @runId, @logOrdre
SET @LOG_ACTIF = "true"
SET @runId     = Substring(Replace(GUID(), "-", ""), 1, 12)
SET @logOrdre  = 0

SET @sfStatus   = ""
SET @sfErrorMsg = ""
SET @journal   = ""
SET @isNew     = "false"
SET @paId      = ""

SET @submitted = RequestParameter("submitted")

IF @submitted == "true" THEN

    /* ---- Lecture du formulaire (memes name[] que readForm() en SSJS) ---- */
    SET @email      = Trim(RequestParameter("EmailAddress"))
    SET @lastName   = RequestParameter("LastName")
    SET @firstName  = RequestParameter("FirstName")
    SET @country    = RequestParameter("Country")
    SET @indicatif  = RequestParameter("Indicatif")
    SET @mobile     = RequestParameter("MobilePhone")
    SET @studyLevel = RequestParameter("StudyLevel")
    SET @vousEtes   = RequestParameter("VousEtes")
    SET @ecole      = RequestParameter("Marque")
    SET @formType   = Lowercase(RequestParameter("TypeFormulaire"))
    SET @ptatId     = RequestParameter("PTAT_Id")
    SET @campaignId = RequestParameter("CampaignId")
    SET @brandId    = RequestParameter("BusinessBrandId")
    SET @legalText  = RequestParameter("LegalTexteAccepted")
    SET @legalFooter = RequestParameter("LegalTexteFooter")

    SET @utmS   = RequestParameter("utm_source")
    SET @utmM   = RequestParameter("utm_medium")
    SET @utmC   = RequestParameter("utm_campaign")
    SET @utmCo  = RequestParameter("utm_content")
    SET @utmT   = RequestParameter("utm_term")
    SET @utmI   = RequestParameter("utm_id")
    SET @gclid  = RequestParameter("gclid")
    SET @fbclid = RequestParameter("fbclid")
    SET @clientId = RequestParameter("clientId")
    SET @canal    = RequestParameter("canal")
    SET @sousCanal = RequestParameter("sous_canal")

    /* Marque et Account ecole depuis la DE de correspondance, jamais en dur. */
    IF Empty(@brandId) AND NOT Empty(@ecole) THEN
        SET @brandId = Lookup("LPB_Mapping_Ecoles", "BusinessBrandId", "Ecole", @ecole)
    ENDIF
    SET @schoolAccId = Lookup("LPB_Mapping_Ecoles", "SchoolAccountId", "Ecole", @ecole)

    /* ---- Resolution de la campagne, depuis la DE de mapping --------------
       40 combinaisons : brochure/candidature x FR/Intl x 10 ecoles. Les Ids
       sont propres a chaque org, donc jamais en dur : la DE est le point de
       bascule UAT -> Prod.

       La zone se deduit du PAYS DE RESIDENCE, pas de la langue de la page :
       un candidat marocain sur une LP francaise releve de la campagne Intl.

       Si le formulaire fournit deja un CampaignId, il gagne : cela permet a
       une LP de forcer une campagne specifique sans toucher au mapping. */
    IF Empty(@campaignId) AND NOT Empty(@ecole) THEN
        SET @zone = "Intl"
        IF Lowercase(Trim(@country)) == "france" THEN SET @zone = "FR" ENDIF

        SET @cleCampagne = Concat(@formType, "|", @ecole, "|", @zone)
        IF @LOG_ACTIF == "true" THEN
            SET @logOrdre = Add(@logOrdre, 1)
            InsertData("LPB_Log_Soumissions",
                "RowId", Concat(@runId, "-", @logOrdre),
                "RunId", @runId,
                "Ordre", @logOrdre,
                "Horodatage", Now(),
                "Etape", "10 - contexte lu",
                "Statut", "OK",
                "Objet", "-",
                "RecordId", "",
                "Detail", Concat("zone=", @zone, " marque=", @brandId, " ecoleAcc=", @schoolAccId),
                "Email", @email,
                "Ecole", @ecole,
                "FormType", @formType)
        ENDIF
        SET @campActif   = Lookup("LPB_Mapping_Campagnes", "Actif", "Cle", @cleCampagne)

        /* Actif=false = Id non renseigne ou non verifie. On n'ecrit alors AUCUN
           CampaignMember : mieux vaut une adhesion manquante et tracee qu'une
           adhesion rattachee a la mauvaise campagne. */
        IF Lowercase(@campActif) == "true" THEN
            SET @campaignId = Lookup("LPB_Mapping_Campagnes", "CampaignId", "Cle", @cleCampagne)
            SET @journal = Concat(@journal, " CAMP:", @cleCampagne)
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "20 - campagne resolue",
                    "Statut", "OK",
                    "Objet", "Campaign",
                    "RecordId", @campaignId,
                    "Detail", @cleCampagne,
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF
        ELSE
            SET @journal = Concat(@journal, " CAMP:inactive(", @cleCampagne, ")")
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "20 - campagne inactive",
                    "Statut", "IGNORE",
                    "Objet", "Campaign",
                    "RecordId", "",
                    "Detail", @cleCampagne,
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF
        ENDIF
    ENDIF

    /* ====================================================================
       ETAPE 0 — REGLES DE BLOCAGE CANDIDATURE
       ====================================================================
       Deux refus prevus au contrat, AVANT toute ecriture :
         R1 - doublon programme (Jira 1070/463) : une candidature est deja en
              cours pour ce couple (personne x PTAT) ;
         R2 - refus dans l'annee (Jira 464) : une decision defavorable a deja
              ete rendue sur le meme programme la meme annee scolaire.

       --- Pourquoi ce bloc est DESACTIVE par defaut ----------------------
       AMPscript n'a pas de try/catch, et un nom d'objet ou de champ invalide
       ne renvoie pas une erreur rattrapable : il REMPLACE la page. Interroger
       l'objet de candidature avec un nom non verifie ferait donc mourir la
       page a CHAQUE soumission de candidature — panne totale, pas degradation.
       Il n'existe aucun moyen de coder defensivement autour de ca.

       Les noms ci-dessous viennent du document de cadrage, pas de l'org : ils
       n'ont pas encore ete confrontes a EntityDefinition. @REGLES_ACTIVES
       reste donc a "false" jusqu'a verification, et le bloc ne lit rien.

       --- Sens du defaut : on laisse passer -------------------------------
       Regle desactivee ou indeterminee = on N'EMPECHE PAS la soumission.
       Un doublon qui passe est rattrapable (le CRM dedoublonne, un admissions
       peut fusionner). Un candidat legitime bloque par erreur est un lead
       perdu, sans trace et sans recours. L'asymetrie tranche le defaut.
       ==================================================================== */
    IF @REGLES_ACTIVES == "true" AND @formType == "candidature" AND NOT Empty(@ptatId) THEN

        /* Le lien vers la personne se fait par le Contact du Person Account.
           Sans compte existant, il ne peut y avoir de candidature anterieure :
           on ne lit rien. */
        SET @rows = RetrieveSalesforceObjects("Account", "Id,PersonContactId",
            "PersonEmail", "=", @email)

        IF RowCount(@rows) > 0 THEN
            SET @candContactId = Field(Row(@rows,1), "PersonContactId")

            SET @candRows = RetrieveSalesforceObjects(@OBJ_APPLICATION,
                Concat("Id,", @F_APP_STATUS, ",", @F_APP_YEAR),
                @F_APP_PERSON, "=", @candContactId,
                @F_APP_PTAT,   "=", @ptatId)
            SET @nCand = RowCount(@candRows)

            IF @nCand > 0 THEN
                FOR @i = 1 TO @nCand DO
                    SET @candStatut = Lowercase(Field(Row(@candRows,@i), @F_APP_STATUS))

                    /* R2 d'abord : un refus est plus contraignant qu'un dossier
                       en cours, et son message est different. */
                    IF IndexOf(@candStatut, @VAL_REFUSE) > 0 THEN
                        SET @sfStatus = "blocked"
                        SET @sfBlockMsg = "Votre precedente candidature a fait l'objet d'une decision defavorable. Une nouvelle candidature au meme programme n'est pas possible avant l'annee prochaine."
                    ELSEIF Empty(@sfBlockMsg) THEN
                        SET @sfStatus = "blocked"
                        SET @sfBlockMsg = "Vous avez deja une candidature en cours pour ce programme. Nous vous invitons a contacter le service des admissions du campus auquel vous souhaitez candidater."
                    ENDIF
                NEXT @i
                SET @journal = Concat(@journal, " BLOQUE:", @nCand, "candidature(s)")
            ENDIF
        ENDIF
    ENDIF

    /* Un blocage arrete TOUT : ni compte, ni consentement, ni campagne. Le
       candidat doit passer par les admissions, pas alimenter un doublon. */
    IF @sfStatus != "blocked" THEN
    /* ====================================================================
       ETAPE 1 — PERSON ACCOUNT, upsert sur PersonEmail
       Pas d'email = pas de dedoublonnage possible = on n'ecrit rien. C'est la
       regle du contrat, et elle protege d'une explosion de doublons.
       ==================================================================== */
    IF Empty(@email) THEN
        SET @sfStatus = "error"
        SET @sfErrorMsg = "Adresse e-mail absente : aucune ecriture possible (cle de dedoublonnage)."
        IF @LOG_ACTIF == "true" THEN
            SET @logOrdre = Add(@logOrdre, 1)
            InsertData("LPB_Log_Soumissions",
                "RowId", Concat(@runId, "-", @logOrdre),
                "RunId", @runId,
                "Ordre", @logOrdre,
                "Horodatage", Now(),
                "Etape", "05 - email absent",
                "Statut", "KO",
                "Objet", "-",
                "RecordId", "",
                "Detail", @sfErrorMsg,
                "Email", @email,
                "Ecole", @ecole,
                "FormType", @formType)
        ENDIF
    ELSE

        IF @LOG_ACTIF == "true" THEN
            SET @logOrdre = Add(@logOrdre, 1)
            InsertData("LPB_Log_Soumissions",
                "RowId", Concat(@runId, "-", @logOrdre),
                "RunId", @runId,
                "Ordre", @logOrdre,
                "Horodatage", Now(),
                "Etape", "25 - avant lecture Account",
                "Statut", "OK",
                "Objet", "Account",
                "RecordId", "",
                "Detail", "RetrieveSalesforceObjects va etre appele",
                "Email", @email,
                "Ecole", @ecole,
                "FormType", @formType)
        ENDIF
        SET @rows = RetrieveSalesforceObjects("Account",
            "Id,PersonContactId,LastName,FirstName,LivingCountry__c,IndicatifPick__c,MobileNumber__c,Academic_Level_List__c,PersonAccountType__c,Ecole__c,UTMSource__c,UTMMedium__c,UTMCampaign__c,ClientID__c",
            "PersonEmail", "=", @email)
        SET @n = RowCount(@rows)
        IF @LOG_ACTIF == "true" THEN
            SET @logOrdre = Add(@logOrdre, 1)
            InsertData("LPB_Log_Soumissions",
                "RowId", Concat(@runId, "-", @logOrdre),
                "RunId", @runId,
                "Ordre", @logOrdre,
                "Horodatage", Now(),
                "Etape", "26 - lecture Account OK",
                "Statut", "OK",
                "Objet", "Account",
                "RecordId", "",
                "Detail", Concat("lignes trouvees=", @n),
                "Email", @email,
                "Ecole", @ecole,
                "FormType", @formType)
        ENDIF

        IF @n > 0 THEN
            SET @row = Row(@rows, 1)
            SET @paId = Field(@row, "Id")
            SET @paContactId = Field(@row, "PersonContactId")
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "30 - account existant",
                    "Statut", "OK",
                    "Objet", "Account",
                    "RecordId", @paId,
                    "Detail", Concat("contact=", @paContactId),
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF

            /* --- FILL-IF-BLANK -------------------------------------------
               On ne remplit QUE ce qui est vide cote CRM. Un appel par champ :
               AMPscript ne permet pas de construire dynamiquement la liste
               d'arguments. En pratique, un contact deja qualifie ne declenche
               aucun appel ici. */
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "35 - avant fill-if-blank",
                    "Statut", "OK",
                    "Objet", "Account",
                    "RecordId", @paId,
                    "Detail", Concat("nom=", Field(@row,"LastName"), " prenom=", Field(@row,"FirstName")),
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF
            IF Empty(Field(@row,"LastName"))  AND NOT Empty(@lastName)  THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update LastName",
                        "Statut", "OK",
                        "Objet", IIF(@IDENTITE_SUR_CONTACT == "true", "Contact", "Account"),
                        "RecordId", IIF(@IDENTITE_SUR_CONTACT == "true", @paContactId, @paId),
                        "Detail", Concat("cible=", IIF(@ECRIRE_IDENTITE != "true", "IGNORE", IIF(@IDENTITE_SUR_CONTACT == "true", "Contact", "Account"))),
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                IF @ECRIRE_IDENTITE != "true" THEN
                    /* Ecriture volontairement sautee — voir le commentaire en tete. */
                    SET @journal = Concat(@journal, " IDENT:LastName-ignore")
                ELSEIF @IDENTITE_SUR_CONTACT == "true" AND NOT Empty(@paContactId) THEN
                    SET @n = UpdateSingleSalesforceObject("Contact", @paContactId, "LastName", @lastName)
                ELSE
                    SET @n = UpdateSingleSalesforceObject("Account", @paId, "LastName", @lastName)
                ENDIF
                ENDIF
            IF Empty(Field(@row,"FirstName")) AND NOT Empty(@firstName) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update FirstName",
                        "Statut", "OK",
                        "Objet", IIF(@IDENTITE_SUR_CONTACT == "true", "Contact", "Account"),
                        "RecordId", IIF(@IDENTITE_SUR_CONTACT == "true", @paContactId, @paId),
                        "Detail", Concat("cible=", IIF(@ECRIRE_IDENTITE != "true", "IGNORE", IIF(@IDENTITE_SUR_CONTACT == "true", "Contact", "Account"))),
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                IF @ECRIRE_IDENTITE != "true" THEN
                    /* Ecriture volontairement sautee — voir le commentaire en tete. */
                    SET @journal = Concat(@journal, " IDENT:FirstName-ignore")
                ELSEIF @IDENTITE_SUR_CONTACT == "true" AND NOT Empty(@paContactId) THEN
                    SET @n = UpdateSingleSalesforceObject("Contact", @paContactId, "FirstName", @firstName)
                ELSE
                    SET @n = UpdateSingleSalesforceObject("Account", @paId, "FirstName", @firstName)
                ENDIF
                ENDIF
            IF Empty(Field(@row,"LivingCountry__c")) AND NOT Empty(@country) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update LivingCountry__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "LivingCountry__c", @country)
                ENDIF
            IF Empty(Field(@row,"IndicatifPick__c")) AND NOT Empty(@indicatif) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update IndicatifPick__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "IndicatifPick__c", @indicatif)
                ENDIF
            /* MobileNumber__c et JAMAIS PersonMobilePhone : l'E.164 est calcule
               par un flow, l'ecrire ici le ferait diverger. */
            IF Empty(Field(@row,"MobileNumber__c")) AND NOT Empty(@mobile) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update MobileNumber__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "MobileNumber__c", @mobile)
                ENDIF
            IF Empty(Field(@row,"Academic_Level_List__c")) AND NOT Empty(@studyLevel) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update Academic_Level_List__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "Academic_Level_List__c", @studyLevel)
                ENDIF
            IF Empty(Field(@row,"PersonAccountType__c")) AND NOT Empty(@vousEtes) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update PersonAccountType__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "PersonAccountType__c", @vousEtes)
                ENDIF
            /* Ecole__c est un LOOKUP : il exige l'Id de l'Account ecole, pas le
               code "efap". Sans lui, le trigger ne depose pas le tampon et le
               flow CRM aval ne verra jamais la soumission. */
            IF Empty(Field(@row,"Ecole__c")) AND NOT Empty(@schoolAccId) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update Ecole__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "Ecole__c", @schoolAccId)
                ENDIF

            /* Tracking en first-touch : on ne reecrit pas l'origine d'un
               contact deja attribue. */
            IF Empty(Field(@row,"UTMSource__c"))   AND NOT Empty(@utmS)  THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update UTMSource__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "UTMSource__c", @utmS)
                ENDIF
            IF Empty(Field(@row,"UTMMedium__c"))   AND NOT Empty(@utmM)  THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update UTMMedium__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "UTMMedium__c", @utmM)
                ENDIF
            IF Empty(Field(@row,"UTMCampaign__c")) AND NOT Empty(@utmC)  THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update UTMCampaign__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "UTMCampaign__c", @utmC)
                ENDIF
            IF Empty(Field(@row,"ClientID__c"))    AND NOT Empty(@clientId) THEN
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "36 - update ClientID__c",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "va tenter cet update",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "ClientID__c", @clientId)
                ENDIF
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "40 - fill-if-blank termine",
                    "Statut", "OK",
                    "Objet", "Account",
                    "RecordId", @paId,
                    "Detail", "tous les updates ont passe",
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF

        ELSEIF Empty(@RT_PERSON_ACCOUNT) THEN
            /* Garde-fou : creer sans RecordType produirait un compte ENTREPRISE. */
            SET @sfStatus = "error"
            SET @sfErrorMsg = "RecordTypeId du Person Account non renseigne : creation bloquee. Renseigner @RT_PERSON_ACCOUNT."
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "30 - creation bloquee",
                    "Statut", "KO",
                    "Objet", "Account",
                    "RecordId", "",
                    "Detail", @sfErrorMsg,
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF
        ELSE
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "28 - avant creation Account",
                    "Statut", "OK",
                    "Objet", "Account",
                    "RecordId", "",
                    "Detail", Concat("mode=", RequestParameter("TestCreateMode"), " RT=", @RT_PERSON_ACCOUNT, " nom=", @lastName, " niveau=", @studyLevel, " indicatif=", @indicatif, " type=", @vousEtes),
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF
            /* ---- CREATION DU PERSON ACCOUNT ----------------------------
               Le jeu de champs ci-dessous n'est pas negociable : il est dicte
               par les validation rules de l'org, relevees dans les journaux
               Apex du 2026-08-23.

                 VR_PersonAccount_NameMandatory
                     exige FirstName ET LastName ET un moyen de contact
                     (PersonEmail, Invalid_Email__c, PersonMobilePhone ou Phone).
                     -> FirstName est OBLIGATOIRE. Sans lui la page meurt.

                 VR_PersonAccount_PreferredLanguageRequir
                     exige PreferredLangage__c des que LivingCountry__c
                     n'est pas France. Exemptions : SourceCreation__c a
                     "Import" ou "API".
                     -> hors France, on renseigne la langue.

                 VR_PersonAccount_FormTypeRestricted
                     des que FormType__c est rempli, SourceCreation__c DOIT
                     valoir "Web Form".
                     -> SourceCreation__c est fixe a "Web Form".

               Verifie sur l'org : creation OK en France (001AW00001yrOIrYAM)
               et hors France avec langue (001AW00001yrM96YAE).

               ⚠ FormType__c = "Formulaire de Candidature" est REFUSE, alors
               que "Demande de doc" passe : une regle supplementaire, non
               identifiee, s'applique aux candidatures. On n'envoie donc pas
               FormType__c pour ce type de formulaire — le reste de la
               sequence (Application_Requested__c, PTAT) n'est pas affecte.

               UN SEUL APPEL, tous les champs ensemble. C'est structurel :
               les validation rules reevaluent l'enregistrement ENTIER a chaque
               ecriture, donc un compte cree incomplet puis complete champ par
               champ echouerait a la premiere completion. */

            /* Langue : requise hors France. "French" est la valeur relevee sur
               l'org — pas "Francais", qui n'existe pas. */
            IF Lowercase(@country) == "france" THEN
                SET @langue = ""
            ELSE
                SET @langue = "French"
            ENDIF

            /* FormType__c : "Formulaire de Candidature" est refuse (cf. plus
               haut), on le laisse vide pour les candidatures. */
            IF @formType == "candidature" THEN
                SET @typeForm = ""
            ELSEIF @formType == "brochure" THEN
                SET @typeForm = "Demande de doc"
            ELSE
                SET @typeForm = "Forum"
            ENDIF

            IF Empty(@firstName) THEN
                /* Echec propre. Laisser passer tuerait la page sans message,
                   symptome qu'on a mis plusieurs jours a diagnostiquer. */
                SET @sfStatus = "error"
                SET @sfErrorMsg = "Prenom obligatoire : l'org refuse la creation d'un Person Account sans FirstName (regle VR_PersonAccount_NameMandatory). Rendre le champ requis sur le formulaire."

            ELSEIF Empty(@langue) AND Empty(@typeForm) THEN
                SET @paId = CreateSalesforceObject("Account", 12,
                    "RecordTypeId",           @RT_PERSON_ACCOUNT,
                    "SourceCreation__c",      "Web Form",
                    "PersonEmail",            @email,
                    "LastName",               @lastName,
                    "FirstName",              @firstName,
                    "LivingCountry__c",       @country,
                    "IndicatifPick__c",       @indicatif,
                    "MobileNumber__c",        @mobile,
                    "Academic_Level_List__c", @studyLevel,
                    "PersonAccountType__c",   @vousEtes,
                    "UTMSource__c",           @utmS,
                    "ClientID__c",            @clientId)

            ELSEIF Empty(@langue) THEN
                SET @paId = CreateSalesforceObject("Account", 13,
                    "RecordTypeId",           @RT_PERSON_ACCOUNT,
                    "SourceCreation__c",      "Web Form",
                    "FormType__c",            @typeForm,
                    "PersonEmail",            @email,
                    "LastName",               @lastName,
                    "FirstName",              @firstName,
                    "LivingCountry__c",       @country,
                    "IndicatifPick__c",       @indicatif,
                    "MobileNumber__c",        @mobile,
                    "Academic_Level_List__c", @studyLevel,
                    "PersonAccountType__c",   @vousEtes,
                    "UTMSource__c",           @utmS,
                    "ClientID__c",            @clientId)

            ELSEIF Empty(@typeForm) THEN
                SET @paId = CreateSalesforceObject("Account", 13,
                    "RecordTypeId",           @RT_PERSON_ACCOUNT,
                    "SourceCreation__c",      "Web Form",
                    "PreferredLangage__c",    @langue,
                    "PersonEmail",            @email,
                    "LastName",               @lastName,
                    "FirstName",              @firstName,
                    "LivingCountry__c",       @country,
                    "IndicatifPick__c",       @indicatif,
                    "MobileNumber__c",        @mobile,
                    "Academic_Level_List__c", @studyLevel,
                    "PersonAccountType__c",   @vousEtes,
                    "UTMSource__c",           @utmS,
                    "ClientID__c",            @clientId)

            ELSE
                SET @paId = CreateSalesforceObject("Account", 14,
                    "RecordTypeId",           @RT_PERSON_ACCOUNT,
                    "SourceCreation__c",      "Web Form",
                    "FormType__c",            @typeForm,
                    "PreferredLangage__c",    @langue,
                    "PersonEmail",            @email,
                    "LastName",               @lastName,
                    "FirstName",              @firstName,
                    "LivingCountry__c",       @country,
                    "IndicatifPick__c",       @indicatif,
                    "MobileNumber__c",        @mobile,
                    "Academic_Level_List__c", @studyLevel,
                    "PersonAccountType__c",   @vousEtes,
                    "UTMSource__c",           @utmS,
                    "ClientID__c",            @clientId)
            ENDIF
            /* Le bookkeeping ne vaut que si la creation a REELLEMENT rendu un Id.
               Sinon on journalisait « account cree » avec un RecordId vide. */
            IF NOT Empty(@paId) THEN
                SET @isNew = "true"
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "30 - account cree",
                        "Statut", "OK",
                        "Objet", "Account",
                        "RecordId", @paId,
                        "Detail", "creation avec RecordType person",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF

                IF NOT Empty(@schoolAccId) THEN
                    SET @n = UpdateSingleSalesforceObject("Account", @paId, "Ecole__c", @schoolAccId)
                ENDIF
                SET @rows = RetrieveSalesforceObjects("Account", "Id,PersonContactId", "Id", "=", @paId)
                IF RowCount(@rows) > 0 THEN SET @paContactId = Field(Row(@rows,1), "PersonContactId") ENDIF
            ENDIF
        ENDIF

        /* ---- Champs ECRITS A CHAQUE SOUMISSION (jamais fill-if-blank) ----
           Le trigger ne remet plus Application_Requested__c a false : c'est a
           nous de le poser explicitement, y compris a false. Sinon un contact
           ayant candidate une fois resterait marque candidat pour toujours. */
        IF NOT Empty(@paId) THEN
            IF @formType == "candidature" THEN
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "Application_Requested__c", "true")
                IF NOT Empty(@ptatId) THEN
                    SET @n = UpdateSingleSalesforceObject("Account", @paId, "PTAT_Id__c", @ptatId)
                ENDIF
            ELSE
                SET @n = UpdateSingleSalesforceObject("Account", @paId, "Application_Requested__c", "false")
            ENDIF
            IF @LOG_ACTIF == "true" THEN
                SET @logOrdre = Add(@logOrdre, 1)
                InsertData("LPB_Log_Soumissions",
                    "RowId", Concat(@runId, "-", @logOrdre),
                    "RunId", @runId,
                    "Ordre", @logOrdre,
                    "Horodatage", Now(),
                    "Etape", "50 - drapeau candidature pose",
                    "Statut", "OK",
                    "Objet", "Account",
                    "RecordId", @paId,
                    "Detail", Concat("formType=", @formType),
                    "Email", @email,
                    "Ecole", @ecole,
                    "FormType", @formType)
            ENDIF
        ENDIF

        /* ====================================================================
           ETAPE 2 — CONTACTPOINTCONSENT, un enregistrement par canal coche
           ====================================================================
           ⚠ MODELE CORRIGE le 2026-08-23. Le code precedent ecrivait
           `ParentId`, qui N'EXISTE PAS sur cet objet : toutes les creations
           echouaient en silence depuis le debut.

           Modele reel, releve sur l'org :
             ContactPointId        reference vers un ContactPointEmail
                                   ou ContactPointPhone — PAS vers l'Account
             Channel__c            REQUIS (sans lui la creation echoue,
                                   quels que soient les autres champs)
             PrivacyConsentStatus  "OptIn"
             Status__c             "Opt-in" — les DEUX sont remplis sur les
                                   2461 consentements existants, avec des
                                   graphies differentes
             DataUsePurposeId      vide partout, inutile

           Le consentement se rattache donc a un POINT DE CONTACT, pas au
           compte. Il faut le resoudre avant d'ecrire.

           ⚠ LIMITE CONNUE : un Person Account fraichement cree n'a AUCUN
           ContactPoint (verifie sur 001AW00001yrOIrYAM : zero email, zero
           telephone), et `CreateSalesforceObject("ContactPointEmail", ...)`
           echoue. On ne peut donc pas enregistrer de consentement pour un
           nouveau prospect. Sur un compte existant qui en possede un, ca
           fonctionne. A remonter au CRM : soit un flow cree le ContactPoint,
           soit on nous ouvre la creation.

           Boucle sur 5 canaux plutot que cinq blocs recopies.
           ==================================================================== */
        IF NOT Empty(@paId) THEN

            SET @preuve = Concat("[v1]")
            IF NOT Empty(@legalText)   THEN SET @preuve = Concat(@preuve, " — ", @legalText) ENDIF
            IF NOT Empty(@legalFooter) THEN SET @preuve = Concat(@preuve, " — ", @legalFooter) ENDIF

            /* Points de contact du compte, resolus UNE FOIS pour les 5 canaux.
               Email pour le canal Email et les cookies publicitaires,
               telephone pour Phone / SMS / WhatsApp. */
            SET @cpEmail = ""
            SET @cpPhone = ""
            SET @rows = RetrieveSalesforceObjects("ContactPointEmail", "Id", "ParentId", "=", @paId)
            IF RowCount(@rows) > 0 THEN
                SET @cpEmail = Field(Row(@rows,1), "Id")
            ENDIF
            SET @rows = RetrieveSalesforceObjects("ContactPointPhone", "Id", "ParentId", "=", @paId)
            IF RowCount(@rows) > 0 THEN
                SET @cpPhone = Field(Row(@rows,1), "Id")
            ENDIF

            FOR @i = 1 TO 5 DO
                IF @i == 1 THEN
                    SET @canalParam = "HasOptedInEmail"
                    SET @canalValue = "Email"
                ELSEIF @i == 2 THEN
                    SET @canalParam = "HasOptedInPhone"
                    SET @canalValue = "Phone"
                ELSEIF @i == 3 THEN
                    SET @canalParam = "HasOptedInSMS"
                    SET @canalValue = "SMS"
                ELSEIF @i == 4 THEN
                    SET @canalParam = "HasOptedInWhatsApp"
                    SET @canalValue = "WhatsApp"
                ELSE
                    SET @canalParam = "HasOptedInAdvertising"
                    SET @canalValue = "Advertising Cookies"
                ENDIF

                SET @coche = RequestParameter(@canalParam)

                /* Case non cochee = pas de consentement = on n'ecrit RIEN.
                   On ne pose jamais un opt-out implicite : l'absence de preuve
                   n'est pas une preuve de refus. */
                IF @coche == "1" OR Lowercase(@coche) == "true" OR Lowercase(@coche) == "on" THEN

                    /* Le point de contact a viser depend du canal. */
                    IF @canalValue == "Phone" OR @canalValue == "SMS" OR @canalValue == "WhatsApp" THEN
                        SET @cpId = @cpPhone
                    ELSE
                        SET @cpId = @cpEmail
                    ENDIF

                    IF Empty(@cpId) THEN
                        SET @rows = ""
                    ELSE
                        SET @rows = RetrieveSalesforceObjects("ContactPointConsent", "Id",
                            "ContactPointId", "=", @cpId,
                            "Channel__c",     "=", @canalValue)
                    ENDIF

                    IF @LOG_ACTIF == "true" THEN
                        SET @logOrdre = Add(@logOrdre, 1)
                        InsertData("LPB_Log_Soumissions",
                            "RowId", Concat(@runId, "-", @logOrdre),
                            "RunId", @runId,
                            "Ordre", @logOrdre,
                            "Horodatage", Now(),
                            "Etape", "58 - avant consentement",
                            "Statut", "OK",
                            "Objet", "ContactPointConsent",
                            "RecordId", "",
                            "Detail", Concat("canal=", @canalValue, " existant=", RowCount(@rows)),
                            "Email", @email,
                            "Ecole", @ecole,
                            "FormType", @formType)
                    ENDIF
                    IF Empty(@cpId) THEN
                        /* Aucun point de contact : on ne peut rien ecrire.
                           On le journalise au lieu de tuer la page. */
                        SET @journal = Concat(@journal, " CPC:", @canalValue, "-sans-contactpoint")
                    ELSEIF RowCount(@rows) > 0 THEN
                        SET @cpcId = Field(Row(@rows,1), "Id")
                        /* Opt_In_Date__c et GDPR_Status__c : JAMAIS ecrits ici
                           (poses par flow, avec des VR sans bypass).
                           Les deux champs de statut ont des graphies
                           differentes sur l'org : "OptIn" et "Opt-in". */
                        SET @n = UpdateSingleSalesforceObject("ContactPointConsent", @cpcId,
                            "PrivacyConsentStatus", "OptIn")
                        SET @n = UpdateSingleSalesforceObject("ContactPointConsent", @cpcId,
                            "Status__c", "Opt-in")
                        SET @n = UpdateSingleSalesforceObject("ContactPointConsent", @cpcId,
                            "Legal_Texte_Accepted__c", @preuve)
                    ELSE
                        SET @cpcId = CreateSalesforceObject("ContactPointConsent", 7,
                            "ContactPointId",          @cpId,
                            "Channel__c",              @canalValue,
                            "PrivacyConsentStatus",    "OptIn",
                            "Status__c",               "Opt-in",
                            "CaptureSource",           "SFMC CloudPage",
                            "Legal_Texte_Accepted__c", @preuve,
                            "BusinessBrandId",         @brandId)
                    ENDIF
                    SET @journal = Concat(@journal, " CPC:", @canalValue)
                    IF @LOG_ACTIF == "true" THEN
                        SET @logOrdre = Add(@logOrdre, 1)
                        InsertData("LPB_Log_Soumissions",
                            "RowId", Concat(@runId, "-", @logOrdre),
                            "RunId", @runId,
                            "Ordre", @logOrdre,
                            "Horodatage", Now(),
                            "Etape", "60 - consentement",
                            "Statut", "OK",
                            "Objet", "ContactPointConsent",
                            "RecordId", @cpcId,
                            "Detail", Concat("canal=", @canalValue),
                            "Email", @email,
                            "Ecole", @ecole,
                            "FormType", @formType)
                    ENDIF
                ENDIF
            NEXT @i
        ENDIF

        /* ====================================================================
           ETAPE 3a — CAMPAIGNMEMBER (brochure / candidature)
           Idempotence : un seul CM par (Campagne x PA). Une re-soumission ne
           cree pas de doublon — le contrat prevoit d'empiler l'interaction, pas
           l'adhesion.
           ==================================================================== */
        /* ---- Famille du formulaire -------------------------------------
           ⚠ Le builder ne pose PAS "jpo" / "atelier" / "stage". Les quatre
           formulaires evenement passent par blocks/forms/shared/event-form.js,
           qui pose une seule valeur : "evenement". Le sous-type (JPO,
           Atelier_Decouverte, Stage) arrive dans TypeEvenement.

           Le socle SSJS testait les trois valeurs detaillees : la condition
           n'aurait JAMAIS ete vraie, et toute inscription evenement serait
           partie dans la branche CampaignMember au lieu de Summit. Bug herite,
           corrige ici apres lecture du builder.

           Valeurs reellement emises : brochure | candidature | immersion |
           evenement. On accepte aussi les trois anciennes par tolerance, au cas
           ou une page publiee avant ce correctif serait encore en ligne.

           IMMERSION : arbitrage CLOS par le mapping API SF v4 (decision du
           02/07) — « ce formulaire NE cree PAS de CampaignMember. Suivre la
           structure de l onglet Inscription JPO : Summit Registration + 1
           Appointment par date d immersion ». Elle rejoint donc la famille
           evenement. Coherent avec le fichier de campagnes, qui ne contient
           aucune campagne immersion : il n y aurait rien a rattacher. */
        SET @isEvent = "false"
        IF @formType == "evenement" OR @formType == "immersion" OR @formType == "jpo" OR @formType == "atelier" OR @formType == "stage" THEN
            SET @isEvent = "true"
        ENDIF
        SET @typeEvt = RequestParameter("TypeEvenement")

        IF @isEvent == "false" AND NOT Empty(@paId) AND NOT Empty(@campaignId) AND NOT Empty(@paContactId) THEN

            SET @rows = RetrieveSalesforceObjects("CampaignMember", "Id",
                "CampaignId", "=", @campaignId,
                "ContactId",  "=", @paContactId)

            IF RowCount(@rows) > 0 THEN
                SET @cmId = Field(Row(@rows,1), "Id")
                SET @journal = Concat(@journal, " CM:existant")
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "70 - campaignmember existant",
                        "Statut", "IGNORE",
                        "Objet", "CampaignMember",
                        "RecordId", @cmId,
                        "Detail", "interaction historisee",
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
                /* Interaction repetee : historisee dans un objet dedie plutot
                   que par un second CampaignMember. */
                SET @n = CreateSalesforceObject("CampaignMemberInteraction__c", 3,
                    "CampaignMember__c", @cmId,
                    "SourceSystem__c",   "SFMC",
                    "Information__c",    RequestParameter("NomFormulaire"))
            ELSE
                SET @cmId = CreateSalesforceObject("CampaignMember", 9,
                    "CampaignId",             @campaignId,
                    "ContactId",              @paContactId,
                    "UTM_Source__c",          @utmS,
                    "UTM_Medium__c",          @utmM,
                    "UTM_Campaign__c",        @utmC,
                    "UTM_Content__c",         @utmCo,
                    "UTM_Term__c",            @utmT,
                    "AcquisitionChannel__c",  @canal,
                    "AcquisitionSubChannel__c", @sousCanal)
                SET @journal = Concat(@journal, " CM:cree")
                IF @LOG_ACTIF == "true" THEN
                    SET @logOrdre = Add(@logOrdre, 1)
                    InsertData("LPB_Log_Soumissions",
                        "RowId", Concat(@runId, "-", @logOrdre),
                        "RunId", @runId,
                        "Ordre", @logOrdre,
                        "Horodatage", Now(),
                        "Etape", "70 - campaignmember cree",
                        "Statut", "OK",
                        "Objet", "CampaignMember",
                        "RecordId", @cmId,
                        "Detail", @campaignId,
                        "Email", @email,
                        "Ecole", @ecole,
                        "FormType", @formType)
                ENDIF
            ENDIF
        ENDIF

        /* ====================================================================
           ETAPE 3b — SUMMIT REGISTRATION + ATELIERS (JPO / Atelier / Stage)
           ====================================================================
           Unicite = (personne x instance), et NON par personne : s'inscrire a
           une autre journee JPO doit creer une NOUVELLE inscription, pas
           ecraser la precedente. D'ou l'externalId compose des deux.
           ==================================================================== */
        IF @isEvent == "true" AND NOT Empty(@paId) AND NOT Empty(@paContactId) THEN

            SET @instanceId = RequestParameter("InstanceId")

            IF Empty(@instanceId) THEN
                SET @sfStatus = "error"
                SET @sfErrorMsg = "Inscription evenement sans InstanceId : aucune date choisie."
            ELSE
                SET @extId = Concat(@paContactId, "-", @instanceId)

                SET @rows = RetrieveSalesforceObjects("summit__Summit_Events_Registration__c",
                    "Id", "externalId__c", "=", @extId)

                IF RowCount(@rows) > 0 THEN
                    SET @regId = Field(Row(@rows,1), "Id")
                    SET @journal = Concat(@journal, " REG:existante(", @typeEvt, ")")
                    IF @LOG_ACTIF == "true" THEN
                        SET @logOrdre = Add(@logOrdre, 1)
                        InsertData("LPB_Log_Soumissions",
                            "RowId", Concat(@runId, "-", @logOrdre),
                            "RunId", @runId,
                            "Ordre", @logOrdre,
                            "Horodatage", Now(),
                            "Etape", "80 - registration existante",
                            "Statut", "IGNORE",
                            "Objet", "summit Registration",
                            "RecordId", @regId,
                            "Detail", @extId,
                            "Email", @email,
                            "Ecole", @ecole,
                            "FormType", @formType)
                    ENDIF

                    /* ANTI-ECHO — en update on ne renvoie NI summit__Status__c
                       (il porte la presence pointee le jour J, l'ecraser la
                       perdrait) NI actionNameStatus__c (un flow quotidien le
                       fait passer 'Origin' -> 'checkin' ; le reecrire relance
                       le scoring et l'echo vers Marketing Cloud).
                       Seul le tracking est rafraichi. */
                    IF NOT Empty(@utmS) THEN
                        SET @n = UpdateSingleSalesforceObject("summit__Summit_Events_Registration__c",
                            @regId, "summit__utm_source__c", @utmS)
                    ENDIF
                ELSE
                    /* A la CREATION seulement, les deux statuts sont poses. */
                    SET @regId = CreateSalesforceObject("summit__Summit_Events_Registration__c", 10,
                        "externalId__c",             @extId,
                        "summit__Event_Instance__c", @instanceId,
                        "summit__Contact__c",        @paContactId,
                        "summit__Status__c",         "Inscrit",
                        "actionNameStatus__c",       "Origin",
                        "summit__utm_source__c",     @utmS,
                        "summit__utm_medium__c",     @utmM,
                        "summit__utm_campaign__c",   @utmC,
                        "AcquisitionChannel__c",     @canal,
                        "AcquisitionSubChannel__c",  @sousCanal)
                    SET @journal = Concat(@journal, " REG:creee(", @typeEvt, ")")
                    IF @LOG_ACTIF == "true" THEN
                        SET @logOrdre = Add(@logOrdre, 1)
                        InsertData("LPB_Log_Soumissions",
                            "RowId", Concat(@runId, "-", @logOrdre),
                            "RunId", @runId,
                            "Ordre", @logOrdre,
                            "Horodatage", Now(),
                            "Etape", "80 - registration creee",
                            "Statut", "OK",
                            "Objet", "summit Registration",
                            "RecordId", @regId,
                            "Detail", @extId,
                            "Email", @email,
                            "Ecole", @ecole,
                            "FormType", @formType)
                    ENDIF
                ENDIF

                /* ---- Ateliers coches -------------------------------------
                   Le champ cache `Appointments` porte les Ids du CATALOGUE
                   (summit__Summit_Events_Appointment_Type__c), separes par des
                   virgules — c'est ce que le bloc de lecture emet.
                   On n'ecrit QUE des ajouts : le retrait d'un atelier decoche
                   est hors perimetre (page publique, pas d'outil d'admin), il
                   est journalise et laisse en place. */
                SET @appts = RequestParameter("Appointments")
                IF NOT Empty(@regId) AND NOT Empty(@appts) THEN
                    SET @apptRows = BuildRowsetFromString(@appts, ",")
                    SET @nA = RowCount(@apptRows)

                    FOR @i = 1 TO @nA DO
                        SET @apptType = Trim(Field(Row(@apptRows, @i), 1))
                        IF NOT Empty(@apptType) THEN

                            /* Idempotence : (Registration x type d'atelier). */
                            SET @rows = RetrieveSalesforceObjects("summit__Summit_Events_Appointments__c",
                                "Id",
                                "summit__Event_Registration__c",   "=", @regId,
                                "summit__Event_Appointment_Type__c", "=", @apptType)

                            IF RowCount(@rows) == 0 THEN
                                SET @n = CreateSalesforceObject("summit__Summit_Events_Appointments__c", 2,
                                    "summit__Event_Registration__c",     @regId,
                                    "summit__Event_Appointment_Type__c", @apptType)
                                SET @journal = Concat(@journal, " APPT:+")
                                IF @LOG_ACTIF == "true" THEN
                                    SET @logOrdre = Add(@logOrdre, 1)
                                    InsertData("LPB_Log_Soumissions",
                                        "RowId", Concat(@runId, "-", @logOrdre),
                                        "RunId", @runId,
                                        "Ordre", @logOrdre,
                                        "Horodatage", Now(),
                                        "Etape", "90 - atelier ajoute",
                                        "Statut", "OK",
                                        "Objet", "summit Appointments",
                                        "RecordId", @apptType,
                                        "Detail", "1 atelier",
                                        "Email", @email,
                                        "Ecole", @ecole,
                                        "FormType", @formType)
                                ENDIF
                            ENDIF
                        ENDIF
                    NEXT @i
                ENDIF
            ENDIF
        ENDIF

        IF Empty(@sfStatus) THEN SET @sfStatus = "success" ENDIF
        IF @LOG_ACTIF == "true" THEN
            SET @logOrdre = Add(@logOrdre, 1)
            InsertData("LPB_Log_Soumissions",
                "RowId", Concat(@runId, "-", @logOrdre),
                "RunId", @runId,
                "Ordre", @logOrdre,
                "Horodatage", Now(),
                "Etape", "99 - fin",
                "Statut", @sfStatus,
                "Objet", "-",
                "RecordId", @paId,
                "Detail", Concat("journal=", @journal),
                "Email", @email,
                "Ecole", @ecole,
                "FormType", @formType)
        ENDIF
    ENDIF
    ENDIF   /* fin du garde-fou : rien n'est ecrit si @sfStatus == "blocked" */
ENDIF
]%%

<!-- socle ecriture: statut=%%=v(@sfStatus)=%% pa=%%=v(@paId)=%% nouveau=%%=v(@isNew)=%% journal=%%=v(@journal)=%% -->
%%[ IF NOT Empty(@sfErrorMsg) THEN ]%%
<!-- socle erreur: %%=v(@sfErrorMsg)=%% -->
%%[ ENDIF ]%%

<!-- ============================================================================
     FORMULAIRE DE TEST — ecriture Salesforce
     ============================================================================
     Poste sur lui-meme avec les MEMES name[] que readForm(). Si un nom diverge
     ici, le handler lira une valeur vide et le test sera fausse sans erreur.
     ⚠ CETTE PAGE ECRIT REELLEMENT DANS LE CRM. Utiliser une adresse dediee.
     ============================================================================ -->
<div style="font:14px/1.6 Segoe UI,Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 16px">

<h2 style="margin:0 0 4px">Test d'&eacute;criture Salesforce</h2>
<p style="color:#777;margin:0 0 18px">CloudPage publi&eacute;e &middot; <b>&eacute;crit r&eacute;ellement</b> dans le CRM</p>

%%[ IF @submitted == "true" THEN ]%%
  %%[ IF @sfStatus == "blocked" THEN ]%%
    <div style="background:#78350f;color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:18px">
      <b>Soumission bloqu&eacute;e par une r&egrave;gle candidature.</b><br>
      %%=v(@sfBlockMsg)=%%<br>
      <span style="opacity:.8;font-size:13px">Aucune &eacute;criture n'a &eacute;t&eacute; faite.</span>
    </div>
  %%[ ELSEIF @sfStatus == "success" THEN ]%%
    <div style="background:#065f46;color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:18px">
      <b>Succ&egrave;s.</b><br>
      Person Account : <code>%%=v(@paId)=%%</code> %%[IF @isNew == "true" THEN]%%(cr&eacute;&eacute;)%%[ELSE]%%(existant, compl&eacute;t&eacute;)%%[ENDIF]%%<br>
      PersonContactId : <code>%%=v(@paContactId)=%%</code><br>
      Journal : <code>%%=v(@journal)=%%</code><br>
      RunId : <code>%%=v(@runId)=%%</code>
      <span style="opacity:.8;font-size:12px">&mdash; a reporter dans la requete de lecture du log</span>
    </div>
  %%[ ELSE ]%%
    <div style="background:#7f1d1d;color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:18px">
      <b>&Eacute;chec.</b> %%=v(@sfErrorMsg)=%%<br>
      RunId : <code>%%=v(@runId)=%%</code>
    </div>
  %%[ ENDIF ]%%
%%[ ENDIF ]%%


%%[
/* ============================================================================
   REFERENTIELS POUR LE TEST — lecture seule
   ============================================================================
   Les Ids ne se saisissent pas a la main : sur une vraie page ils viennent de
   la cascade (PTAT) ou du selecteur de date (Instance). Ici on les lit
   directement dans le CRM et on les propose en liste.

   Variables prefixees @t pour ne pas ecraser celles du handler, execute juste
   avant dans la meme page.
   ============================================================================ */
VAR @tRows, @tN, @tI, @tRow, @tMax, @tLabel, @tOpts, @tInst, @tAppt, @tCampRes

/* Ce que le handler resoudra tout seul si CampaignId est laisse vide. */
SET @tCampRes = Lookup("LPB_Mapping_Campagnes", "CampaignId", "Cle",
                       Concat("brochure|", RequestParameter("Marque"), "|FR"))

/* --- PTAT (candidature) : DisplayName__c donne un libelle lisible. --------- */
SET @tOpts = ""
SET @tRows = RetrieveSalesforceObjects("ProgramTermApplnTimeline",
    "Id,DisplayName__c,AcademicYear__c", "DisplayName__c", "!=", "")
SET @tN = RowCount(@tRows)
IF @tN > 15 THEN SET @tMax = 15 ELSE SET @tMax = @tN ENDIF
FOR @tI = 1 TO @tMax DO
    SET @tRow = Row(@tRows, @tI)
    SET @tLabel = Concat(Field(@tRow,"DisplayName__c"), " (", Field(@tRow,"AcademicYear__c"), ")")
    SET @tOpts = Concat(@tOpts, "<option value='", Field(@tRow,"Id"), "'>",
                        @tLabel, "</option>")
NEXT @tI

/* --- Instances d evenement a venir ---------------------------------------- */
SET @tInst = ""
SET @tRows = RetrieveSalesforceObjects("summit__Summit_Events_Instance__c",
    "Id,Name,eventType__c,summit__Instance_Start_Date__c",
    "summit__Instance_Start_Date__c", ">=", FormatDate(Now(), "yyyy-MM-dd"))
SET @tN = RowCount(@tRows)
IF @tN > 15 THEN SET @tMax = 15 ELSE SET @tMax = @tN ENDIF
FOR @tI = 1 TO @tMax DO
    SET @tRow = Row(@tRows, @tI)
    SET @tInst = Concat(@tInst, "<option value='", Field(@tRow,"Id"), "'>",
        Field(@tRow,"summit__Instance_Start_Date__c"), " - ",
        Field(@tRow,"eventType__c"), " - ", Field(@tRow,"Name"), "</option>")
NEXT @tI

/* --- Catalogue d ateliers (tous evenements, pour reference) ---------------- */
SET @tAppt = ""
SET @tRows = RetrieveSalesforceObjects("summit__Summit_Events_Appointment_Type__c",
    "Id,summit__Title__c,summit__Required_Appointment__c", "Id", "!=", "")
SET @tN = RowCount(@tRows)
IF @tN > 10 THEN SET @tMax = 10 ELSE SET @tMax = @tN ENDIF
FOR @tI = 1 TO @tMax DO
    SET @tRow = Row(@tRows, @tI)
    SET @tAppt = Concat(@tAppt, "<option value='", Field(@tRow,"Id"), "'>",
        Field(@tRow,"summit__Title__c"),
        IIF(Lowercase(Field(@tRow,"summit__Required_Appointment__c")) == "true", " [obligatoire]", ""),
        "</option>")
NEXT @tI
]%%

<form method="post" action="">
  <input type="hidden" name="submitted" value="true">

  <fieldset style="border:1px solid #ddd;border-radius:8px;padding:14px 18px;margin-bottom:14px">
    <legend style="font-weight:700">Identit&eacute;</legend>
    <p>E-mail (cl&eacute; de d&eacute;doublonnage)<br>
       <input name="EmailAddress" value="phase1.a@example.invalid" size="42" required></p>
    <p>Nom <input name="LastName" value="PHASE1" required>
       &nbsp; Pr&eacute;nom <input name="FirstName" value="Alpha" required></p>
    <p style="color:#b91c1c;font-size:13px">Le pr&eacute;nom est OBLIGATOIRE :
       la r&egrave;gle <code>VR_PersonAccount_NameMandatory</code> refuse la
       cr&eacute;ation d'un Person Account sans <code>FirstName</code>.</p>
    <p>Pays <input name="Country" value="France">
       &nbsp; Indicatif <input name="Indicatif" value="33" size="6">
       &nbsp; Mobile <input name="MobilePhone" value="612345678" size="12"></p>
    <p>Niveau <input name="StudyLevel" value="BAC+3">
       &nbsp; Vous &ecirc;tes <input name="VousEtes" value="Student"></p>
    <p style="color:#777;font-size:13px">Valeurs relev&eacute;es sur l'org &mdash; toute autre
       valeur est ignor&eacute;e en silence par Salesforce :<br>
       <code>Indicatif</code> : <b>33</b> (et non +33) &middot;
       <code>Niveau</code> : <b>BAC+3</b>, BAC+1, BAC+2, Terminale, Coll&egrave;ge
       (majuscules ; <i>Bac obtenu</i> n'existe PAS sur Account) &middot;
       <code>Vous &ecirc;tes</code> : Student, Parent, EDH Student, Career Change &middot;
       <code>Pays</code> : France, Afghanistan (<i>Maroc</i> n'existe pas)</p>
  </fieldset>

  <fieldset style="border:1px solid #ddd;border-radius:8px;padding:14px 18px;margin-bottom:14px">
    <legend style="font-weight:700">Contexte</legend>
    <p>&Eacute;cole (<code>Marque</code>) <input name="Marque" value="efap" size="14"></p>
    <p>Type de formulaire
      <select name="TypeFormulaire">
        <option value="brochure">brochure &mdash; CampaignMember</option>
        <option value="candidature">candidature &mdash; CM + Application_Requested__c + PTAT</option>
        <option value="evenement">evenement &mdash; Summit Registration (JPO / Atelier / Stage)</option>
        <option value="immersion">immersion &mdash; Summit Registration (decision v4 du 02/07)</option>
      </select></p>
    <p>Nom du formulaire <input name="NomFormulaire" value="T1 creation" size="30"></p>

    <p style="background:#fef3c7;padding:10px 14px;border-radius:6px">
      <b>Bissection de la cr&eacute;ation</b> &mdash; outil de diagnostic temporaire.<br>
      <select name="TestCreateMode">
        <option value="">normal &mdash; 12 champs (celui qui &eacute;choue)</option>
        <option value="min">min &mdash; RecordTypeId + LastName + PersonEmail</option>
        <option value="identite">identite &mdash; min + pr&eacute;nom, pays, indicatif, mobile</option>
        <option value="qualif">qualif &mdash; identite + niveau, vous &ecirc;tes</option>
        <option value="sansrt">sansRT &mdash; LastName + PersonEmail, SANS RecordTypeId</option>
      </select><br>
      <span style="font-size:13px;color:#78350f">Changer d'e-mail &agrave; chaque essai : un compte
      cr&eacute;&eacute; ferait passer l'essai suivant en mise &agrave; jour.<br>
      <b>sansRT</b> cr&eacute;e un compte ENTREPRISE &mdash; &agrave; supprimer apr&egrave;s.</span></p>
    <p style="color:#777;font-size:13px">Laisser vide ce qui ne s'applique pas :
       sans <code>CampaignId</code> aucun CampaignMember n'est &eacute;crit,
       sans <code>InstanceId</code> aucune Registration.</p>
    <p><b>CampaignId</b> &mdash; laisser vide : le handler le r&eacute;sout depuis la DE.<br>
       <span style="color:#777;font-size:13px">Pour brochure + cette &eacute;cole + FR, il r&eacute;soudra :
       <code>%%=v(@tCampRes)=%%</code></span><br>
       <input name="CampaignId" value="" size="24" placeholder="vide = r&eacute;solution automatique"></p>

    <p><b>PTAT_Id</b> (candidature)<br>
      <select name="PTAT_Id" style="max-width:100%">
        <option value="">&mdash; aucun &mdash;</option>
        %%=v(@tOpts)=%%
      </select></p>

    <p><b>TypeEvenement</b>
      <select name="TypeEvenement">
        <option value="">&mdash; aucun &mdash;</option>
        <option value="JPO">JPO</option>
        <option value="Atelier_Decouverte">Atelier_Decouverte</option>
        <option value="Stage">Stage</option>
      </select></p>

    <p><b>InstanceId</b> (date d'&eacute;v&eacute;nement)<br>
      <select name="InstanceId" style="max-width:100%">
        <option value="">&mdash; aucune &mdash;</option>
        %%=v(@tInst)=%%
      </select></p>

    <p><b>Ateliers</b> &mdash; catalogue r&eacute;el, s&eacute;lection multiple<br>
      <select name="Appointments" multiple size="5" style="max-width:100%">
        %%=v(@tAppt)=%%
      </select>
      <br><span style="color:#777;font-size:13px">⚠ Une s&eacute;lection multiple envoie plusieurs
      valeurs ; le handler attend une cha&icirc;ne s&eacute;par&eacute;e par des virgules. N'en choisir
      qu'un pour ce test.</span></p>
  </fieldset>

  <fieldset style="border:1px solid #ddd;border-radius:8px;padding:14px 18px;margin-bottom:14px">
    <legend style="font-weight:700">Consentements</legend>
    <p style="color:#777;font-size:13px">Une case non coch&eacute;e n'&eacute;crit RIEN &mdash;
       jamais d'opt-out implicite.</p>
    <label><input type="checkbox" name="HasOptedInEmail" value="1" checked> Email</label>
    &nbsp;<label><input type="checkbox" name="HasOptedInPhone" value="1"> T&eacute;l&eacute;phone</label>
    &nbsp;<label><input type="checkbox" name="HasOptedInSMS" value="1"> SMS</label>
    &nbsp;<label><input type="checkbox" name="HasOptedInWhatsApp" value="1"> WhatsApp</label>
    <p>Texte l&eacute;gal <input name="LegalTexteAccepted"
       value="J'accepte de recevoir des informations de l'EFAP." size="52"></p>
    <input type="hidden" name="LegalTexteFooter" value="Mentions legales v1 - test">
  </fieldset>

  <!-- Tracking : valeurs figees pour verifier le first-touch. A la 2e
       soumission avec les memes valeurs, rien ne doit changer cote Account. -->
  <input type="hidden" name="utm_source"   value="test-socle">
  <input type="hidden" name="utm_medium"   value="cloudpage">
  <input type="hidden" name="utm_campaign" value="recette-ecriture">
  <input type="hidden" name="clientId"     value="TESTCLIENT001">

  <button type="submit" style="background:#12123a;color:#fff;border:0;border-radius:6px;
          padding:12px 22px;font-size:15px;cursor:pointer">Envoyer</button>
</form>

<p style="margin-top:22px;color:#777;font-size:13px">
  <b>Ordre de test conseill&eacute;.</b><br>
  1. Envoyer une fois &rarr; le compte doit &ecirc;tre cr&eacute;&eacute; (ou compl&eacute;t&eacute;).<br>
  2. Renvoyer <b>&agrave; l'identique</b> &rarr; m&ecirc;me Id, aucun doublon : c'est l'idempotence.<br>
  3. Renvoyer en changeant le pr&eacute;nom &rarr; il ne doit <b>PAS</b> &ecirc;tre &eacute;cras&eacute; : c'est le fill-if-blank.<br>
  4. Cocher un canal de plus &rarr; un seul ContactPointConsent suppl&eacute;mentaire.
</p>
</div>
