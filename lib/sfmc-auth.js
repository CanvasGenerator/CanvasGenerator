/**
 * ============================================================================
 *  AUTH SFMC — OAuth2 Authorization Code + verrouillage d'instance
 * ============================================================================
 *  Portage de la spec « SFMC Embedded App — Auth & Instance-Locking Spec ».
 *
 *  ── Écart assumé avec la spec ───────────────────────────────────────────────
 *  La spec décrit un portage vers Express + express-session. Ce projet n'utilise
 *  NI l'un NI l'autre :
 *    • en local  : serveur `node:http` brut (server.js) ;
 *    • en prod   : fonctions serverless Vercel (api/router.js).
 *  express-session est donc inutilisable : son MemoryStore ne survit pas entre
 *  deux invocations serverless — l'utilisateur bouclerait indéfiniment sur le
 *  login. La session est ici un COOKIE SIGNÉ HMAC-SHA256, sans état serveur.
 *  Le reste de la logique est identique : Authorization Code, échange
 *  code → token → userinfo, allow-list de tenant, contrôle de `exp`.
 *
 *  Aucune dépendance externe (le projet n'a que cheerio + dotenv).
 * ============================================================================
 */
const crypto = require('crypto');

const COOKIE_NAME = 'sfmc_session';

/* ── Configuration ──────────────────────────────────────────────────────────
 * Les 3 URLs dérivent du seul sous-domaine du tenant (TSSD). On accepte donc
 * soit les URLs complètes, soit le sous-domaine qui les reconstruit — c'est ce
 * que la spec §06 demande de fournir.
 *
 * ⚠️ IDENTIFIANTS DISTINCTS de ceux de lib/sfmc.js. Ce projet possède déjà
 * SFMC_CLIENT_ID / SFMC_CLIENT_SECRET : ce sont ceux du composant
 * Server-to-Server (grant `client_credentials`, publication d'assets). Un
 * composant Server-to-Server n'a PAS de redirect_uri et ne peut pas porter un
 * Authorization Code — les réutiliser ici ferait échouer /handlelogin. La spec
 * §06 demande bien un SECOND composant, de type Web App : d'où le préfixe
 * SFMC_AUTH_*. Seul le sous-domaine est partagé (même tenant), avec repli.
 */
function cfg() {
    const sub = process.env.SFMC_AUTH_SUBDOMAIN || process.env.SFMC_SUBDOMAIN || '';
    const base = sub ? `https://${sub}.auth.marketingcloudapis.com` : '';
    return {
        authorizeUrl: process.env.SFMC_AUTHORIZE_URL || (base && `${base}/v2/authorize`),
        tokenUrl:     process.env.SFMC_TOKEN_URL     || (base && `${base}/v2/token`),
        userInfoUrl:  process.env.SFMC_USERINFO_URL  || (base && `${base}/v2/userinfo`),
        clientId:     process.env.SFMC_AUTH_CLIENT_ID     || '',
        clientSecret: process.env.SFMC_AUTH_CLIENT_SECRET || '',
        webAppHost:  (process.env.WEB_APP_HOST || '').replace(/\/+$/, ''),
        allowedTenants: (process.env.ALLOWED_TENANT_ID || '')
            .split(',').map(s => s.trim()).filter(Boolean),
        sessionSecret: process.env.SESSION_SECRET || '',
        // Page d'atterrissage après login quand aucune page n'était demandée.
        // Défaut = le sélecteur d'école, vraie page d'accueil de l'app (sur
        // Vercel, '/' sert index.html, c'est-à-dire le builder nu).
        home: process.env.AUTH_HOME || '/school-selector.html',
        // `dev` court-circuite le contrôle d'accès. La spec signale ce bypass
        // comme « catastrophique si déployé tel quel » : on le DURCIT en le
        // rendant impossible sur Vercel, quelle que soit la valeur de la variable.
        isDev: process.env.AUTH_ENV === 'dev' && !process.env.VERCEL,
        // Interrupteur de sûreté : tant que l'Installed Package SFMC n'est pas
        // livré (spec §06 : TSSD, client_id, client_secret, EID/MID), l'auth ne
        // peut pas fonctionner. Elle se met alors en veille au lieu de rendre
        // l'app inaccessible. Passer SFMC_AUTH_REQUIRED=true pour interdire ce
        // repli en production une fois la config en place.
        required: String(process.env.SFMC_AUTH_REQUIRED || '').toLowerCase() === 'true'
    };
}

