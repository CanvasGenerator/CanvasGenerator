/**
 * ============================================================================
 *  DEPLOIEMENT DES BLOCS DU SOCLE SSJS DANS SFMC
 * ============================================================================
 *  Televerse les fichiers de sfmc-ssjs/socle/ dans Content Builder comme
 *  Code Snippets (assetType 220), avec les CustomerKey exacts attendus par
 *  %%=ContentBlockByKey("...")=%%.
 *
 *  A faire UNE FOIS, puis a rejouer a chaque modification du code du socle.
 *  Ce ne sont PAS des CloudPages : ce sont des blocs partages par toutes les
 *  landing pages.
 *
 *  Usage :
 *      npm run deploy:socle              # simulation (n'ecrit rien)
 *      npm run deploy:socle -- --push    # deploiement reel
 *      npm run deploy:socle -- --push --only=LPB_Socle_Read_AG
 *
 *  Par securite, le mode SIMULATION est le defaut : rien n'est envoye a SFMC
 *  tant que --push n'est pas passe explicitement.
 * ============================================================================
 */
'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { isSfmcConfigured, sfmcFetch, findAssetIdByCustomerKey, ensureFolder,
        resolveCategoryIdByName } = require('../lib/sfmc');

const SOCLE_DIR = path.join(__dirname, '..', 'sfmc-ssjs', 'socle');

/**
 * Fichier -> CustomerKey. L'ordre est celui d'inclusion dans la CloudPage :
 * un bloc ne peut dependre que de ceux qui le precedent.
 */
const BLOCS = [
    { fichier: 'config.ssjs',           key: 'LPB_Socle_Config_AG',      nom: 'Socle — Configuration' },
    { fichier: 'sf-helpers.ssjs',       key: 'LPB_Socle_Helpers_AG',     nom: 'Socle — Helpers Salesforce' },
    { fichier: 'socle-resolvers.ssjs',  key: 'LPB_Socle_Resolvers_AG',   nom: 'Socle — Résolveurs' },
    { fichier: 'socle-read.ssjs',       key: 'LPB_Socle_Read_AG',        nom: 'Socle — Lecture Salesforce' },
    { fichier: 'socle-upsert.ssjs',     key: 'LPB_Socle_Upsert_AG',      nom: 'Socle — Séquence upsert' },
    { fichier: 'socle-summit.ssjs',     key: 'LPB_Socle_Summit_AG',      nom: 'Socle — Summit (événement)' },
    { fichier: 'handler-form.ssjs',     key: 'LPB_Form_Handler_AG',      nom: 'Handler — Écriture formulaire' },
    { fichier: 'picklist-handler.ssjs', key: 'LPB_Picklist_Handler_AG',  nom: 'Handler — Listes déroulantes' },
];

/* -- arguments ----------------------------------------------------------- */
const args = process.argv.slice(2);
const PUSH = args.includes('--push');
const seul = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];

function log(s) { console.log(s); }

async function main() {
    log('');
    log('  Déploiement des blocs du socle SSJS → SFMC Content Builder');
    log('  ' + '─'.repeat(58));

    if (!isSfmcConfigured()) {
        console.error('\n  ❌ SFMC non configuré. Vérifie SFMC_SUBDOMAIN, SFMC_CLIENT_ID,');
        console.error('     SFMC_CLIENT_SECRET et SFMC_ACCOUNT_ID dans .env\n');
        process.exit(1);
    }

    // 1. Lecture + contrôle des fichiers AVANT tout appel réseau
    const aDeployer = [];
    for (const b of BLOCS) {
        if (seul && b.key !== seul) continue;

        const chemin = path.join(SOCLE_DIR, b.fichier);
        if (!fs.existsSync(chemin)) {
            console.error(`  ✖ ${b.fichier} introuvable`);
            process.exit(1);
        }
        const contenu = fs.readFileSync(chemin, 'utf8');

        // Un bloc SSJS doit porter son enveloppe : sans elle, SFMC le traite
        // comme du HTML et le code s'afficherait en clair sur la page.
        if (!/<script[^>]*runat=["']server["']/i.test(contenu)) {
            console.error(`  ✖ ${b.fichier} : pas de <script runat="server"> — bloc invalide`);
            process.exit(1);
        }
        aDeployer.push(Object.assign({}, b, { contenu, taille: Buffer.byteLength(contenu) }));
    }

    if (!aDeployer.length) {
        console.error(`\n  ❌ Aucun bloc à déployer${seul ? ` (--only=${seul} ne correspond à rien)` : ''}\n`);
        process.exit(1);
    }

    if (!PUSH) {
        log('\n  MODE SIMULATION — rien n\'est envoyé à SFMC.');
        log('  Relance avec --push pour déployer réellement.\n');
        for (const b of aDeployer) {
            log(`    ${b.key.padEnd(28)} ← ${b.fichier.padEnd(22)} ${String(b.taille).padStart(6)} o`);
        }
        log(`\n  ${aDeployer.length} bloc(s) prêt(s).\n`);
        return;
    }

    // 2. Dossier de destination : [racine]/socle
    let racineId = process.env.SFMC_CATEGORY_ID || null;
    if (!racineId && process.env.SFMC_CATEGORY_NAME) {
        racineId = await resolveCategoryIdByName(process.env.SFMC_CATEGORY_NAME, null)
                || await ensureFolder(process.env.SFMC_CATEGORY_NAME, 0);
    }
    const dossierId = await ensureFolder('socle', racineId);
    log(`\n  Dossier de destination : socle (id ${dossierId})\n`);

    // 3. Upsert bloc par bloc
    let crees = 0, majs = 0, erreurs = 0;

    for (const b of aDeployer) {
        const payload = {
            name: b.nom,
            customerKey: b.key,
            assetType: { id: 220, name: 'codesnippet' },
            content: b.contenu,
            category: { id: dossierId },
        };

        try {
            const existant = await findAssetIdByCustomerKey(b.key);
            if (existant) {
                await sfmcFetch('PATCH', `/asset/v1/content/assets/${existant}`, payload);
                log(`  ↻ mis à jour   ${b.key}`);
                majs++;
            } else {
                await sfmcFetch('POST', '/asset/v1/content/assets', payload);
                log(`  + créé         ${b.key}`);
                crees++;
            }
        } catch (e) {
            log(`  ✖ ÉCHEC        ${b.key} — ${e.message}`);
            erreurs++;
        }
    }

    log('');
    log(`  ${crees} créé(s) · ${majs} mis à jour · ${erreurs} en échec`);
    if (erreurs) {
        log('\n  ⚠ Déploiement incomplet : un bloc manquant fera échouer');
        log('    ContentBlockByKey sur la page publiée.\n');
        process.exit(1);
    }
    log('\n  ✅ Socle déployé. Les CloudPages peuvent maintenant appeler');
    log('     %%=ContentBlockByKey("LPB_...")=%% \n');
}

main().catch((e) => {
    console.error('\n  ❌ ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
});
