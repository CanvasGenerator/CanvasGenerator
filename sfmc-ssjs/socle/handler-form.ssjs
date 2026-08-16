%%[ /* Variables AMPscript lues par le bloc form-salesforce-core (messages) */
    VAR @sfStatus, @sfErrorMsg
    SET @sfStatus = ""
    SET @sfErrorMsg = ""
]%%
<script runat="server">
/**
 * ============================================================================
 *  HANDLER FORMULAIRE  (Content Block : LPB_Form_Handler_AG)
 * ============================================================================
 *  Orchestration de la sequence d'upsert commune. A inclure en HAUT de la
 *  CloudPage, avant l'affichage du formulaire.
 *
 *  Garantie contractuelle : l'ecriture du Person Account ne peut JAMAIS
 *  echouer a cause de l'aval. try/catch global ; aucune soumission perdue.
 * ============================================================================
 */
Platform.Load("Core", "1.1.1");

try {
    var submitted = Platform.Function.RequestParameter("submitted");
    if (submitted == "true") {

        // Inclusion des briques du socle (meme scope SSJS)
        Platform.Function.ContentBlockByKey("LPB_Socle_Config_AG");
        Platform.Function.ContentBlockByKey("LPB_Socle_Helpers_AG");
        Platform.Function.ContentBlockByKey("LPB_Socle_Resolvers_AG");
        Platform.Function.ContentBlockByKey("LPB_Socle_Upsert_AG");
        Platform.Function.ContentBlockByKey("LPB_Socle_Summit_AG");

        var form = Socle.readForm();

        // Resolution marque + campagne (mapping DE, jamais en dur)
        if (Socle.isBlank(form.brandId)) {
            form.brandId = SocleResolvers.resolveBrand(form.ecole).brandId;
        }

        // Familles de formulaires (3e objet ecrit)
        var CAMPAIGN_FAMILY = { brochure: true, candidature: true };
        var EVENT_FAMILY    = { jpo: true, atelier: true, stage: true };
        var isCampaign = CAMPAIGN_FAMILY[form.formType] === true;
        var isEvent    = EVENT_FAMILY[form.formType] === true;

        if (isCampaign && Socle.isBlank(form.campaignId)) {
            form.campaignId = SocleResolvers.resolveCampaign(form);
        }

        // Etape 1 — Person Account (declenche le depot du tampon)
        var pa = Socle.withRetry(function () { return upsertPersonAccount(form); });

        if (pa && pa.id) {
            // Etape 2 — Consentements (1 record par canal coche)
            upsertConsents(pa, form);

            // Etape 3 — 3e objet selon la famille du formulaire
            if (isCampaign) {
                // 3a — CampaignMember (brochure / candidature)
                upsertCampaignMember(pa, form);
            } else if (isEvent) {
                // 3b — Summit Registration + Appointments (JPO / Atelier / Stage)
                var regId = upsertSummitRegistration(pa, form);
                if (regId) createAppointments(regId, form);
            } else if (form.formType === "immersion") {
                // A ARBITRER (v4 = Summit, support = CampaignMember) — cf. artifact §07
                Socle.log("immersion: famille a arbitrer, aucun 3e objet ecrit.");
            }
            Variable.SetValue("@sfStatus", "success");
        } else {
            Variable.SetValue("@sfStatus", "error");
            Variable.SetValue("@sfErrorMsg", "Person Account non cree (email manquant ?)");
        }

        Write("<!-- socle log:\n" + Socle.getLog() + "\n-->");
    }
} catch (e) {
    // Stringify autonome : les briques du socle peuvent ne pas etre chargees ici.
    var msg;
    try { msg = Platform.Function.Stringify(e); } catch (e2) { msg = String(e); }
    Variable.SetValue("@sfStatus", "error");
    Variable.SetValue("@sfErrorMsg", msg);
    Write("<!-- socle exception: " + msg + " -->");
}
</script>
