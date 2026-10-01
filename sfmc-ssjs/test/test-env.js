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
        'CampaignId', 'Campus', 'Ecole', 'Date_telechargement_brochure'];
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

/* Soumission asynchrone : drapeau ferme par defaut, et le handler porte les
   trois pieces — capture SSJS du corps brut, accuse de reception vers la
   file, solde de la ligne apres la garde d'ecriture. */
test('SFMC_ASYNC_SOUMISSION : booleen, ferme par defaut', () => {
    egal(injecterEnv('x=%%ENV:SFMC_ASYNC_SOUMISSION%%', {}), 'x=false');
    egal(injecterEnv('x=%%ENV:SFMC_ASYNC_SOUMISSION%%', { SFMC_ASYNC_SOUMISSION: 'oui' }), 'x=false');
    egal(injecterEnv('x=%%ENV:SFMC_ASYNC_SOUMISSION%%', { SFMC_ASYNC_SOUMISSION: 'TRUE' }), 'x=true');
});
test('handler inline : mode asynchrone complet, ferme sans variable', () => {
    const avant = process.env.SFMC_ASYNC_SOUMISSION;
    delete process.env.SFMC_ASYNC_SOUMISSION;
    try {
        delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'))];
        const { inlineSocleBlocks } = require(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'));
        const html = String(inlineSocleBlocks('%%=ContentBlockByKey("LPB_Form_Handler_AG")=%%').html);
        egal(/SET @ASYNC_ACTIF\s*= "false"/.test(html), true, 'drapeau ferme');
        egal(/==ASYNC_CAPTURE==/.test(html) && /Platform\.Request\.GetPostData\(\)/.test(html), true, 'capture du corps brut');
        egal(/InsertData\("LPB_File_Soumissions"/.test(html), true, 'depot dans la file');
        egal((html.match(/UpdateData\("LPB_File_Soumissions"/g) || []).length, 2, 'reservation puis solde de la ligne');
        egal(/run=%%=v\(@runId\)=%% async=%%=v\(@asyncMode\)=%% traitement=%%=v\(@PAGE_TRAITEMENT\)=%% reception-seule=(true|false) journal=/.test(html), true, 'bilan : run, mode, page de traitement et variante avant journal');
        /* La reception ne doit JAMAIS ecrire dans le CRM : aucun Create/Update
           Salesforce entre le marqueur de reception et le ELSEIF des ecritures. */
        const deb = html.indexOf('MODE ASYNCHRONE — ACCUSE DE RECEPTION');
        const fin = html.indexOf('ETAPE 1 — PERSON ACCOUNT', deb);
        egal(deb > 0 && fin > deb, true, 'bloc de reception present');
        egal(/SalesforceObject/.test(html.slice(deb, fin)), false, 'la reception n ecrit pas dans le CRM');
    } finally { if (avant !== undefined) process.env.SFMC_ASYNC_SOUMISSION = avant; }
});

/* Cache de lecture : drapeau ferme par defaut ; le socle de lecture porte la
   lecture SSJS avant les lectures CRM, l'ecriture apres, et chaque
   RetrieveSalesforceObjects est sous la garde de sa famille. */
test('SFMC_CACHE_LECTURE : booleen, ferme par defaut', () => {
    egal(injecterEnv('x=%%ENV:SFMC_CACHE_LECTURE%%', {}), 'x=false');
    egal(injecterEnv('x=%%ENV:SFMC_CACHE_LECTURE%%', { SFMC_CACHE_LECTURE: 'TRUE' }), 'x=true');
});
test('socle de lecture : cache DE complet, ferme sans variable', () => {
    const avant = process.env.SFMC_CACHE_LECTURE;
    delete process.env.SFMC_CACHE_LECTURE;
    try {
        delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'))];
        const { inlineSocleBlocks } = require(path.join(__dirname, '..', '..', 'lib', 'socle-inliner'));
        const html = String(inlineSocleBlocks('%%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%').html);
        egal(/SET @CACHE_ACTIF\s*= "false"/.test(html), true, 'drapeau ferme');
        const lire = html.indexOf('==CACHE_LECTURE_LIRE==');
        const ecrire = html.lastIndexOf('==CACHE_LECTURE_ECRIRE==');
        const premierCrm = html.indexOf('RetrieveSalesforceObjects(');
        const dernierCrm = html.lastIndexOf('RetrieveSalesforceObjects(');
        const emission = html.indexOf('window.SOCLE_DATA = {');
        egal(lire > 0 && lire < premierCrm, true, 'la lecture du cache precede la premiere lecture CRM');
        egal(ecrire > dernierCrm && ecrire < emission, true, 'l ecriture du cache suit la derniere lecture CRM et precede SOCLE_DATA');
        egal(/LookupRows\("LPB_Cache_Lecture", "Famille"/.test(html), true, 'lecture par famille');
        egal(/UpsertData\("LPB_Cache_Lecture", \["Cle"\]/.test(html), true, 'ecriture par cle');
        /* SFMC supprime les espaces de fin d'un champ texte (25/09) : chaque
           tranche part entre deux sentinelles et les perd a la relecture. */
        egal(/"~" \+ lg\.texte\.substring\(debT, Math\.min\(debT \+ 3998, lg\.texte\.length\)\) \+ "~"/.test(html), true, 'tranches ecrites entre sentinelles, 3 998 utiles');
        egal(/texte \+= morceau\.substring\(1, morceau\.length - 1\)/.test(html), true, 'sentinelles retirees a la lecture');
        /* Chaque lecture CRM du socle de lecture est sous une garde de cache :
           on remonte depuis chaque RetrieveSalesforceObjects jusqu'au dernier
           IF ouvert sur un drapeau @cache*, qui doit exister. */
        const zone = html.slice(lire, ecrire);
        const gardes = /IF @cache(Pick|Prog|Evt) (!= "hit"|== "hit")/g;
        let m, positions = [];
        while ((m = gardes.exec(zone))) positions.push(m.index);
        const appels = [...zone.matchAll(/RetrieveSalesforceObjects\(/g)].map((x) => x.index);
        egal(appels.length >= 14, true, 'au moins 14 lectures CRM attendues dans la zone');
        for (const a of appels) egal(positions.some((g) => g < a), true, 'lecture CRM hors garde de cache a ' + a);
        egal(/cache=%%=v\(@cacheEtat\)=%%/.test(html), true, 'etat du cache dans le commentaire socle ampscript');
    } finally { if (avant !== undefined) process.env.SFMC_CACHE_LECTURE = avant; }
});

/* DE synchronisees : drapeau ferme par defaut ; ouvert, le socle de lecture
   lit evenements, instances, ateliers et nom de marque dans les DE ENT.* et
   ne passe au CRM qu'en repli. */
test('SFMC_LECTURE_DE_SYNC : booleen, ferme par defaut', () => {
    egal(injecterEnv('x=%%ENV:SFMC_LECTURE_DE_SYNC%%', {}), 'x=false');
    egal(injecterEnv('x=%%ENV:SFMC_LECTURE_DE_SYNC%%', { SFMC_LECTURE_DE_SYNC: 'TRUE' }), 'x=true');
});
test('socle de lecture : evenements et marque depuis les DE synchronisees, CRM en repli', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'picklist-handler.ampscript'), 'utf8');
    const bloc = src.indexOf('==LECTURE_DE_SYNC_EVT==');
    const garde = src.indexOf('IF @cacheEvt != "hit" AND NOT Empty(@typeEvt) AND @evtDeSync != "true" THEN');
    const crm = src.indexOf('RetrieveSalesforceObjects("summit__Summit_Events_Instance__c"');
    egal(bloc > 0 && garde > bloc && crm > garde, true, 'bloc DE, puis garde, puis chemin CRM');
    for (const de of ['ENT.summit__Summit_Events__c_Salesforce_1', 'ENT.summit__Summit_Events_Instance__c_Salesforce_1', 'ENT.summit__Summit_Events_Appointment_Type__c_Salesforce', 'ENT.BusinessBrand_Salesforce']) {
        egal(src.includes('LookupRows("' + de + '"'), true, 'lecture de ' + de);
    }
    egal(/catch \(eDeSyncEvt\) \{\s*Variable\.SetValue\("@evtDeSync", "false"\)/.test(src), true, 'en erreur, le chemin CRM reprend');
    egal(src.includes('IF @bbDeSync != "true" THEN'), true, 'marque : CRM en repli');
    egal(src.includes('desync=%%=v(@deSyncEtat)=%%'), true, 'etat dans le commentaire socle ampscript');
});
/* 30/09 : programmes, campus, PTAT et rentrees depuis les trois DE partagees
   par la synchro (LearningProgram_Salesforce_1, ProgramTermApplnTimeline_Salesforce,
   AcademicTerm_Salesforce), par LookupRows seulement ; la famille prog sort
   du cache quand la DE la sert ; le cache picklists porte la date du jour. */
test('socle de lecture : programmes, PTAT et rentrees depuis les DE synchronisees, cache prog exclu, cache picklists au jour', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'picklist-handler.ampscript'), 'utf8');
    const reset = src.indexOf('IF @cacheProg != "hit" THEN\nSET @jsProgs   = ""');
    const bloc = src.indexOf('/* ==LECTURE_DE_SYNC_PROG==');
    const garde = src.indexOf('IF @cacheProg != "hit" AND @progDeSync != "true" AND Length(@prefixUp) > 0 AND Lowercase(@actif) == "true" THEN');
    const crm = src.indexOf('RetrieveSalesforceObjects("ProgramTermApplnTimeline"');
    egal(reset > 0 && bloc > reset && garde > bloc && crm > garde, true, 'remise a zero, bloc DE, garde, puis chemin CRM');
    for (const de of ['ENT.AcademicTerm_Salesforce', 'ENT.ProgramTermApplnTimeline_Salesforce', 'ENT.LearningProgram_Salesforce_1']) {
        egal(src.includes('LookupRows("' + de + '"'), true, 'lecture de ' + de);
    }
    egal(src.includes('LookupRows("ENT.AcademicTerm_Salesforce", "IsActive", "True")'), true, 'seules les rentrees actives');
    egal(src.includes('LookupRows("ENT.LearningProgram_Salesforce_1", "IsActive", "False")'), true, 'programmes inactifs lus aussi, comme le CRM');
    egal(/if \(candDe && !ptatProgDe\[pidDe\]\) continue;\s*if \(candDe && !String\(pDe\.Speciality__c \|\| ""\)\.length\) continue;/.test(src), true, 'candidature : ni programme sans PTAT ni sans specialite');
    egal(/catch \(eDeSyncProg\) \{\s*Variable\.SetValue\("@progDeSync", "false"\)/.test(src), true, 'en erreur, le chemin CRM reprend');
    egal(src.includes('if (fam.tag == "prog" && deSyncActif) { etats.push("prog:de-sync"); continue; }'), true, 'famille prog hors cache quand la DE la sert');
    egal(src.includes('if (famE.tag == "prog" && String(Variable.GetValue("@progDeSync")) == "true") continue;'), true, 'famille prog non ecrite quand la DE la sert');
    egal(src.includes('SET @clePick   = Concat("picklists|", @d0)'), true, 'cle picklists au jour');
    egal((src.match(/famille: String\(Variable\.GetValue\("@clePick"\) \|\| ""\)/g) || []).length, 2, 'cle du jour a la lecture et a l ecriture');
    egal(/DeleteData\("LPB_Cache_Lecture", \["Famille"\], \[String\(Variable\.GetValue\("@clePickJ" \+ pj\) \|\| ""\)\]\)/.test(src), true, 'purge des trois jours precedents');
});

/* Page de traitement dediee : la cle est injectee a la publication, le
   handler l'annonce dans son marqueur et l'ecrit comme Url de rejeu. */
test('SFMC_PAGE_TRAITEMENT : chaine libre, vide par defaut', () => {
    egal(injecterEnv('x=%%ENV:SFMC_PAGE_TRAITEMENT%%', {}), 'x=');
    egal(injecterEnv('x=%%ENV:SFMC_PAGE_TRAITEMENT%%', { SFMC_PAGE_TRAITEMENT: 'Interne_TRAITEMENT_V0' }), 'x=Interne_TRAITEMENT_V0');
});
test('handler : page de traitement annoncee, Url de rejeu, refus des soumissions directes', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'handler-form.ampscript'), 'utf8');
    egal(src.includes('SET @PAGE_TRAITEMENT = "%%ENV:SFMC_PAGE_TRAITEMENT%%"'), true, 'drapeau lu');
    egal(src.includes('traitement=%%=v(@PAGE_TRAITEMENT)=%%'), true, 'annonce dans le marqueur socle ecriture');
    egal(src.includes('"Url", @urlTraitement,'), true, 'la file porte l URL de traitement');
    egal(/IF NOT Empty\(@PAGE_TRAITEMENT\) AND RequestParameter\("id"\) == @PAGE_TRAITEMENT AND @modeTraitement != "1" THEN\s*SET @sfStatus\s*= "error"/.test(src), true, 'soumission directe refusee sur la page de traitement');
    egal(src.includes('IF @sfStatus != "blocked" AND @sfStatus != "error" AND @ASYNC_ACTIF == "true" AND @modeTraitement != "1" THEN'), true, 'le refus n entre pas en reception');
});

