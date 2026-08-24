/**
 * Guard d'authentification CÔTÉ CLIENT.
 *
 * ── Pourquoi il est INDISPENSABLE sur Vercel ────────────────────────────────
 * Le gate serveur (lib/sfmc-auth.js) vit dans api/router.js. Or les règles de
 * rewrite de vercel.json excluent les chemins contenant un point :
 *
 *     "source": "/:path((?!api/|preview/|.*\\.).+)"
 *
 * Donc /school-selector.html, /index.html, /pages-dashboard.html et / sont
 * servis DIRECTEMENT par le CDN et ne passent JAMAIS par api/router.js : le
 * gate serveur n'est pas exécuté pour eux. Seuls /api/*, /preview/* et les
 * chemins sans point (pages publiées, /login, /handlelogin) sont gardés côté
 * serveur.
 *
 * Ce script comble ce trou : il interroge /api/auth-status (qui, lui, passe
 * bien par le routeur) et redirige vers le login SFMC si aucune session n'est
 * présentée alors que l'auth est active.
 *
 * En local (server.js), tout passe par le serveur : la page n'est même pas
 * servie sans session, ce script n'est jamais atteint. Il est inoffensif.
 *
 * ⚠️ Ce n'est PAS une protection : le HTML a déjà été livré au navigateur quand
 * ce code s'exécute. La vraie barrière est côté serveur sur /api/* — sans
 * session, aucune donnée n'est lisible ni modifiable. Ce guard évite d'afficher
 * une interface vide et inutilisable à quelqu'un qui n'est pas authentifié.
 */
(function () {
    var next = encodeURIComponent(location.pathname + location.search);

    fetch('/api/auth-status', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) {
            if (!r.ok) return;                       // route absente → ne pas bloquer
            return r.json();
        })
        .then(function (d) {
            if (!d) return;
            // Auth en veille (non configurée) ou bypass local : laisser passer.
            if (!d.authActive) return;
            // Session déjà valide : rien à faire.
            if (d.sessionPresent) return;
            location.replace('/login?next=' + next);
        })
        .catch(function () { /* réseau indisponible : ne pas verrouiller l'utilisateur */ });
})();
