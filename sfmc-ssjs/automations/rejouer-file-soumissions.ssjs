<script runat="server">
/* ============================================================================
 *  REJEU DE LA FILE DES SOUMISSIONS — Script Activity, Automation Studio
 * ============================================================================
 *  Filet de securite du mode asynchrone (SFMC_ASYNC_SOUMISSION) : le POST du
 *  visiteur depose la soumission dans LPB_File_Soumissions et repond ; le
 *  navigateur relance le traitement par beacon. Ce script rejoue ce qui n'est
 *  pas arrive :
 *    - a_traiter depuis plus de 2 minutes   (le beacon n'est jamais parti)
 *    - en_cours  depuis plus de 10 minutes  (la page de traitement est morte
 *                                            avant le solde, CRM en echec)
 *  Il reposte le corps brut conserve (Payload1..3) sur l'URL de la colonne Url
 *  — la page de traitement dediee (<Lot>_TRAITEMENT_V0) depuis le 27/09, la
 *  page d'origine pour les lignes plus anciennes — avec
 *  socle_traitement=1 et socle_run=<RunId> : c'est la page qui ecrit et qui
 *  solde la ligne (traitee | erreur). Au-dela de 3 tentatives la ligne passe
 *  en erreur, pour ne pas marteler le CRM avec une soumission qu'il refuse.
 *  Aucune lecture Salesforce ici (interdite en SSJS sur cette org) : DE et
 *  HTTP seulement. Planification conseillee : toutes les 15 minutes.
 * ========================================================================== */
Platform.Load("core", "1.1.1");
var DE = "LPB_File_Soumissions";
var MAX_TENTATIVES = 3;
var ATTENTE_A_TRAITER_MS = 2 * 60 * 1000;
var ATTENTE_EN_COURS_MS  = 10 * 60 * 1000;
var maintenant = new Date();
var bilan = { vues: 0, rejouees: 0, abandonnees: 0, attendues: 0, echecsHttp: 0 };

function dateDe(v) { try { var d = new Date(String(v)); return isNaN(d.getTime()) ? null : d; } catch (e) { return null; } }
function lignes(statut) {
    try { return Platform.Function.LookupOrderedRows(DE, 200, "Horodatage ASC", "Statut", statut) || []; } catch (e) { return []; }
}
function solder(runId, statut, detail) {
    Platform.Function.UpdateData(DE, ["RunId"], [runId], ["Statut", "DerniereTentative", "Detail"], [statut, maintenant, String(detail || "").substring(0, 500)]);
}
function rejouer(l) {
    var payload = String(l.Payload1 || "") + String(l.Payload2 || "") + String(l.Payload3 || "");
    var url = String(l.Url || "");
    if (!payload || !url) { solder(l.RunId, "erreur", "rejeu impossible : payload ou URL absent"); bilan.abandonnees++; return; }
    var corps = payload + "&socle_traitement=1&socle_run=" + encodeURIComponent(String(l.RunId));
    try {
        var r = HTTP.Post(url, "application/x-www-form-urlencoded; charset=UTF-8", corps, [], []);
        bilan.rejouees++;
        /* La page solde elle-meme la ligne ; on ne note ici qu'un HTTP non 2xx. */
        if (r && r.StatusCode && Number(r.StatusCode) >= 300) {
            bilan.echecsHttp++;
            Platform.Function.UpdateData(DE, ["RunId"], [l.RunId], ["Detail"], ["rejeu : http " + r.StatusCode]);
        }
    } catch (eHttp) {
        bilan.echecsHttp++;
        var motif = (eHttp && eHttp.message ? String(eHttp.message) : Stringify(eHttp)).replace(/\s+/g, " ").substring(0, 200);
        Platform.Function.UpdateData(DE, ["RunId"], [l.RunId], ["Detail"], ["rejeu : appel refuse : " + motif]);
    }
}
function traiter(statut, champDate, attenteMs) {
    var rows = lignes(statut);
    for (var i = 0; i < rows.length; i++) {
        var l = rows[i];
        bilan.vues++;
        var tentatives = Number(l.Tentatives || 0);
        if (tentatives >= MAX_TENTATIVES) { solder(l.RunId, "erreur", "abandon apres " + tentatives + " tentative(s)"); bilan.abandonnees++; continue; }
        var d = dateDe(l[champDate]) || dateDe(l.Horodatage);
        if (d && (maintenant.getTime() - d.getTime()) < attenteMs) { bilan.attendues++; continue; }
        rejouer(l);
    }
}
try {
    traiter("a_traiter", "Horodatage", ATTENTE_A_TRAITER_MS);
    traiter("en_cours", "DerniereTentative", ATTENTE_EN_COURS_MS);
    Write("rejeu file soumissions : " + Stringify(bilan));
} catch (e) {
    Write("rejeu file soumissions : exception " + (e && e.message ? e.message : Stringify(e)));
}
</script>
