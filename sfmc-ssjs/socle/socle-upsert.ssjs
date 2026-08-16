<script runat="server">
/**
 * ============================================================================
 *  SOCLE — SEQUENCE D'UPSERT  (Content Block : LPB_Socle_Upsert_AG)
 * ============================================================================
 *  Les fonctions communes reutilisees par les 6 formulaires :
 *      upsertPersonAccount(form)   -> etape 1
 *      upsertConsents(pa, form)    -> etape 2
 *      upsertCampaignMember(pa, f) -> etape 3a (+ interaction si CM existant)
 *
 *  Depend de : LPB_Socle_Config_AG (SocleConfig) + LPB_Socle_Helpers_AG (Socle).
 *  Contrat   : mapping API SF v4 (09/07), onglet "A ecrire par Reetain (v4)".
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 *  Lecture du POST -> objet form normalise. Les name[] viennent des blocs
 *  GrapesJS (form-candidature, form-brochure, ...). Adapter au besoin.
 * ------------------------------------------------------------------------- */
function readForm() {
    function rp(name) { return Platform.Function.RequestParameter(name); }
    return {
        // identite
        lastName:   rp("LastName"),
        firstName:  rp("FirstName"),
        email:      rp("EmailAddress"),
        country:    rp("Country"),
        indicatif:  rp("Indicatif"),          // ex "+33"
        mobile:     rp("MobilePhone"),        // numero local, PAS l'E.164
        studyLevel: rp("StudyLevel"),
        vousEtes:   rp("VousEtes"),
        ecole:      rp("Marque"),             // ecole (mix marque + campus)

        // contexte
        formType:   rp("TypeFormulaire"),     // brochure | candidature | jpo | atelier | stage | immersion
        formName:   rp("NomFormulaire"),
        eventType:  rp("TypeEvenement"),      // JPO | AD | Stage | Immersion (famille evenement)
        campaignId: rp("CampaignId"),         // resolu en amont (resolveCampaign)
        brandId:    rp("BusinessBrandId"),    // marque SF
        ptatId:     rp("PTAT_Id"),            // candidature : Id du ProgramTermApplnTimeline

        // famille evenement (Summit) : instance choisie + date + sous-evenements
        instanceId:   rp("InstanceId"),       // Id de l'instance evenement (JPO/AD/Stage)
        eventDate:    rp("EventDate"),         // libelle date affiche (info)
        campus:       rp("Campus"),            // campus/ville selectionne
        appointments: rp("Appointments"),      // ids ateliers coches, separes par des virgules

        // champs enfant (formulaire "parent")
        childLastName:  rp("ChildLastName"),
        childFirstName: rp("ChildFirstName"),
        childPhone:     rp("ChildPhone"),

        // consentements (1/0 par canal) — 5 canaux au contrat
        HasOptedInEmail:       rp("HasOptedInEmail"),
        HasOptedInPhone:       rp("HasOptedInPhone"),
        HasOptedInSMS:         rp("HasOptedInSMS"),
        HasOptedInWhatsApp:    rp("HasOptedInWhatsApp"),
        HasOptedInAdvertising: rp("HasOptedInAdvertising"),  // cookies publicitaires (banniere)

        // preuve de consentement : phrase du formulaire + phrase du footer
        legalText:       rp("LegalTexteAccepted"),
        legalTextFooter: rp("LegalTexteFooter"),

        // tracking
        utm_source: rp("utm_source"), utm_medium: rp("utm_medium"),
        utm_campaign: rp("utm_campaign"), utm_content: rp("utm_content"),
        utm_term: rp("utm_term"), utm_id: rp("utm_id"),
        gclid: rp("gclid"), fbclid: rp("fbclid"), clientId: rp("clientId"),
        canal: rp("canal"), sousCanal: rp("sous_canal")
    };
}

