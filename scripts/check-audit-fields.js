#!/usr/bin/env node
/**
 * Vérifie de bout en bout le suivi « dernière modification par » :
 * forge une session locale valide, interroge les routes du dashboard, et
 * contrôle que les champs d'auteur sont bien exposés.
 *
 * Aucune écriture. Nécessite un serveur lancé (npm run dev) et un .env
 * contenant SESSION_SECRET.
 *
 * Usage : node scripts/check-audit-fields.js [port]
 */
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || process.env.PORT || 8000;
const BASE = `http://localhost:${PORT}`;

// Lecture directe du .env : dotenv écrit une bannière sur stdout, ce qui
// polluerait une valeur capturée par un script shell.
function envValue(key) {
    const file = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(file)) return null;
    const all = [...fs.readFileSync(file, 'utf8')
        .matchAll(new RegExp('^' + key + '=(.*)$', 'gm'))];
    if (!all.length) return null;
    // ⚠️ On prend la DERNIÈRE occurrence, pas la première : dotenv parse le
    // fichier séquentiellement, donc un doublon plus bas écrase celui du haut.
    // Ce .env déclare SESSION_SECRET deux fois (héritage de l'implémentation
    // SSO par JWT) ; lire la première donnait un secret différent de celui du
    // serveur, et donc un 401 trompeur.
    if (all.length > 1) {
        console.warn(`⚠ ${key} est déclaré ${all.length} fois dans .env — ` +
                     'la dernière valeur est celle qui s\'applique.');
    }
    return all[all.length - 1][1].trim().replace(/^['"]|['"]$/g, '');
}

const secret = envValue('SESSION_SECRET');
if (!secret) {
    console.error('SESSION_SECRET absent de .env — impossible de forger une session.');
    process.exit(1);
}

// getUser() lit process.env : on l'aligne sur le .env avant de charger le module.
process.env.SESSION_SECRET = secret;
const auth = require('../lib/sfmc-auth');

const session = auth.serializeSession({
    user: { name: 'Recette Audit', email: 'recette.audit@reetain-test.fr' },
    expires: Math.floor(Date.now() / 1000) + 600
}, secret);
const COOKIE = 'sfmc_session=' + encodeURIComponent(session);

// Contrôle local avant tout appel réseau : si ceci échoue, le problème est le
// secret, pas le serveur.
if (!auth.getUser({ headers: { cookie: COOKIE } })) {
    console.error('La session forgée est refusée localement : SESSION_SECRET incohérent.');
    process.exit(1);
}
console.log('Session forgée et validée localement.\n');

const AUDIT = ['updated_by_name', 'updated_by_email'];

async function get(route) {
    const res = await fetch(BASE + route, { headers: { Cookie: COOKIE } });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* pas du JSON */ }
    return { status: res.status, json, text };
}

function rowsOf(json) {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== 'object') return [];
    for (const k of ['pages', 'projects', 'data', 'items']) {
        if (Array.isArray(json[k])) return json[k];
    }
    return [];
}

(async () => {
    let failures = 0;

    const st = await get('/api/auth-status');
    console.log('/api/auth-status');
    console.log('  authActive     :', st.json?.authActive);
    console.log('  sessionPresent :', st.json?.sessionPresent);
    if (st.json?.authActive && st.json?.sessionPresent !== true) {
        console.error('  ✖ la session n\'est pas reconnue par le serveur');
        failures++;
    }
    console.log();

    for (const route of ['/api/pages', '/api/projects']) {
        const r = await get(route);
        const rows = rowsOf(r.json);
        console.log(route, '→ http', r.status, '·', rows.length, 'ligne(s)');

        if (r.status !== 200) {
            console.error('  ✖ statut inattendu :', r.text.slice(0, 160));
            failures++;
            console.log();
            continue;
        }
        if (!rows.length) {
            console.log('  (aucune ligne : impossible de vérifier les champs)');
            console.log();
            continue;
        }

        const row = rows[0];
        for (const f of AUDIT) {
            const present = f in row;
            console.log('  ' + f.padEnd(17) + ':', present ? JSON.stringify(row[f]) : '✖ CHAMP ABSENT');
            if (!present) failures++;
        }
        const withAuthor = rows.filter(p => p.updated_by_name || p.updated_by_email).length;
        console.log(`  ${withAuthor}/${rows.length} ligne(s) avec un auteur ` +
                    '(les pages antérieures au suivi affichent un tiret)');
        console.log();
    }

    console.log(failures ? `═══ ${failures} problème(s)` : '═══ tout est conforme');
    process.exit(failures ? 1 : 0);
})().catch(e => {
    console.error('Échec :', e.message);
    console.error('Le serveur tourne-t-il sur le port ' + PORT + ' ?');
    process.exit(1);
});
