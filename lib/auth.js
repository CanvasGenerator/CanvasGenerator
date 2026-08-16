/**
 * Authentification SIMPLE via redirection SFMC (sans API REST / sans OAuth token).
 *
 * Principe demandé :
 *   1. À chaque requête protégée, on regarde s'il existe un COOKIE de session valide.
 *   2. Cookie présent  → l'utilisateur entre directement.
 *   3. Cookie absent   → on le redirige vers l'URL de connexion SFMC (SFMC_URL),
 *                        BRUTE telle quelle (sans MID ni paramètre ajouté).
 *   4. Au retour de SFMC (/auth/sfmc/callback), on pose notre cookie de session.
 *
 * ⚠️ IMPORTANT — pourquoi NOTRE cookie et pas « le cookie SFMC » :
 *   Les cookies posés par SFMC appartiennent au domaine SFMC et sont HttpOnly :
 *   ton app (autre domaine) ne peut PAS les lire. On utilise donc notre propre
 *   cookie, signé (HMAC), qui mémorise « cet utilisateur est passé par SFMC ».
 *
 * ⚠️ NIVEAU DE SÉCURITÉ : cette porte est un simple aiguillage. Elle ne vérifie
 *   pas cryptographiquement l'identité SFMC (c'est ce que ferait le flux OAuth).
 *   Elle empêche l'accès direct sans passer par la redirection SFMC, ce qui
 *   correspond au besoin exprimé.
 *
 * Si SFMC_URL n'est pas renseigné, la porte est DÉSACTIVÉE (l'app marche comme avant).
 */

const crypto = require('crypto');

// ── Cookies ───────────────────────────────────────────────────────────────────
const SESSION_COOKIE = 'sfmc_session';
const RETURN_COOKIE = 'sfmc_return';

const SESSION_TTL_MS = parseInt(process.env.SFMC_SESSION_TTL_MS || String(8 * 60 * 60 * 1000), 10);
const RETURN_TTL_MS = 10 * 60 * 1000;

// MID / Business Unit SFMC à passer dans l'URL de login (ex. 536009308).
const SFMC_MID = (process.env.SFMC_ACCOUNT_ID || '').trim();

/** Secret de signature des cookies. */
function getSecret() {
    return process.env.SESSION_SECRET
        || process.env.SFMC_CLIENT_SECRET
        || 'dev-insecure-secret-change-me';
}

/**
 * URL de connexion SFMC vers laquelle rediriger quand l'utilisateur n'est pas
 * connecté. On lit d'abord SFMC_BASE_URL (l'URL propre à mettre dans .env), avec
 * repli sur SFMC_URL. On redirige vers cette URL BRUTE telle quelle.
 */
function sfmcLoginBase() {
    const base = process.env.SFMC_BASE_URL || process.env.SFMC_URL || '';
    return base.trim().replace(/\/+$/, '');
}

/**
 * URL du LP / de l'app vers laquelle renvoyer l'utilisateur APRÈS connexion SFMC
 * (le lien enregistré dans le package AppExchange). Repli sur '/' (racine de l'app).
 */
function appLandingUrl() {
    return (process.env.SFMC_APP_URL || '').trim() || '/';
}

/**
 * Requête servie en LOCAL (localhost / 127.0.0.1) ? En local on DÉSACTIVE toute
 * la porte SFMC : l'app doit s'ouvrir directement, sans redirection vers SFMC.
 * En prod (Vercel), x-forwarded-host porte le vrai domaine → porte active.
 */
