<script runat="server">
/**
 * ============================================================================
 *  SOCLE — SEQUENCE SUMMIT (EVENEMENT)  (Content Block : LPB_Socle_Summit_AG)
 * ============================================================================
 *  Etape 3b de la sequence commune, pour la FAMILLE EVENEMENT
 *  (JPO · Atelier Decouverte · Stage · [Immersion, a arbitrer]) :
 *
 *      upsertSummitRegistration(pa, form)  -> inscription a l'evenement
 *      createAppointments(regId, form)     -> 1 record par atelier coche
 *
 *  Le debut de sequence (Person Account + ContactPointConsent) est identique
 *  aux autres formulaires : il reste dans LPB_Socle_Upsert_AG. Ce bloc ne
 *  couvre QUE le 3e objet specifique aux evenements.
 *
 *  Regles d'or v4 + diagrammes de sequence 3 & 4 cablees ici :
 *    - Idempotence : upsert sur externalId__c, seule vraie cle unique
 *                    (actionIdOscar__c ne l'est PAS). Unicite = personne x
 *                    instance : une autre journee JPO = nouvelle Registration.
 *    - Creation    : summit__Status__c = 'Inscrit' + actionNameStatus__c = 'Origin'.
 *    - Anti-echo   : en UPDATE on ne renvoie NI summit__Status__c (ecraserait
 *                    la presence pointee le jour J) NI actionNameStatus__c (un
 *                    flow quotidien le fait passer 'Origin' -> 'checkin' ; le
 *                    reecrire relancerait le scoring et l'echo MC).
 *    - Appointments: crees APRES la Registration (master-detail). Mode ADDITIF
 *                    seul : le socle ne supprime jamais (formulaire public).
 *
 *  Depend de : LPB_Socle_Config_AG (SocleConfig) + LPB_Socle_Helpers_AG (Socle).
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 *  Cle externe deterministe d'une inscription = (PersonContact x Instance).
 *  Garantit qu'une re-soumission du meme prospect au meme evenement retombe
 *  sur le meme enregistrement (upsert, jamais de doublon).
 * ------------------------------------------------------------------------- */
function buildRegistrationExternalId(pa, form) {
    var contactRef = (SocleConfig.SUMMIT_REGISTRATION.linkSource === "personContactId")
        ? pa.personContactId : pa.id;
    return String(contactRef) + "-" + String(form.instanceId);
}

/* ===========================================================================
 *  ETAPE 3b — SUMMIT REGISTRATION   (JPO / AD / Stage)
 *  Upsert cle externalId__c. Pose l'instance choisie + le rattachement PA +
 *  le tracking. actionNameStatus__c = 'Origin' UNIQUEMENT a la creation.
 *  @returns {String|null} Id de la Registration (pour les Appointments), ou null.
 * =========================================================================== */
function upsertSummitRegistration(pa, form) {
    if (!pa) return null;
    var C = SocleConfig.SUMMIT_REGISTRATION;

    if (Socle.isBlank(form.instanceId)) {
        Socle.log("Summit: InstanceId vide -> pas d'inscription possible, abandon.");
        return null;
    }

    var linkValue = (C.linkSource === "personContactId") ? pa.personContactId : pa.id;
    if (Socle.isBlank(linkValue)) { Socle.log("Summit: lien PA vide, abandon."); return null; }

    var externalId = buildRegistrationExternalId(pa, form);

    // relire l'existant sur la cle d'idempotence
    var where = {}; where[C.upsertKey] = externalId;
    var existing = Socle.retrieveOne(C.object, "Id", where);

    // champs de tracking (valeurs vides ignorees par le helper)
    var track = Socle.mapTracking(form, C.tracking);

    if (existing) {
        // UPDATE (diagramme 4, etape 5 : meme externalId = update en place).
        // On ne rafraichit QUE le tracking. Filet de securite : on retire
        // explicitement tout champ de neverUpdate qui aurait pu s'y glisser
        // (summit__Status__c = presence pointee, actionNameStatus__c = scoring).
        var safe = _stripNeverUpdate(track, C.neverUpdate);
        Socle.update(C.object, existing.Id, safe);
        return existing.Id;
    }

    // CREATE : instance + lien PA + cle externe + statut « Inscrit »
    // + actionNameStatus__c 'Origin' (anti-echo) + tracking.
    var fields = {};
    fields[C.instanceField]  = form.instanceId;
    fields[C.linkField]      = linkValue;
    fields[C.upsertKey]      = externalId;
    fields[C.statusField]    = C.statusValue;             // actionNameStatus__c = 'Origin'
    if (!Socle.isBlank(C.regStatusField)) {
        fields[C.regStatusField] = C.regStatusValue;      // summit__Status__c = 'Inscrit'
    }
    for (var f in track) { if (track.hasOwnProperty(f)) fields[f] = track[f]; }

    Socle.create(C.object, fields);

    // relire pour recuperer l'Id (necessaire aux Appointments)
    var created = Socle.retrieveOne(C.object, "Id", where);
    return created ? created.Id : null;
}

