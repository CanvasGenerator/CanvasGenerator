/**
 * ============================================================================
 *  REMPLIR LES TROIS DE DE MAPPING D'UNE BU DE PROD
 * ============================================================================
 *  LPB_Mapping_Ecoles, LPB_Mapping_Campus et LPB_Mapping_Campagnes ont ete
 *  remplies en Recette a la main, depuis des lectures de l'org de recette
 *  (sonde LPB_TST_Campus_Resolveur, releves d'aout 2026). Leurs Ids Salesforce
 *  sont ceux de l'org de recette : ils n'existent pas en prod.
 *
 *  Ce script reprend la Recette comme GABARIT (cles, libelles, prefixes,
 *  drapeaux) et remplace chaque Id par celui de l'org de prod, lu dans les
 *  DE synchronisees de la BU cible (Synchronized Data Sources, ~15 min) :
 *
 *    LPB_Mapping_Ecoles.BusinessBrandId   <- BusinessBrand_Salesforce.Id, par Name
 *    LPB_Mapping_Campus.SchoolAccountId   <- Account_Salesforce.Id, comptes
 *         RecordTypeNameFor__c = schoolEntity dont schoolName__c = le campus
 *         ET SchoolLegalEntity__c renseigne (= « EDH School » ; vide = entite
 *         juridique, ecartee — l'org de prod n'a pas synchronise Name ni
 *         EntityType__c, ce sont ces deux colonnes qui les remplacent)
 *    LPB_Mapping_Campagnes.CampaignId     <- Campaign_Salesforce.Id : campagne
 *         ACTIVE de la marque, Type « Brochure download » (brochure) ou
 *         « Application » (candidature), zone Intl = Territory__c
 *         International ou « - INTER - » dans le nom, zone FR = Territory__c
 *         France ou « - FR - » dans le nom (repli : la campagne sans zone),
 *         saison dans le nom (--saison=2026-27).
 *
 *  Une ligne qui ne se resout pas de facon UNIQUE est ecrite avec un Id vide
 *  et Actif=false, et son motif dans la colonne Commentaire (Campus) ou dans
 *  la sortie : le socle la traite comme « inactive », il n'ecrit rien et ne
 *  meurt pas. Rien n'est devine.
 *
 *  Par defaut : SIMULATION, affiche la proposition et l'ecrit dans
 *  .lp-pages/prod/mappings-proposes.json. --push ecrit dans la BU cible
 *  (UpdateAdd : les lignes existantes de meme cle sont remplacees).
 *
 *    SFMC_ACCOUNT_ID=536009308 node -r dotenv/config scripts/remplir-mappings-prod.js --mid=536009308
 *    SFMC_ACCOUNT_ID=536009308 node -r dotenv/config scripts/remplir-mappings-prod.js --mid=536009308 --push
 *
 *  Options : --source-mid=536010339 (Recette)  --saison=2026-27
 *            --tables=ecoles,campus,campagnes  --campagnes=resoudre|copie
 *            (copie = lignes de Recette telles quelles, Ids de recette compris,
 *             forcees a Actif=false : un CampaignId inconnu de l'org fait
 *             echouer la creation du membre de campagne)
 *
 *  Garde-fou : --mid doit egaler SFMC_ACCOUNT_ID. Meme paquet API que
 *  creer-de-prod.js, un jeton par BU.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const PUSH = !!args.push;
const MID = String(process.env.SFMC_ACCOUNT_ID || '');
const SOURCE_MID = String(args['source-mid'] || '536010339');
const SAISON = String(args.saison || '2026-27');
const TABLES = String(args.tables || 'ecoles,campus,campagnes').split(',').map((t) => t.trim().toLowerCase());
const MODE_CAMPAGNES = String(args.campagnes || 'resoudre').toLowerCase();
const SUBDOMAIN = String(process.env.SFMC_SUBDOMAIN || '').replace(/^https?:\/\//, '').split('.')[0].trim();
const SORTIE = path.join(process.cwd(), '.lp-pages', 'prod');
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
/* Comparaison de noms : sans accents, en majuscules, espaces reduits.
   « ÉSEC » = « ESEC », « IFA Paris » = « IFA PARIS », « BRASSART Rennes » = « BRASSART RENNES ». */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/* ---- Client SOAP minimal, un jeton par MID -------------------------------- */