/* 01/10 : avec une page de traitement dediee, la page du visiteur publie le
   handler sans ses regions de traitement (ecriture CRM, journey, file). */
test('handler : variante reception seule sur la page du visiteur, handler complet sur la page de traitement', () => {
    const avant = { r: process.env.SFMC_SOCLE_RECEPTION_SEULE, t: process.env.SFMC_PAGE_TRAITEMENT, d: process.env.SFMC_SOCLE_DEPOUILLE };
    const inliner = path.join(__dirname, '..', '..', 'lib', 'socle-inliner');
    const rendre = (receptionSeule) => {
        process.env.SFMC_SOCLE_RECEPTION_SEULE = receptionSeule ? 'true' : 'false';
        process.env.SFMC_PAGE_TRAITEMENT = 'Test_TRAITEMENT_V0';
        process.env.SFMC_SOCLE_DEPOUILLE = 'true';
        delete require.cache[require.resolve(inliner)];
        return String(require(inliner).inlineSocleBlocks('%%=ContentBlockByKey("LPB_Form_Handler_AG")=%%').html);
    };
    const equilibre = (html) => (html.match(/\bIF\b/g) || []).length === (html.match(/\bENDIF\b/g) || []).length;
    try {
        const complet = rendre(false), reception = rendre(true);
        egal(complet.includes('CreateSalesforceObject(') && complet.includes('==JOURNEY_FIRE_DEBUT==') && complet.includes('"Statut", @fileStatut'), true, 'page de traitement : handler complet');
        egal(complet.includes('reception-seule=false'), true, 'marqueur complet');
        egal(reception.includes('CreateSalesforceObject(') || reception.includes('==JOURNEY_FIRE_DEBUT==') || reception.includes('"Statut", @fileStatut') || reception.includes('RetrieveSalesforceObjects("ContactPointConsent"'), false, 'page du visiteur : ni ecriture CRM, ni journey, ni file');
        egal(reception.includes('InsertData("LPB_File_Soumissions"') && reception.includes('socle ecriture: statut=') && reception.includes('RetrieveSalesforceObjects("Account", "Id,PersonContactId",'), true, 'page du visiteur : mise en file, marqueur, regles de blocage conserves');
        egal(reception.includes('reception-seule=true'), true, 'marqueur reception seule');
        egal(equilibre(complet) && equilibre(reception), true, 'IF / ENDIF equilibres dans les deux variantes');
        egal(reception.length < complet.length * 0.6, true, 'variante reception au moins 40 % plus legere (' + reception.length + ' / ' + complet.length + ')');
    } finally {
        for (const [k, v] of [['SFMC_SOCLE_RECEPTION_SEULE', avant.r], ['SFMC_PAGE_TRAITEMENT', avant.t], ['SFMC_SOCLE_DEPOUILLE', avant.d]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
        delete require.cache[require.resolve(inliner)];
    }
});

/* 01/10 : reabonnement SFMC (niveau BU) avant le tir de l'API Event, quand
   la case Email est cochee sur un compte deja connu. */
test('handler : reabonnement SFMC du Subscriber avant le tir de journey', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'handler-form.ampscript'), 'utf8');
    egal(src.includes('VAR @reaboEmail\nSET @reaboEmail     = ""'), true, 'drapeau declare et vide');
    egal(/CPC:", @canalValue, "-inchange"\)\s*ENDIF\s*(\/\*[\s\S]*?\*\/\s*)?IF @canalValue == "Email" THEN SET @reaboEmail = "1" ENDIF/.test(src), true, 'leve apres la mise a jour du consentement, quel que soit le sous-cas');
    egal(/CPC:", @canalValue, "-cree"\)\s*(\/\*[\s\S]*?\*\/\s*)?IF @canalValue == "Email" AND @isNew != "true" THEN SET @reaboEmail = "1" ENDIF/.test(src), true, 'leve a la creation d un consentement sur un compte connu seulement');
    const debut = src.indexOf('==JOURNEY_FIRE_DEBUT=='), reabo = src.indexOf('==REABONNEMENT=='), tir = src.indexOf('var jrnLaunch  = String(Variable.GetValue("@JOURNEY_LAUNCH")'), fin = src.indexOf('==JOURNEY_FIRE_FIN==');
    egal(debut > 0 && reabo > debut && tir > reabo && fin > tir, true, 'bloc de reabonnement dans le bloc journey, avant le tir');
    egal(src.includes('new Script.Util.WSProxy().updateItem("Subscriber", rbSub)') && src.includes('Lookup("LPB_Config_Api", "Valeur", "Cle", "AccountId")') && src.includes('"98 - reabonnement"'), true, 'updateItem Subscriber, MID de LPB_Config_Api, ligne 98 du journal');
});

/* 01/10 : un opt-out en attente dans Journey_OptOut_Entry_DE (file de
   l'automation de desabonnement, cle ConsentId) est leve quand la personne
   recoche le canal : l'opt-in est plus recent, la journey ne doit pas repasser
   le CRM en Opt-out. Suppression par cle exacte, jamais par SubscriberKey. */
test('handler : purge de l opt-out en attente quand le consentement repasse Opt-in', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'handler-form.ampscript'), 'utf8');
    egal(src.includes('VAR @optoutCpcIds\nSET @optoutCpcIds   = ""'), true, 'liste declaree et vide');
    egal(/IF @canalValue == "Email" THEN SET @reaboEmail = "1" ENDIF\s*(\/\*[\s\S]*?\*\/\s*)?IF NOT Empty\(@cpcId\) THEN SET @optoutCpcIds = Concat\(@optoutCpcIds, @cpcId, ","\) ENDIF/.test(src), true, 'l Id du consentement existant est collecte, tout canal, juste apres le drapeau de reabonnement');
    egal(/CPC:", @canalValue, "-cree"\)[\s\S]{0,600}?ENDIF/.test(src) && !/CPC:", @canalValue, "-cree"\)[\s\S]{0,600}?@optoutCpcIds/.test(src), true, 'un consentement tout juste cree n est pas collecte');
    const debut = src.indexOf('==JOURNEY_FIRE_DEBUT=='), purge = src.indexOf('==OPTOUT_PURGE=='), reabo = src.indexOf('==REABONNEMENT=='), fin = src.indexOf('==JOURNEY_FIRE_FIN==');
    egal(debut > 0 && purge > debut && reabo > purge && fin > reabo, true, 'bloc de purge dans le bloc journey, avant le reabonnement');
    egal(src.includes('Platform.Function.LookupRows("Journey_OptOut_Entry_DE", "ConsentId", opId)') && src.includes('Platform.Function.DeleteData("Journey_OptOut_Entry_DE", ["ConsentId"], [opId])'), true, 'lecture puis suppression par ConsentId exact');
    egal(/DeleteData\("Journey_OptOut_Entry_DE", \["SubscriberKey"/.test(src), false, 'jamais de suppression par SubscriberKey');
    egal(src.includes('"97 - optout-purge"') && src.includes('" OPTOUT:purge("') && src.includes('" OPTOUT:aucun"'), true, 'ligne 97 et marques du journal');
    const bloc = src.slice(purge, reabo);
    egal(/\/\^\\s\+\|\\s\+\$\/g/.test(bloc), false, 'pas de regex de trim dans le bloc (Jint)');
});