/** L'auth est-elle exploitable ? (config complète) */
function isConfigured(c = cfg()) {
    return Boolean(c.authorizeUrl && c.tokenUrl && c.userInfoUrl &&
                   c.clientId && c.clientSecret && c.webAppHost && c.sessionSecret);
}

/**
 * Auth active ? Trois états :
 *   • configurée            → active ;
 *   • non configurée + required=true → ACTIVE quand même (fail-closed : l'app
 *     répond 503 plutôt que de s'ouvrir sans contrôle) ;
 *   • non configurée        → en veille, l'app fonctionne comme avant.
 */
function isEnabled(c = cfg()) {
    return isConfigured(c) || c.required;
}

/* ── Cookie de session signé ────────────────────────────────────────────────
 * payload base64url(JSON) + '.' + HMAC-SHA256 base64url. Sans état serveur :
 * n'importe quelle instance serverless peut vérifier le cookie.
 */
function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
    return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function sign(payloadB64, secret) {
    return b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
}

function serializeSession(data, secret) {
    const payload = b64url(JSON.stringify(data));
    return `${payload}.${sign(payload, secret)}`;
}

function parseSession(value, secret) {
    if (!value || typeof value !== 'string') return null;
    const dot = value.lastIndexOf('.');
    if (dot <= 0) return null;
    const payload = value.slice(0, dot);
    const given = value.slice(dot + 1);
    const expected = sign(payload, secret);
    // Comparaison à temps constant : sans ça, la signature est attaquable
    // octet par octet.
    const a = Buffer.from(given), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { return JSON.parse(unb64url(payload).toString('utf8')); } catch { return null; }
}

function readCookie(req, name) {
    const raw = req.headers && req.headers.cookie;
    if (!raw) return null;
    for (const part of String(raw).split(';')) {
        const i = part.indexOf('=');
        if (i === -1) continue;
        if (part.slice(0, i).trim() === name) {
            try { return decodeURIComponent(part.slice(i + 1).trim()); }
            catch { return part.slice(i + 1).trim(); }
        }
    }
    return null;
}

/**
 * L'app tourne en IFRAME dans l'UI SFMC : contexte cross-site. Sans
 * `SameSite=None; Secure`, le navigateur refuse le cookie et l'utilisateur
 * boucle login → app → login (piège n°1 de la spec §07).
 */
