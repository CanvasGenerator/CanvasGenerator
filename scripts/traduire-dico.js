/**
 * ============================================================================
 *  TRADUCTION DU DICTIONNAIRE DE VALEURS DE PICKLIST
 * ============================================================================
 *  Remplit la colonne `En` de la DE `LPB_Dico_Traductions` pour les lignes qui
 *  ne l'ont pas encore, en appelant le même moteur Gemini que la traduction des
 *  landing pages (lib/translate.js).
 *
 *  Ce que ce script NE fait PAS, volontairement :
 *    - il ne crée aucune ligne. Les valeurs viennent du CRM, et seule une page
 *      AMPscript peut lire Salesforce sur cette org : c'est le bloc
 *      `LPB_TST_Dico_Sync` qui les insère, l'anglais vide.
 *    - il ne retraduit jamais une ligne déjà traduite. Une correction faite à
 *      la main dans la DE est donc définitive, sauf --force.
 *
 *  Usage :
 *      SFMC_ACCOUNT_ID=536010339 node scripts/traduire-dico.js
 *      SFMC_ACCOUNT_ID=536010339 node scripts/traduire-dico.js --push --mid=536010339
 *
 *      --force   retraduit TOUT, y compris les lignes déjà traduites
 *      --max=N   limite le volume d'un passage
 *
 *  Le mode SIMULATION est le défaut : rien ne part chez Gemini ni dans SFMC
 *  tant que --push n'est pas passé. Il affiche ce qui serait traduit.
 *
 *  ⚠ --mid est OBLIGATOIRE avec --push, comme pour deploy-socle-blocks.js :
 *  `.env` porte SFMC_ACCOUNT_ID=536009308, l'entreprise PARENTE, alors que le
 *  dictionnaire vit dans RECETTE (536010339). Sans surcharge, la lecture rend
 *  0 ligne — et une écriture partirait dans la mauvaise Business Unit.
 * ============================================================================
 */

require('dotenv').config();

const { translateStrings } = require('../lib/translate');
const { lireDicoTraductions, upsertDicoTraductions, isSfmcCredentialsConfigured } = require('../lib/sfmc');

const args  = process.argv.slice(2);
const PUSH  = args.includes('--push');
const FORCE = args.includes('--force');
const MAX   = Number((args.find(a => a.startsWith('--max=')) || '').split('=')[1]) || 0;
const MID   = (args.find(a => a.startsWith('--mid=')) || '').split('=')[1] || '';

function log(s) { console.log(s); }

async function main() {
    log('');
    log('  Traduction du dictionnaire de picklists');
    log('  ──────────────────────────────────────────────────────────');
    log('');

    const bu = (process.env.SFMC_ACCOUNT_ID || '').trim();
    if (PUSH && MID !== bu) {
        log('  ✗ Business Unit non confirmée.');
        log('');
        log(`    SFMC_ACCOUNT_ID = ${bu || '(absent)'}`);
        log(`    --mid           = ${MID || '(absent)'}`);
        log('');
        log('    Les deux doivent coïncider. RECETTE EDH = 536010339 ·');
        log('    536009308 = entreprise parente, à éviter.');
        log('');
        log('    SFMC_ACCOUNT_ID=536010339 node scripts/traduire-dico.js --push --mid=536010339');
        log('');
        process.exitCode = 1;
        return;
    }
    log(`  Business Unit : ${bu || '(défaut du jeton)'}`);
    log('');

    if (!isSfmcCredentialsConfigured()) {
        log('  ✗ Identifiants SFMC absents. Renseigner SFMC_CLIENT_ID,');
        log('    SFMC_CLIENT_SECRET et SFMC_SUBDOMAIN dans .env');
        process.exitCode = 1;
        return;
    }

    const cle = (process.env.GEMINI_API_KEY_TRANSLATION || '').trim();
    if (!cle && PUSH) {
        log('  ✗ GEMINI_API_KEY_TRANSLATION absente : impossible de traduire.');
        process.exitCode = 1;
        return;
    }

    const lignes = await lireDicoTraductions();
    log(`  ${lignes.length} ligne(s) dans le dictionnaire.`);

    const aTraduire = lignes.filter(l => {
        if (String(l.Actif || 'true').toLowerCase() === 'false') return false;
        if (!l.Fr) return false;
        return FORCE || !String(l.En || '').trim();
    });

    if (!aTraduire.length) {
        log('  ✓ Rien à traduire — toutes les lignes actives ont un anglais.');
        log('');
        return;
    }

    const lot = MAX > 0 ? aTraduire.slice(0, MAX) : aTraduire;
    log(`  ${aTraduire.length} sans anglais${FORCE ? ' (--force : tout est reprise)' : ''}` +
        `${MAX > 0 && MAX < aTraduire.length ? `, limité à ${lot.length}` : ''}.`);
    log('');

    if (!PUSH) {
        log('  SIMULATION — rien n\'est envoyé. Aperçu des 10 premières :');
        lot.slice(0, 10).forEach(l => log(`    ${l.Champ || '?'}  ·  ${l.Fr}`));
        log('');
        log('  Relancer avec --push pour traduire et écrire.');
        log('');
        return;
    }

    /* Le moteur déduplique et découpe déjà en lots de 60 : on lui passe la
       liste entière et il gère les appels. Les clés du dictionnaire sont
       uniques par construction (PK), donc pas de doublon à craindre ici. */
    const sources = lot.map(l => l.Fr);
    log(`  Appel du moteur de traduction sur ${sources.length} libellé(s)…`);
    const traduites = await translateStrings(sources, 'English', cle, globalThis.fetch);

    if (traduites.length !== sources.length) {
        log(`  ✗ Réponse incohérente : ${traduites.length} traductions pour ${sources.length} libellés.`);
        process.exitCode = 1;
        return;
    }

    const aEcrire = [];
    lot.forEach((l, i) => {
        const en = String(traduites[i] || '').trim();
        if (!en || en === l.Fr) return;   // rien de neuf : on n'écrit pas
        aEcrire.push({ Cle: l.Cle, Fr: l.Fr, En: en, Origine: 'IA', Actif: 'true' });
    });

    const identiques = lot.length - aEcrire.length;
    if (identiques) {
        log(`  ${identiques} libellé(s) rendus inchangés par la traduction — non écrits.`);
    }

    if (!aEcrire.length) {
        log('  Aucune traduction à écrire.');
        log('');
        return;
    }

    const n = await upsertDicoTraductions(aEcrire);
    log(`  ✓ ${n} traduction(s) écrite(s) dans LPB_Dico_Traductions.`);
    log('');
    log('  Aperçu :');
    aEcrire.slice(0, 12).forEach(l => log(`    ${l.Fr}  →  ${l.En}`));
    log('');
    log('  Les libellés sont désormais servis en anglais par le socle, sur les');
    log('  formulaires dont data-lang vaut "en". Les valeurs postées au CRM,');
    log('  elles, restent inchangées.');
    log('');
}

main().catch(e => {
    console.error('');
    console.error('  ✗ ' + (e && e.message ? e.message : e));
    console.error('');
    process.exitCode = 1;
});