/* Compte existant : l'update du compte part APRES les consentements. Poser
   PTAT_Id__c avant declenchait cote CRM un tampon de date d'engagement sur les
   consentements, que notre update suivant ne pouvait plus « faire progresser »
   (trigger CRM) : page morte intermittente en recette, 24/09. */
test('handler : l update du compte existant suit le bloc consentement', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'handler-form.ampscript'), 'utf8');
    const maj = src.indexOf('"40 - maj compte terminee"');
    const consent = src.indexOf('"60 - consentement"');
    const etape3 = src.indexOf('ETAPE 3a');
    egal(maj > 0 && consent > 0 && etape3 > 0, true, 'marqueurs presents');
    egal(consent < maj && maj < etape3, true, 'ordre attendu : 60 - consentement, puis 40 - maj compte, puis etape 3a');
    /* Essai du 24/09 : en UPDATE, seul le statut part — la date d'engagement
       est posee par le CRM lui-meme, et son trigger refuse toute regression. */
    const zoneCpc = src.slice(src.indexOf('FOR @i = 1 TO 5 DO'), src.indexOf('ETAPE 3a'));
    const updates = [...zoneCpc.matchAll(/(ELSEIF @formType == "brochure" THEN|IF Field\(@cpcRow, "Status__c"\) != "Opt-in" THEN)\s*SET @n = UpdateSingleSalesforceObject\("ContactPointConsent", @cpcId,([\s\S]*?)\)/g)].map((m) => [m[1], m[2]]);
    egal(updates.length, 2, 'deux updates de consentement : statut qui change, et brochure');
    egal(updates.every(([, args]) => /LastMarketingEngagementDate__c/.test(args) && /@cpcHorodatageUtc/.test(args)), true, 'la date part avec le statut et sur la brochure, calculee au plus tard');
    egal(/ELSE\s*SET @journal = Concat\(@journal, " CPC:", @canalValue, "-inchange"\)/.test(zoneCpc), true, 'hors brochure et sans changement de statut : aucun update');
});

