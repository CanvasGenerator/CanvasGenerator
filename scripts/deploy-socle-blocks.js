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
 *      npm run deploy:socle -- --push --mid=536010339   # deploiement reel
 *
 *  --mid est OBLIGATOIRE avec --push : il confirme la Business Unit visee.
 *  536010339 = RECETTE EDH · 536009308 = entreprise parente (a eviter).
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
    /* ⚠ AMPSCRIPT, PAS SSJS. Sur cette org, ni une CloudPage ni une Automation
       ne peuvent atteindre Salesforce en SSJS. Les fichiers .ssjs du socle sont
       conserves pour reference (et picklist-handler.ssjs reste la SOURCE du JS
       de cascade, cf. scripts/sync-cascade-js.js), mais ce ne sont PAS eux qui
       tournent en production.

       Cette liste doit rester alignee sur FICHIERS_META dans
       lib/socle-inliner.js : meme cles, memes fichiers. */
    { fichier: 'picklist-handler.ampscript', key: 'LPB_Picklist_Handler_AG', nom: 'Handler — Listes deroulantes', langage: 'ampscript' },
    { fichier: 'handler-form.ampscript',     key: 'LPB_Form_Handler_AG',     nom: 'Handler — Ecriture formulaire', langage: 'ampscript' },
];

/* -- arguments ----------------------------------------------------------- */
const args = process.argv.slice(2);
const PUSH = args.includes('--push');
const seul = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];

function log(s) { console.log(s); }

async function main() {
    log('');
    log('  Déploiement des blocs du socle → SFMC Content Builder');
    log('  ' + '─'.repeat(58));

    /* ---- GARDE-FOU BUSINESS UNIT ------------------------------------------
       Incident du 2026-08-23 : `.env` porte SFMC_ACCOUNT_ID=536009308, qui est
       l'ENTREPRISE, pas la BU de recette (536010339). Le deploiement est donc
       parti dans la mauvaise BU, et comme un CustomerKey est unique pour toute
       l'entreprise, il a rendu les cles du socle inutilisables ailleurs. Il a
       fallu supprimer les assets a la main.

       Desormais le MID cible est AFFICHE, et il faut le confirmer par
       --mid=<id>. Sans ca, --push est refuse. */
    const MID = String(process.env.SFMC_ACCOUNT_ID || '');
    const midAttendu = (args.find((a) => a.startsWith('--mid=')) || '').split('=')[1];

    log(`\n  Business Unit cible (SFMC_ACCOUNT_ID) : ${MID || '(non defini)'}`);
    if (PUSH) {
        if (!midAttendu) {
            console.error('\n  ❌ --push exige --mid=<MID> pour confirmer la Business Unit.');
            console.error(`     Ici SFMC_ACCOUNT_ID vaut ${MID || '(non defini)'}.`);
            console.error('     Rappel : 536010339 = RECETTE EDH, 536009308 = entreprise parente.');
            console.error('     Un CustomerKey est unique pour TOUTE l\'entreprise : se tromper');
            console.error('     de BU bloque la cle partout ailleurs.\n');
            process.exit(1);
        }
        if (midAttendu !== MID) {
            console.error(`\n  ❌ Le MID confirme (${midAttendu}) ne correspond pas a`);
            console.error(`     SFMC_ACCOUNT_ID (${MID}). Rien n'a ete envoye.\n`);
            process.exit(1);
        }
    }

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

        if (b.langage === 'ampscript') {
            // L'AMPscript vit dans des %%[ ]%% et NE DOIT PAS etre enferme dans
            // un <script runat="server"> : SFMC y attendrait du SSJS et le code
            // s'afficherait en clair. Meme garde-fou que dans socle-inliner.js.
            if (/<script[^>]*runat=["']server["']/i.test(contenu)) {
                console.error(`  ✖ ${b.fichier} : AMPscript enferme dans <script runat="server"> — bloc invalide`);
                process.exit(1);
            }
            if (!/%%\[/.test(contenu)) {
                console.error(`  ✖ ${b.fichier} : aucun bloc %%[ ]%% — ce n'est pas de l'AMPscript`);
                process.exit(1);
            }
        } else if (!/<script[^>]*runat=["']server["']/i.test(contenu)) {
            // Un bloc SSJS doit porter son enveloppe : sans elle, SFMC le traite
            // comme du HTML et le code s'afficherait en clair sur la page.
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
    /* SFMC_SOCLE_CATEGORY_ID permet de viser un dossier EXISTANT sans passer
       par ensureFolder, qui echoue en 400 quand le dossier est deja la (constat
       du 2026-08-23 : dossier « socle » id 46200 deja present dans RECETTE). */
    const dossierId = process.env.SFMC_SOCLE_CATEGORY_ID
        ? Number(process.env.SFMC_SOCLE_CATEGORY_ID)
        : await ensureFolder('socle', racineId);
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