const jetons = {};
async function jeton(mid) {
    if (jetons[mid] && jetons[mid].exp > Date.now()) return jetons[mid].tok;
    const r = await fetch(`https://${SUBDOMAIN}.auth.marketingcloudapis.com/v2/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.SFMC_CLIENT_ID, client_secret: process.env.SFMC_CLIENT_SECRET, account_id: mid }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error(`jeton refuse pour la BU ${mid} : ${JSON.stringify(j).slice(0, 200)}`);
    jetons[mid] = { tok: j.access_token, exp: Date.now() + (Number(j.expires_in || 1000) - 60) * 1000 };
    return j.access_token;
}
async function soap(mid, action, inner) {
    const tok = await jeton(mid);
    const r = await fetch(`https://${SUBDOMAIN}.soap.marketingcloudapis.com/Service.asmx`, {
        method: 'POST', headers: { 'Content-Type': 'text/xml', SOAPAction: action },
        body: `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><s:Header><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body>${inner}</s:Body></s:Envelope>`,
    });
    const text = await r.text();
    return { text, statut: (text.match(/<OverallStatus>([^<]*)/) || [])[1] || '', message: (text.match(/<StatusMessage>([^<]*)/) || [])[1] || '', requestId: (text.match(/<RequestID>([^<]*)/) || [])[1] || '' };
}
const results = (text) => text.match(/<Results\b[\s\S]*?<\/Results>/g) || [];
async function lignes(mid, de, colonnes, filtre) {
    const rows = []; let reqId = null;
    do {
        const f = filtre ? `<Filter xsi:type="SimpleFilterPart"><Property>${filtre[0]}</Property><SimpleOperator>${filtre[1]}</SimpleOperator><Value>${esc(filtre[2])}</Value></Filter>` : '';
        const inner = reqId
            ? `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ContinueRequest>${reqId}</ContinueRequest><ObjectType>DataExtensionObject[${de}]</ObjectType>${colonnes.map((p) => `<Properties>${p}</Properties>`).join('')}</RetrieveRequest></RetrieveRequestMsg>`
            : `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ObjectType>DataExtensionObject[${de}]</ObjectType>${colonnes.map((p) => `<Properties>${p}</Properties>`).join('')}${f}</RetrieveRequest></RetrieveRequestMsg>`;
        const r = await soap(mid, 'Retrieve', inner);
        if (r.statut !== 'OK' && r.statut !== 'MoreDataAvailable') throw new Error(`lecture ${de} (BU ${mid}) : ${r.statut} ${r.message}`);
        for (const b of results(r.text)) { const o = {}; for (const p of b.match(/<Property>[\s\S]*?<\/Property>/g) || []) o[(p.match(/<Name>([^<]*)/) || [])[1]] = dec((p.match(/<Value>([\s\S]*?)<\/Value>/) || [])[1] || ''); rows.push(o); }
        reqId = r.statut === 'MoreDataAvailable' ? r.requestId : null;
    } while (reqId);
    return rows;
}
async function upsert(mid, de, colonnes, rows) {
    let ok = 0, ko = 0; const erreurs = [];
    for (let i = 0; i < rows.length; i += 100) {
        const lot = rows.slice(i, i + 100);
        const objets = lot.map((row) => `<Objects xsi:type="DataExtensionObject"><CustomerKey>${esc(de)}</CustomerKey><Properties>${colonnes.filter((c) => row[c] !== undefined && row[c] !== null).map((c) => `<Property><Name>${esc(c)}</Name><Value>${esc(row[c])}</Value></Property>`).join('')}</Properties></Objects>`).join('');
        const r = await soap(mid, 'Update', `<UpdateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI"><Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>${objets}</UpdateRequest>`);
        const res = results(r.text);
        for (const b of res) { if (/<StatusCode>OK<\/StatusCode>/.test(b)) ok++; else { ko++; erreurs.push((b.match(/<StatusMessage>([^<]*)/) || [])[1] || r.message); } }
        if (!res.length) { ko += lot.length; erreurs.push(r.message || r.statut); }
    }
    return { ok, ko, erreurs: [...new Set(erreurs)].slice(0, 5) };
}

