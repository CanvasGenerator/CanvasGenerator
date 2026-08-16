<script runat="server">
/**
 * ============================================================================
 *  SYNCHRO PICKLISTS SALESFORCE -> DATA EXTENSION
 *  (à coller dans : Automation Studio > nouvelle Automation > Script Activity)
 * ============================================================================
 *  POURQUOI ICI (et pas sur la CloudPage) :
 *  Une Script Activity d'Automation Studio EXECUTE TOUJOURS le SSJS de façon
 *  fiable, côté serveur — contrairement à une page publiée. C'est donc le bon
 *  endroit pour lire Salesforce. La page, elle, n'aura plus qu'à lire la Data
 *  Extension (données déjà synchronisées) : plus aucune dépendance à
 *  l'exécution de code sur la page.
 *
 *  CE QUE FAIT CE SCRIPT :
 *    1. lit les value sets Salesforce (Pays, Niveau, Vous êtes, Indicatif)
 *       via les Platform Functions SSJS natives  ->  AUCUN REST (consigne manager)
 *    2. écrit / met à jour chaque valeur dans la Data Extension LP_Picklists
 *
 *  PLANIFICATION : placer cette Automation sur un Schedule (ex. 1x/jour). À
 *  chaque passage, la DE est resynchronisée avec Salesforce.
 *
 *  PRÉREQUIS INCONTOURNABLE : Marketing Cloud Connect doit être connecté à
 *  l'org Salesforce, sinon RetrieveSalesforceObjects ne renvoie rien.
 *
 *  --- Data Extension à créer AVANT (une seule fois) ---
 *  Nom / External Key : LP_Picklists
 *    Field        | Type    | Longueur | Clé primaire | Nullable
 *    -------------|---------|----------|--------------|---------
 *    FieldKey     | Text    | 50       | OUI          | non   (ex. "country")
 *    Value        | Text    | 255      | OUI          | non   (valeur API SF)
 *    Label        | Text    | 255      |              | oui   (libellé affiché)
 *    SortOrder    | Number  |          |              | oui
 *    UpdatedAt    | Date    |          |              | oui
 * ============================================================================
 */
Platform.Load("Core", "1.1.1");

var DE_KEY = "LP_Picklists";   // External Key de la Data Extension cible

var LOG = [];
function log(m) { LOG.push(String(m)); }
function S(o) { try { return Platform.Function.Stringify(o); } catch (e) { return String(o); } }
function isBlank(v) { return (v === null || v === undefined || String(v) === ""); }

/* -- Champs picklist à synchroniser : clé formulaire -> (objet, champ SF) ---- */
var FIELDS = [
    { key: "country",    object: "Account", field: "LivingCountry__c" },
    { key: "studyLevel", object: "Account", field: "Academic_Level_List__c" },
    { key: "vousEtes",   object: "Account", field: "PersonAccountType__c" },
    { key: "indicatif",  object: "Account", field: "IndicatifPick__c" }
];

/* -- Objets de métadonnées standards de Salesforce (value sets) ------------- */
var ENTITY_PARTICLE = { object: "EntityParticle",   durable: "DurableId", name: "QualifiedApiName", owner: "EntityDefinitionId" };
var PICKLIST_VALUE  = { object: "PicklistValueInfo", parent:  "EntityParticleId", value: "Value", label: "Label", active: "IsActive" };

/* -- Lecture Salesforce protégée : renvoie toujours un tableau -------------- */
function retrieve(object, colsCSV, whereMap) {
    try {
        var filter = null, keys = [];
        for (var k in whereMap) { if (whereMap.hasOwnProperty(k)) keys.push(k); }
        if (keys.length === 1) {
            filter = { Property: keys[0], SimpleOperator: "equals", Value: whereMap[keys[0]] };
        } else if (keys.length > 1) {
            filter = { Property: keys[0], SimpleOperator: "equals", Value: whereMap[keys[0]] };
            for (var i = 1; i < keys.length; i++) {
                filter = { LeftOperand: filter, LogicalOperator: "AND",
                           RightOperand: { Property: keys[i], SimpleOperator: "equals", Value: whereMap[keys[i]] } };
            }
        }
        var rows = RetrieveSalesforceObjects(object, colsCSV, filter);
        return (rows && rows.length) ? rows : [];
    } catch (e) {
        log("retrieve " + object + " KO: " + S(e));
        return [];
    }
}

/* -- Résout le DurableId d'un champ (repli : forme "Objet.Champ") ----------- */
function fieldDurableId(objet, champ) {
    var where = {};
    where[ENTITY_PARTICLE.owner] = objet;
    where[ENTITY_PARTICLE.name]  = champ;
    var rows = retrieve(ENTITY_PARTICLE.object, ENTITY_PARTICLE.durable + "," + ENTITY_PARTICLE.name, where);
    if (rows.length && !isBlank(rows[0][ENTITY_PARTICLE.durable])) return rows[0][ENTITY_PARTICLE.durable];
    return objet + "." + champ; // repli accepté par beaucoup d'orgs
}

/* -- Valeurs actives d'un value set ---------------------------------------- */
function getPicklistValues(objet, champ) {
    var cols = PICKLIST_VALUE.value + "," + PICKLIST_VALUE.label + "," + PICKLIST_VALUE.active;
    var direct  = objet + "." + champ;
    var durable = fieldDurableId(objet, champ);

    var where = {}; where[PICKLIST_VALUE.parent] = durable;
    var rows = retrieve(PICKLIST_VALUE.object, cols, where);
    if (!rows.length && durable !== direct) {
        where[PICKLIST_VALUE.parent] = direct;
        rows = retrieve(PICKLIST_VALUE.object, cols, where);
    }

    var out = [];
    for (var i = 0; i < rows.length; i++) {
        var actif = rows[i][PICKLIST_VALUE.active];
        if (actif === false || String(actif).toLowerCase() === "false") continue; // désactivée -> ignorée
        var v = rows[i][PICKLIST_VALUE.value];
        if (isBlank(v)) continue;
        out.push({ value: v, label: rows[i][PICKLIST_VALUE.label] || v });
    }
    return out;
}

/* -- Upsert d'une valeur dans la DE (clé = FieldKey + Value) ---------------- */
function upsertRow(fieldKey, value, label, sortOrder) {
    try {
        Platform.Function.UpsertData(
            DE_KEY,
            ["FieldKey", "Value"],            [fieldKey, value],
            ["Label", "SortOrder", "UpdatedAt"], [label, sortOrder, Platform.Function.SystemDateToLocalDate(Now())]
        );
        return true;
    } catch (e) {
        log("upsert " + fieldKey + "/" + value + " KO: " + S(e));
        return false;
    }
}

/* ========================= EXECUTION ======================================= */
var total = 0, ok = 0;
for (var f = 0; f < FIELDS.length; f++) {
    var def = FIELDS[f];
    var vals = getPicklistValues(def.object, def.field);
    log(def.key + " (" + def.object + "." + def.field + ") -> " + vals.length + " valeur(s)");
    for (var i = 0; i < vals.length; i++) {
        total++;
        if (upsertRow(def.key, vals[i].value, vals[i].label, i + 1)) ok++;
    }
}

log("SYNCHRO TERMINEE : " + ok + "/" + total + " valeur(s) ecrites dans " + DE_KEY);

/* Trace visible si on lance le script dans l'éditeur (bouton "Validate/Run"). */
Write(LOG.join("\n"));
</script>
