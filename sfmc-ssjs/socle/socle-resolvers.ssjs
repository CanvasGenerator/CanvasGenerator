<script runat="server">
/**
 * ============================================================================
 *  SOCLE — RESOLVEURS & REFERENTIELS DE  (Content Block : LPB_Socle_Resolvers_AG)
 * ============================================================================
 *  Traductions "metier -> Id/valeur CRM" lues dans des Data Extensions SFMC
 *  (JAMAIS en dur, JAMAIS via REST) :
 *
 *      resolveCampaign(form)      -> CampaignId (form x ecole x zone)
 *      resolveBrand(ecole)        -> { brandId, brandCode }
 *      computeZone(pays)          -> "FR" | "Intl"
 *
 *  NB : les valeurs des menus deroulants ne sont PAS ici — elles sont lues
 *  directement dans le value set Salesforce (SocleRead.getPicklist).
 *
 *  Ces DE sont propres a l'org (UAT != Prod) : basculer les noms de DE en
 *  config a la mise en prod. 40 campagnes = brochure/candidature x FR/Intl x 10 ecoles.
 *
 *  Depend de : LPB_Socle_Config_AG (SocleConfig) + LPB_Socle_Helpers_AG (Socle).
 *  Utilise les Platform Functions natives via DataExtension.Init(...).Rows.Lookup.
 * ============================================================================
 */

var SocleResolvers = (function () {

    /**
     * Lookup multi-criteres dans une Data Extension.
     * @param {String} deName   Name / ExternalKey de la DE
     * @param {Array}  fields    ex ["FormType","Ecole","Zone"]
     * @param {Array}  values    ex ["candidature","EFAP","FR"]
     * @returns {Array} lignes trouvees (vide si rien / erreur)
     */
    function lookup(deName, fields, values) {
        try {
            var de = DataExtension.Init(deName);
            var rows = de.Rows.Lookup(fields, values);
            return (rows && rows.length) ? rows : [];
        } catch (e) {
            Socle.log("lookup DE " + deName + " KO: " + Socle.Stringify(e));
            return [];
        }
    }

    /** Zone tarifaire/campagne deduite du pays de residence. */
    function computeZone(pays) {
        var Rz = SocleConfig.RESOLVERS;
        if (Socle.isBlank(pays)) return Rz.zoneDomestic;                 // defaut : FR
        return (String(pays) === Rz.zoneDomesticCountry) ? Rz.zoneDomestic : Rz.zoneInternational;
    }

    /**
     * resolveCampaign — Id de campagne pour (type de formulaire, ecole, zone).
     * La zone est calculee depuis le pays si non fournie.
     * @param {Object} form  form normalise (formType, ecole, country[, zone])
     * @returns {String|null} CampaignId
     */
    function resolveCampaign(form) {
        var Rc = SocleConfig.RESOLVERS;
        var zone = Socle.isBlank(form.zone) ? computeZone(form.country) : form.zone;

        var rows = lookup(
            Rc.campaignDE,
            [Rc.campaignKeys.form, Rc.campaignKeys.ecole, Rc.campaignKeys.zone],
            [form.formType,        form.ecole,            zone]
        );
        if (rows.length) return rows[0][Rc.campaignValue];

        // repli : sans la zone (mapping non ventile FR/Intl pour ce formulaire)
        rows = lookup(Rc.campaignDE, [Rc.campaignKeys.form, Rc.campaignKeys.ecole],
                      [form.formType, form.ecole]);
        if (rows.length) return rows[0][Rc.campaignValue];

        Socle.log("resolveCampaign: aucune campagne pour form=" + form.formType +
                  " ecole=" + form.ecole + " zone=" + zone);
        return null;
    }

    /**
     * resolveBrand — marque SF d'une ecole.
     * @returns {Object} { brandId, brandCode } (valeurs vides si introuvable)
     */
    function resolveBrand(ecole) {
        var Rb = SocleConfig.RESOLVERS;
        var rows = lookup(Rb.brandDE, [Rb.brandKey], [ecole]);
        if (!rows.length) { Socle.log("resolveBrand: ecole inconnue -> " + ecole); return { brandId: "", brandCode: "" }; }
        return {
            brandId:   rows[0][Rb.brandValues.brandId]   || "",
            brandCode: rows[0][Rb.brandValues.brandCode] || ""
        };
    }

    /* Les valeurs des menus deroulants NE passent PAS par une DE : elles sont
       lues directement dans le value set Salesforce -> SocleRead.getPicklist()
       (EntityParticle + PicklistValueInfo). Rien a synchroniser ici. */

    return {
        lookup:          lookup,
        computeZone:     computeZone,
        resolveCampaign: resolveCampaign,
        resolveBrand:    resolveBrand
    };
})();
</script>
