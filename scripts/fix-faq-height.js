#!/usr/bin/env node
/**
 * Correctif des FAQ déjà en base : neutralise les hauteurs fixes qui empêchent
 * l'accordéon de s'adapter quand on déroule les réponses.
 *
 * ── Le bug ────────────────────────────────────────────────────────────────
 * app.js rend tout composant redimensionnable sur 8 poignées avec
 * `keyHeight: 'height'` (LP_RESIZE). Un glissement de la poignée basse sur la
 * section FAQ — même accidentel — écrit `height: NNNpx` dans la règle #id du
 * Style Manager. Cette règle est stockée (colonne `css`) et republiée
 * (`<style>${css}</style>` dans buildStoredHtml). En ligne, la boîte est figée
 * à sa hauteur REPLIÉE : dérouler les réponses fait déborder le contenu hors du
 * fond de section et par-dessus le footer.
 *
 * Le composant est corrigé (MasterTemplate/Components/Accordion/index.js :
 * poignées latérales uniquement + garde-fou CSS), mais les pages DÉJÀ
 * enregistrées portent l'ancien CSS. Ce script leur ajoute le garde-fou.
 *
 * ── Ce que fait le script ─────────────────────────────────────────────────
 * ADDITIF uniquement : aucune règle existante n'est réécrite ni supprimée. On
 * ajoute un bloc CSS marqué `LPB-FIX-FAQ-HEIGHT` qui bat la règle #id grâce à
 * `!important`. Idempotent : une ligne déjà porteuse du marqueur est ignorée.
 *
 *   • table `Projects`      → colonnes css, html, html_sfmc
 *   • table `page_versions` → colonnes css, html, html_sfmc
 *
 * Par DÉFAUT, seules les versions réellement servies sont patchées :
 * `pages.current_version_id` et `page_variants.current_version_id`. L'historique
 * est laissé intact — le patcher représentait 2 262 lignes pour 14 pages (le
 * dashboard crée deux versions par sauvegarde). Conséquence assumée : restaurer
 * une ancienne version réintroduit le bug jusqu'à la sauvegarde suivante, qui
 * régénère le CSS depuis le composant corrigé. `--all-versions` couvre
 * l'historique si tu préfères.
 *
 * Usage :
 *   node scripts/fix-faq-height.js               # DRY-RUN : liste, n'écrit RIEN
 *   node scripts/fix-faq-height.js --apply       # écrit en base
 *   node scripts/fix-faq-height.js --apply --only=Projects
 *   node scripts/fix-faq-height.js --all-versions   # inclut tout l'historique
 *   node scripts/fix-faq-height.js --limit=50    # borne le balayage (debug)
 *
 * ⚠️ Republication SFMC NON incluse : le script corrige la base, pas les assets
 * déjà envoyés dans Content Builder. Les pages concernées doivent être
 * republiées depuis le dashboard pour que la correction soit visible en ligne.
 */
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY doivent être définis dans .env');
    process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const ALL_VERSIONS = process.argv.includes('--all-versions');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1], 10) || null;

const MARKER = 'LPB-FIX-FAQ-HEIGHT';

// Doit rester identique au garde-fou du composant (Accordion/index.js), sinon
// une page re-sauvegardée et une page migrée ne se comporteraient pas pareil.
const GUARD_CSS = `
/* ${MARKER} — une FAQ se déplie, sa hauteur ne peut PAS être figée.
   Neutralise toute hauteur fixe héritée du Style Manager (règle #id posée par le
   resizer) : sans ça, dérouler les réponses fait déborder le contenu hors du fond
   de section et par-dessus le footer. */
.ma-section, .ma-inner, .ma-list, .ma-item, .ma-a {
  height: auto !important;
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible !important;
}`;

const GUARD_STYLE_TAG = `<style>${GUARD_CSS}\n</style>`;

// Une page est concernée si elle embarque le composant FAQ. `ma-faq-section` est
// le data-gjs-type ; `ma-section` couvre les sorties où l'attribut a été nettoyé.
const HAS_FAQ = /ma-faq-section|ma-section/;

