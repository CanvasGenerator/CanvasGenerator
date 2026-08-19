<script runat="server">
/**
 * ============================================================================
 *  SOCLE — LECTURE SALESFORCE  (Content Block : LPB_Socle_Read_AG)
 * ============================================================================
 *  Alimente les listes deroulantes des formulaires depuis Salesforce Core.
 *  LECTURE SEULE — aucun Create/Update ici (l'ecriture reste dans socle-upsert).
 *
 *  Cascade « Programme » pilotee par le PTAT (ProgramTermApplnTimeline), qui
 *  porte a la fois LearningProgramId et AcademicTermId :
 *      1. PTAT filtre par ecole (Brand)
 *      2. -> LearningProgram lies
 *      3. Campus + Niveau depuis les Programs
 *      4/5/6. filtre Specialite / Rythme / Langue
 *      7. Rentree depuis les PTAT restants (AcademicTerm)
 *      8. Programs disponibles pour la rentree choisie
 *      9. resolution du PTAT Id final (transmis a l'ecriture, hors de ce bloc)
 *
 *  Depend de : LPB_Socle_Config_AG (SocleConfig) + LPB_Socle_Helpers_AG (Socle).
 *  Source contrat : mapping API SF v4, colonnes GET.
 *
 *  ⚠ Noms d'API a CONFIRMER cote org (cf. PDF « Recap-Lecture-SF ») :
 *     Speciality_c / Rhythm_c / Instructionlanguage_c -> probablement __c.
 *     Objet PTAT : ProgramTermApplnTimeline (verifier le suffixe/API exact).
 * ============================================================================
 */

