#!/usr/bin/env node
/**
 * Tests de la logique d'auth SFMC — sans appel réseau, sans tenant réel.
 * Couvre ce qui est vérifiable hors SFMC : signature de session, expiration,
 * allow-list de tenant, périmètre protégé, états d'activation, flags du cookie.
 *
 * Usage : node scripts/test-sfmc-auth.js
 */
const assert = require('assert');
const path = require('path');

const MOD = path.join(__dirname, '..', 'lib', 'sfmc-auth.js');

/** Recharge le module avec un environnement donné (la config est lue à chaud). */
function load(env = {}) {
    delete require.cache[require.resolve(MOD)];
    const saved = {};
    for (const k of Object.keys(env)) { saved[k] = process.env[k]; }
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    const mod = require(MOD);
    return { mod, restore() { for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    } } };
}

const FULL = {
    SFMC_AUTH_SUBDOMAIN: 'mctest123',
    SFMC_AUTH_CLIENT_ID: 'cid',
    SFMC_AUTH_CLIENT_SECRET: 'secret',
    WEB_APP_HOST: 'https://app.example.com',
    SESSION_SECRET: 'x'.repeat(64),
    ALLOWED_TENANT_ID: '',
    AUTH_ENV: 'prod',
    SFMC_AUTH_REQUIRED: 'false',
    VERCEL: undefined
};

/** Faux ServerResponse : capture statut, en-têtes et corps. */
function fakeRes() {
    const h = {};
    return {
        statusCode: null, body: '', headers: h, ended: false,
        setHeader(k, v) { h[k] = v; },
        getHeader(k) { return h[k]; },
        writeHead(code, hdrs) { this.statusCode = code; Object.assign(h, hdrs || {}); },
        end(b) { this.ended = true; if (b) this.body += b; }
    };
}
const reqWith = (cookie, url = '/') => ({ url, headers: cookie ? { cookie } : {} });