function isLocalRequest(req) {
    const host = String(
        (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || ''
    ).toLowerCase();
    return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

/** La porte est-elle active ? (dès que le secret JWT OU l'URL SFMC est fourni). */
function isAuthEnabled() {
    return Boolean(sfmcLoginBase() || (process.env.SFMC_JWT_SECRET || '').trim());
}

// ── Encodage base64url ────────────────────────────────────────────────────────
function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
    return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// ── Jetons signés (HMAC-SHA256) : <base64url(json)>.<base64url(sig)> ─────────────
function sign(payloadObj) {
    const body = b64url(JSON.stringify(payloadObj));
    const sig = b64url(crypto.createHmac('sha256', getSecret()).update(body).digest());
    return `${body}.${sig}`;
}
function verify(token) {
    if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', getSecret()).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const obj = JSON.parse(fromB64url(body).toString('utf8'));
        if (obj && obj.exp && Date.now() > obj.exp) return null; // expiré
        return obj;
    } catch (_) {
        return null;
    }
}

/**
 * Vérifie un JWT SFMC (HS256) signé avec l'App Signature du package, et renvoie
 * son payload si la signature est valide et le jeton non expiré. Aucune dépendance
 * externe : on recalcule le HMAC-SHA256 sur "<header>.<payload>".
 *
 * C'est le cœur du SSO Marketing Cloud : SFMC POSTe ce jeton sur l'URL de login
 * quand l'utilisateur (déjà connecté à SFMC) ouvre l'app. Un jeton non signé par
 * le bon secret est rejeté → impossible d'entrer sans passer par SFMC.
 */
function verifyJwt(token, secret) {
    if (!token || typeof token !== 'string' || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
    const a = Buffer.from(s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(fromB64url(p).toString('utf8'));
        // exp JWT = secondes depuis epoch (parfois ms) → gérer les deux.
        if (payload && payload.exp) {
            const expMs = payload.exp < 1e12 ? payload.exp * 1000 : payload.exp;
            if (Date.now() > expMs) return null;
        }
        return payload;
    } catch (_) {
        return null;
    }
}

/** Normalise un corps de requête (objet déjà parsé, JSON, ou form-urlencoded). */
function normalizeBody(body) {
    if (!body) return {};
    if (typeof body === 'object') return body;
    if (typeof body === 'string') {
        const s = body.trim();
        if (!s) return {};
        if (s[0] === '{') { try { return JSON.parse(s); } catch (_) { /* fallthrough */ } }
        const out = {};
        new URLSearchParams(s).forEach((v, k) => { out[k] = v; });
        return out;
    }
    return {};
}

// ── Cookies ───────────────────────────────────────────────────────────────────
function parseCookies(req) {
    const header = (req && req.headers && req.headers.cookie) || '';
    const out = {};
    header.split(';').forEach(part => {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        if (!k) return;
        out[k] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

function serializeCookie(name, value, opts = {}) {
    let str = `${name}=${encodeURIComponent(value)}`;
    if (opts.maxAge != null) str += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
    str += `; Path=${opts.path || '/'}`;
    if (opts.httpOnly !== false) str += '; HttpOnly';
    str += `; SameSite=${opts.sameSite || 'Lax'}`;
    if (opts.secure) str += '; Secure';
    return str;
}

/** Ajoute un Set-Cookie sans écraser ceux déjà positionnés. */
function appendSetCookie(res, cookieStr) {
    const prev = res.getHeader ? res.getHeader('Set-Cookie') : null;
    let arr = [];
    if (Array.isArray(prev)) arr = prev.slice();
    else if (prev) arr = [prev];
    arr.push(cookieStr);
    res.setHeader('Set-Cookie', arr);
}

// ── Contexte requête ──────────────────────────────────────────────────────────
function isSecure(req) {
    const xf = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    if (xf) return xf === 'https';
    return Boolean(req.socket && req.socket.encrypted);
}

/**
 * Valeur de SameSite pour les cookies.
 *
 * L'app peut être EMBARQUÉE dans Marketing Cloud (iframe cross-site). Or un cookie
 * `SameSite=Lax` n'est pas renvoyé dans une iframe cross-site → session invisible
 * et boucle de login. On passe alors en `SameSite=None` (qui exige `Secure`/HTTPS).
 * Détection via Sec-Fetch-*, repli sur `Lax` en accès direct (anti-CSRF). Forçable
 * via SFMC_COOKIE_SAMESITE ('Lax' | 'None').
 */
function sameSiteFor(req) {
    const forced = (process.env.SFMC_COOKIE_SAMESITE || '').trim();
    if (/^none$/i.test(forced)) return 'None';
    if (/^lax$/i.test(forced)) return 'Lax';

    const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
    const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    const framed = dest === 'iframe' || dest === 'frame' || site === 'cross-site';
    return (framed && isSecure(req)) ? 'None' : 'Lax';
}

/** URL de retour vers laquelle SFMC (ou l'utilisateur) revient après login. */
function computeReturnUri(req) {
    const explicit = (process.env.SFMC_REDIRECT_URI || '').trim();
    if (explicit) return explicit;
    const proto = isSecure(req) ? 'https' : 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 8000}`;
    return `${proto}://${host}/auth/sfmc/callback`;
}

/** Évite les open-redirects : n'autorise que des chemins locaux. */
function sanitizeNext(next) {
    if (!next || typeof next !== 'string') return '/';
    if (!next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
}

/**
 * URL de login SFMC : on redirige vers l'URL BRUTE fournie dans .env (SFMC_URL),
 * telle quelle — sans ajouter le MID (Business Unit) ni aucun paramètre.
 */
function buildSfmcLoginUrl(/* returnUri */) {
    return sfmcLoginBase();
}

// ── Session ───────────────────────────────────────────────────────────────────
function getSessionUser(req) {
    return verify(parseCookies(req)[SESSION_COOKIE]);
}

// ── Guard : quels chemins exigent une session ? ─────────────────────────────────
// Approche « liste blanche du protégé » : tout ce qui n'est pas explicitement
// protégé reste public (assets statiques, /preview, pages publiées, /auth).
const APP_HTML = new Set([
    '/', '/index.html', '/school-selector.html', '/pages-dashboard.html'
]);
function isProtectedPath(pathname) {
    if (APP_HTML.has(pathname)) return true;
    if (pathname.startsWith('/api/')) {
        // API appelées par les PAGES PUBLIÉES (runtime) → rester publiques.
        if (pathname.startsWith('/api/campuses')) return false;
        if (pathname === '/api/faq/render') return false;
        return true;
    }
    return false;
}

// ── Réponses HTTP bas niveau (compatibles http natif ET res Vercel) ─────────────
function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}

/** Petite page d'information affichée quand l'accès direct (sans SFMC) est refusé. */
function authInfoPage(message) {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">`
        + `<title>Accès via Marketing Cloud</title>`
        + `<style>body{font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;`
        + `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}`
        + `.card{max-width:440px;padding:32px;background:#1e293b;border-radius:12px;text-align:center;line-height:1.5}`
        + `h2{margin-top:0}</style></head><body>`
        + `<div class="card"><h2>Connexion requise</h2>`
        + `<p>${String(message || '').replace(/[<>&]/g, '')}</p></div></body></html>`;
}

/**
 * Applique le guard. Renvoie true si la requête a été traitée (redirigée / 401)
 * et que l'appelant doit s'arrêter ; false si la requête peut continuer.
 */
function enforceAuth(req, res, pathname, originalUrl) {
    if (isLocalRequest(req)) return false;   // LOCAL → porte désactivée
    if (!isAuthEnabled()) return false;      // SFMC_URL non renseigné → pas de porte
    if (!isProtectedPath(pathname)) return false;
    if (getSessionUser(req)) return false;   // cookie de session valide → on entre

    if (pathname.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required', login: '/auth/sfmc/login' }));
        return true;
    }
    const next = encodeURIComponent(originalUrl || pathname);
    redirect(res, `/auth/sfmc/login?next=${next}`);
    return true;
}

/**
 * Gère les routes /auth/*. `query` : query params ; `body` : corps de requête
 * (utilisé pour le POST du JWT). Renvoie true si la route a été prise en charge.
 */
async function handleAuthRoute(req, res, pathname, query = {}, body = {}) {
    if (!pathname.startsWith('/auth/')) return false;

    // ── Entrée SSO Marketing Cloud ──────────────────────────────────────────────
    // SFMC POSTe un JWT signé sur cette URL (= « Login URL » du package) quand
    // l'utilisateur, déjà connecté à SFMC, ouvre l'app depuis le menu MC.
    if (pathname === '/auth/sfmc/login') {
        if (req.method === 'POST') {
            const b = normalizeBody(body);
            const jwt = b.jwt || b.JWT || null;
            const secret = (process.env.SFMC_JWT_SECRET || '').trim();
            const payload = (jwt && secret) ? verifyJwt(jwt, secret) : null;
            if (!payload) {
                res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(authInfoPage('Jeton SFMC absent ou invalide. Ouvrez l’application depuis Marketing Cloud.'));
                return true;
            }
            // Profil : structure JWT legacy MC (request.user) ou variantes.
            const u = (payload.request && payload.request.user) || payload.user || {};
            appendSetCookie(res, serializeCookie(SESSION_COOKIE, sign({
                sfmc: true,
                sub: u.id || u.sub || null,
                email: u.email || null,
                name: u.name || null,
                mid: SFMC_MID || null,
                exp: Date.now() + SESSION_TTL_MS
            }), { maxAge: SESSION_TTL_MS, sameSite: sameSiteFor(req), secure: isSecure(req) }));
            // Après connexion SFMC → on renvoie vers le LP enregistré dans AppExchange
            // (SFMC_APP_URL), pas vers SFMC. Repli sur '/' si non configuré.
            redirect(res, appLandingUrl());
            return true;
        }

        // GET (accès direct au navigateur, sans JWT) : on renvoie vers la page de
        // login SFMC (URL brute). L'utilisateur ne pourra revenir authentifié qu'en
        // ouvrant l'app depuis Marketing Cloud (qui POSTera un JWT valide).
        // En LOCAL, la porte est désactivée → on laisse entrer directement dans l'app.
        if (isLocalRequest(req)) { redirect(res, sanitizeNext(query.next)); return true; }
        if (!isAuthEnabled()) { redirect(res, sanitizeNext(query.next)); return true; }
        const loginUrl = buildSfmcLoginUrl(computeReturnUri(req));
        if (!loginUrl) {
            res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(authInfoPage('Ouvrez l’application depuis Marketing Cloud pour vous connecter.'));
            return true;
        }
        redirect(res, loginUrl);
        return true;
    }

    // ── Déconnexion ─────────────────────────────────────────────────────────────
    if (pathname === '/auth/logout') {
        appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }));
        redirect(res, '/');
        return true;
    }

    // ── Statut de session (utilisé par le guard client) ─────────────────────────
    if (pathname === '/auth/me') {
        const user = getSessionUser(req);
        // En LOCAL, on annonce enabled:false → le guard client (auth-guard.js) n'essaie
        // pas de rediriger vers SFMC et l'app s'ouvre normalement.
        const enabled = isLocalRequest(req) ? false : isAuthEnabled();
        res.writeHead(user ? 200 : 401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(
            user ? { authenticated: true } : { authenticated: false, enabled }
        ));
        return true;
    }

    return false;
}

module.exports = {
    isAuthEnabled,
    getSessionUser,
    enforceAuth,
    handleAuthRoute,
    // utilitaires (tests/diagnostic)
    SESSION_COOKIE,
    sign,
    verify,
    parseCookies,
    buildSfmcLoginUrl,
};