var SocleRead = (function () {

    /* -- Mapping objets/champs de LECTURE (aligne sur le mapping v4 GET) ---
       Regroupe ici pour n'avoir qu'un endroit a corriger apres validation org. */
    var R = {
        /* ⚠ Noms RELEVES SUR L'ORG le 2026-08-16 (sonde AMPscript, ?champs=).
           Ce ne sont plus des hypotheses : chaque champ ci-dessous a ete lu
           dans EntityParticle. Ne pas "corriger" au jugé. */
        PTAT: {
            object:        "ProgramTermApplnTimeline",
            id:            "Id",
            programId:     "LearningProgramId",
            termId:        "AcademicTermId",
            schoolField:   "SchoolId__c",          // et NON "SchoolId" (champ custom, type texte)

            /* Deux champs que le socle ignorait et qui portent des regles metier :
               - visibleOnWeb : un PTAT non publie ne doit PAS alimenter le formulaire ;
               - midYearIntake : c'est la "rentree decalee" de la matrice par ecole
                 (EFAP, ICART), jusqu'ici sans equivalent technique identifie. */
            visibleOnWeb:  "VisibleOnWebsite__c",  // boolean
            midYearIntake: "MidYearIntake__c",     // boolean
            academicYear:  "AcademicYear__c",
            displayName:   "DisplayName__c",
            displayOrder:  "DisplayOrder__c"
        },
        PROGRAM: {
            object:        "LearningProgram",
            id:            "Id",
            name:          "Name",

            /* Il n'existe NI Campus__c NI Academic_Level__c sur LearningProgram.
               - campus : seul `campusNameFor__c` porte le campus, sous forme de
                 LIBELLE (formule texte), pas d'Id. Le filtrage se fait donc par
                 nom — cohérent avec la cascade, qui compare des chaines.
               - level  : deux candidats. `AcademicLevel` est le picklist standard
                 (une valeur). `Academic_Level_List__c` est un MULTIpicklist : un
                 programme peut viser plusieurs niveaux, et c'est lui qui doit
                 servir au filtrage, sans quoi un programme "bac+3;bac+4" ne
                 remonterait sur aucun des deux. */
            /* VALEURS RELEVEES le 2026-08-16 (?rows=) :
                 campus                 -> "EFAP PARIS"  (ecole + ville accolees)
                 Academic_Level_List__c -> "Bac+3" ou "Terminale;Bac obtenu"
                 AcademicLevel          -> 1, 2, 3, 4, 5  (ORDINAL, pas un libelle)
               Le niveau affichable est donc `Academic_Level_List__c`, et lui seul.
               `AcademicLevel` ne sert qu'au tri. */
            campus:        "campusNameFor__c",
            level:         "Academic_Level_List__c",   // multipicklist ';' — cf. matchMulti
            levelOrdinal:  "AcademicLevel",            // 1..5, pour trier uniquement
            speciality:    "Speciality__c",
            rhythm:        "Rhythm__c",
            language:      "InstructionLanguage__c",   // L MAJUSCULE — SFMC est sensible a la casse
            isActive:      "IsActive",
            school:        "parentSchoolNameFor__c"
        },
        TERM: {
            object:        "AcademicTerm",
            id:            "Id",
            name:          "Name"
        },
        /* Instance evenement Summit (JPO / AD / Stage).
           ⚠ Nom d'objet RELEVE dans l'Object Manager de l'org le 2026-08-16 :
           le package prefixe ses objets `summit__Summit_Events_*__c`, et non
           `summit__*__c`. L'ancien `summit__Instance__c` renvoyait
           INVALID_TYPE. Les CHAMPS ci-dessous restent a confirmer. */
        INSTANCE: {
            object:        "summit__Summit_Events_Instance__c",
            id:            "Id",
            name:          "Name",

            /* Campus__c est SANS prefixe summit__ (champ ajoute par EDH), et
               c'est un lookup : il porte un Id, pas un libelle. Pour filtrer ou
               afficher par NOM, utiliser campusNameFor__c (formule texte). */
            campusField:   "Campus__c",
            campusName:    "campusNameFor__c",

            typeField:     "summit__Event_Type__c",              // JPO | AD | Stage
            dateField:     "summit__Instance_Start_Date__c",     // et NON summit__Start_Date__c
            timeField:     "summit__Instance_Start_Time__c",
            endDateField:  "summit__Instance_End_Date__c",
            endTimeField:  "summit__Instance_End_Time__c",
            titleField:    "summit__Instance_Title__c",
            addressField:  "summit__Location_Address_Override__c", // et NON summit__Address__c
            locationField: "summit__Location_Title_Override__c",

            /* Lien vers l'Evenement parent : c'est LUI qui porte le catalogue
               des ateliers proposes (cf. APPOINTMENT_TYPE ci-dessous). */
            eventField:    "summit__Event__c",

            /* Garde-fous d'affichage : ne proposer que des dates ouvertes. */
            openField:     "summit__Open_Registration__c",       // boolean
            closeDate:     "summit__Registration_Close_Date__c",
            capacityLeft:  "summit__Current_Available_Capacity__c"
        },

        /* CATALOGUE des ateliers proposes — objet distinct des ateliers CHOISIS.
           ⚠ Correction de modele, pas seulement de nommage. Le socle lisait
           `summit__Appointment__c` filtre sur une Instance, avec un drapeau
           `summit__Is_Required__c`. Or sur l'org :
             - `summit__Summit_Events_Appointments__c` est l'atelier CHOISI par
               un inscrit : il est rattache a une REGISTRATION, jamais a une
               Instance, et n'a aucun drapeau "obligatoire". C'est une donnee
               d'ecriture, pas un referentiel de lecture.
             - le catalogue est `summit__Summit_Events_Appointment_Type__c`,
               rattache a l'EVENEMENT, et c'est lui qui porte
               `summit__Required_Appointment__c`.
           Lire le premier pour alimenter le formulaire ne remontait donc rien,
           et n'aurait jamais pu remonter quoi que ce soit. */
        APPOINTMENT_TYPE: {
            object:        "summit__Summit_Events_Appointment_Type__c",
            id:            "Id",
            name:          "Name",
            title:         "summit__Title__c",                    // libelle affiche
            eventField:    "summit__Summit_Events__c",            // lookup Evenement
            instanceField: "summit__Restrict_To_Instance_Title__c",// restriction a UNE instance
            typeField:     "summit__Appointment_Type__c",
            categoryField: "summit__Appointment_Category__c",
            requiredField: "summit__Required_Appointment__c",     // le vrai drapeau "obligatoire"
            statusField:   "summit__Appointment_Type_Status__c",
            sortField:     "summit__Sort_Order__c",
            descField:     "summit__Description__c"
        },
        /* Association Marque x Ville/Campus — A CONFIRMER. */
        SCHOOL_CAMPUS: {
            object:        "SchoolCampusAssociation__c",
            id:            "Id",
            name:          "Name",
            schoolField:   "School__c",
            campusField:   "Campus__c"
        }
    };

    /* ===================================================================
     *  VALUE SET DES PICKLISTS — lu DIRECTEMENT dans Salesforce
     *  Aucune Data Extension : les valeurs viennent des objets de
     *  metadonnees standards de l'org, donc jamais desynchronisees.
     *
     *      EntityParticle    -> DurableId du champ
     *      PicklistValueInfo -> valeurs du value set (filtre obligatoire
     *                           sur EntityParticleId)
     * =================================================================== */

    /* Cache par execution de page : un meme champ n'est resolu qu'une fois. */
    var _durableCache = {};

    /**
     * Resout le DurableId d'un champ. Sur beaucoup d'orgs, EntityParticleId
     * accepte directement la forme "Objet.Champ" — on s'en sert de repli si
     * EntityParticle ne repond pas.
     */
    function _fieldDurableId(objet, champ) {
        var cle = objet + "." + champ;
        if (_durableCache[cle] !== undefined) return _durableCache[cle];

        var E = SocleConfig.PICKLISTS.entityParticle;
        var where = {};
        where[E.objectField] = objet;
        where[E.nameField]   = champ;

        var row = Socle.retrieveOne(E.object, [E.durableField, E.nameField].join(","), where);
        var durable = (row && !Socle.isBlank(row[E.durableField])) ? row[E.durableField] : cle;

        _durableCache[cle] = durable;
        return durable;
    }

    /**
     * getPicklist — valeurs d'un menu deroulant, depuis le value set Salesforce.
     *
     * @param {String} champForm  cle logique du formulaire : studyLevel,
     *                            country, indicatif, vousEtes (cf. config).
     * @returns {Array} [{ value, label }] — valeurs desactivees exclues.
     */
    function getPicklist(champForm) {
        var P = SocleConfig.PICKLISTS;
        var def = P.fields[champForm];
        if (!def) { Socle.log("getPicklist: cle inconnue -> " + champForm); return []; }

        var V = P.picklistValue;
        var cols = [V.valueField, V.labelField, V.activeField].join(",");
        var direct = def.object + "." + def.field;
        var durable = _fieldDurableId(def.object, def.field);

        var where = {}; where[V.parentField] = durable;
        var rows = Socle.retrieve(V.object, cols, where);

        // Repli : si le DurableId ne donne rien, retenter en "Objet.Champ".
        if (!rows.length && durable !== direct) {
            where[V.parentField] = direct;
            rows = Socle.retrieve(V.object, cols, where);
        }

        if (!rows.length) Socle.log("getPicklist: aucune valeur pour " + direct);

        var out = [];
        for (var i = 0; i < rows.length; i++) {
            var actif = rows[i][V.activeField];
            // IsActive absent = on garde ; explicitement faux = on ignore.
            if (actif === false || String(actif).toLowerCase() === "false") continue;

            var v = rows[i][V.valueField];
            if (Socle.isBlank(v)) continue;
            out.push({ value: v, label: rows[i][V.labelField] || v });
        }
        return out;
    }

    /* -- utilitaires ---------------------------------------------------- */

    /** Dedoublonne une liste [{value,label}] par value en conservant l'ordre. */
    function distinct(rows, valueKey, labelKey) {
        var seen = {}, out = [];
        for (var i = 0; i < rows.length; i++) {
            var v = rows[i][valueKey];
            if (Socle.isBlank(v) || seen[v]) continue;
            seen[v] = true;
            out.push({ value: v, label: rows[i][labelKey] || v });
        }
        return out;
    }

    /** Extrait les valeurs distinctes d'une colonne -> [{value,label}]. */
    function distinctValues(rows, field) {
        var seen = {}, out = [];
        for (var i = 0; i < rows.length; i++) {
            var v = rows[i][field];
            if (Socle.isBlank(v) || seen[v]) continue;
            seen[v] = true;
            out.push({ value: v, label: v });
        }
        return out;
    }

    /**
     * matchMulti — egalite tolerante aux MULTIPICKLISTS.
     *
     * Salesforce serialise un multipicklist en "a;b;c". `Academic_Level_List__c`
     * vaut par exemple "Terminale;Bac obtenu" : un programme ouvert a deux
     * niveaux. Une comparaison stricte ne le ferait remonter sous AUCUN des
     * deux, et le candidat en Terminale ne verrait jamais ce programme.
     * On compare donc valeur a valeur, apres decoupage.
     */
    function matchMulti(cellule, attendu) {
        if (String(cellule) === String(attendu)) return true;      // cas simple
        var parts = String(cellule).split(";");
        for (var i = 0; i < parts.length; i++) {
            // trim manuel : ES3 n'a pas String.prototype.trim
            var p = parts[i].replace(/^\s+|\s+$/g, "");
            if (p === String(attendu)) return true;
        }
        return false;
    }

    /** Applique des filtres { champ: valeur } sur une liste de lignes (AND). */
    function localFilter(rows, criteria) {
        var out = [];
        for (var i = 0; i < rows.length; i++) {
            var keep = true;
            for (var f in criteria) {
                if (!criteria.hasOwnProperty(f)) continue;
                if (Socle.isBlank(criteria[f])) continue;      // critere non renseigne -> ignore
                if (!matchMulti(rows[i][f], criteria[f])) { keep = false; break; }
            }
            if (keep) out.push(rows[i]);
        }
        return out;
    }

    /**
     * Eclate les valeurs d'une colonne MULTIPICKLIST en options distinctes.
     * Sans cela, "Terminale;Bac obtenu" apparaitrait tel quel dans le menu
     * deroulant — une option que personne ne peut choisir.
     */
    function distinctMulti(rows, field) {
        var seen = {}, out = [];
        for (var i = 0; i < rows.length; i++) {
            var brut = rows[i][field];
            if (Socle.isBlank(brut)) continue;
            var parts = String(brut).split(";");
            for (var j = 0; j < parts.length; j++) {
                var v = parts[j].replace(/^\s+|\s+$/g, "");
                if (v === "" || seen[v]) continue;
                seen[v] = true;
                out.push({ value: v, label: v });
            }
        }
        return out;
    }

    /* ===================================================================
     *  ETAPE 1-2 — PTAT d'une ecole -> Programs lies
     *  Retourne les lignes Program (avec toutes les colonnes utiles) pour
     *  l'ecole donnee. Une seule lecture large, filtree ensuite en memoire.
     * =================================================================== */
    function getProgramsForSchool(schoolId) {
        var cols = [R.PROGRAM.id, R.PROGRAM.name, R.PROGRAM.campus, R.PROGRAM.level,
                    R.PROGRAM.speciality, R.PROGRAM.rhythm, R.PROGRAM.language].join(",");

        // 1) PTAT de l'ecole -> ids de programmes
        var ptatCols = [R.PTAT.id, R.PTAT.programId, R.PTAT.termId].join(",");
        var where = {};
        if (!Socle.isBlank(schoolId)) where[R.PTAT.schoolField] = schoolId;
        var ptats = Socle.retrieve(R.PTAT.object, ptatCols, where);
        if (!ptats.length) { Socle.log("read: aucun PTAT pour school=" + schoolId); return []; }

        // 2) Programs correspondants (une lecture par batch d'ids simples)
        var progIds = distinctValues(ptats, R.PTAT.programId);
        var out = [];
        for (var i = 0; i < progIds.length; i++) {
            var w = {}; w[R.PROGRAM.id] = progIds[i].value;
            var rows = Socle.retrieve(R.PROGRAM.object, cols, w);
            for (var j = 0; j < rows.length; j++) out.push(rows[j]);
        }
        return out;
    }

    /**
     * getPtatIndex — table (programme x rentree -> PTAT Id) de toute l'ecole.
     *
     * Permet de resoudre le PTAT final SANS relire Salesforce a chaque etape :
     * une seule lecture au chargement, puis toute la cascade se joue en memoire
     * (ou cote navigateur, cf. LPB_Picklist_Handler_AG).
     *
     * @returns [{ ptatId, programId, termId }]
     */
    function getPtatIndex(schoolId) {
        var cols = [R.PTAT.id, R.PTAT.programId, R.PTAT.termId].join(",");
        var where = {};
        if (!Socle.isBlank(schoolId)) where[R.PTAT.schoolField] = schoolId;
        var ptats = Socle.retrieve(R.PTAT.object, cols, where);

        var out = [];
        for (var i = 0; i < ptats.length; i++) {
            out.push({
                ptatId:    ptats[i][R.PTAT.id],
                programId: ptats[i][R.PTAT.programId],
                termId:    ptats[i][R.PTAT.termId]
            });
        }
        return out;
    }

    /**
     * getTerms — libelle lisible des rentrees, pour une liste d'Ids.
     * @returns [{ value:termId, label }]
     */
    function getTerms(termIds) {
        var out = [], vus = {};
        for (var i = 0; i < termIds.length; i++) {
            var id = termIds[i];
            if (Socle.isBlank(id) || vus[id]) continue;
            vus[id] = true;
            var w = {}; w[R.TERM.id] = id;
            var term = Socle.retrieveOne(R.TERM.object, [R.TERM.id, R.TERM.name].join(","), w);
            out.push({ value: id, label: term ? term[R.TERM.name] : id });
        }
        return out;
    }

    /* ===================================================================
     *  ETAPE 3 — options Campus & Niveau depuis les Programs
     * =================================================================== */
    function getCampusOptions(programs) { return distinctValues(programs, R.PROGRAM.campus); }
    /* Multipicklist : on eclate, sinon "Terminale;Bac obtenu" deviendrait une
       option unique et inchoisissable. */
    function getLevelOptions(programs)  { return distinctMulti(programs, R.PROGRAM.level); }

    /* ===================================================================
     *  ETAPES 4-5-6 — options Specialite / Rythme / Langue
     *  Chaque liste ne propose que les valeurs des Programs deja filtres.
     * =================================================================== */
    function getSpecialityOptions(programs, sel) {
        return distinctValues(localFilter(programs, _crit(sel)), R.PROGRAM.speciality);
    }
    function getRhythmOptions(programs, sel) {
        return distinctValues(localFilter(programs, _crit(sel)), R.PROGRAM.rhythm);
    }
    function getLanguageOptions(programs, sel) {
        return distinctValues(localFilter(programs, _crit(sel)), R.PROGRAM.language);
    }

    /** Traduit les valeurs selectionnees en criteres sur les colonnes Program. */
    function _crit(sel) {
        sel = sel || {};
        var c = {};
        if (!Socle.isBlank(sel.campus))     c[R.PROGRAM.campus]     = sel.campus;
        if (!Socle.isBlank(sel.level))      c[R.PROGRAM.level]      = sel.level;
        if (!Socle.isBlank(sel.speciality)) c[R.PROGRAM.speciality] = sel.speciality;
        if (!Socle.isBlank(sel.rhythm))     c[R.PROGRAM.rhythm]     = sel.rhythm;
        if (!Socle.isBlank(sel.language))   c[R.PROGRAM.language]   = sel.language;
        return c;
    }

    /* ===================================================================
     *  ETAPE 7 — Rentrees disponibles pour les Programs filtres
     *  On repart du PTAT (school) puis on ne garde que les termes dont le
     *  LearningProgramId figure dans la liste de Programs encore valides.
     * =================================================================== */
    function getRentreeOptions(schoolId, filteredPrograms) {
        var ptatCols = [R.PTAT.id, R.PTAT.programId, R.PTAT.termId].join(",");
        var where = {};
        if (!Socle.isBlank(schoolId)) where[R.PTAT.schoolField] = schoolId;
        var ptats = Socle.retrieve(R.PTAT.object, ptatCols, where);

        // ensemble des programmes encore valides
        var validProg = {};
        for (var i = 0; i < filteredPrograms.length; i++) validProg[filteredPrograms[i][R.PROGRAM.id]] = true;

        // termes distincts portes par ces programmes
        var termIds = {}, termList = [];
        for (var k = 0; k < ptats.length; k++) {
            if (!validProg[ptats[k][R.PTAT.programId]]) continue;
            var tid = ptats[k][R.PTAT.termId];
            if (Socle.isBlank(tid) || termIds[tid]) continue;
            termIds[tid] = true; termList.push(tid);
        }
        // libelle lisible des termes
        var out = [];
        for (var t = 0; t < termList.length; t++) {
            var w = {}; w[R.TERM.id] = termList[t];
            var term = Socle.retrieveOne(R.TERM.object, [R.TERM.id, R.TERM.name].join(","), w);
            out.push({ value: termList[t], label: term ? term[R.TERM.name] : termList[t] });
        }
        return out;
    }

    /* ===================================================================
     *  ETAPES 8-9 — Programs pour la rentree choisie, puis resolution PTAT Id
     * =================================================================== */

    /** Programs disponibles a la rentree choisie (parmi les Programs filtres). */
    function getProgramsForRentree(schoolId, filteredPrograms, termId) {
        var ptatCols = [R.PTAT.id, R.PTAT.programId, R.PTAT.termId].join(",");
        var where = {};
        if (!Socle.isBlank(schoolId)) where[R.PTAT.schoolField] = schoolId;
        var ptats = Socle.retrieve(R.PTAT.object, ptatCols, where);

        var validProg = {};
        for (var i = 0; i < filteredPrograms.length; i++) validProg[filteredPrograms[i][R.PROGRAM.id]] = true;

        var progIds = {}, out = [];
        for (var k = 0; k < ptats.length; k++) {
            if (String(ptats[k][R.PTAT.termId]) !== String(termId)) continue;
            var pid = ptats[k][R.PTAT.programId];
            if (!validProg[pid] || progIds[pid]) continue;
            progIds[pid] = true;
            var byId = _findProgram(filteredPrograms, pid);
            out.push({ value: pid, label: byId ? byId[R.PROGRAM.name] : pid });
        }
        return out;
    }

    /**
     * ETAPE 9 — PTAT Id final = intersection (programme choisi × rentree choisie).
     * C'est la SEULE cle etrangere transmise a l'ecriture de la candidature.
     * @returns {String|null}
     */
    function resolvePtatId(schoolId, programId, termId) {
        var where = {};
        if (!Socle.isBlank(schoolId)) where[R.PTAT.schoolField] = schoolId;
        where[R.PTAT.programId] = programId;
        where[R.PTAT.termId]    = termId;
        var ptat = Socle.retrieveOne(R.PTAT.object, R.PTAT.id, where);
        return ptat ? ptat[R.PTAT.id] : null;
    }

    function _findProgram(programs, id) {
        for (var i = 0; i < programs.length; i++) if (programs[i][R.PROGRAM.id] === id) return programs[i];
        return null;
    }

    /* ===================================================================
     *  FAMILLE EVENEMENT — lecture des dates & sous-evenements (Summit)
     * =================================================================== */

    /**
     * getNextEventDates — prochaine date + evenements des 15 jours suivants
     * pour un campus (et un type d'evenement optionnel : JPO / AD / Stage).
     * Alimente la carte "date + heures + adresse" du formulaire evenement.
     * @returns [{ value:instanceId, label, date, address }] triees par date.
     */
    function getNextEventDates(campus, eventType) {
        var I = R.INSTANCE;
        var cols = [I.id, I.name, I.campusField, I.typeField, I.dateField, I.addressField].join(",");

        // fenetre [aujourd'hui, aujourd'hui + 15 j]
        var now = new Date();
        var horizon = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

        // filtre : date dans la fenetre (+ campus / type si fournis) — AND imbrique
        var filter = Socle.betweenFilter(I.dateField, now, horizon);
        if (!Socle.isBlank(campus)) {
            filter = { LeftOperand: filter, LogicalOperator: "AND",
                       RightOperand: { Property: I.campusField, SimpleOperator: "equals", Value: campus } };
        }
        if (!Socle.isBlank(eventType)) {
            filter = { LeftOperand: filter, LogicalOperator: "AND",
                       RightOperand: { Property: I.typeField, SimpleOperator: "equals", Value: eventType } };
        }

        var rows = Socle.retrieveRaw(I.object, cols, filter);
        var out = [];
        for (var i = 0; i < rows.length; i++) {
            out.push({
                value:   rows[i][I.id],
                label:   rows[i][I.name],
                date:    rows[i][I.dateField],
                address: rows[i][I.addressField]
            });
        }
        // tri chronologique (la Platform Function ne garantit pas l'ordre)
        out.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
        return out;
    }

    /**
     * getAppointmentOptions — TOUS les sous-evenements d'une instance, avec le
     * drapeau `required`. Une seule lecture, l'appelant decide de l'affichage.
     *
     * Necessaire pour la JPO : le contrat prevoit une « Conference = Appointment
     * NON obligatoire » — un filtre sur required=true seul ne la remonterait
     * jamais et la case ne serait jamais proposee au candidat.
     *
     * @returns [{ value:appointmentTypeId, label, required:Boolean }]
     */
    function getAppointmentOptions(instanceId) {
        var A = R.APPOINTMENT_TYPE, I = R.INSTANCE;
        if (Socle.isBlank(instanceId)) return [];

        /* 1. L'instance donne l'EVENEMENT parent. Le catalogue d'ateliers est
              porte par l'evenement, pas par l'instance : deux journees JPO du
              meme evenement proposent le meme catalogue. */
        var wInst = {}; wInst[I.id] = instanceId;
        var inst = Socle.retrieveOne(I.object, [I.id, I.eventField].join(","), wInst);
        if (!inst || Socle.isBlank(inst[I.eventField])) {
            Socle.log("getAppointmentOptions: instance ou evenement introuvable -> " + instanceId);
            return [];
        }

        /* 2. Ateliers proposes pour cet evenement. */
        var cols = [A.id, A.name, A.title, A.typeField, A.requiredField,
                    A.instanceField, A.statusField, A.sortField].join(",");
        var where = {}; where[A.eventField] = inst[I.eventField];
        var rows = Socle.retrieve(A.object, cols, where);

        var out = [];
        for (var i = 0; i < rows.length; i++) {
            /* 3. Un type d'atelier peut etre RESTREINT a une instance precise.
                  Restriction vide = propose sur toutes les instances. */
            var restrict = rows[i][A.instanceField];
            if (!Socle.isBlank(restrict) && String(restrict) !== String(instanceId)) continue;

            var raw = rows[i][A.requiredField];
            out.push({
                value:    rows[i][A.id],
                label:    rows[i][A.title] || rows[i][A.name],
                // SF peut renvoyer true / "true" / 1 selon le type remonte
                required: (raw === true || String(raw).toLowerCase() === "true" || String(raw) === "1"),
                ordre:    rows[i][A.sortField]
            });
        }
        // Ordre d'affichage voulu par l'admin CRM, pas celui du retour SF.
        out.sort(function (a, b) { return (Number(a.ordre) || 0) - (Number(b.ordre) || 0); });
        return out;
    }

    /**
     * getRequiredAppointments — sous-ensemble a inscription OBLIGATOIRE.
     * Filtre en memoire le resultat de getAppointmentOptions (pas de 2e lecture).
     * @returns [{ value:appointmentTypeId, label, required:true }]
     */
    function getRequiredAppointments(instanceId) {
        var all = getAppointmentOptions(instanceId), out = [];
        for (var i = 0; i < all.length; i++) if (all[i].required) out.push(all[i]);
        return out;
    }

    /**
     * getOptionalAppointments — sous-ensemble FACULTATIF (conference JPO, etc.).
     * @returns [{ value:appointmentTypeId, label, required:false }]
     */
    function getOptionalAppointments(instanceId) {
        var all = getAppointmentOptions(instanceId), out = [];
        for (var i = 0; i < all.length; i++) if (!all[i].required) out.push(all[i]);
        return out;
    }

    /**
     * getBrandsCampuses — Marque x Ville/campus disponibles pour une ecole.
     * Alimente le menu "Campus" (source : SchoolCampusAssociation__c).
     * @returns [{ value:campus, label }]
     */
    function getBrandsCampuses(schoolId) {
        var S = R.SCHOOL_CAMPUS;
        var cols = [S.id, S.name, S.campusField].join(",");
        var where = {};
        if (!Socle.isBlank(schoolId)) where[S.schoolField] = schoolId;
        var rows = Socle.retrieve(S.object, cols, where);
        return distinctValues(rows, S.campusField);
    }

    /* -- API publique --------------------------------------------------- */
    return {
        map:                     R,
        getPicklist:             getPicklist,
        getProgramsForSchool:    getProgramsForSchool,
        getPtatIndex:            getPtatIndex,
        getTerms:                getTerms,
        getCampusOptions:        getCampusOptions,
        getLevelOptions:         getLevelOptions,
        getSpecialityOptions:    getSpecialityOptions,
        getRhythmOptions:        getRhythmOptions,
        getLanguageOptions:      getLanguageOptions,
        getRentreeOptions:       getRentreeOptions,
        getProgramsForRentree:   getProgramsForRentree,
        resolvePtatId:           resolvePtatId,
        getNextEventDates:       getNextEventDates,
        getAppointmentOptions:   getAppointmentOptions,
        getRequiredAppointments: getRequiredAppointments,
        getOptionalAppointments: getOptionalAppointments,
        getBrandsCampuses:       getBrandsCampuses,
        distinct:                distinct,
        distinctValues:          distinctValues,
        localFilter:             localFilter
    };
})();
</script>