function setSessionCookie(res, value, maxAgeSec, opts = {}) {
    const parts = [
        `${COOKIE_NAME}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly'
    ];
    // En local (http://localhost), `Secure` + `SameSite=None` font rejeter le
    // cookie par certains navigateurs : on les omet UNIQUEMENT dans ce cas.
    // Partout ailleurs ils sont obligatoires — sans eux le cookie ne remonte
    // pas depuis l'iframe SFMC (contexte cross-site) et l'utilisateur boucle.
    if (opts.insecureLocal) parts.push('SameSite=Lax');
    else parts.push('Secure', 'SameSite=None');
    if (typeof maxAgeSec === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`);
    appendHeader(res, 'Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
    appendHeader(res, 'Set-Cookie',
        `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`);
}

/** `res` est soit un ServerResponse brut, soit la réponse enrichie de Vercel. */
function appendHeader(res, name, value) {
    const prev = res.getHeader ? res.getHeader(name) : null;
    const next = prev ? [].concat(prev, value) : value;
    res.setHeader(name, next);
}

/* ── Identité en session ────────────────────────────────────────────────────*/

/**
 * Utilisateur courant, ou null. Contrôle l'expiration `exp` renvoyée par SFMC
 * (piège « session éternelle » de la spec §07).
 */
function getUser(req, c = cfg()) {
    if (!c.sessionSecret) return null;
    const sess = parseSession(readCookie(req, COOKIE_NAME), c.sessionSecret);
    if (!sess || !sess.user) return null;
    const now = Math.floor(Date.now() / 1000);
    if (!sess.expires || sess.expires <= now) return null;
    return sess.user;
}

/**
 * Auteur d'une écriture, pour l'audit « dernière modification par ».
 *
 * ⚠️ L'identité vient de la SESSION, jamais du corps de la requête. Le champ
 * `page_versions.created_by` était auparavant lu depuis `body.created_by` :
 * n'importe quel appelant pouvait donc s'attribuer les modifications de
 * quelqu'un d'autre. Ici la valeur est celle qu'a signée SFMC.
 *
 * Renvoie `{ name: null, email: null }` quand l'auth est en veille ou que la
 * session a expiré — l'audit est alors vide, mais l'écriture n'échoue pas.
 *
 * @returns {{name: string|null, email: string|null}}
 */
function getActor(req) {
    const u = getUser(req);
    if (!u) return { name: null, email: null };
    return {
        // `preferred_username` est le repli quand SFMC ne renvoie pas de nom.
        name: u.name || u.username || u.email || null,
        email: u.email || null
    };
}

/* ── Verrouillage d'instance (spec §05) ─────────────────────────────────────*/

/**
 * Mono-instance : les URLs authorize/token/userinfo pointent vers le
 * sous-domaine du tenant, donc un token ne peut être émis que pour CE tenant —
 * l'allow-list est facultative et la fonction renvoie true.
 *
 * Multi-instance : on compare l'EID/MID renvoyé par /v2/userinfo (signé côté
 * SFMC) à ALLOWED_TENANT_ID. Jamais le sous-domaine, jamais un paramètre d'URL.
 */
function isAllowedTenant(info, c = cfg()) {
    if (!c.allowedTenants.length) return true;
    const eid = String(info?.organization?.enterprise_id ?? '');
    const mid = String(info?.organization?.id ?? '');
    return c.allowedTenants.includes(eid) || c.allowedTenants.includes(mid);
}

/* ── Périmètre protégé ──────────────────────────────────────────────────────
 * ⚠️ On protège le BUILDER, jamais le rendu public. Les landing pages publiées
 * et les previews sont servies par le même serveur : les verrouiller mettrait
 * les pages en ligne hors service.
 */
const PROTECTED_EXACT = new Set([
    '/', '/index.html', '/school-selector.html', '/pages-dashboard.html'
]);
const PROTECTED_PREFIX = ['/api/'];
// Exceptions à l'intérieur des préfixes protégés.
const PUBLIC_PREFIX = ['/login', '/handlelogin', '/logout', '/api/cron', '/preview/',
                       '/api/auth-status',
                       '/dev-login',
                       // ⚠️ API appelées AU RUNTIME PAR LES PAGES PUBLIÉES.
                       // MasterTemplate/Components/Carousel3Campus et NosCampus
                       // font un fetch('/api/campuses') depuis la landing page en
                       // ligne : les protéger viderait les carrousels de toutes
                       // les pages publiées, sans erreur visible.
                       '/api/campuses',
                       '/api/faq/render'];

function isProtectedPath(pathname) {
    if (PUBLIC_PREFIX.some(p => pathname === p || pathname.startsWith(p))) return false;
    if (PROTECTED_EXACT.has(pathname)) return true;
    return PROTECTED_PREFIX.some(p => pathname.startsWith(p));
}

/* ── Paramètre `state` : anti-CSRF + retour à la page demandée ──────────────
 * La spec n'utilise pas `state`. Deux raisons de l'ajouter :
 *   1. SÉCURITÉ — sans `state`, /handlelogin accepte n'importe quel `code`
 *      présenté par un tiers (CSRF sur le flux d'autorisation).
 *   2. ERGONOMIE — l'utilisateur qui ouvrait /school-selector.html doit y
 *      revenir après login, pas être renvoyé sur '/'.
 *
 * Le state est signé avec SESSION_SECRET et horodaté : ni forgeable, ni
 * rejouable au-delà de STATE_TTL.
 */
const STATE_TTL = 600; // 10 min

/**
 * Chemin de retour sûr. Refuse tout ce qui n'est pas un chemin local :
 * '//evil.com' et 'https://evil.com' seraient des open redirects.
 */
function safeNext(next) {
    if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return null;
    if (next.startsWith('/login') || next.startsWith('/handlelogin')) return null; // pas de boucle
    return next;
}

function makeState(next, secret, home = '/school-selector.html') {
    return serializeSession({ n: safeNext(next) || home, t: Math.floor(Date.now() / 1000) }, secret);
}

/** @returns {string|null} chemin de retour validé, ou null si le state est invalide. */
function readState(state, secret, home = '/school-selector.html') {
    const data = parseSession(state, secret);
    if (!data || typeof data.t !== 'number') return null;
    if (Math.floor(Date.now() / 1000) - data.t > STATE_TTL) return null;
    return safeNext(data.n) || home;
}

/* ── Le « gate » ────────────────────────────────────────────────────────────*/

/**
 * Contrôle d'accès. Renvoie true si la requête peut continuer, false si une
 * réponse a DÉJÀ été émise (redirection vers le login, 503, …).
 *
 * @returns {boolean} true = poursuivre le traitement
 */
function requireSfmcAuth(req, res, pathname) {
    const c = cfg();

    if (!isEnabled(c)) return true;               // auth en veille (non configurée)
    if (!isProtectedPath(pathname)) return true;  // rendu public
    if (c.isDev) return true;                     // bypass local uniquement

    if (!isConfigured(c)) {
        // required=true mais configuration incomplète : on refuse au lieu d'ouvrir.
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Authentification SFMC exigee mais non configuree.');
        return false;
    }

    if (getUser(req, c)) return true;

    // Une requête d'API répond 401 : une redirection 302 vers SFMC dans un fetch
    // renverrait du HTML de login que le front tenterait de parser en JSON.
    if (pathname.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthenticated', loginUrl: '/login' }));
        return false;
    }

    // On mémorise la page demandée pour y revenir après le login.
    const next = (req.url && req.url.startsWith('/')) ? req.url : pathname;
    res.writeHead(302, { Location: `/login?next=${encodeURIComponent(next)}` });
    res.end();
    return false;
}

/* ── Routes OAuth ───────────────────────────────────────────────────────────*/

/**
 * Diagnostic de configuration — /api/auth-status.
 *
 * Route PUBLIQUE et volontairement sans secret : elle dit quelles variables
 * manquent et quel redirect_uri est réellement envoyé à SFMC, pour pouvoir
 * régler un redirect_uri_mismatch sans accès aux logs. Ne renvoie JAMAIS le
 * client_secret ni le SESSION_SECRET, seulement des booléens de présence.
 * Le sous-domaine et le redirect_uri ne sont pas confidentiels : ils
 * apparaissent déjà en clair dans l'URL de redirection vers SFMC.
 *
 * À retirer de PUBLIC_PREFIX si tu préfères la réserver aux sessions valides.
 */
function authStatus(req) {
    const c = cfg();
    const missing = [];
    if (!c.authorizeUrl)  missing.push('SFMC_AUTH_SUBDOMAIN');
    if (!c.clientId)      missing.push('SFMC_AUTH_CLIENT_ID');
    if (!c.clientSecret)  missing.push('SFMC_AUTH_CLIENT_SECRET');
    if (!c.webAppHost)    missing.push('WEB_APP_HOST');
    if (!c.sessionSecret) missing.push('SESSION_SECRET');

    return {
        authActive: isEnabled(c) && !c.isDev,
        configComplete: isConfigured(c),
        missingVars: missing,
        // Chaîne EXACTE comparée par SFMC : elle doit figurer telle quelle dans
        // les Redirect URIs du composant Web App.
        redirectUri: c.webAppHost ? `${c.webAppHost}/handlelogin` : null,
        authorizeUrl: c.authorizeUrl || null,
        tenantAllowList: c.allowedTenants.length ? c.allowedTenants : 'desactivee (mono-instance)',
        devBypass: c.isDev,
        failClosed: c.required,
        homeAfterLogin: c.home,
        // Une session est-elle présentée par CE navigateur ?
        sessionPresent: Boolean(getUser(req, c))
    };
}

/**
 * Gère /login, /handlelogin, /logout et /api/auth-status.
 * @returns {Promise<boolean>} true si la requête a été traitée ici.
 */
async function handleSfmcAuthRoutes(req, res, pathname) {
    const c = cfg();

    // ── /dev-login : session locale de test ─────────────────────────────────
    // Le login SFMC est INTESTABLE en local : SFMC n'accepte que des redirect
    // URIs en HTTPS et refuse http://localhost. Sans session, `getActor()`
    // renvoie null et le suivi « modifié par » reste vide — donc impossible de
    // recetter la fonctionnalité sur sa machine.
    //
    // Cette route ouvre une session portant une identité factice. Elle est
    // strictement réservée au local : `c.isDev` exige AUTH_ENV=dev ET l'absence
    // de process.env.VERCEL. En production elle n'existe pas — la condition
    // ci-dessous la fait tomber dans le `return false` final.
    if (pathname === '/dev-login' && c.isDev) {
        const q = new URL(req.url || '/', 'http://localhost').searchParams;
        const name  = q.get('name')  || 'Dev Local';
        const email = q.get('email') || 'dev.local@reetain-test.fr';
        const now = Math.floor(Date.now() / 1000);
        const value = serializeSession({
            user: { id: 'dev-local', name, email, username: email },
            tenant: { eid: null, mid: null },
            expires: now + 8 * 3600
        }, c.sessionSecret || 'dev-secret-local');
        setSessionCookie(res, value, 8 * 3600, { insecureLocal: true });
        res.writeHead(302, { Location: c.home });
        res.end();
        return true;
    }

    if (pathname === '/api/auth-status') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
                             'Cache-Control': 'no-store' });
        res.end(JSON.stringify(authStatus(req), null, 2));
        return true;
    }

    if (!['/login', '/handlelogin', '/logout'].includes(pathname)) return false;

    if (pathname === '/logout') {
        clearSessionCookie(res);
        res.writeHead(302, { Location: c.home });
        res.end();
        return true;
    }

    if (!isConfigured(c)) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Auth SFMC non configuree (voir .env.example).');
        return true;
    }

    const redirectUri = `${c.webAppHost}/handlelogin`;
    const query = new URL(req.url || '/', 'http://localhost').searchParams;

    if (pathname === '/login') {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: c.clientId,
            redirect_uri: redirectUri,
            // Anti-CSRF + mémorisation de la page demandée.
            state: makeState(query.get('next'), c.sessionSecret, c.home)
        });
        res.writeHead(302, { Location: `${c.authorizeUrl}?${params}` });
        res.end();
        return true;
    }

    // ── /handlelogin : code → token → userinfo → session ────────────────────
    const code = query.get('code');
    if (!code) return redirectToLogin(res);

    // Le state doit être celui qu'on a émis : sinon le `code` vient d'ailleurs.
    const next = readState(query.get('state'), c.sessionSecret, c.home);
    if (next === null) return redirectToLogin(res);

    try {
        // 1) code → access_token
        const tokenRes = await fetch(c.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                client_id: c.clientId,
                client_secret: c.clientSecret,
                redirect_uri: redirectUri
            })
        });
        if (!tokenRes.ok) return redirectToLogin(res);
        const token = await tokenRes.json();
        if (!token || !token.access_token) return redirectToLogin(res);

        // 2) identité
        const infoRes = await fetch(c.userInfoUrl, {
            headers: { Authorization: `Bearer ${token.access_token}` }
        });
        if (!infoRes.ok) return redirectToLogin(res);
        const info = await infoRes.json();

        // 3) verrouillage d'instance
        if (!isAllowedTenant(info, c)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Instance SFMC non autorisee.');
            return true;
        }

        // 4) session. `exp` vient de SFMC ; à défaut on retombe sur expires_in,
        //    puis sur 1 h — jamais de session sans expiration.
        const now = Math.floor(Date.now() / 1000);
        const expires = Number(info?.exp)
            || (Number(token.expires_in) ? now + Number(token.expires_in) : now + 3600);

        const value = serializeSession({
            user: {
                id: info?.user?.sub || null,
                name: info?.user?.name || null,
                email: info?.user?.email || null,
                username: info?.user?.preferred_username || null
            },
            // Tracé pour l'audit : quel tenant a ouvert la session.
            tenant: {
                eid: info?.organization?.enterprise_id ?? null,
                mid: info?.organization?.id ?? null
            },
            expires
        }, c.sessionSecret);

        setSessionCookie(res, value, Math.max(60, expires - now));
        res.writeHead(302, { Location: next });
        res.end();
        return true;
    } catch (e) {
        // Jamais de détail d'erreur OAuth côté client.
        console.error('[sfmc-auth] handlelogin:', e && e.message);
        return redirectToLogin(res);
    }
}