/* ---- Colonnes des trois DE (sfmc-ssjs/de/LPB_DE_definitions.json) --------- */
const COLS = {
    LPB_Mapping_Ecoles:    ['Ecole', 'Libelle', 'CampusPrefix', 'SchoolAccountId', 'BusinessBrandId', 'BrandCode', 'Actif'],
    LPB_Mapping_Campus:    ['Campus', 'Ecole', 'SchoolAccountId', 'Actif', 'Commentaire'],
    LPB_Mapping_Campagnes: ['Cle', 'FormType', 'Ecole', 'Zone', 'CampaignId', 'Libelle', 'Actif'],
};
const bool = (v) => (String(v).toLowerCase() === 'true' ? 'True' : 'False');

/* ---- 1. Ecoles : la marque par son nom ------------------------------------ */
function proposerEcoles(recette, marques) {
    const parNom = new Map();
    for (const m of marques) { const k = norm(m.Name); parNom.set(k, [...(parNom.get(k) || []), m]); }
    return recette.map((r) => {
        const cands = parNom.get(norm(r.Libelle)) || [];
        const ligne = { Ecole: r.Ecole, Libelle: r.Libelle, CampusPrefix: r.CampusPrefix, SchoolAccountId: '', BusinessBrandId: '', BrandCode: r.BrandCode || '', Actif: 'False' };
        if (cands.length === 1) { ligne.BusinessBrandId = cands[0].Id; ligne.Actif = bool(r.Actif); return { ligne, etat: 'ok', detail: cands[0].Name }; }
        return { ligne, etat: cands.length ? 'AMBIGU' : 'ABSENT', detail: cands.length ? cands.map((c) => `${c.Name} ${c.Id}`).join(' ; ') : `aucune marque nommee « ${r.Libelle} »` };
    });
}

/* ---- 2. Campus : le compte EDH School par son nom ------------------------- */
function proposerCampus(recette, comptes) {
    const parNom = new Map();
    for (const c of comptes) { const k = norm(c.schoolName__c); parNom.set(k, [...(parNom.get(k) || []), c]); }
    return recette.map((r) => {
        const tous = parNom.get(norm(r.Campus)) || [];
        const edh = tous.filter((c) => c.SchoolLegalEntity__c);           // campus rattache a une entite juridique
        const legales = tous.filter((c) => !c.SchoolLegalEntity__c);      // l'entite juridique elle-meme, ecartee
        const ligne = { Campus: r.Campus, Ecole: r.Ecole, SchoolAccountId: '', Actif: 'False', Commentaire: '' };
        if (edh.length === 1) {
            ligne.SchoolAccountId = edh[0].Id; ligne.Actif = bool(r.Actif);
            ligne.Commentaire = `resolu ${AUJOURDHUI} depuis Account_Salesforce (schoolName__c)${legales.length ? ` ; ${legales.length} entite(s) juridique(s) homonyme(s) ecartee(s)` : ''}`;
            return { ligne, etat: 'ok', detail: edh[0].Id };
        }
        const etat = edh.length ? 'AMBIGU' : 'ABSENT';
        const detail = edh.length ? `${edh.length} comptes EDH School : ${edh.map((c) => c.Id).join(' ')}` : (legales.length ? `seulement une entite juridique (${legales.map((c) => c.Id).join(' ')}), aucun campus` : 'aucun compte schoolEntity de ce nom');
        ligne.Commentaire = `${etat} ${AUJOURDHUI} : ${detail}`.slice(0, 200);
        return { ligne, etat, detail };
    });
}

