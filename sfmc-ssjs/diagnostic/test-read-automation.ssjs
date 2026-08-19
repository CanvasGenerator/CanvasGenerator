<script runat="server">
/**
 * ============================================================================
 *  DIAGNOSTIC LECTURE SALESFORCE — enveloppe Automation (Script Activity)
 * ============================================================================
 *  Meme sonde que la CloudPage, mais executee dans Automation Studio et
 *  deversee dans une Data Extension : le resultat se relit ensuite par API,
 *  sans avoir a publier ni ouvrir une page.
 *
 *  Interet du doublon : Automation Studio est un runtime FIABLE pour SSJS,
 *  la CloudPage ne l'est pas toujours. Si cette version repond et pas la
 *  CloudPage, la panne est dans la page (collage / apercu / publication) et
 *  non dans Marketing Cloud Connect.
 *
 *  LECTURE SEULE cote Salesforce. La seule ecriture est la DE de diagnostic.
 *
 *  Deploiement : concatener `probe-sf-read.ssjs` PUIS ce fichier en un seul
 *  script (une Script Activity ne prend qu'un bloc) — cf. deploy-diagnostic.js.
 * ============================================================================
 */
Platform.Load("Core", "1.1.1");

var DIAG_DE = "LPB_Diag_SF_Read";

var runId = "";
try { runId = String(Platform.Function.GUID()).substring(0, 8); } catch (e) { runId = "run"; }

var de = DataExtension.Init(DIAG_DE);
var maintenant = Platform.Function.Now();

function tronque(v, max) {
    var s = String(v === null || v === undefined ? "" : v);
    return s.length > max ? s.substring(0, max) : s;
}

/** Une ligne de DE par sonde + une ligne de synthese. */
function ecrire(ordre, etape, objet, colonnes, statut, nb, echantillon, erreur, verdict) {
    try {
        de.Rows.Add({
            RowId:         runId + "-" + (ordre < 10 ? "0" + ordre : ordre),
            RunId:         runId,
            Ordre:         ordre,
            Etape:         tronque(etape, 100),
            Objet:         tronque(objet, 100),
            Colonnes:      tronque(colonnes, 200),
            Statut:        tronque(statut, 20),
            NbLignes:      nb,
            Echantillon:   tronque(echantillon, 500),
            Erreur:        tronque(erreur, 500),
            /* 3900 et non 900 : les verdicts detaillent la cause et depassent
               largement le millier de caracteres. Tronquer ici couperait
               justement la partie actionnable. */
            Verdict:       tronque(verdict, 3900),
            DateExecution: maintenant
        });
    } catch (e) { /* une ligne de log perdue ne doit jamais faire tomber le run */ }
}

var lignes = [];
var pannne = "";
try {
    lignes = SfProbe.run();
} catch (e) {
    try { pannne = Platform.Function.Stringify(e); } catch (e2) { pannne = String(e); }
}

if (pannne) {
    ecrire(0, "0 · Demarrage sonde", "-", "-", "ERREUR", 0, "", tronque(pannne, 500),
           "La sonde n'a pas demarre : bloc probe-sf-read.ssjs absent du script ?");
} else {
    for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        ecrire(i + 1, l.etape, l.objet, l.colonnes, l.statut, l.nb, l.echantillon, l.erreur, "");
    }
    var b = SfProbe.bilan(lignes);
    ecrire(99, "99 · SYNTHESE", "-", "-", (b.ok > 0 ? "OK" : "KO"), b.ok,
           b.total + " sondes / " + b.ok + " OK / " + b.vide + " vide / " + b.erreur + " erreur",
           "", SfProbe.verdict(lignes));
}
</script>
