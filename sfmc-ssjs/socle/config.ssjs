<script runat="server">
/**
 * ============================================================================
 *  SOCLE — CONFIGURATION  (Content Block : LPB_Socle_Config_AG)
 * ============================================================================
 *  Mapping champ formulaire -> champ API Salesforce + IDs propres a l'org.
 *  Source : mapping API SF v4 (09/07), onglet "A ecrire par Reetain (v4)".
 *
 *  SSJS = EcmaScript 3 : uniquement var / function, pas de const/let/arrow/JSON.
 *  Ce bloc ne fait que DECLARER des objets de config dans le scope global SSJS.
 * ============================================================================
 */

var SocleConfig = {

    /* -- Objet Account (Person Account) --------------------------------- */
    ACCOUNT: {
        object: "Account",

        /* Cle d'upsert : email exact (dedup DR_PersonAccount_EmailUnicity). */
        upsertKey: "PersonEmail",

        /* RecordType du Person Account de l'org. A RENSEIGNER (UAT != Prod). */
        recordTypeId: "TODO_PERSON_ACCOUNT_RECORDTYPE_ID",

        /* Identite + qualification : ecrits en FILL-IF-BLANK (on n'ecrase
           jamais une valeur existante non vide). Cle = champ du form. */
        fillIfBlank: {
            lastName:   "LastName",
            firstName:  "FirstName",
            country:    "LivingCountry__c",
            indicatif:  "IndicatifPick__c",
            mobile:     "MobileNumber__c",       // JAMAIS PersonMobilePhone (calcule E.164 par flow)
            studyLevel: "Academic_Level_List__c",
            vousEtes:   "PersonAccountType__c",  // valueSet : Student/EDH Student/Parent/Career Change/Jury
            ecole:      "Ecole__c"               // lookup ecole : DOIT etre pose (condition du trigger tampon)
        },

        /* Champs ECRITS EXPLICITEMENT a chaque soumission (pas de fill-if-blank).
           Le trigger ne remet plus Application_Requested__c a false : on l'ecrit. */
        alwaysWrite: {
            applicationRequested: "Application_Requested__c", // true UNIQUEMENT candidature
            ptatId:               "PTAT_Id__c"                // requis candidature, optionnel ailleurs
        },

        /* Tracking porte AUSSI par le Person Account (artefact §03 : upsert PA
           pose "identite, locale, UTM, source"). ATTENTION — sur Account le
           nommage est SANS underscore (UTMSource__c), contrairement au
           CampaignMember / a la Registration (UTM_Source__c). C'est la raison
           d'etre de mapTracking() : un seul objet form -> deux nommages. */
        tracking: {
            utm_source:   "UTMSource__c",
            utm_medium:   "UTMMedium__c",
            utm_campaign: "UTMCampaign__c",
            utm_content:  "UTMContent__c",
            utm_term:     "UTMTerm__c",
            utm_id:       "UTMId__c",
            gclid:        "gclid__c",
            fbclid:       "fbclid__c",
            clientId:     "ClientID__c"
        },

        /* Interdits absolus : deriveds / verrouilles (rollback en masse sinon). */
        neverWrite: [
            "PersonMobilePhone", "Scoring__c", "SMSLocale__c", "WhatsAppLocale__c",
            "Academic_Level_Historical__c", "SourceCreation__c"
        ]
    },

    /* -- Objet ContactPointConsent -------------------------------------- */
    CONSENT: {
        object: "ContactPointConsent",

        /* Cle d'upsert composite : 1 record par (ParentId, Channel__c). */
        upsertKeyFields: ["ParentId", "Channel__c"],

        /* Cible reelle de ParentId : Account Id vs PersonContactId selon le
           modele EDC de l'org. A CONFIRMER. Valeurs : "accountId" | "personContactId". */
        parentSource: "accountId",

        channelField:  "Channel__c",
        statusField:   "Status__c",
        statusValue:   "OptIn",
        captureSource: "CaptureSource",              // standard — requis par la VR opt-in
        legalTextField:"Legal_Texte_Accepted__c",    // requis par la VR opt-in (texte versionne, 32k)
        brandField:    "BusinessBrandId",

        /* GDPR_Status__c : conflit v4 (flow vs Reetain) -> desactive par defaut. */
        writeGdprStatus: false,
        gdprStatusField: "GDPR_Status__c",
        gdprStatusValue: "Active",

        /* NE JAMAIS ecrire : poses par flow + VR sans bypass. */
        neverWrite: ["Opt_In_Date__c", "Opt_Out_Date__c"],

        /* Un canal par case cochee cote formulaire (name du champ -> valeur SF).
           5 canaux au contrat (artefact §03) : le 5e (cookies publicitaires) est
           pilote par la banniere de consentement, pas par une case du formulaire. */
        channels: {
            HasOptedInEmail:       "Email",
            HasOptedInPhone:       "Phone",
            HasOptedInSMS:         "SMS",
            HasOptedInWhatsApp:    "WhatsApp",
            HasOptedInAdvertising: "Advertising Cookies"      // valeur SF A CONFIRMER
        },

        /* Version du texte legal affiche. Assemblee avec la phrase du formulaire
           et celle du footer par buildConsentProof() -> Legal_Texte_Accepted__c. */
        legalVersion: "v1"
    },

    /* -- Objet CampaignMember (etape 3a : brochure / candidature) -------- */
    CAMPAIGN_MEMBER: {
        object: "CampaignMember",

        /* Rattachement du Person Account au CM. "ContactId" = PersonContactId
           du compte, ou "PersonAccount__c" si champ custom. A CONFIRMER. */
        linkField: "ContactId",

        campaignField: "CampaignId",

        /* Tracking ecrit sur le CM (source : colonne "Membre de campagne" v4). */
        tracking: {
            utm_source:   "UTM_Source__c",
            utm_medium:   "UTM_Medium__c",
            utm_campaign: "UTM_Campaign__c",
            utm_content:  "UTM_Content__c",
            utm_term:     "UTM_Term__c",
            utm_id:       "UTM_Id__c",
            gclid:        "gclid__c",
            fbclid:       "fbclid__c",
            clientId:     "Client_ID__c",
            canal:        "AcquisitionChannel__c",
            sousCanal:    "AcquisitionSubChannel__c"
        }
        /* Nom/Prenom sur le CM = champs FORMULE (contactLastNameFor__c /
           contactFirstNameFor__c) : NON inscriptibles, ne pas les envoyer. */
    },

    /* -- Objet CampaignMemberInteraction__c (etape 3c) ------------------ */
    CM_INTERACTION: {
        object:       "CampaignMemberInteraction__c",
        sourceField:  "SourceSystem__c",   // ex. "SFMC"
        sourceValue:  "SFMC",
        infoField:    "Information__c",     // ex. nom du formulaire
        /* lien vers le CampaignMember : champ lookup a confirmer cote org. */
        cmLinkField:  "CampaignMember__c"
    },

    /* -- Objet Summit Registration (etape 3b : JPO / Atelier / Stage) ----
       Famille Evenement. Upsert idempotent sur externalId__c. Anti-echo :
       actionNameStatus__c = 'Origin' a la creation, on ne renvoie JAMAIS
       summit__Status__c (presence pointee le jour J). Noms d'API A CONFIRMER
       cote org (package summit__). */
    SUMMIT_REGISTRATION: {
        object:          "summit__Registration__c",       // A CONFIRMER (API du package)

        /* externalId__c est la VRAIE cle d'upsert (unique). actionIdOscar__c ne
           l'est PAS — cf. note du diagramme 3. Unicite = (personne x instance) :
           une autre journee JPO = nouvel externalId = nouvelle Registration. */
        upsertKey:       "externalId__c",

        /* Instance evenement choisie. Diagramme 3 : summit__Event_Instance__c
           (master-detail), et NON summit__Instance__c. */
        instanceField:   "summit__Event_Instance__c",
        instanceParam:   "InstanceId",                     // name[] du champ cache cote front

        /* Rattachement du Person Account. "personContactId" | "accountId". */
        linkField:       "summit__Contact__c",             // A CONFIRMER
        linkSource:      "personContactId",

        /* Statut fonctionnel de l'inscription — ECRIT A LA CREATION UNIQUEMENT
           (diagramme 3, etape 6 : « statut Inscrit »). En update il est dans
           neverUpdate : le renvoyer ecraserait la presence pointee le jour J. */
        regStatusField:  "summit__Status__c",
        regStatusValue:  "Inscrit",                        // valeur SF A CONFIRMER

        /* Anti-echo (cf. regles d'or v4 + diagramme 4). */
        statusField:     "actionNameStatus__c",
        statusValue:     "Origin",

        /* Champs a ne JAMAIS renvoyer EN UPDATE (creation OK pour le statut) :
           - summit__Status__c   : ecraserait la presence pointee le jour J ;
           - actionNameStatus__c : un flow planifie quotidien fait passer
             'Origin' -> 'checkin'. Le reecrire relancerait le scoring et
             l'echo MC (le scoring ne repart que si ce champ change). */
        neverUpdate:     ["summit__Status__c", "actionNameStatus__c"],

        /* Tracking porte sur la Registration (identique au CampaignMember). */
        tracking: {
            utm_source:   "UTM_Source__c",
            utm_medium:   "UTM_Medium__c",
            utm_campaign: "UTM_Campaign__c",
            utm_content:  "UTM_Content__c",
            utm_term:     "UTM_Term__c",
            utm_id:       "UTM_Id__c",
            gclid:        "gclid__c",
            fbclid:       "fbclid__c",
            clientId:     "Client_ID__c",
            canal:        "AcquisitionChannel__c",
            sousCanal:    "AcquisitionSubChannel__c"
        }
    },

    /* -- Objet Summit Appointments (sous-evenements / ateliers) ----------
       1 record par atelier/date coche, en master-detail SOUS la Registration
       (a creer APRES la Registration). Cle d'idempotence : Reg + type. */
    SUMMIT_APPOINTMENT: {
        object:          "summit__Appointment__c",          // A CONFIRMER (API du package)
        regField:        "summit__Registration__c",          // master-detail vers la Registration
        typeField:       "summit__Appointment_Type__c",       // type d'atelier / sous-evenement
        instanceField:   "summit__Instance__c",              // instance du sous-evenement (si applicable)
        appointmentsParam: "Appointments",                    // name[] front : ids separes par des virgules
        upsertKeyFields: ["summit__Registration__c", "summit__Appointment_Type__c"]

        /* PAS de suppression : le diagramme 4 prevoit d'ajuster les enfants
           (ajout + suppression) a la re-soumission, mais le retrait est HORS
           PERIMETRE du backend formulaire — ces blocs sont soumis par des
           prospects sur une page publique, pas par des administrateurs.
           Un atelier decoche reste en place et est journalise. */
    },

    /* -- Resolution campagne / marque (mapping externe, Data Extensions) --
       Ecrites en DE SFMC (LookupRows), JAMAIS en dur. UAT != Prod : basculer
       la DE en config a la mise en prod. 40 campagnes (form x zone x 10 ecoles). */
    RESOLVERS: {
        /* DE de mapping campagnes : 1 ligne par (FormType, Ecole, Zone). */
        campaignDE:     "Mapping_Campagnes_x_Formulaires",   // ExternalKey/Name de la DE — A RENSEIGNER
        campaignKeys:   { form: "FormType", ecole: "Ecole", zone: "Zone" },
        campaignValue:  "CampaignId",

        /* DE de mapping ecole -> marque (BusinessBrandId + Brand__c). */
        brandDE:        "Mapping_Ecoles_x_Marques",          // A RENSEIGNER
        brandKey:       "Ecole",
        brandValues:    { brandId: "BusinessBrandId", brandCode: "Brand__c" },

        /* Zone (FR / Intl) deduite du pays de residence. */
        zoneDomesticCountry: "France",
        zoneDomestic:   "FR",
        zoneInternational: "Intl"
    },

    /* -- Lecture picklists : VALUE SET LU DIRECTEMENT DANS SALESFORCE -----
       Aucune Data Extension. On interroge les objets de metadonnees standards
       de l'org (SOQL, API v39+), via les memes Platform Functions que le reste :

         EntityParticle    -> DurableId du champ (Objet + nom d'API du champ)
         PicklistValueInfo -> les valeurs du value set de ce champ

       Avantage : aucune synchronisation a maintenir. Une valeur ajoutee par
       l'admin CRM apparait immediatement dans le formulaire. */
    PICKLISTS: {

        /* Etape 1 — resolution du DurableId du champ. */
        entityParticle: {
            object:       "EntityParticle",
            durableField: "DurableId",           // ce qu'on cherche
            nameField:    "QualifiedApiName",    // nom d'API du champ
            objectField:  "EntityDefinitionId"   // nom d'API de l'objet porteur
        },

        /* Etape 2 — valeurs du value set. */
        picklistValue: {
            object:      "PicklistValueInfo",
            parentField: "EntityParticleId",     // = DurableId resolu a l'etape 1
            valueField:  "Value",                // valeur stockee en base
            labelField:  "Label",                // libelle affiche
            activeField: "IsActive"              // les valeurs desactivees sont ignorees
        },

        /* Correspondance cle formulaire -> (objet, champ picklist) cote CRM. */
        fields: {
            studyLevel: { object: "Account", field: "Academic_Level_List__c" },
            country:    { object: "Account", field: "LivingCountry__c" },
            indicatif:  { object: "Account", field: "IndicatifPick__c" },
            vousEtes:   { object: "Account", field: "PersonAccountType__c" }
        }
    },

    /* -- Objet SchoolCampusAssociation__c (Marque x Ville/Campus) -------- */
    SCHOOL_CAMPUS: {
        object:      "SchoolCampusAssociation__c",           // A CONFIRMER
        schoolField: "School__c",                            // filtre ecole
        campusValue: "Campus__c",                            // valeur (ville/campus)
        campusLabel: "Name"
    }
};
</script>
