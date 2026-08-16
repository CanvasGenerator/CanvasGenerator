<script runat="server">
/**
 * ============================================================================
 *  SOCLE — HELPERS SALESFORCE  (Content Block : LPB_Socle_Helpers_AG)
 * ============================================================================
 *  Wrappers minces autour des Platform Functions SSJS Salesforce natives :
 *      RetrieveSalesforceObjects / CreateSalesforceObject / UpdateSingleSalesforceObject
 *  -> AUCUNE API REST.
 *
 *  Depend de : LPB_Socle_Config_AG (objet SocleConfig).
 *  Requiert  : Platform.Load("Core","1.1.1") dans le handler appelant.
 * ============================================================================
 */

var Socle = (function () {

    /* -- journal d'execution (pour debug + statut de retour au form) ----- */
    var _log = [];
    function log(msg) { _log.push(String(msg)); }
    function getLog() { return _log.join("\n"); }

    /* -- utilitaires valeurs -------------------------------------------- */
    function isBlank(v) {
        return (v === null || v === undefined || String(v) === "");
    }

    /**
     * Construit un filtre SSJS (SimpleFilterPart / ComplexFilterPart) a partir
     * d'un objet plat { champ: valeur }. Plusieurs cles => combinees en AND.
     */
    function buildFilter(map) {
        var keys = [];
        for (var k in map) { if (map.hasOwnProperty(k)) keys.push(k); }
        if (keys.length === 0) return null;

        function simple(field) {
            return { Property: field, SimpleOperator: "equals", Value: map[field] };
        }
        var filter = simple(keys[0]);
        for (var i = 1; i < keys.length; i++) {
            filter = { LeftOperand: filter, LogicalOperator: "AND", RightOperand: simple(keys[i]) };
        }
        return filter;
    }

    /**
     * Lecture. Retourne TOUJOURS un tableau (vide si rien / erreur).
     * @param {String} object   API name de l'objet
     * @param {String} colsCSV  colonnes demandees, ex "Id,PersonContactId"
     * @param {Object} whereMap { champ: valeur } combinees en AND
     */
    function retrieve(object, colsCSV, whereMap) {
        try {
            var filter = buildFilter(whereMap);
            var rows = RetrieveSalesforceObjects(object, colsCSV, filter);
            return (rows && rows.length) ? rows : [];
        } catch (e) {
            log("retrieve " + object + " KO: " + Stringify(e));
            return [];
        }
    }

    /** Premiere ligne ou null. */
    function retrieveOne(object, colsCSV, whereMap) {
        var rows = retrieve(object, colsCSV, whereMap);
        return rows.length ? rows[0] : null;
    }

    /**
     * Lecture avec filtre BRUT (SimpleFilterPart / ComplexFilterPart deja
     * construit). Sert aux comparaisons non-"equals" : plages de dates,
     * greaterThan, lessThanOrEqual... (getNextEventDates). Retourne un tableau.
     */
    function retrieveRaw(object, colsCSV, filter) {
        try {
            var rows = RetrieveSalesforceObjects(object, colsCSV, filter);
            return (rows && rows.length) ? rows : [];
        } catch (e) {
            log("retrieveRaw " + object + " KO: " + Stringify(e));
            return [];
        }
    }

    /** Filtre "champ dans [debut, fin]" (bornes incluses) sur une date/valeur. */
    function betweenFilter(field, from, to) {
        return {
            LeftOperand:  { Property: field, SimpleOperator: "greaterThanOrEqual", Value: from },
            LogicalOperator: "AND",
            RightOperand: { Property: field, SimpleOperator: "lessThanOrEqual", Value: to }
        };
    }

    /**
     * Transforme { champ: valeur } en liste variadique [f1,v1,f2,v2,...]
     * en ignorant les valeurs vides.
     */
    function pairs(fields) {
        var out = [];
        for (var f in fields) {
            if (!fields.hasOwnProperty(f)) continue;
            if (isBlank(fields[f])) continue;
            out.push(f); out.push(fields[f]);
        }
        return out;
    }

    /**
     * Creation. Retourne { ok, error }. NB : la Platform Function ne renvoie
     * pas l'Id de facon fiable -> l'appelant re-lit par la cle d'upsert.
     */
    function create(object, fields) {
        var p = pairs(fields);
        var count = p.length / 2;
        if (count === 0) return { ok: false, error: "aucun champ a creer" };
        var args = [object, count].concat(p);
        try {
            CreateSalesforceObject.apply(this, args);
            log("create " + object + " (" + count + " champs) OK");
            return { ok: true };
        } catch (e) {
            log("create " + object + " KO: " + Stringify(e));
            return { ok: false, error: Stringify(e) };
        }
    }

    /**
     * Mise a jour d'un enregistrement par Id. Retourne { ok, count, error }.
     */
    function update(object, id, fields) {
        var p = pairs(fields);
        var count = p.length / 2;
        if (count === 0) return { ok: true, count: 0 };  // rien a mettre a jour = succes
        var args = [object, id, count].concat(p);
        try {
            var n = UpdateSingleSalesforceObject.apply(this, args);
            log("update " + object + " " + id + " (" + count + " champs) -> " + n);
            return { ok: true, count: n };
        } catch (e) {
            log("update " + object + " " + id + " KO: " + Stringify(e));
            return { ok: false, error: Stringify(e) };
        }
    }

    /**
     * FILL-IF-BLANK : ne conserve que les champs dont la valeur ACTUELLE cote
     * SF est vide et la NOUVELLE valeur non vide. `current` = ligne relue.
     */
    function fillIfBlank(current, candidate) {
        var out = {};
        for (var f in candidate) {
            if (!candidate.hasOwnProperty(f)) continue;
            if (isBlank(candidate[f])) continue;
            if (current && !isBlank(current[f])) continue; // deja rempli -> on n'ecrase pas
            out[f] = candidate[f];
        }
        return out;
    }

    /** JSON-safe pour le log (SSJS n'a pas JSON.stringify natif fiable). */
    function Stringify(o) {
        try { return Platform.Function.Stringify(o); } catch (e) { return String(o); }
    }

    /**
     * Rejeu idempotent d'une operation sur erreur transitoire. Les upsert du
     * socle etant idempotents, un re-essai ne cree pas de doublon.
     * @param {Function} fn      operation renvoyant { ok, ... } ou une valeur
     * @param {Number}   tries   nombre total de tentatives (defaut 3)
     * @returns le resultat de fn (dernier essai si tous echouent)
     */
    function withRetry(fn, tries) {
        var max = tries || 3;
        var last = null;
        for (var i = 1; i <= max; i++) {
            try {
                last = fn();
                // succes si pas d'objet {ok:false}
                if (!last || last.ok !== false) return last;
                log("withRetry: essai " + i + "/" + max + " KO -> " + Stringify(last.error));
            } catch (e) {
                last = { ok: false, error: Stringify(e) };
                log("withRetry: essai " + i + "/" + max + " exception -> " + last.error);
            }
        }
        return last;
    }

    /**
     * Assemble la preuve de consentement versionnee : phrase du formulaire +
     * phrase de pied de page (footer). Stockee dans Legal_Texte_Accepted__c
     * (texte legal versionne, requis par la VR opt-in).
     */
    function buildConsentProof(formText, footerText, version) {
        var parts = [];
        if (!isBlank(version))    parts.push("[" + version + "]");
        if (!isBlank(formText))   parts.push(formText);
        if (!isBlank(footerText)) parts.push(footerText);
        return parts.join(" — ");
    }

    /* ------------------------------------------------------------------------
     *  PAS DE SUPPRESSION DANS LE SOCLE — decision de perimetre.
     *  Ces blocs sont executes depuis une CloudPage PUBLIQUE, soumise par des
     *  prospects. Le socle n'expose donc que Create / Update : aucune requete
     *  forgee ne peut faire disparaitre un enregistrement Salesforce.
     *  Le nettoyage des enfants devenus obsoletes releve d'un outil
     *  d'administration CRM, pas du backend des formulaires.
     * --------------------------------------------------------------------- */

    /**
     * Projette les champs de tracking du formulaire sur les noms d'API cibles.
     *
     * Indispensable parce que le MEME tracking porte deux nommages selon
     * l'objet : sans underscore sur Account (UTMSource__c), avec underscore sur
     * CampaignMember et Summit Registration (UTM_Source__c). On passe donc la
     * table de correspondance de l'objet vise (SocleConfig.<OBJET>.tracking).
     *
     * @param {Object} form         form normalise (utm_source, gclid, ...)
     * @param {Object} trackingMap  { cleForm: "ChampAPI__c" }
     * @returns {Object} { ChampAPI__c: valeur } — vides ignorees a l'ecriture
     */
    function mapTracking(form, trackingMap) {
        var out = {};
        if (!form || !trackingMap) return out;
        for (var k in trackingMap) {
            if (!trackingMap.hasOwnProperty(k)) continue;
            if (isBlank(form[k])) continue;
            out[trackingMap[k]] = form[k];
        }
        return out;
    }

    return {
        log: log, getLog: getLog, isBlank: isBlank,
        retrieve: retrieve, retrieveOne: retrieveOne, retrieveRaw: retrieveRaw,
        betweenFilter: betweenFilter,
        create: create, update: update,
        fillIfBlank: fillIfBlank, pairs: pairs, Stringify: Stringify,
        withRetry: withRetry, buildConsentProof: buildConsentProof,
        mapTracking: mapTracking
    };
})();
</script>
