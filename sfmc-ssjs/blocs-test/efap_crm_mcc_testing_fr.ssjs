<script runat="server">
/* ===========================================================================
   efap_crm_mcc_testing_fr — ENVELOPPE DU BLOC DE LECTURE CRM
   ---------------------------------------------------------------------------
   Code snippet appele par la CloudPage (LPB_Page en prod, landingpage en
   recette) comme n'importe quelle page du LP Builder :

     ?id=efap_crm_mcc_testing_fr&email=<adresse>
     ?school=efap&name=crm_mcc_testing&lang=fr&email=<adresse>

   Il inclut le bloc AMPscript `efap_crm_mcc_testing_fr_amp` dans un
   try/catch : une lecture refusee par l'org (champ absent, objet non expose
   au connecteur, MC Connect detache) affiche l'exception Salesforce complete
   au lieu d'une page morte. Source : sfmc-ssjs/blocs-test/,
   depot : node scripts/deployer-bloc-test-crm.js --mid=<BU>.
   =========================================================================== */
Platform.Load("Core", "1.1.1");
var out = "";
try {
    out = Platform.Function.ContentBlockByKey("efap_crm_mcc_testing_fr_amp");
} catch (e) {
    var msg = "";
    try { msg = (e && e.message) ? String(e.message) : String(e); } catch (e2) { msg = "exception illisible"; }
    try { if (e && e.description) { msg += "\n" + String(e.description); } } catch (e3) {}
    out = "<pre style='font:12px/1.4 Menlo,Consolas,monospace;white-space:pre-wrap;color:#b00;max-width:1100px;margin:16px auto;padding:0 12px'>"
        + "ERREUR du bloc de lecture CRM (exception du connecteur)\n\n"
        + msg.replace(/</g, "&lt;") + "</pre>";
}
Write(out);
</script>