let pass = 0;
function it(name, fn) {
    try { fn(); console.log(`  ✔ ${name}`); pass++; }
    catch (e) { console.error(`  ✖ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

console.log('\n1. Configuration & activation');
{
    const { mod, restore } = load(FULL);
    it('config complète → auth active', () => {
        assert.strictEqual(mod.isConfigured(), true);
        assert.strictEqual(mod.isEnabled(), true);
    });
    it('URLs dérivées du sous-domaine', () => {
        const c = mod.cfg();
        assert.strictEqual(c.authorizeUrl, 'https://mctest123.auth.marketingcloudapis.com/v2/authorize');
        assert.strictEqual(c.tokenUrl,     'https://mctest123.auth.marketingcloudapis.com/v2/token');
        assert.strictEqual(c.userInfoUrl,  'https://mctest123.auth.marketingcloudapis.com/v2/userinfo');
    });
    it('identifiants séparés de ceux du Server-to-Server', () => {
        // SFMC_CLIENT_ID (S2S) ne doit JAMAIS alimenter le client_id OAuth.
        const { mod: m2, restore: r2 } = load({
            ...FULL, SFMC_AUTH_CLIENT_ID: '', SFMC_CLIENT_ID: 'S2S-ID'
        });
        assert.strictEqual(m2.cfg().clientId, '');
        assert.strictEqual(m2.isConfigured(), false);
        r2();
    });
    restore();
}
{
    const { mod, restore } = load({ ...FULL, SFMC_AUTH_CLIENT_ID: '', SFMC_AUTH_REQUIRED: 'false' });
    it('config incomplète → auth en veille (app non bloquée)', () => {
        assert.strictEqual(mod.isConfigured(), false);
        assert.strictEqual(mod.isEnabled(), false);
        const res = fakeRes();
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), res, '/'), true);
        assert.strictEqual(res.statusCode, null);
    });
    restore();
}
{
    const { mod, restore } = load({ ...FULL, SFMC_AUTH_CLIENT_ID: '', SFMC_AUTH_REQUIRED: 'true' });
    it('config incomplète + required → 503, jamais d\'ouverture', () => {
        const res = fakeRes();
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), res, '/'), false);
        assert.strictEqual(res.statusCode, 503);
    });
    restore();
}

console.log('\n2. Bypass dev — durci contre la mise en prod');
{
    const { mod, restore } = load({ ...FULL, AUTH_ENV: 'dev' });
    it('AUTH_ENV=dev en local → accès libre', () => {
        assert.strictEqual(mod.cfg().isDev, true);
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), fakeRes(), '/'), true);
    });
    restore();
}
{
    const { mod, restore } = load({ ...FULL, AUTH_ENV: 'dev', VERCEL: '1' });
    it('AUTH_ENV=dev sur Vercel → bypass IGNORÉ (piège §07)', () => {
        assert.strictEqual(mod.cfg().isDev, false);
        const res = fakeRes();
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), res, '/'), false);
        assert.strictEqual(res.statusCode, 302);
    });
    restore();
}

console.log('\n3. Session signée');
{
    const { mod, restore } = load(FULL);
    const now = () => Math.floor(Date.now() / 1000);
    const secret = FULL.SESSION_SECRET;

    it('aller-retour signature/vérification', () => {
        const v = mod.serializeSession({ user: { id: 'u1' }, expires: now() + 600 }, secret);
        assert.strictEqual(mod.parseSession(v, secret).user.id, 'u1');
    });
    it('payload altéré → rejeté', () => {
        const v = mod.serializeSession({ user: { id: 'u1' }, expires: now() + 600 }, secret);
        const [p, s] = v.split('.');
        const forged = Buffer.from(JSON.stringify({ user: { id: 'admin' }, expires: now() + 9999 }))
            .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        assert.strictEqual(mod.parseSession(`${forged}.${s}`, secret), null);
        assert.ok(p);
    });
    it('autre secret → rejeté', () => {
        const v = mod.serializeSession({ user: { id: 'u1' }, expires: now() + 600 }, secret);
        assert.strictEqual(mod.parseSession(v, 'y'.repeat(64)), null);
    });
    it('cookie valide → utilisateur reconnu', () => {
        const v = mod.serializeSession({ user: { id: 'u1', email: 'a@b.c' }, expires: now() + 600 }, secret);
        const u = mod.getUser(reqWith(`sfmc_session=${encodeURIComponent(v)}`));
        assert.strictEqual(u.email, 'a@b.c');
    });
    it('session expirée → refusée (piège « session éternelle »)', () => {
        const v = mod.serializeSession({ user: { id: 'u1' }, expires: now() - 1 }, secret);
        assert.strictEqual(mod.getUser(reqWith(`sfmc_session=${encodeURIComponent(v)}`)), null);
    });
    it('session sans expiration → refusée', () => {
        const v = mod.serializeSession({ user: { id: 'u1' } }, secret);
        assert.strictEqual(mod.getUser(reqWith(`sfmc_session=${encodeURIComponent(v)}`)), null);
    });
    it('cookie absent ou malformé → null', () => {
        assert.strictEqual(mod.getUser(reqWith(null)), null);
        assert.strictEqual(mod.getUser(reqWith('sfmc_session=nimportequoi')), null);
        assert.strictEqual(mod.getUser(reqWith('autre=1; sfmc_session=a.b')), null);
    });
    restore();
}

console.log('\n4. Verrouillage d\'instance (§05)');
{
    const { mod, restore } = load({ ...FULL, ALLOWED_TENANT_ID: '' });
    it('mono-instance (allow-list vide) → autorisé', () => {
        assert.strictEqual(mod.isAllowedTenant({ organization: { id: 42, enterprise_id: 7 } }), true);
    });
    restore();
}
{
    const { mod, restore } = load({ ...FULL, ALLOWED_TENANT_ID: '510001234, 510009999' });
    it('EID dans l\'allow-list → autorisé', () => {
        assert.strictEqual(mod.isAllowedTenant({ organization: { enterprise_id: 510001234, id: 1 } }), true);
    });
    it('MID dans l\'allow-list → autorisé', () => {
        assert.strictEqual(mod.isAllowedTenant({ organization: { enterprise_id: 1, id: 510009999 } }), true);
    });
    it('tenant inconnu → REFUSÉ', () => {
        assert.strictEqual(mod.isAllowedTenant({ organization: { enterprise_id: 999, id: 888 } }), false);
    });
    it('userinfo sans organization → REFUSÉ', () => {
        assert.strictEqual(mod.isAllowedTenant({}), false);
        assert.strictEqual(mod.isAllowedTenant(null), false);
    });
    restore();
}

console.log('\n5. Périmètre protégé — le rendu public ne doit JAMAIS être verrouillé');
{
    const { mod, restore } = load(FULL);
    const P = ['/', '/index.html', '/school-selector.html', '/pages-dashboard.html',
               '/api/save', '/api/schools', '/api/content/pages'];
    const OPEN = ['/login', '/handlelogin', '/logout', '/api/cron',
                  '/preview/school-efap__Brochure', '/jpo-efap', '/candidature',
                  '/css/builder.css', '/js/app.js', '/assets/fonts/inter/Inter-Variable.ttf'];
    it('routes builder protégées', () => P.forEach(p =>
        assert.strictEqual(mod.isProtectedPath(p), true, `devrait être protégée : ${p}`)));
    it('routes publiques ouvertes', () => OPEN.forEach(p =>
        assert.strictEqual(mod.isProtectedPath(p), false, `devrait être ouverte : ${p}`)));
    it('page publiée servie sans session', () => {
        const res = fakeRes();
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), res, '/jpo-efap'), true);
        assert.strictEqual(res.statusCode, null);
    });
    restore();
}

console.log('\n6. Réponses du gate');
{
    const { mod, restore } = load(FULL);
    it('page builder sans session → 302 /login avec le retour mémorisé', () => {
        const res = fakeRes();
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), res, '/'), false);
        assert.strictEqual(res.statusCode, 302);
        assert.strictEqual(res.headers.Location, '/login?next=%2F');
    });
    it('appel API sans session → 401 JSON, pas de redirection', () => {
        const res = fakeRes();
        assert.strictEqual(mod.requireSfmcAuth(reqWith(null), res, '/api/save'), false);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(JSON.parse(res.body).error, 'unauthenticated');
    });
    it('session valide → passe', () => {
        const v = mod.serializeSession(
            { user: { id: 'u1' }, expires: Math.floor(Date.now() / 1000) + 600 }, FULL.SESSION_SECRET);
        const res = fakeRes();
        assert.strictEqual(
            mod.requireSfmcAuth(reqWith(`sfmc_session=${encodeURIComponent(v)}`), res, '/api/save'), true);
    });
    restore();
}

console.log('\n7. Paramètre state — anti-CSRF + retour à la page demandée');
{
    const { mod, restore } = load(FULL);
    const secret = FULL.SESSION_SECRET;
    const HOME = '/school-selector.html';

    it('aller-retour du chemin de retour', () => {
        const st = mod.makeState('/school-selector.html?school=efap', secret, HOME);
        assert.strictEqual(mod.readState(st, secret, HOME), '/school-selector.html?school=efap');
    });
    it('sans next → page d\'accueil de l\'app', () => {
        assert.strictEqual(mod.readState(mod.makeState(null, secret, HOME), secret, HOME), HOME);
    });
    it('state absent ou forgé → REFUSÉ (pas de code accepté d\'ailleurs)', () => {
        assert.strictEqual(mod.readState(null, secret, HOME), null);
        assert.strictEqual(mod.readState('a.b', secret, HOME), null);
        assert.strictEqual(mod.readState(mod.makeState('/x', 'autre-secret', HOME), secret, HOME), null);
    });
    it('state périmé → REFUSÉ', () => {
        const old = mod.serializeSession({ n: '/x', t: Math.floor(Date.now() / 1000) - 3600 }, secret);
        assert.strictEqual(mod.readState(old, secret, HOME), null);
    });
    it('open redirect impossible', () => {
        ['//evil.com', 'https://evil.com', 'http://evil.com', 'evil.com', '/login', '/handlelogin']
            .forEach(bad => assert.strictEqual(mod.safeNext(bad), null, `devrait être refusé : ${bad}`));
        assert.strictEqual(mod.safeNext('/pages-dashboard.html'), '/pages-dashboard.html');
    });
    it('le gate transmet la page demandée', () => {
        const res = fakeRes();
        mod.requireSfmcAuth(reqWith(null, '/pages-dashboard.html?x=1'), res, '/pages-dashboard.html');
        assert.strictEqual(res.headers.Location, '/login?next=%2Fpages-dashboard.html%3Fx%3D1');
    });
    restore();
}

console.log('\n8. Routes OAuth');
(async () => {
    const { mod, restore } = load(FULL);
    {
        const res = fakeRes();
        const handled = await mod.handleSfmcAuthRoutes(reqWith(null, '/login'), res, '/login');
        it('GET /login → 302 vers l\'authorize du tenant', () => {
            assert.strictEqual(handled, true);
            assert.strictEqual(res.statusCode, 302);
            const u = new URL(res.headers.Location);
            assert.strictEqual(u.origin, 'https://mctest123.auth.marketingcloudapis.com');
            assert.strictEqual(u.pathname, '/v2/authorize');
            assert.strictEqual(u.searchParams.get('response_type'), 'code');
            assert.strictEqual(u.searchParams.get('client_id'), 'cid');
            assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://app.example.com/handlelogin');
            assert.ok(u.searchParams.get('state'), 'state manquant : flux vulnerable au CSRF');
        });
    }
    {
        const res = fakeRes();
        await mod.handleSfmcAuthRoutes(reqWith(null, '/handlelogin'), res, '/handlelogin');
        it('GET /handlelogin sans code → 302 /login', () => {
            assert.strictEqual(res.statusCode, 302);
            assert.strictEqual(res.headers.Location, '/login');
        });
    }
    {
        const res = fakeRes();
        await mod.handleSfmcAuthRoutes(reqWith('sfmc_session=x', '/logout'), res, '/logout');
        it('GET /logout → cookie effacé + 302 /', () => {
            assert.strictEqual(res.statusCode, 302);
            assert.strictEqual(res.headers.Location, '/school-selector.html');
            const c = String(res.headers['Set-Cookie']);
            assert.ok(/Max-Age=0/.test(c), 'cookie non expiré');
            assert.ok(/SameSite=None/.test(c) && /Secure/.test(c) && /HttpOnly/.test(c),
                      'flags iframe manquants : ' + c);
        });
    }
    {
        const res = fakeRes();
        const handled = await mod.handleSfmcAuthRoutes(reqWith(null, '/api/save'), res, '/api/save');
        it('route hors OAuth → non traitée ici', () => assert.strictEqual(handled, false));
    }
    restore();

    console.log(`\n═══ ${pass} test(s) OK` + (process.exitCode ? ' — DES ÉCHECS' : ''));
})();