async function sb(method, endpoint, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            ...(method === 'PATCH' ? { Prefer: 'return=minimal' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${method} ${endpoint} → ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
}

/** Insère le garde-fou juste avant </head> (ou en tête si pas de <head>). */
function patchHtml(html) {
    if (!html) return html;
    const i = html.toLowerCase().lastIndexOf('</head>');
    if (i === -1) return GUARD_STYLE_TAG + html;
    return html.slice(0, i) + GUARD_STYLE_TAG + html.slice(i);
}

function patchRow(row) {
    const blob = [row.css, row.html, row.html_sfmc].filter(Boolean).join('\n');
    if (!HAS_FAQ.test(blob)) return null;               // pas de FAQ sur cette page
    if (blob.includes(MARKER))  return null;            // déjà migrée

    const patch = {};
    // `css` est la source de vérité : buildStoredHtml régénère <style>${css}</style>
    // à chaque sauvegarde, donc le garde-fou doit y vivre pour survivre.
    if (typeof row.css === 'string')        patch.css        = row.css + '\n' + GUARD_CSS;
    // `html` / `html_sfmc` sont ce qui est servi/publié tant qu'aucune sauvegarde
    // n'a eu lieu : on les patche directement.
    if (row.html)      patch.html      = patchHtml(row.html);
    if (row.html_sfmc) patch.html_sfmc = patchHtml(row.html_sfmc);
    return Object.keys(patch).length ? patch : null;
}

async function fetchAll(table, select, order) {
    const out = [];
    const PAGE = 200;
    for (let offset = 0; ; offset += PAGE) {
        const rows = await sb('GET', `/${table}?select=${select}&order=${order}&limit=${PAGE}&offset=${offset}`);
        if (!rows || !rows.length) break;
        out.push(...rows);
        if (rows.length < PAGE) break;
        if (LIMIT && out.length >= LIMIT) break;
    }
    return LIMIT ? out.slice(0, LIMIT) : out;
}

/**
 * Ids des versions réellement SERVIES : la version courante de chaque page
 * (rendu par défaut) et celle de chaque variante de langue. Tout le reste est de
 * l'historique — inutile de le réécrire.
 */
async function currentVersionIds() {
    const ids = new Set();
    for (const [table, col] of [['pages', 'current_version_id'], ['page_variants', 'current_version_id']]) {
        const rows = await sb('GET', `/${table}?select=${col}`);
        (rows || []).forEach(r => { if (r[col]) ids.add(r[col]); });
    }
    return ids;
}

/** Récupère des page_versions par lots d'ids (évite de balayer toute la table). */
async function fetchVersionsByIds(ids, select) {
    const out = [];
    const list = [...ids];
    const BATCH = 40;
    for (let i = 0; i < list.length; i += BATCH) {
        const chunk = list.slice(i, i + BATCH).map(encodeURIComponent).join(',');
        const rows = await sb('GET', `/page_versions?select=${select}&id=in.(${chunk})`);
        if (rows) out.push(...rows);
    }
    return LIMIT ? out.slice(0, LIMIT) : out;
}

async function migrate({ table, select, order, keyField, label, rows: preloaded }) {
    console.log(`\n-- ${table} --`);
    const rows = preloaded || await fetchAll(table, select, order);
    console.log(`   ${rows.length} ligne(s) balayée(s)`);

    let touched = 0, skipped = 0, already = 0, failed = 0;
    for (const row of rows) {
        const blob = [row.css, row.html, row.html_sfmc].filter(Boolean).join('\n');
        if (blob.includes(MARKER)) { already++; continue; }
        const patch = patchRow(row);
        if (!patch) { skipped++; continue; }

        const key = row[keyField];
        const name = label(row);
        touched++;
        if (!APPLY) {
            console.log(`   [dry-run] ${name}  (+${Object.keys(patch).join(', ')})`);
            continue;
        }
        try {
            await sb('PATCH', `/${table}?${keyField}=eq.${encodeURIComponent(key)}`, patch);
            console.log(`   ✔ ${name}`);
        } catch (e) {
            failed++;
            console.error(`   ✖ ${name} → ${e.message}`);
        }
    }
    console.log(`   → ${touched} à corriger · ${already} déjà migrée(s) · ${skipped} sans FAQ` +
                (failed ? ` · ${failed} en échec` : ''));
    return { touched, failed };
}

(async () => {
    console.log(APPLY
        ? '⚙️  MODE ÉCRITURE — les lignes concernées vont être modifiées.'
        : '🔍 DRY-RUN — aucune écriture. Relancer avec --apply pour appliquer.');

    const VERSION_SELECT = 'id,page_id,version_number,language,html,html_sfmc,css';

    // Périmètre des page_versions : versions servies (défaut) ou tout l'historique.
    let versionRows = null;
    if (!ONLY || ONLY === 'page_versions') {
        if (ALL_VERSIONS) {
            console.log('\nPérimètre page_versions : TOUT l\'historique (--all-versions).');
        } else {
            const ids = await currentVersionIds();
            console.log(`\nPérimètre page_versions : ${ids.size} version(s) servie(s) ` +
                        '(pages.current_version_id + page_variants.current_version_id). ' +
                        '--all-versions pour inclure l\'historique.');
            versionRows = await fetchVersionsByIds(ids, VERSION_SELECT);
        }
    }

    const targets = [
        {
            table: 'Projects',
            select: 'project_name,html,html_sfmc,css',
            order: 'project_name.asc',
            keyField: 'project_name',
            label: r => r.project_name
        },
        {
            table: 'page_versions',
            select: VERSION_SELECT,
            order: 'created_at.asc',
            keyField: 'id',
            label: r => `page ${r.page_id} · v${r.version_number} · ${r.language || '—'}`,
            rows: versionRows
        }
    ].filter(t => !ONLY || t.table === ONLY);

    let total = 0, failed = 0;
    for (const t of targets) {
        const r = await migrate(t);
        total += r.touched;
        failed += r.failed;
    }

    console.log(`\n═══ ${total} ligne(s) ${APPLY ? 'corrigée(s)' : 'à corriger'}` +
                (failed ? ` · ${failed} en échec` : ''));
    if (APPLY && total) {
        console.log('⚠️  Republier les pages concernées depuis le dashboard : ce script');
        console.log('    corrige la base, pas les assets déjà envoyés dans SFMC.');
    }
    process.exit(failed ? 1 : 0);
})().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