/* ===========================================================================
 *  ETAPE 1 — PERSON ACCOUNT   (upsert cle PersonEmail, fill-if-blank)
 *  Cette ecriture declenche a elle seule le depot du tampon (utilisateur
 *  d'integration inscrit dans IntegrationUser__mdt).
 *  @returns {Object|null} { id, personContactId }
 * =========================================================================== */
function upsertPersonAccount(form) {
    var C = SocleConfig.ACCOUNT;

    if (Socle.isBlank(form.email)) {
        Socle.log("PA: pas d'email -> pas de dedup possible, abandon.");
        return null;
    }

    // valeurs candidates issues du formulaire (fill-if-blank)
    var candidate = {};
    candidate[C.fillIfBlank.lastName]   = form.lastName;
    candidate[C.fillIfBlank.firstName]  = form.firstName;
    candidate[C.fillIfBlank.country]    = form.country;
    candidate[C.fillIfBlank.indicatif]  = form.indicatif;
    candidate[C.fillIfBlank.mobile]     = form.mobile;      // MobileNumber__c (jamais PersonMobilePhone)
    candidate[C.fillIfBlank.studyLevel] = form.studyLevel;
    candidate[C.fillIfBlank.vousEtes]   = form.vousEtes;
    candidate[C.fillIfBlank.ecole]      = form.ecole;       // condition du trigger tampon

    // Tracking d'acquisition, egalement en FILL-IF-BLANK : on conserve le
    // premier contact (first-touch), une 2e soumission ne reecrit pas la source.
    // mapTracking applique le nommage SANS underscore propre a Account.
    var paTracking = Socle.mapTracking(form, C.tracking);
    for (var tf in paTracking) {
        if (paTracking.hasOwnProperty(tf)) candidate[tf] = paTracking[tf];
    }

    // champs toujours ecrits explicitement
    var always = {};
    var isCandidature = (form.formType === "candidature");
    always[C.alwaysWrite.applicationRequested] = isCandidature ? "true" : "false";
    if (!Socle.isBlank(form.ptatId)) always[C.alwaysWrite.ptatId] = form.ptatId;

    // relire l'existant sur toutes les colonnes utiles
    var cols = "Id,PersonContactId";
    for (var f in candidate) { if (candidate.hasOwnProperty(f)) cols += "," + f; }

    var where = {}; where[C.upsertKey] = form.email;
    var existing = Socle.retrieveOne(C.object, cols, where);

    if (existing) {
        // UPDATE : identite en fill-if-blank + champs always-write
        var toUpdate = Socle.fillIfBlank(existing, candidate);
        for (var a in always) { if (always.hasOwnProperty(a)) toUpdate[a] = always[a]; }
        Socle.update(C.object, existing.Id, toUpdate);
        return { id: existing.Id, personContactId: existing.PersonContactId };
    }

    // CREATE : identite + always-write + email + recordtype
    var toCreate = {};
    for (var k in candidate) { if (candidate.hasOwnProperty(k) && !Socle.isBlank(candidate[k])) toCreate[k] = candidate[k]; }
    for (var a2 in always) { if (always.hasOwnProperty(a2)) toCreate[a2] = always[a2]; }
    toCreate[C.upsertKey] = form.email;
    if (!Socle.isBlank(C.recordTypeId) && C.recordTypeId.indexOf("TODO") !== 0) {
        toCreate.RecordTypeId = C.recordTypeId;
    }
    Socle.create(C.object, toCreate);

    // relire pour recuperer l'Id + PersonContactId (la fonction Create ne les renvoie pas)
    var created = Socle.retrieveOne(C.object, "Id,PersonContactId", where);
    return created ? { id: created.Id, personContactId: created.PersonContactId } : null;
}

/**
 * Une case cochee peut arriver sous plusieurs formes selon le formulaire :
 * "1" (champ cache pose en JS), "true" (checkbox value="true" du bloc RGPD),
 * "on" (checkbox sans attribut value). On accepte les trois.
 */
