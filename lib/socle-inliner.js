/**
 * ============================================================================
 *  INLINER DU SOCLE SSJS
 * ============================================================================
 *  Remplace, AU MOMENT DE LA PUBLICATION, les appels
 *      %%=ContentBlockByKey("LPB_...")=%%
 *  par le code SSJS reel des fichiers de sfmc-ssjs/socle/.
 *
 *  Pourquoi : la page publiee devient AUTONOME. Plus besoin de creer les
 *  Content Blocks dans Content Builder — il n'y a rien a installer cote SFMC,
 *  le depot reste la seule source de verite.
 *
 *  Ce qui est stocke en base garde la forme courte %%=ContentBlockByKey(...)=%% :
 *  seule la charge ENVOYEE a SFMC est developpee. Le builder reste lisible.
 *
 *  --- Deux niveaux d'inclusion a traiter ---
 *  1. Dans le HTML de la page   : %%=ContentBlockByKey("LPB_Form_Handler_AG")=%%
 *  2. Dans le SSJS des handlers : Platform.Function.ContentBlockByKey("LPB_Socle_Config_AG");
 *     -> remplace par le corps du fichier, sans son <script runat="server">,
 *        puisqu'on est deja a l'interieur du script du handler.
 *
 *  --- Dedoublonnage ---
 *  Les deux handlers dependent des memes briques. Comme tous les blocs d'une
 *  page partagent le meme scope SSJS, une brique deja emise plus haut dans le
 *  document n'est pas reemise : on evite de doubler ~70 Ko par page.
 * ============================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOCLE_DIR = path.join(__dirname, '..', 'sfmc-ssjs', 'socle');

/** CustomerKey -> fichier source. */
const FICHIERS = {
    LPB_Socle_Config_AG:     'config.ssjs',
    LPB_Socle_Helpers_AG:    'sf-helpers.ssjs',
    LPB_Socle_Resolvers_AG:  'socle-resolvers.ssjs',
    LPB_Socle_Read_AG:       'socle-read.ssjs',
    LPB_Socle_Upsert_AG:     'socle-upsert.ssjs',
    LPB_Socle_Summit_AG:     'socle-summit.ssjs',
    LPB_Form_Handler_AG:     'handler-form.ssjs',
    LPB_Picklist_Handler_AG: 'picklist-handler.ssjs',
};

/** Inclusion AMPscript dans le HTML de la page. */
const RE_AMPSCRIPT = /%%=\s*ContentBlockByKey\(\s*["']([A-Za-z0-9_]+)["']\s*\)\s*=%%/g;

/** Inclusion SSJS a l'interieur d'un handler (avec ou sans point-virgule). */
const RE_SSJS = /^[ \t]*Platform\.Function\.ContentBlockByKey\(\s*["']([A-Za-z0-9_]+)["']\s*\)\s*;?[ \t]*$/gm;

function lire(fichier) {
    return fs.readFileSync(path.join(SOCLE_DIR, fichier), 'utf8');
}

/** Retire l'enveloppe <script runat="server"> — on inline dans un script existant. */
function corpsSsjs(contenu) {
    return contenu
        .replace(/<script[^>]*runat=["']server["'][^>]*>/i, '')
        .replace(/<\/script>\s*$/i, '');
}

/**
 * Developpe un bloc et, recursivement, ses dependances SSJS.
 * @param {String} cle        CustomerKey demande
 * @param {Set}    dejaEmis   cles deja injectees plus haut dans le document
 * @param {Object} stats      compteurs remplis au passage
 * @returns {String} le contenu pret a etre insere
 */
function developper(cle, dejaEmis, stats) {
    const fichier = FICHIERS[cle];
    if (!fichier) return null;

    let contenu = lire(fichier);
    dejaEmis.add(cle);
    stats.blocs.push(cle);

    // Remplace les inclusions SSJS internes par le corps des dependances.
    contenu = contenu.replace(RE_SSJS, (ligne, depCle) => {
        if (!FICHIERS[depCle]) return ligne;              // cle inconnue : on laisse tel quel

        if (dejaEmis.has(depCle)) {
            stats.dedoublonnes++;
            return `/* ${depCle} : deja inline plus haut dans la page (scope SSJS partage) */`;
        }
        dejaEmis.add(depCle);
        stats.blocs.push(depCle);

        return [
            `/* ===== debut ${depCle} (${FICHIERS[depCle]}) ===== */`,
            corpsSsjs(lire(FICHIERS[depCle])).trim(),
            `/* ===== fin ${depCle} ===== */`,
        ].join('\n');
    });

    return contenu;
}

/**
 * Developpe toutes les inclusions du socle presentes dans une page.
 *
 * Ne leve jamais : en cas de probleme, le HTML est renvoye inchange et la
 * publication continue (la page retombe alors sur les Content Blocks SFMC,
 * s'ils existent).
 *
 * @param {String} html
 * @returns {{ html:String, inline:Boolean, blocs:String[], dedoublonnes:Number, octets:Number }}
 */
function inlineSocleBlocks(html) {
    const source = String(html || '');
    const stats = { blocs: [], dedoublonnes: 0 };

    if (!source.includes('ContentBlockByKey')) {
        return { html: source, inline: false, blocs: [], dedoublonnes: 0, octets: 0 };
    }

    try {
        const dejaEmis = new Set();
        const sortie = source.replace(RE_AMPSCRIPT, (match, cle) => {
            // Cle hors socle (bloc metier maison) : on n'y touche pas.
            if (!FICHIERS[cle]) return match;
            if (dejaEmis.has(cle)) {
                stats.dedoublonnes++;
                return `<!-- ${cle} : deja inline plus haut dans la page -->`;
            }
            const developpe = developper(cle, dejaEmis, stats);
            return developpe === null ? match : developpe;
        });

        return {
            html: sortie,
            inline: stats.blocs.length > 0,
            blocs: stats.blocs,
            dedoublonnes: stats.dedoublonnes,
            octets: Buffer.byteLength(sortie) - Buffer.byteLength(source),
        };
    } catch (e) {
        console.warn('⚠️  Inline du socle impossible, publication du HTML tel quel :', e.message);
        return { html: source, inline: false, blocs: [], dedoublonnes: 0, octets: 0 };
    }
}

module.exports = { inlineSocleBlocks, FICHIERS, corpsSsjs };