/* ---- 3. Campagnes : la campagne active de la marque, du type et de la zone - */
const TYPE_PAR_FORM = { brochure: 'Brochure download', candidature: 'Application' };
function proposerCampagnes(recette, campagnes, ecolesProposees) {
    const marqueParEcole = Object.fromEntries(ecolesProposees.map((e) => [e.ligne.Ecole, e.ligne.BusinessBrandId]));
    const actives = campagnes.filter((c) => c.IsActive === 'True' && c.Name.includes(SAISON));
    return recette.map((r) => {
        const ligne = { Cle: r.Cle, FormType: r.FormType, Ecole: r.Ecole, Zone: r.Zone, CampaignId: '', Libelle: r.Libelle, Actif: 'False' };
        if (MODE_CAMPAGNES === 'copie') { ligne.CampaignId = r.CampaignId; return { ligne, etat: 'copie', detail: `Id de recette ${r.CampaignId}, Actif force a false` }; }
        const marque = marqueParEcole[r.Ecole]; const type = TYPE_PAR_FORM[String(r.FormType).toLowerCase()];
        if (!marque) return { ligne, etat: 'ABSENT', detail: 'marque non resolue dans LPB_Mapping_Ecoles' };
        if (!type) return { ligne, etat: 'ABSENT', detail: `FormType « ${r.FormType} » sans type de campagne connu` };
        const deMarque = actives.filter((c) => c.Brand__c === marque && c.Type === type);
        const intl = (c) => c.Territory__c === 'International' || /\bINTER\b/i.test(c.Name);
        const fr = (c) => c.Territory__c === 'France' || /- FR -/i.test(c.Name);
        let cands, repli = '';
        if (String(r.Zone).toLowerCase() === 'intl') cands = deMarque.filter(intl);
        else { cands = deMarque.filter(fr); if (!cands.length) { cands = deMarque.filter((c) => !intl(c)); repli = ' (repli : campagne sans zone)'; } }
        if (cands.length === 1) { ligne.CampaignId = cands[0].Id; ligne.Libelle = cands[0].Name.slice(0, 120); ligne.Actif = bool(r.Actif); return { ligne, etat: 'ok', detail: cands[0].Name + repli }; }
        return { ligne, etat: cands.length ? 'AMBIGU' : 'ABSENT', detail: cands.length ? cands.map((c) => `${c.Name} ${c.Id}`).join(' ; ') : `aucune campagne active ${type} ${r.Zone} ${SAISON} pour cette marque (${deMarque.length} du type, zones : ${deMarque.map((c) => c.Territory__c || 'sans zone').join(', ') || 'aucune'})` };
    });
}

/* ---- Affichage ----------------------------------------------------------- */
function afficher(titre, cle, props) {
    const nOk = props.filter((p) => p.etat === 'ok' || p.etat === 'copie').length;
    console.log(`\n  ${titre} : ${props.length} ligne(s), ${nOk} resolue(s), ${props.length - nOk} a arbitrer`);
    for (const p of props) {
        const marque = p.etat === 'ok' ? '✓' : p.etat === 'copie' ? '=' : '✗';
        console.log(`    ${marque} ${String(p.ligne[cle]).padEnd(30)} ${(p.ligne.SchoolAccountId || p.ligne.BusinessBrandId || p.ligne.CampaignId || '(vide)').padEnd(19)} ${p.etat === 'ok' ? '' : p.etat + ' : '}${p.detail}`);
    }
}