/** Retire d'un objet de champs ceux qui sont interdits en update. */
function _stripNeverUpdate(fields, blacklist) {
    if (!blacklist || !blacklist.length) return fields;
    var out = {};
    for (var f in fields) {
        if (!fields.hasOwnProperty(f)) continue;
        var banned = false;
        for (var i = 0; i < blacklist.length; i++) {
            if (blacklist[i] === f) { banned = true; break; }
        }
        if (!banned) out[f] = fields[f];
    }
    return out;
}

/* ===========================================================================
 *  ETAPE 3b-bis — SUMMIT APPOINTMENTS   (sous-evenements / ateliers)
 *  1 record par atelier/date coche, en master-detail SOUS la Registration.
 *  A appeler APRES upsertSummitRegistration (regId requis).
 *
 *  MODE ADDITIF UNIQUEMENT — le socle ne supprime jamais.
 *  Le diagramme 4 (« opt [ateliers modifies] ») prevoit ajout ET suppression
 *  des enfants, mais la suppression est HORS PERIMETRE du backend formulaire :
 *  ces blocs tournent sur une CloudPage publique soumise par des prospects,
 *  pas par des administrateurs. Un atelier decoche lors d'une re-soumission
 *  reste donc en place et est JOURNALISE ; son retrait releve d'un outil
 *  d'administration CRM.
 *
 *  Idempotence conservee : upsert sur (Registration + type d'atelier), donc
 *  une re-soumission a l'identique ne cree aucun doublon.
 *
 *  @param {String} regId  Id de la Registration parente
 *  @param {Object} form   form normalise (form.appointments = "id1,id2,...")
 *  @returns {Object} { added, kept, obsolete }
 * =========================================================================== */
function createAppointments(regId, form) {
    var result = { added: 0, kept: 0, obsolete: 0 };
    if (Socle.isBlank(regId)) { Socle.log("Appointments: regId vide, abandon."); return result; }

    var C = SocleConfig.SUMMIT_APPOINTMENT;

    // 1) selection courante du formulaire -> ensemble des types coches
    var wanted = {};
    if (!Socle.isBlank(form.appointments)) {
        var ids = String(form.appointments).split(",");
        for (var i = 0; i < ids.length; i++) {
            var t = String(ids[i]).replace(/^\s+|\s+$/g, "");   // trim (pas de String.trim en ES3)
            if (Socle.isBlank(t)) continue;
            wanted[t] = true;
        }
    }

    // 2) etat actuel cote Salesforce (une seule lecture, indexee par type)
    var where = {}; where[C.regField] = regId;
    var current = Socle.retrieve(C.object, ["Id", C.typeField].join(","), where);

    var present = {};
    for (var j = 0; j < current.length; j++) {
        var type = current[j][C.typeField];
        if (!Socle.isBlank(type)) present[type] = current[j].Id;
    }

    // 3) creation des ateliers coches qui ne sont pas encore poses
    for (var w in wanted) {
        if (!wanted.hasOwnProperty(w)) continue;
        if (present[w]) { result.kept++; continue; }        // deja pose -> on ne recree pas
        var fields = {};
        fields[C.regField]  = regId;
        fields[C.typeField] = w;
        var r = Socle.create(C.object, fields);
        if (r && r.ok) result.added++;
    }

    // 4) ateliers presents mais plus coches : on les LAISSE, on les signale.
    //    Trace utile pour l'equipe CRM ; aucune suppression cote socle.
    for (var p in present) {
        if (!present.hasOwnProperty(p) || wanted[p]) continue;
        result.obsolete++;
        Socle.log("Appointment decoche mais conserve (suppression hors perimetre) : " + p);
    }

    Socle.log("Appointments — crees: " + result.added + ", deja poses: " + result.kept +
              (result.obsolete ? ", decoches conserves: " + result.obsolete : ""));
    return result;
}
</script>
