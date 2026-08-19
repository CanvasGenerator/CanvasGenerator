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
