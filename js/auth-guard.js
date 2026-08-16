/**
 * Guard d'authentification CÔTÉ CLIENT.
 *
 * Utile uniquement quand le HTML est servi par un CDN (déploiement Vercel) et ne
 * passe donc pas par le guard serveur. En local (server.js), le serveur redirige
 * déjà vers SFMC avant même de servir la page : ce script n'est jamais atteint
 * sans session valide, il est donc un no-op inoffensif.
 *
 * Il interroge /auth/me : si la session est absente ET que l'auth est activée
 * côté serveur, il redirige vers le login SFMC en conservant la destination.
 */
(function () {
    var next = encodeURIComponent(location.pathname + location.search);
    fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) {
            if (r.status !== 401) return; // authentifié (ou route absente) → laisser passer
            return r.json().catch(function () { return {}; }).then(function (d) {
                // enabled === false → OAuth SFMC non configuré : ne pas bloquer l'app.
                if (d && d.enabled === false) return;
                location.replace('/auth/sfmc/login?next=' + next);
            });
        })
        .catch(function () { /* réseau indisponible : ne pas verrouiller l'utilisateur */ });
})();