function _estCoche(v) {
    if (v === true) return true;
    var s = String(v === null || v === undefined ? "" : v).toLowerCase();
    return (s === "1" || s === "true" || s === "on" || s === "yes");
}

/* ===========================================================================
 *  ETAPE 2 — CONTACT POINT CONSENT   (1 record par canal coche)
 *  upsert cle (ParentId + Channel__c). CaptureSource + Legal_Texte_Accepted__c
 *  requis par la VR opt-in. Opt_In_Date / GDPR pose par flow (non ecrits).
 * =========================================================================== */
function upsertConsents(pa, form) {
    if (!pa) return;
    var C = SocleConfig.CONSENT;
    var parentId = (C.parentSource === "personContactId") ? pa.personContactId : pa.id;
    if (Socle.isBlank(parentId)) { Socle.log("CPC: parentId vide, abandon."); return; }

    // Preuve legale versionnee : identique pour tous les canaux d'une meme
    // soumission (phrase du formulaire + phrase du footer + version).
    var proof = Socle.buildConsentProof(form.legalText, form.legalTextFooter, C.legalVersion);

    for (var formField in C.channels) {
        if (!C.channels.hasOwnProperty(formField)) continue;
        if (!_estCoche(form[formField])) continue;        // canal non coche
        var channel = C.channels[formField];

        var fields = {};
        fields[C.channelField]   = channel;
        fields[C.statusField]    = C.statusValue;
        fields[C.captureSource]  = form.formName;         // source = nom du formulaire
        fields[C.legalTextField] = proof;
        if (!Socle.isBlank(form.brandId)) fields[C.brandField] = form.brandId;
        if (C.writeGdprStatus) fields[C.gdprStatusField] = C.gdprStatusValue;

        var where = {}; where["ParentId"] = parentId; where[C.channelField] = channel;
        var existing = Socle.retrieveOne(C.object, "Id", where);

        if (existing) {
            Socle.update(C.object, existing.Id, fields);
        } else {
            fields.ParentId = parentId;
            Socle.create(C.object, fields);
        }
    }
}

/* ===========================================================================
 *  ETAPE 3a — CAMPAIGN MEMBER   (brochure / candidature)
 *  Unicite Campagne x PA : si le CM existe deja -> on historise une
 *  interaction (CampaignMemberInteraction__c) au lieu d'un 2e membre.
 * =========================================================================== */
function upsertCampaignMember(pa, form) {
    if (!pa) return;
    var C = SocleConfig.CAMPAIGN_MEMBER;
    if (Socle.isBlank(form.campaignId)) { Socle.log("CM: campaignId vide, abandon."); return; }

    var linkValue = (C.linkField === "PersonAccount__c") ? pa.id : pa.personContactId;
    if (Socle.isBlank(linkValue)) { Socle.log("CM: lien PA vide, abandon."); return; }

    var where = {};
    where[C.campaignField] = form.campaignId;
    where[C.linkField]     = linkValue;
    var existing = Socle.retrieveOne(C.object, "Id", where);

    if (existing) {
        logCampaignInteraction(existing.Id, form);      // interaction repetee
        return existing.Id;
    }

    var fields = Socle.mapTracking(form, C.tracking);   // nommage AVEC underscore ici
    fields[C.campaignField] = form.campaignId;
    fields[C.linkField]     = linkValue;

    Socle.create(C.object, fields);   // les valeurs vides sont ignorees par le helper
    return null;
}

/** Historise une interaction repetee sur une campagne ou le PA est deja membre. */
function logCampaignInteraction(campaignMemberId, form) {
    var C = SocleConfig.CM_INTERACTION;
    var fields = {};
    fields[C.sourceField] = C.sourceValue;
    fields[C.infoField]   = form.formName;
    if (!Socle.isBlank(campaignMemberId)) fields[C.cmLinkField] = campaignMemberId;
    Socle.create(C.object, fields);
}

/* Expose readForm sous Socle pour l'appel depuis le handler. */
Socle.readForm = readForm;
</script>