/* Date de consentement cookies : Axeptio via la CloudPage envoie
   « AAAA-MM-JJ HH:MM:SS » ; le CRM n'accepte que l'ISO UTC avec Z et un format
   refuse tue la page — toute deuxieme soumission plantait (25/09). */
test('handler : la date de consentement cookies est normalisee en ISO UTC avant l update', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'socle', 'handler-form.ampscript'), 'utf8');
    const lecture = src.indexOf('SET @dateCookies = RequestParameter("date_consentement_cookies")');
    const ecriture = src.indexOf('UpdateSingleSalesforceObject("Account", @paId, "DateConsentementCookies__c", @dateCookies)');
    egal(lecture > 0 && ecriture > lecture, true, 'lecture puis ecriture');
    const zone = src.slice(lecture, ecriture);
    egal(/RegExMatch\(@dateCookies, "\^\\d\{4\}-\\d\{2\}-\\d\{2\}\[ T\]\\d\{2\}:\\d\{2\}:\\d\{2\}\$", 0\)/.test(zone), true, 'le format avec espace est reconnu');
    egal(/Concat\(Substring\(@dateCookies, 1, 10\), "T", Substring\(@dateCookies, 12, 8\), "Z"\)/.test(zone), true, 'et converti en ISO UTC avec Z');
    egal(/ELSE\s*SET @journal = Concat\(@journal, " COOKIES:date-ignoree"\)\s*SET @dateCookies = ""/.test(zone), true, 'un format inconnu n est pas ecrit et se journalise');
    egal((src.match(/"DateConsentementCookies__c", @dateCookies\)/g) || []).length, 1, 'une seule ecriture du champ');
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
for (const e of echecs) console.log('    ✗ ' + e);
if (echecs.length) process.exit(1);
