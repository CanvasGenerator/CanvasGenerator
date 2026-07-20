#!/usr/bin/env node
/**
 * Supprime TOUS les projets de la table `Projects` de Supabase
 * (les « projets sauvegardés » affichés sur le dashboard).
 *
 * ⚠️  IRRÉVERSIBLE. Utilise la clé service-role (bypass RLS).
 *
 * Usage :
 *   node scripts/delete-all-projects.js            # DRY-RUN : compte et liste, ne supprime RIEN
 *   node scripts/delete-all-projects.js --confirm  # supprime réellement toutes les lignes
 *
 * N.B. : ne touche QUE la table `Projects`. Les assets déjà publiés dans SFMC ne sont
 * pas dépubliés, et le schéma scalable (pages / page_versions…) n'est pas affecté.
 */
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY doivent être définis dans .env');
    process.exit(1);
}

const CONFIRM = process.argv.includes('--confirm') || process.argv.includes('--yes');

async function sb(method, endpoint, { prefer } = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            ...(prefer ? { Prefer: prefer } : {})
        }
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Supabase ${method} ${endpoint} → ${res.status} ${text}`);
    }
    return text ? JSON.parse(text) : null;
}

(async () => {
    // 1. Lister ce qui existe.
    const rows = await sb('GET', '/Projects?select=project_name&order=project_name.asc');
    const names = (rows || []).map(r => r.project_name);
    console.log(`📋 ${names.length} projet(s) dans la table Projects.`);

    if (names.length === 0) {
        console.log('✅ Rien à supprimer.');
        return;
    }

    // Aperçu (10 premiers).
    names.slice(0, 10).forEach(n => console.log('   •', n));
    if (names.length > 10) console.log(`   … et ${names.length - 10} de plus`);

    if (!CONFIRM) {
        console.log('\n🚧 DRY-RUN — aucune suppression effectuée.');
        console.log('   Relance avec --confirm pour supprimer réellement :');
        console.log('   node scripts/delete-all-projects.js --confirm');
        return;
    }

    // 2. Suppression réelle, PAR LOTS : un DELETE global dépasse le statement_timeout
    // de Postgres (lignes volumineuses : HTML complet). On supprime ligne par ligne
    // via la clé (project_name=eq.), avec une petite concurrence.
    console.log(`\n🗑️  Suppression de ${names.length} projet(s) (par lots)…`);
    const CONCURRENCY = 5;
    let done = 0;
    const failures = [];
    const queue = [...names];

    async function worker() {
        while (queue.length) {
            const name = queue.shift();
            try {
                await sb('DELETE', `/Projects?project_name=eq.${encodeURIComponent(name)}`);
                done += 1;
                if (done % 25 === 0 || done === names.length) {
                    console.log(`   … ${done}/${names.length}`);
                }
            } catch (e) {
                failures.push({ name, error: e.message });
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`✅ ${done} projet(s) supprimé(s).`);
    if (failures.length) {
        console.log(`⚠️  ${failures.length} échec(s) :`);
        failures.slice(0, 10).forEach(f => console.log('   •', f.name, '→', f.error));
    }

    // 3. Vérification.
    const remaining = await sb('GET', '/Projects?select=project_name');
    console.log(`📋 Restant : ${(remaining || []).length} projet(s).`);
})().catch(e => {
    console.error('❌ Échec :', e.message);
    process.exit(1);
});
