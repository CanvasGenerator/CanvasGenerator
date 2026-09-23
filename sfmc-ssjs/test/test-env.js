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
test('SFMC_LOG_DETAIL : booleen, ferme par defaut', () => {
    egal(injecterEnv('x=%%ENV:SFMC_LOG_DETAIL%%', {}), 'x=false');
    egal(injecterEnv('x=%%ENV:SFMC_LOG_DETAIL%%', { SFMC_LOG_DETAIL: 'oui' }), 'x=false');
    egal(injecterEnv('x=%%ENV:SFMC_LOG_DETAIL%%', { SFMC_LOG_DETAIL: ' True ' }), 'x=true');
});
test('handler inline : niveau de journal pose, lignes « avant » gardees', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'))];
    const { inlineSocleBlocks } = require(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'));
    const html = String(inlineSocleBlocks('%%=ContentBlockByKey("LPB_Form_Handler_AG")=%%').html);
    egal(/SET @LOG_DETAIL = "(true|false)"/.test(html), true, 'drapeau pose');
    const gardes = (html.match(/IF @LOG_ACTIF == "true" AND @LOG_DETAIL == "true" THEN/g) || []).length;
    egal(gardes, 7, 'sept lignes de detail gardees');
    egal(/"Etape", "99 - fin"/.test(html), true, 'la fin reste journalisee');
});
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
        egal(/var evtBody = ascii\(/.test(html) && /\[\\u0080-\\uffff\]/.test(html), true, 'corps de l evenement echappe en ASCII (accents)');
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

/* Le bloc des listes se tait sur un POST envoye par fetch (piste 1 du 14/09) :
   le garde ouvre le bloc, le referme APRES le JS de cascade, et le JS envoie
   bien le parametre qui le declenche. Un ENDIF perdu par la synchro du JS
   rendrait la page morte : on le verifie a chaque passage. */
test('listes inline : garde socle_fetch ouvert en tete, ferme apres la cascade, parametre envoye', () => {
    delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'))];
    const { inlineSocleBlocks } = require(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'));
    const html = String(inlineSocleBlocks('%%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%').html);
    const garde = html.indexOf('IF @socleFetch != "1" THEN');
    const premiereLecture = html.indexOf('RetrieveSalesforceObjects(');
    const finCascade = html.indexOf('<!-- ===== fin JS DE CASCADE ===== -->');
    const fermeture = html.lastIndexOf('%%[ ENDIF ]%%');
    egal(garde > 0 && garde < premiereLecture, true, 'garde avant la premiere lecture Salesforce');
    egal(finCascade > 0 && fermeture > finCascade, true, 'ENDIF apres la fin du JS de cascade');
    egal(/RequestParameter\("socle_fetch"\)/.test(html), true, 'parametre lu');
    egal(/corps\.push\('socle_fetch=1'\)/.test(html), true, 'parametre envoye par le JS');
});

/* Les deux entrees de journey (API Event) : chaque colonne du corps JSON doit
   exister dans la DE d'entree, sinon SFMC refuse l'evenement ENTIER. Les
   listes ci-dessous sont les DE relues le 18/09 (Data_contacts_evenement_new,
   Post_Demande_De_Doc_Target) ; une colonne ajoutee au handler sans exister
   dans la DE casse ce test avant de casser la production. */
test('journeys : les colonnes des deux corps JSON sont celles des DE d entree', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(path.join(__dirname, '..', 'socle', 'handler-form.ampscript'), 'utf8');
    const corps = [...src.matchAll(/SET @jrnData = Concat\(([\s\S]*?)\)\n/g)]
        .map((m) => [...m[1].matchAll(/'"([A-Za-z0-9_]+)":"'/g)].map((c) => c[1]));
    egal(corps.length, 2, 'deux corps JSON (evenement, brochure)');
    /* BrandCode : colonne relue le 22/09 sur les trois DE evenement (reelle,
       _TEST, _TEST_LP), Text 50. Demande du 22/09 pour les splits. */
    const evenement = ['Subscriberkey', 'ID_salesforce', 'FirstName', 'LastName', 'PersonEmail', 'MobileNumber',
        'PreferredLangage', 'SMSLocale', 'LivingCountry', 'BusinessBrandName', 'BrandCode', 'schoolName', 'EventType',
        'summit__Event_Instance', 'summit__Instance_Start_Date', 'summit__Instance_End_Date',
        'SummitEventRegistrationId', 'Nom_action', 'Date_action', 'campusNameFor'];
    /* Brochure : BrandCode relu le 23/09 sur Post_Demande_De_Doc_Target (18
       colonnes) et sur la copie sans cle. */
    const brochure = ['Id', 'PersonContactId', 'FirstName', 'LastName', 'PersonEmail', 'MobileE164Auto', 'MobileNumber',
        'Schoolname', 'Academic_Level_List', 'LivingCountry', 'Brand', 'BrandCode', 'PreferredLangage', 'SMSLocale', 'WhatsAppLocale',
        'CampaignId', 'Campus', 'Ecole'];
    egal(corps[0].join(','), evenement.join(','), 'colonnes Data_contacts_evenement_new');
    egal(corps[1].join(','), brochure.join(','), 'colonnes Post_Demande_De_Doc_Target');
    /* Vocabulaire des splits, releve sur les journeys le 18/09. */
    for (const v of ['Open House', 'Discovery Workshop', 'Internship', 'Immersion Day']) egal(src.includes('=' + v + '|'), true, 'type Summit ' + v);
    for (const v of ['ESEC', 'Ecole Bleue', '3W Academy', 'IFA Paris', 'MoPA']) egal(src.includes('=' + v + '|'), true, 'marque ' + v);
    /* BrandCode : la regle du client (CASE du 22/09) — codes sans espaces ni
       accents, VIDE si la marque manque, ? si elle est inconnue. */
    for (const v of ['Ecole_Bleue', 'IFA_Paris', '3WA', 'MOPA']) egal(src.includes('=' + v + '|'), true, 'code ' + v);
    egal(src.includes('SET @jrnBrandCode = "VIDE"'), true, 'BrandCode VIDE si marque vide');
    egal(src.includes('SET @jrnBrandCode = "?"'), true, 'BrandCode ? si marque inconnue');
    egal(src.includes('"MobileE164Auto":"\', @jrnTel,'), false, 'le champ Phone de l evenement s appelle MobileNumber');
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
for (const e of echecs) console.log('    ✗ ' + e);
if (echecs.length) process.exit(1);
