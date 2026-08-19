<script runat="server">
/**
 * ============================================================================
 *  SONDE DE LECTURE SALESFORCE — coeur commun
 * ============================================================================
 *  Repond a UNE question : les Platform Functions SSJS Salesforce de cette BU
 *  voient-elles l'org Salesforce Core, et si oui quels objets / champs ?
 *
 *  LECTURE SEULE. Aucun Create/Update/Delete, ici ni ailleurs dans ce dossier.
 *
 *  Ce fichier ne produit AUCUNE sortie : il declare `SfProbe.runSafe()` qui
 *  renvoie un tableau de resultats. Deux enveloppes l'exploitent :
 *      - test-read-cloudpage.ssjs   -> affiche un tableau HTML (CloudPage)
 *      - test-read-automation.ssjs  -> ecrit les lignes dans une DE (Automation)
 *
 *  --- Regle de conception -------------------------------------------------
 *  UNE SONDE QUI TOMBE NE DOIT JAMAIS EMPORTER LES AUTRES.
 *  Chaque etape est isolee derriere son propre garde-fou, et `runSafe()` ne
 *  leve jamais. Une seule fonction toxique du runtime SSJS (v2 : la sonde
 *  d'identite, qui a leve « Unable to retrieve security descriptor for this
 *  frame ») suffisait a rendre une page entierement muette — donc a ne rien
 *  diagnostiquer du tout. Le journal `trace()` dit jusqu'ou on est alle.
 *
 *  SSJS = EcmaScript 3 : var / function uniquement (pas de const, let, arrow).
 * ============================================================================
 */

/* Core 1.1.1 = la version qui expose les Platform Functions Salesforce.
   Redondant avec l'enveloppe, et c'est VOULU : si la sonde conclut que les
   fonctions sont absentes, personne ne doit pouvoir mettre ce resultat sur le
   dos d'un Platform.Load manquant ou charge dans un autre bloc. */
Platform.Load("Core", "1.1.1");