function redirectToLogin(res) {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return true;
}

/** Avertissement de démarrage — une auth en veille ne doit pas être silencieuse. */
function logAuthStatus(prefix = '[sfmc-auth]') {
    const c = cfg();
    if (isConfigured(c)) {
        console.log(`${prefix} actif · tenants autorises : ` +
            (c.allowedTenants.length ? c.allowedTenants.join(', ') : 'mono-instance (verrouillage par sous-domaine)') +
            (c.isDev ? ' · ⚠ AUTH_ENV=dev : controle d\'acces court-circuite' : ''));
    } else if (c.required) {
        console.warn(`${prefix} ⚠ SFMC_AUTH_REQUIRED=true mais configuration incomplete : les routes protegees repondront 503.`);
    } else {
        console.warn(`${prefix} ⚠ EN VEILLE : aucune authentification. Renseigner SFMC_* + SESSION_SECRET (voir .env.example).`);
    }
}

module.exports = {
    COOKIE_NAME,
    cfg,
    isConfigured,
    isEnabled,
    isProtectedPath,
    getUser,
    getActor,
    isAllowedTenant,
    requireSfmcAuth,
    handleSfmcAuthRoutes,
    authStatus,
    logAuthStatus,
    // exportés pour les tests
    serializeSession,
    parseSession,
    safeNext,
    makeState,
    readState
};