(async () => {
    if (!MID) throw new Error('SFMC_ACCOUNT_ID absent');
    if (String(args.mid || '') !== MID) throw new Error(`--mid=${args.mid || '?'} ne correspond pas a SFMC_ACCOUNT_ID=${MID} : garde-fou, rien n'est fait`);
    if (MID === SOURCE_MID) throw new Error('la BU cible est la BU source : rien a faire');
    console.log(`\n  LP Builder — mappings de la BU ${MID} depuis le gabarit de la BU ${SOURCE_MID} ${PUSH ? '(ECRITURE)' : '(simulation, --push pour ecrire)'}`);
    console.log(`  saison des campagnes : ${SAISON} · campagnes : ${MODE_CAMPAGNES} · tables : ${TABLES.join(', ')}`);

    const [ecolesR, campusR, campagnesR] = await Promise.all([
        lignes(SOURCE_MID, 'LPB_Mapping_Ecoles', COLS.LPB_Mapping_Ecoles),
        lignes(SOURCE_MID, 'LPB_Mapping_Campus', COLS.LPB_Mapping_Campus),
        lignes(SOURCE_MID, 'LPB_Mapping_Campagnes', COLS.LPB_Mapping_Campagnes),
    ]);
    console.log(`  gabarit : ${ecolesR.length} ecoles, ${campusR.length} campus, ${campagnesR.length} campagnes`);

    const marques = await lignes(MID, 'BusinessBrand_Salesforce', ['Id', 'Name']);
    const comptes = await lignes(MID, 'Account_Salesforce', ['Id', 'schoolName__c', 'SchoolLegalEntity__c', 'Brand__c'], ['RecordTypeNameFor__c', 'equals', 'schoolEntity']);
    const campagnes = TABLES.includes('campagnes') && MODE_CAMPAGNES !== 'copie' ? await lignes(MID, 'Campaign_Salesforce', ['Id', 'Name', 'IsActive', 'Brand__c', 'Territory__c', 'Type']) : [];
    console.log(`  BU ${MID} : ${marques.length} marques, ${comptes.length} comptes schoolEntity, ${campagnes.length} campagnes lues`);

    const ecolesP = proposerEcoles(ecolesR, marques);
    const campusP = proposerCampus(campusR, comptes);
    const campagnesP = proposerCampagnes(campagnesR, campagnes, ecolesP);
    const plan = [];
    if (TABLES.includes('ecoles'))    { afficher('LPB_Mapping_Ecoles', 'Ecole', ecolesP);       plan.push(['LPB_Mapping_Ecoles', ecolesP]); }
    if (TABLES.includes('campus'))    { afficher('LPB_Mapping_Campus', 'Campus', campusP);      plan.push(['LPB_Mapping_Campus', campusP]); }
    if (TABLES.includes('campagnes')) { afficher('LPB_Mapping_Campagnes', 'Cle', campagnesP);   plan.push(['LPB_Mapping_Campagnes', campagnesP]); }

    fs.mkdirSync(SORTIE, { recursive: true });
    const fichier = path.join(SORTIE, 'mappings-proposes.json');
    fs.writeFileSync(fichier, JSON.stringify({ bu: MID, source: SOURCE_MID, date: new Date().toISOString(), tables: Object.fromEntries(plan.map(([de, props]) => [de, props.map((p) => ({ etat: p.etat, detail: p.detail, ...p.ligne }))])) }, null, 1));
    console.log(`\n  proposition ecrite dans ${fichier}`);

    const aArbitrer = plan.reduce((n, [, props]) => n + props.filter((p) => p.etat !== 'ok' && p.etat !== 'copie').length, 0);
    if (!PUSH) { console.log(`  simulation : rien ecrit${aArbitrer ? ` ; ${aArbitrer} ligne(s) partiraient avec Actif=false` : ''}\n`); return; }

    let echecs = 0;
    for (const [de, props] of plan) {
        const r = await upsert(MID, de, COLS[de], props.map((p) => p.ligne));
        console.log(`  ${de} : ${r.ok} ligne(s) ecrite(s)${r.ko ? `, ${r.ko} en echec : ${r.erreurs.join(' | ')}` : ''}`);
        echecs += r.ko;
    }
    console.log('');
    process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