var SfProbe = (function () {

    /* Journal des etapes ATTEINTES. Ecrit avant l'execution de chaque etape :
       si la page meurt malgre tout, la derniere entree designe le coupable. */
    var _trace = [];
    function trace() { return _trace.join(" > "); }

    /** Tronque + neutralise les retours ligne, pour tenir dans une cellule. */
    function court(v, max) {
        if (v === null || v === undefined) return "";
        var s;
        try { s = String(v); } catch (e) { return "(valeur non convertible)"; }
        s = s.replace(/[\r\n\t]+/g, " ");
        max = max || 120;
        return s.length > max ? s.substring(0, max) + "…" : s;
    }

    /**
     * Serialisation d'un objet d'erreur, a l'epreuve des exceptions HOTES.
     *
     * Jint remonte parfois des exceptions .NET dont la seule lecture releve une
     * NOUVELLE exception. Serialiser une erreur dans un bloc `catch` peut donc
     * relancer — et cette relance-la, elle, n'est plus protegee. C'est ce qui a
     * fait tomber la v2 en entier. Trois filets successifs, du plus riche au
     * plus pauvre, et jamais rien qui puisse lever.
     */
    function str(o) {
        try { return Platform.Function.Stringify(o); } catch (e1) { /* filet 2 */ }
        try { if (o && o.message) return String(o.message); } catch (e2) { /* filet 3 */ }
        try { return String(o); } catch (e3) { /* abandon */ }
        return "(erreur non serialisable)";
    }

    /** Ligne de resultat normalisee. */
    function ligne(etape, objet, colonnes, statut, nb, echantillon, erreur) {
        return { etape: etape, objet: objet, colonnes: colonnes, statut: statut,
                 nb: nb || 0, echantillon: echantillon || "", erreur: erreur || "" };
    }

    /**
     * Garde-fou : execute `fn` et verse son resultat (ligne ou tableau) dans
     * `out`. Toute exception devient une ligne ERREUR — jamais une panne.
     */
    function pousser(out, libelle, fn) {
        _trace.push(libelle);
        try {
            var r = fn();
            if (!r) return;
            if (typeof r.length === "number" && typeof r.etape === "undefined") {
                for (var i = 0; i < r.length; i++) out.push(r[i]);
            } else {
                out.push(r);
            }
        } catch (e) {
            out.push(ligne(libelle, "(sonde)", "-", "ERREUR", 0, "",
                           "sonde interrompue : " + court(str(e), 240)));
        }
    }

    /**
     * Appelle RetrieveSalesforceObjects quelle que soit la forme sous laquelle
     * le runtime l'expose : globale (documentee) ou Platform.Function.* (au cas
     * ou). Sans ce resolveur, une org qui n'exposerait que la seconde forme
     * ferait echouer toutes les sondes et on conclurait a tort "MC Connect
     * absent" — une erreur qui couterait des semaines.
     */
    function appelRetrieve(objet, colsCSV, filtre) {
        var echecs = [];

        /* ON APPELLE, on ne teste pas d'abord.
           La v3 gardait ces appels derriere `typeof x === "function"`. Or Jint
           expose les membres .NET comme 'clr' / 'clrmethodinfo' — JAMAIS comme
           'function'. Le garde-fou etait donc toujours faux : la fonction etait
           la, et le code refusait de l'appeler avant de conclure qu'elle
           n'existait pas. Tenter l'appel et rapporter l'erreur reelle est la
           seule facon de ne pas se mentir. */
        try {
            return RetrieveSalesforceObjects(objet, colsCSV, filtre || null);
        } catch (e) {
            echecs.push("forme globale -> " + court(str(e), 130));
        }

        try {
            return Platform.Function.RetrieveSalesforceObjects(objet, colsCSV, filtre || null);
        } catch (e2) {
            echecs.push("Platform.Function -> " + court(str(e2), 130));
        }

        throw { message: echecs.join("  ||  ") };
    }

    /**
     * Une sonde = un appel de lecture, jamais fatal.
     *
     * @param {String} etape    libelle lisible (colonne 1 du rapport)
     * @param {String} objet    nom d'API de l'objet Salesforce
     * @param {String} colsCSV  colonnes demandees
     * @param {Object} filtre   SimpleFilterPart / ComplexFilterPart, ou null
     * @param {String} echCol   colonne dont on remonte un echantillon
     */
    function sonde(etape, objet, colsCSV, filtre, echCol) {
        var res = ligne(etape, objet, colsCSV, "KO", 0, "", "");
        try {
            var rows = appelRetrieve(objet, colsCSV, filtre);
            if (!rows) {
                // Retour null : l'appel a abouti mais n'a rien rendu. On le
                // distingue d'une exception — ce n'est pas la meme panne.
                res.statut = "VIDE";
                res.erreur = "retour null";
                return res;
            }
            res.nb = rows.length;
            res.statut = rows.length > 0 ? "OK" : "VIDE";

            if (rows.length > 0) {
                var cle = echCol || colsCSV.split(",")[0];
                var ech = [];
                for (var i = 0; i < rows.length && i < 3; i++) ech.push(court(rows[i][cle], 40));
                res.echantillon = ech.join(" | ");
            }
        } catch (e) {
            res.statut = "ERREUR";
            res.erreur = court(str(e), 300);
        }
        return res;
    }

    /** Filtre "champ = valeur". */
    function eq(champ, valeur) {
        return { Property: champ, SimpleOperator: "equals", Value: valeur };
    }

    /**
     * ETAGE 0 — les Platform Functions Salesforce EXISTENT-ELLES ?
     *
     * Distinction capitale, et invisible si on ne teste que des appels :
     *
     *   a) la fonction n'est pas DEFINIE  -> Jint leve "Object expected: <nom>".
     *      Marketing Cloud Connect n'est pas provisionne sur cette BU : le
     *      runtime SSJS n'injecte tout simplement pas ces fonctions. Aucun
     *      reglage de permission, d'utilisateur ou de scope n'y changera rien.
     *
     *   b) la fonction existe mais LEVE a l'appel (OAuth, licence, objet
     *      inconnu) -> MC Connect est bien la, c'est la connexion ou les droits
     *      qui sont a reprendre.
     *
     * Les deux produisent des menus deroulants vides cote formulaire, mais
     * appellent des corrections radicalement differentes.
     */
    function disponibilite(nom, sonderType) {
        var res = ligne("0 · Fonction " + nom, "(runtime SSJS)", "typeof", "KO", 0, "", "");
        var t, leve = false;
        try {
            // `typeof` sur un identifiant absent rend "undefined" sans lever...
            t = String(sonderType());
        } catch (e) {
            // ...sauf si le moteur en decide autrement : on traite les deux cas.
            t = court(str(e), 100);
            leve = true;
        }

        /* ⚠ NE PAS exiger `t === "function"`.
           Jint expose les membres .NET sous des types qui lui sont propres :
           'clr', 'clrmethodinfo', 'clrfunction'. Les Platform Functions de SFMC
           en font partie. Exiger 'function' revient a les declarer toutes
           absentes — c'est exactement ce qu'a fait la v3, qui a conclu a tort
           que Marketing Cloud Connect n'etait pas provisionne alors que
           Platform.Function.RetrieveSalesforceObjects repondait 'clrmethodinfo'.
           Le seul verdict d'absence fiable est 'undefined'. */
        res.echantillon = "typeof = " + t;
        if (leve || t === "undefined" || t === "") {
            res.statut = "ERREUR";
            res.erreur = leve ? ("typeof a leve : " + t) : ("typeof = " + t + " — absente du runtime");
        } else {
            res.statut = "OK";
        }
        return res;
    }

    /**
     * ETAGE -1 — dans QUELLE Business Unit cette page s'execute-t-elle ?
     *
     * Sans cette ligne, un resultat negatif ne prouve rien : deux publications
     * dans deux BU differentes rendent exactement le meme tableau, et rien ne
     * permet de les distinguer. La page doit se nommer elle-meme.
     *
     * Plusieurs chemins sont tentes parce qu'aucun n'est garanti sur une
     * CloudPage. `TreatAsContent` est teste EN DERNIER : c'est lui qui a leve
     * « Unable to retrieve security descriptor for this frame » en v2. Il reste
     * dans la liste — savoir qu'il est interdit ici est une information — mais
     * il ne peut plus rien emporter avec lui.
     */
    function identite() {
        var essais = [
            { nom: "MID · AttributeValue",  fn: function () { return Platform.Function.AttributeValue("memberid"); } },
            { nom: "MID · Variable @mid",   fn: function () { return Variable.GetValue("@mid"); } },
            { nom: "Horodatage",            fn: function () { return Platform.Function.Now(); } },
            { nom: "MID · TreatAsContent",  fn: function () { return Platform.Function.TreatAsContent("%%member_id%%"); } }
        ];
        var out = [];
        for (var i = 0; i < essais.length; i++) {
            // Chaque essai est pousse individuellement : si l'un est toxique,
            // les autres ont deja ete verses dans `out`.
            (function (e) {
                pousser(out, "-1 · Contexte · " + e.nom, function () {
                    var r = ligne("-1 · Contexte · " + e.nom, "(runtime SSJS)", "-", "KO", 0, "", "");
                    var v = e.fn();
                    var s = (v === null || v === undefined) ? "" : String(v);
                    if (s === "") {
                        r.statut = "VIDE"; r.erreur = "valeur vide";
                    } else if (s.indexOf("%%") >= 0) {
                        /* TreatAsContent rend la chaine telle quelle quand la
                           personnalisation ne se resout pas hors contexte d'envoi.
                           La prendre pour un MID afficherait « BU %%member_id%% »
                           dans le verdict — une fausse identite, pire que rien. */
                        r.statut = "VIDE"; r.erreur = "non resolu (rendu litteral : " + court(s, 30) + ")";
                    } else {
                        r.statut = "OK"; r.echantillon = court(s, 60);
                    }
                    return r;
                });
            })(essais[i]);
        }
        return out;
    }

    /* Les 4 picklists du contrat (cf. SocleConfig.PICKLISTS.fields). */
    var PICKLISTS = [
        { cle: "studyLevel", objet: "Account", champ: "Academic_Level_List__c" },
        { cle: "country",    objet: "Account", champ: "LivingCountry__c" },
        { cle: "indicatif",  objet: "Account", champ: "IndicatifPick__c" },
        { cle: "vousEtes",   objet: "Account", champ: "PersonAccountType__c" }
    ];

    /* Referentiels lus par SocleRead (cascade programme + famille evenement). */
    var REFERENTIELS = [
        { etape: "Ref · PTAT",         objet: "ProgramTermApplnTimeline",   cols: "Id,LearningProgramId,AcademicTermId" },
        { etape: "Ref · Programme",    objet: "LearningProgram",            cols: "Id,Name" },
        { etape: "Ref · Rentree",      objet: "AcademicTerm",               cols: "Id,Name" },
        { etape: "Ref · Campus",       objet: "SchoolCampusAssociation__c", cols: "Id,Name" },
        { etape: "Ref · Instance evt", objet: "summit__Instance__c",        cols: "Id,Name" },
        { etape: "Ref · Atelier",      objet: "summit__Appointment__c",     cols: "Id,Name" }
    ];

    /**
     * runSafe — execute toutes les sondes. NE LEVE JAMAIS.
     *
     * L'ordre suit la chaine de dependance : la PREMIERE ligne en erreur
     * designe la cause, les suivantes n'en sont que la consequence.
     */
    function runSafe() {
        var out = [];

        /* -1. Identite du contexte d'execution (BU + horodatage). */
        pousser(out, "-1 · Contexte", function () { return identite(); });

        /* 0. Les Platform Functions Salesforce sont-elles injectees ?
              Se joue AVANT tout appel. WSProxy sert de TEMOIN : il repond
              toujours present, donc s'il est OK pendant que les fonctions
              Salesforce sont absentes, c'est la preuve que le SSJS s'execute
              et que seule l'integration manque. Il est exclu du verdict. */
        pousser(out, "0 · RetrieveSalesforceObjects", function () {
            return disponibilite("RetrieveSalesforceObjects",
                   function () { return typeof RetrieveSalesforceObjects; }); });
        pousser(out, "0 · CreateSalesforceObject", function () {
            return disponibilite("CreateSalesforceObject",
                   function () { return typeof CreateSalesforceObject; }); });
        pousser(out, "0 · UpdateSingleSalesforceObject", function () {
            return disponibilite("UpdateSingleSalesforceObject",
                   function () { return typeof UpdateSingleSalesforceObject; }); });
        pousser(out, "0 · Platform.Function.RetrieveSalesforceObjects", function () {
            return disponibilite("Platform.Function.RetrieveSalesforceObjects",
                   function () { return typeof Platform.Function.RetrieveSalesforceObjects; }); });
        pousser(out, "0 · WSProxy (temoin)", function () {
            return disponibilite("Script.Util.WSProxy (temoin)",
                   function () { return typeof Script.Util.WSProxy; }); });
        pousser(out, "0 · Platform.Function.CreateSalesforceObject", function () {
            return disponibilite("Platform.Function.CreateSalesforceObject",
                   function () { return typeof Platform.Function.CreateSalesforceObject; }); });

        /* 0-bis. LE test qui tranche entre les deux hypotheses restantes.
           Constat : les fonctions dependantes du CONTEXTE (RetrieveSalesforceObjects,
           AttributeValue) sont refusees, celles qui n'en dependent pas (Now,
           TreatAsContent) passent. Deux lectures possibles :

             H1 · la page n'a AUCUNE identite d'execution (frame anonyme) ->
                  tout appel authentifie est refuse, Salesforce comme SFMC ;
             H2 · la page a bien une identite, mais l'utilisateur MC Connect
                  n'est pas rattache a cette BU -> seul Salesforce est refuse.

           WSProxy sur une DataExtension est un appel AUTHENTIFIE qui ne passe
           PAS par Marketing Cloud Connect. S'il repond -> H2. S'il echoue avec
           la meme erreur -> H1, et seul un runtime porteur d'identite
           (Automation Studio) pourra lire Salesforce. */
        pousser(out, "0bis · WSProxy lit une DE (identite de la page)", function () {
            var r = ligne("0bis · Appel authentifie SFMC (WSProxy -> DataExtension)",
                          "DataExtension", "Name", "KO", 0, "", "");
            var api = new Script.Util.WSProxy();
            var rep = api.retrieve("DataExtension", ["Name"], null);   // lecture seule
            if (!rep) { r.statut = "VIDE"; r.erreur = "retour null"; return r; }
            r.echantillon = "Status=" + rep.Status;
            var n = (rep.Results && rep.Results.length) ? rep.Results.length : 0;
            r.nb = n;
            r.statut = (String(rep.Status) === "OK") ? "OK" : "ERREUR";
            if (r.statut !== "OK") r.erreur = "Status=" + rep.Status + " " + court(rep.Message, 120);
            return r;
        });

        /* 1. La connexion Marketing Cloud Connect repond-elle ?
              Organization : 1 seule ligne par org, donc aucun volume ramene. */
        pousser(out, "1 · Organization", function () {
            return sonde("1 · Connexion (Organization)", "Organization", "Id,Name", null, "Name"); });
        pousser(out, "1 · User", function () {
            return sonde("1 · Connexion (User actif)", "User", "Id,Name", eq("IsActive", "true"), "Name"); });

        /* 2. Les objets de METADONNEES sont-ils exposes ?
              C'est LE point qui decide entre lecture directe et DE de reference. */
        pousser(out, "2 · EntityDefinition", function () {
            return sonde("2 · Metadonnees (EntityDefinition)", "EntityDefinition",
                         "DurableId,QualifiedApiName", eq("QualifiedApiName", "Account"), "QualifiedApiName"); });
        pousser(out, "2 · EntityParticle", function () {
            return sonde("2 · Metadonnees (EntityParticle)", "EntityParticle",
                         "DurableId,QualifiedApiName", eq("EntityDefinitionId", "Account"), "QualifiedApiName"); });

        /* 3. Value set de chacune des 4 picklists, par les DEUX chemins de
              SocleRead.getPicklist : DurableId resolu, puis repli "Objet.Champ".
              Savoir lequel repond est une information utile, pas un echec. */
        for (var i = 0; i < PICKLISTS.length; i++) {
            (function (p) {
                var direct = p.objet + "." + p.champ;
                var filtreChamp = { LeftOperand:  eq("EntityDefinitionId", p.objet),
                                    LogicalOperator: "AND",
                                    RightOperand: eq("QualifiedApiName", p.champ) };

                pousser(out, "3 · DurableId " + p.cle, function () {
                    return sonde("3 · DurableId " + p.cle, "EntityParticle",
                                 "DurableId,QualifiedApiName", filtreChamp, "DurableId"); });

                pousser(out, "3 · Valeurs " + p.cle, function () {
                    var durable = "";
                    try {
                        var rows = appelRetrieve("EntityParticle", "DurableId", filtreChamp);
                        if (rows && rows.length) durable = rows[0].DurableId;
                    } catch (e) { durable = ""; }

                    var res = [];
                    if (durable) {
                        res.push(sonde("3 · Valeurs " + p.cle + " (DurableId)", "PicklistValueInfo",
                                       "Value,Label,IsActive", eq("EntityParticleId", durable), "Value"));
                    }
                    res.push(sonde("3 · Valeurs " + p.cle + " (repli " + direct + ")", "PicklistValueInfo",
                                   "Value,Label,IsActive", eq("EntityParticleId", direct), "Value"));
                    return res;
                });
            })(PICKLISTS[i]);
        }

        /* 4. Referentiels metier (cascade programme + evenements). */
        for (var k = 0; k < REFERENTIELS.length; k++) {
            (function (r) {
                pousser(out, r.etape, function () {
                    return sonde(r.etape, r.objet, r.cols, null, r.cols.split(",")[1] || "Id"); });
            })(REFERENTIELS[k]);
        }

        _trace.push("FIN");
        return out;
    }

    /** Compte les lignes par statut — sert au verdict des deux enveloppes. */
    function bilan(lignes) {
        var b = { total: lignes.length, ok: 0, vide: 0, erreur: 0 };
        for (var i = 0; i < lignes.length; i++) {
            if (lignes[i].statut === "OK") b.ok++;
            else if (lignes[i].statut === "VIDE") b.vide++;
            else b.erreur++;
        }
        return b;
    }

    /** Premiere erreur rencontree sur les etapes dont le libelle commence par `prefixe`. */
    function premiereErreur(lignes, prefixe) {
        for (var i = 0; i < lignes.length; i++) {
            if (lignes[i].etape.indexOf(prefixe) === 0 && lignes[i].erreur) return lignes[i].erreur;
        }
        return "(aucune erreur remontee)";
    }

    /** Le MID trouve, s'il l'a ete — pour l'afficher en tete de rapport. */
    function businessUnit(lignes) {
        for (var i = 0; i < lignes.length; i++) {
            if (lignes[i].etape.indexOf("-1 · Contexte · MID") === 0 &&
                lignes[i].statut === "OK") return lignes[i].echantillon;
        }
        return "";
    }

    /**
     * verdict — traduit le bilan en phrase actionnable.
     * Chaque cas correspond a une decision d'architecture differente.
     */
    function verdict(lignes) {
        var lecture = 0, temoin = 0, connexion = 0, meta = 0, valeurs = 0;
        for (var i = 0; i < lignes.length; i++) {
            var l = lignes[i];
            if (l.statut !== "OK") continue;
            /* Seules les deux formes de RetrieveSalesforceObjects comptent.
               WSProxy repond toujours present : l'inclure ici ferait passer
               "fonctions absentes" pour "fonctions disponibles". */
            if (l.etape === "0 · Fonction RetrieveSalesforceObjects" ||
                l.etape === "0 · Fonction Platform.Function.RetrieveSalesforceObjects") lecture++;
            if (l.etape === "0 · Fonction Script.Util.WSProxy (temoin)") temoin++;
            if (l.etape.indexOf("1 · ") === 0) connexion++;
            if (l.etape.indexOf("2 · ") === 0) meta++;
            if (l.etape.indexOf("3 · Valeurs") === 0) valeurs++;
        }
        var bu = businessUnit(lignes);
        var ou = bu ? " (BU " + bu + ")" : "";

        if (lecture === 0) {
            return "FONCTIONS ABSENTES" + ou + " — RetrieveSalesforceObjects est `undefined` " +
                   "sous ses deux formes." +
                   (temoin ? " Script.Util.WSProxy, lui, repond : le SSJS s'execute donc " +
                             "parfaitement, seule l'integration Salesforce manque." : "") +
                   " Marketing Cloud Connect n'est pas provisionne sur cette Business Unit.";
        }
        if (connexion === 0) {
            /* La fonction EXISTE mais aucun appel n'aboutit. C'est le cas le plus
               riche en information : l'erreur exacte de l'appel vaut diagnostic,
               on la remonte telle quelle plutot que de la resumer. */
            var cause = premiereErreur(lignes, "1 · Connexion");
            var refus = (cause.indexOf("security descriptor") >= 0);
            if (!refus) {
                return "FONCTION PRESENTE / APPEL EN ERREUR" + ou + " — RetrieveSalesforceObjects " +
                       "existe mais chaque appel echoue. Erreur remontee : " + cause;
            }

            /* Le resultat de la sonde 0bis departage H1 et H2 (cf. runSafe). */
            var identiteOk = 0, identiteTestee = 0;
            for (var j = 0; j < lignes.length; j++) {
                if (lignes[j].etape.indexOf("0bis ·") !== 0) continue;
                identiteTestee++;
                if (lignes[j].statut === "OK") identiteOk++;
            }

            var tete = "FONCTION PRESENTE / APPEL REFUSE" + ou + " — RetrieveSalesforceObjects " +
                       "existe bien dans le runtime (typeof = clrmethodinfo), mais chaque appel " +
                       "est refuse : « Unable to retrieve security descriptor for this frame ». " +
                       "C'est un refus de CONTEXTE, pas une panne de connexion ni un probleme " +
                       "de nom d'objet. ";

            if (identiteTestee === 0) {
                return tete + "La sonde d'identite n'a pas pu s'executer — relancer pour trancher.";
            }
            if (identiteOk > 0) {
                /* WSProxy prouve une identite SFMC. Il ne prouve RIEN sur
                   l'identite SALESFORCE : ce sont deux descripteurs distincts,
                   et seul le second manque. Deux causes restent possibles, que
                   cette page ne peut pas departager — le dire est plus utile
                   que de trancher au hasard. */
                return tete + "Or WSProxy lit " + identiteOk + " fois une Data Extension : " +
                       "l'identite SFMC de la page est valide. Ce qui manque est le descripteur " +
                       "SALESFORCE — un autre jeton, porte par l'utilisateur Marketing Cloud " +
                       "Connect. Deux causes restent en lice, indiscernables depuis une page : " +
                       "(a) l'utilisateur MC Connect n'est pas configure/actif sur cette BU — " +
                       "l'Automation echouerait alors pareil ; (b) aucune CloudPage PUBLIQUE ne " +
                       "porte de descripteur Salesforce, la lecture n'etant possible que depuis " +
                       "un runtime authentifie — l'Automation passerait. Un seul run de " +
                       "test-read-automation.ssjs tranche.";
            }
            return tete + "Et WSProxy echoue de la meme facon sur une simple Data Extension : " +
                   "la page n'a AUCUNE identite d'execution, tout appel authentifie est refuse. " +
                   "Une CloudPage publique ne pourra donc jamais lire Salesforce ici. Il faut un " +
                   "runtime porteur d'identite : Automation Studio (Script Activity) qui lit " +
                   "Salesforce et depose dans une Data Extension, la page ne lisant plus que la DE.";
        }
        if (valeurs > 0) {
            return "OK" + ou + " — les value sets sont lisibles directement (" + valeurs +
                   " reponse(s)). La lecture live de SocleRead.getPicklist() tient : aucune " +
                   "Data Extension de synchronisation n'est necessaire.";
        }
        if (meta > 0) {
            return "PARTIEL" + ou + " — les metadonnees repondent mais aucun value set n'est " +
                   "remonte. Verifier le nom d'API des 4 champs picklist cote org.";
        }
        return "CONNEXION OK / METADONNEES KO" + ou + " — MC Connect voit l'org mais n'expose " +
               "ni EntityParticle ni PicklistValueInfo. La lecture directe du value set est " +
               "impossible : il faut une DE de reference alimentee par ailleurs.";
    }

    return { runSafe: runSafe, run: runSafe, bilan: bilan, verdict: verdict,
             businessUnit: businessUnit, trace: trace,
             court: court, sonde: sonde, eq: eq };
})();
</script>
<script runat="server">
/**
 * ============================================================================
 *  DIAGNOSTIC LECTURE SALESFORCE — enveloppe CloudPage
 * ============================================================================
 *  A coller dans une CloudPage, en vue CODE, JUSTE APRES `probe-sf-read.ssjs`.
 *  Les deux blocs partagent le meme scope SSJS : `SfProbe` declare par le
 *  premier est visible ici.
 *
 *      +---------------------------------------------------+
 *      |  bloc runat=server n°1  ->  probe-sf-read.ssjs    |
 *      |  bloc runat=server n°2  ->  test-read-cloudpage   |
 *      +---------------------------------------------------+
 *
 *  (les balises ne sont pas ecrites ici : un `</` + `script>` dans un
 *   commentaire refermerait le bloc au moment du rendu de la page.)
 *
 *  LECTURE SEULE — aucune ecriture Salesforce ni SFMC.
 *
 *  Cette enveloppe affiche TOUJOURS quelque chose, y compris quand la sonde
 *  s'effondre : le journal des etapes atteintes vaut diagnostic a lui seul.
 *  Une page blanche ne dit rien ; une page qui dit « je suis morte ici » dit
 *  tout.
 *
 *  ⚠ Se tester sur l'URL PUBLIEE, pas sur l'apercu Page Builder : l'apercu
 *    n'execute pas toujours le SSJS, et un apercu vide ne prouve rien.
 * ============================================================================
 */
