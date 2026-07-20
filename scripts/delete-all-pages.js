#!/usr/bin/env node
/**
 * Supprime TOUTES les pages du schéma scalable (table `pages`) de Supabase —
 * celles affichées dans le dashboard « Portefeuille de pages ».
 *
 * ⚠️  IRRÉVERSIBLE. C'est une suppression DURE (pas la corbeille / soft-delete du
 * dashboard qui se contente de passer status='deleted'). Les `page_versions`
 * associées sont supprimées en cascade (FK on delete cascade).
 *
 * Usage :
 *   node scripts/delete-all-pages.js            # DRY-RUN : compte et liste, ne supprime RIEN
 *   node scripts/delete-all-pages.js --confirm  # supprime réellement toutes les pages
 *
 * N.B. : ne dépublie PAS les assets déjà envoyés dans SFMC.
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
    if (!res.ok) throw new Error(`Supabase ${method} ${endpoint} → ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
}

(async () => {
    // 1. Lister ce qui existe.
    const rows = await sb('GET', '/pages?select=id,title,status&order=created_at.asc');
    const pages = rows || [];
    console.log(`📋 ${pages.length} page(s) dans la table pages.`);

    if (pages.length === 0) {
        console.log('✅ Rien à supprimer.');
        return;
    }

    pages.slice(0, 10).forEach(p => console.log(`   • ${p.title || p.id} [${p.status}]`));
    if (pages.length > 10) console.log(`   … et ${pages.length - 10} de plus`);

    if (!CONFIRM) {
        console.log('\n🚧 DRY-RUN — aucune suppression effectuée.');
        console.log('   Relance avec --confirm pour supprimer réellement :');
        console.log('   node scripts/delete-all-pages.js --confirm');
        return;
    }

    // 2. Suppression réelle, PAR LOTS (un DELETE global dépasse le statement_timeout).
    // Supprimer la page cascade-supprime ses page_versions (FK on delete cascade).
    console.log(`\n🗑️  Suppression de ${pages.length} page(s) (par lots)…`);
    const CONCURRENCY = 5;
    let done = 0;
    const failures = [];
    const queue = pages.map(p => p.id);

    async function worker() {
        while (queue.length) {
            const id = queue.shift();
            try {
                await sb('DELETE', `/pages?id=eq.${encodeURIComponent(id)}`);
                done += 1;
                if (done % 25 === 0 || done === pages.length) {
                    console.log(`   … ${done}/${pages.length}`);
                }
            } catch (e) {
                failures.push({ id, error: e.message });
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`✅ ${done} page(s) supprimée(s).`);
    if (failures.length) {
        console.log(`⚠️  ${failures.length} échec(s) :`);
        failures.slice(0, 10).forEach(f => console.log('   •', f.id, '→', f.error));
    }

    // 3. Vérification.
    const remaining = await sb('GET', '/pages?select=id', { prefer: 'count=exact' });
    console.log(`📋 Restant : ${(remaining || []).length} page(s).`);
})().catch(e => {
    console.error('❌ Échec :', e.message);
    process.exit(1);
});
