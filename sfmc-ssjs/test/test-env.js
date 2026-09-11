'use strict';
/* ============================================================================
 *  INJECTION DES DRAPEAUX D'ENVIRONNEMENT DANS LE SOCLE (lib/socle-env.js)
 * ============================================================================
 *  Une CloudPage n'a pas de process.env : `%%ENV:NOM%%` est remplace a la
 *  publication, par l'inliner (pages) et par deploy-socle-blocks (blocs). On
 *  verifie la normalisation des drapeaux *_LAUNCH, le defaut ferme, et qu'un
 *  handler inline ne contient plus aucun jeton — un `%%ENV:` qui survivrait
 *  arriverait tel quel dans 120 pages publiees.
 * ========================================================================== */
const path = require('node:path');
const { injecterEnv, jetonsRestants } = require(path.join(__dirname, '..', '..', 'lib', 'socle-env'));

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + '\n      ' + e.message); } }
function egal(a, b, m) { if (a !== b) throw new Error((m || '') + ' — attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }

test('drapeau absent → "false"', () => egal(injecterEnv('x=%%ENV:SFMC_JOURNEY_LAUNCH%%', {}), 'x=false'));
test('drapeau vide → "false"', () => egal(injecterEnv('x=%%ENV:SFMC_JOURNEY_LAUNCH%%', { SFMC_JOURNEY_LAUNCH: '' }), 'x=false'));
test('drapeau "true" → "true"', () => egal(injecterEnv('x=%%ENV:SFMC_JOURNEY_LAUNCH%%', { SFMC_JOURNEY_LAUNCH: 'true' }), 'x=true'));
test('drapeau " TRUE " normalise', () => egal(injecterEnv('x=%%ENV:SFMC_JOURNEY_LAUNCH%%', { SFMC_JOURNEY_LAUNCH: ' TRUE ' }), 'x=true'));
test('drapeau "1" ou "oui" reste ferme', () => {
    egal(injecterEnv('%%ENV:SFMC_JOURNEY_LAUNCH%%', { SFMC_JOURNEY_LAUNCH: '1' }), 'false');
    egal(injecterEnv('%%ENV:SFMC_JOURNEY_LAUNCH%%', { SFMC_JOURNEY_LAUNCH: 'oui' }), 'false');
});
test('jeton inconnu hors *_LAUNCH → chaine vide', () => egal(injecterEnv('a%%ENV:AUTRE_CHOSE%%b', {}), 'ab'));
test('plusieurs jetons dans un meme texte', () =>
    egal(injecterEnv('%%ENV:SFMC_JOURNEY_LAUNCH%%/%%ENV:SFMC_JOURNEY_LAUNCH%%', { SFMC_JOURNEY_LAUNCH: 'true' }), 'true/true'));
test('jetonsRestants liste les jetons non remplaces', () => {
    egal(jetonsRestants('%%ENV:A%% et %%ENV:B_LAUNCH%%').join(','), 'A,B_LAUNCH');
    egal(jetonsRestants(injecterEnv('%%ENV:A%% et %%ENV:B_LAUNCH%%', {})).length, 0);
});

/* Le handler reel, inline comme a la publication : drapeau pose, plus aucun
   jeton, et le bloc SSJS de tir est bien embarque avec la page. */
test('handler inline : drapeau ouvert, aucun jeton, bloc SSJS present', () => {
    const avant = process.env.SFMC_JOURNEY_LAUNCH;
    process.env.SFMC_JOURNEY_LAUNCH = 'true';
    try {
        delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'))];
        const { inlineSocleBlocks } = require(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'));
        const html = String(inlineSocleBlocks('%%=ContentBlockByKey("LPB_Form_Handler_AG")=%%').html);
        egal(/SET @JOURNEY_LAUNCH = "true"/.test(html), true, 'drapeau');
        egal(jetonsRestants(html).length, 0, 'jetons restants');
        egal(/==JOURNEY_FIRE_DEBUT==/.test(html) && /==JOURNEY_FIRE_FIN==/.test(html), true, 'bloc SSJS');
        egal(/RegExReplace\(/.test(html), false, 'RegExReplace n existe pas en AMPscript');
        egal(/HTTPPost2?\(/.test(html), false, 'aucun HTTPPost AMPscript (meurt sur 4xx)');
    } finally {
        if (avant === undefined) delete process.env.SFMC_JOURNEY_LAUNCH; else process.env.SFMC_JOURNEY_LAUNCH = avant;
    }
});
test('handler inline sans variable : drapeau ferme', () => {
    const avant = process.env.SFMC_JOURNEY_LAUNCH;
    delete process.env.SFMC_JOURNEY_LAUNCH;
    try {
        delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'))];
        const { inlineSocleBlocks } = require(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'));
        egal(/SET @JOURNEY_LAUNCH = "false"/.test(String(inlineSocleBlocks('%%=ContentBlockByKey("LPB_Form_Handler_AG")=%%').html)), true);
    } finally { if (avant !== undefined) process.env.SFMC_JOURNEY_LAUNCH = avant; }
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
for (const e of echecs) console.log('    ✗ ' + e);
if (echecs.length) process.exit(1);