Platform.Load("Core", "1.1.1");

function esc(s) {
    var t;
    try { t = String(s === null || s === undefined ? "" : s); } catch (e) { t = "(illisible)"; }
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function couleur(statut) {
    if (statut === "OK")   return "#065f46";
    if (statut === "VIDE") return "#92400e";
    return "#991b1b";
}

var __debut  = new Date();
var __lignes = [];
var __panne  = "";
var __trace  = "";

/* La sonde est censee ne jamais lever — mais un diagnostic qui fait confiance
   a ce qu'il diagnostique n'est pas un diagnostic. Ceinture et bretelles. */
if (typeof SfProbe === "undefined") {
    __panne = "Le bloc probe-sf-read.ssjs n'a pas ete execute : SfProbe n'existe pas. "
            + "Est-il bien colle AVANT ce bloc, dans la meme page ?";
} else {
    try {
        __lignes = SfProbe.runSafe();
    } catch (e) {
        try { __panne = Platform.Function.Stringify(e); } catch (e2) { __panne = String(e); }
    }
    try { __trace = SfProbe.trace(); } catch (e3) { __trace = "(journal illisible)"; }
}

Write('<!doctype html><html lang="fr"><head><meta charset="utf-8">');
Write('<meta name="viewport" content="width=device-width,initial-scale=1">');
Write('<title>Diagnostic lecture Salesforce</title></head>');
Write('<body style="margin:0;background:#0f172a;color:#e2e8f0;font:14px/1.6 Segoe UI,Arial,sans-serif;padding:28px">');
Write('<h1 style="margin:0 0 4px;font-size:20px">Diagnostic &mdash; lecture Salesforce Core depuis SSJS</h1>');
Write('<div style="color:#94a3b8;margin-bottom:20px">CloudPage publiee &middot; lecture seule</div>');

if (__panne) {
    Write('<div style="background:#7f1d1d;padding:14px 18px;border-radius:8px;margin-bottom:20px">'
        + '<b>La sonde s\'est interrompue.</b><br>'
        + '<code style="font-size:12px">' + esc(__panne) + '</code></div>');
}

if (__lignes.length) {
    var v = "";
    try { v = SfProbe.verdict(__lignes); } catch (e4) { v = "(verdict indisponible)"; }

    Write('<div style="background:#1e293b;padding:16px 20px;border-radius:8px;margin-bottom:20px;'
        + 'border-left:4px solid #38bdf8"><b>Verdict :</b> ' + esc(v) + '</div>');

    var b = SfProbe.bilan(__lignes);
    Write('<div style="margin-bottom:14px;color:#94a3b8">'
        + b.total + ' sondes &mdash; <b style="color:#4ade80">' + b.ok + ' OK</b>, '
        + '<b style="color:#fbbf24">' + b.vide + ' vide</b>, '
        + '<b style="color:#f87171">' + b.erreur + ' erreur</b></div>');

    Write('<div style="overflow-x:auto">');
    Write('<table style="width:100%;border-collapse:collapse;background:#fff;color:#0f172a;border-radius:8px;overflow:hidden">');
    Write('<thead><tr style="background:#e2e8f0;text-align:left">'
        + '<th style="padding:8px 10px">Etape</th>'
        + '<th style="padding:8px 10px">Objet</th>'
        + '<th style="padding:8px 10px;text-align:right">Lignes</th>'
        + '<th style="padding:8px 10px">Statut</th>'
        + '<th style="padding:8px 10px">Echantillon / erreur</th></tr></thead><tbody>');

    for (var i = 0; i < __lignes.length; i++) {
        var l = __lignes[i];
        var detail = (l.statut === "OK") ? l.echantillon : (l.erreur || "aucune ligne");
        Write('<tr style="border-top:1px solid #e2e8f0">'
            + '<td style="padding:6px 10px">' + esc(l.etape) + '</td>'
            + '<td style="padding:6px 10px;font-family:Consolas,monospace;font-size:12px">' + esc(l.objet) + '</td>'
            + '<td style="padding:6px 10px;text-align:right;font-weight:700">' + esc(l.nb) + '</td>'
            + '<td style="padding:6px 10px;font-weight:700;color:' + couleur(l.statut) + '">' + esc(l.statut) + '</td>'
            + '<td style="padding:6px 10px;font-family:Consolas,monospace;font-size:12px;color:#475569">'
            + esc(detail) + '</td></tr>');
    }
    Write('</tbody></table></div>');
}

/* Le journal des etapes ATTEINTES. Si la page s'arrete malgre tout, sa
   derniere entree nomme la fonction du runtime qui l'a tuee. */
Write('<div style="margin-top:20px;font-weight:700;color:#94a3b8">Etapes atteintes</div>');
Write('<pre style="margin:6px 0 0;white-space:pre-wrap;word-break:break-word;background:#0b0b26;'
    + 'padding:10px 12px;border-radius:6px;font-size:12px;color:#cbd5e1">'
    + esc(__trace || "(aucune etape enregistree — la sonde n\'a pas demarre)") + '</pre>');

Write('<div style="margin-top:14px;color:#64748b;font-size:12px">Duree : '
    + (new Date().getTime() - __debut.getTime()) + ' ms</div>');
Write('</body></html>');
</script>
