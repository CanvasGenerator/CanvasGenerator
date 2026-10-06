#!/usr/bin/env node
'use strict';
/**
 * ============================================================================
 *  CREE LE DOSSIER ET LES DATA EXTENSIONS DU LP BUILDER DANS UNE BU (PROD)
 * ============================================================================
 *  Source de verite : sfmc-ssjs/de/LPB_DE_definitions.json (relevee sur la
 *  BU de recette). Dans la BU cible, sous le dossier « LP_Builder » du
 *  dossier racine « Data Extensions », le script cree quatre sous-dossiers
 *  et les 13 DE du processus, noms et cles externes identiques (Cle == Nom),
 *  toutes non sendable, memes champs (type, longueur, cle primaire, requis,
 *  valeur par defaut). IDEMPOTENT : dossier ou DE deja present = rien touche.
 *
 *  Puis, avec --copier-config, recopie les LIGNES des tables de configuration
 *  pure (niveaux, indicatifs, config formulaires, champs ecole, conditions,
 *  dictionnaire) depuis la BU source : elles ne portent aucun Id Salesforce.
 *  Les mappings (ecoles, campus, campagnes), LPB_Config_Api et les tables
 *  techniques restent VIDES : Ids et secrets de prod a renseigner a la main
 *  (voir PASSAGE-EN-PROD.md §2).
 *
 *  Garde-fou : --mid=<MID cible> doit etre egal a SFMC_ACCOUNT_ID, et --push
 *  est requis pour ecrire ; sans lui, simulation. La BU source des lignes est
 *  --source-mid (defaut 536010339, RECETTE), meme paquet API.
 *
 *  Usage :
 *    SFMC_ACCOUNT_ID=536009308 node -r dotenv/config scripts/creer-de-prod.js --mid=536009308
 *    SFMC_ACCOUNT_ID=536009308 node -r dotenv/config scripts/creer-de-prod.js --mid=536009308 --push
 *    SFMC_ACCOUNT_ID=536009308 node -r dotenv/config scripts/creer-de-prod.js --mid=536009308 --push --copier-config
 *    node -r dotenv/config scripts/creer-de-prod.js --relever   # regenere le JSON depuis la BU courante
 * ============================================================================
 */
const fs = require('node:fs');
const path = require('node:path');

const DEFS_PATH = path.join(__dirname, '..', 'sfmc-ssjs', 'de', 'LPB_DE_definitions.json');
const RACINE = 'Data Extensions';
const DOSSIER_PARENT = 'LP_Builder';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const PUSH = !!args.push;
const MID = String(process.env.SFMC_ACCOUNT_ID || '');
const SOURCE_MID = String(args['source-mid'] || '536010339');
const SUBDOMAIN = String(process.env.SFMC_SUBDOMAIN || '').replace(/^https?:\/\//, '').split('.')[0].trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/* ---- Client SOAP minimal, un jeton par MID (le paquet API du .env) ------- */
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
const prop = (b, t) => dec((b.match(new RegExp('<' + t + '>([^<]*)')) || [])[1] || '');
async function retrieve(mid, objet, props, filtre) {
    const inner = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ObjectType>${objet}</ObjectType>${props.map((p) => `<Properties>${p}</Properties>`).join('')}${filtre ? `<Filter xsi:type="SimpleFilterPart"><Property>${filtre[0]}</Property><SimpleOperator>${filtre[1]}</SimpleOperator><Value>${esc(filtre[2])}</Value></Filter>` : ''}</RetrieveRequest></RetrieveRequestMsg>`;
    const r = await soap(mid, 'Retrieve', inner);
    if (r.statut !== 'OK' && r.statut !== 'MoreDataAvailable') throw new Error(`lecture ${objet} (BU ${mid}) : ${r.statut} ${r.message}`);
    return r;
}
async function lignes(mid, de, colonnes) {
    const rows = []; let reqId = null;
    do {
        const inner = reqId
            ? `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ContinueRequest>${reqId}</ContinueRequest><ObjectType>DataExtensionObject[${de}]</ObjectType>${colonnes.map((p) => `<Properties>${p}</Properties>`).join('')}</RetrieveRequest></RetrieveRequestMsg>`
            : `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ObjectType>DataExtensionObject[${de}]</ObjectType>${colonnes.map((p) => `<Properties>${p}</Properties>`).join('')}</RetrieveRequest></RetrieveRequestMsg>`;
        const r = await soap(mid, 'Retrieve', inner);
        if (r.statut !== 'OK' && r.statut !== 'MoreDataAvailable') throw new Error(`lecture ${de} (BU ${mid}) : ${r.statut} ${r.message}`);
        for (const b of results(r.text)) { const o = {}; for (const p of b.match(/<Property>[\s\S]*?<\/Property>/g) || []) o[prop(p, 'Name')] = dec((p.match(/<Value>([\s\S]*?)<\/Value>/) || [])[1] || ''); rows.push(o); }
        reqId = r.statut === 'MoreDataAvailable' ? r.requestId : null;
    } while (reqId);
    return rows;
}

/* ---- Relever les definitions depuis la BU courante (maintenance) --------- */
async function relever(defs) {
    for (const nom of Object.keys(defs.de)) {
        const r = await retrieve(MID, 'DataExtensionField', ['Name', 'FieldType', 'MaxLength', 'IsPrimaryKey', 'IsRequired', 'Ordinal', 'DefaultValue', 'Scale'], ['DataExtension.CustomerKey', 'equals', nom]);
        const champs = results(r.text).map((b) => ({ nom: prop(b, 'Name'), type: prop(b, 'FieldType'), longueur: prop(b, 'MaxLength') ? Number(prop(b, 'MaxLength')) : undefined, pk: prop(b, 'IsPrimaryKey') === 'true' || undefined, requis: prop(b, 'IsRequired') === 'true' || undefined, defaut: prop(b, 'DefaultValue') || undefined, scale: prop(b, 'Scale') && prop(b, 'Scale') !== '0' ? Number(prop(b, 'Scale')) : undefined, ordinal: Number(prop(b, 'Ordinal')) }))
            .sort((a, b) => a.ordinal - b.ordinal).map(({ ordinal, ...c }) => c);
        if (!champs.length) throw new Error(`${nom} : aucun champ lu sur la BU ${MID}`);
        defs.de[nom] = { champs };
        console.log(`  ${nom.padEnd(26)} ${champs.length} champs`);
    }
    fs.writeFileSync(DEFS_PATH, JSON.stringify(defs, null, 1));
    console.log(`  ✓ ${DEFS_PATH} regenere depuis la BU ${MID}`);
}

/* ---- Dossiers ----------------------------------------------------------- */
async function dossiers(mid) {
    const r = await retrieve(mid, 'DataFolder', ['ID', 'Name', 'ParentFolder.ID'], ['ContentType', 'equals', 'dataextension']);
    return results(r.text).map((b) => ({ id: Number(prop(b, 'ID')), nom: prop(b, 'Name'), parent: Number((b.match(/<ParentFolder>[\s\S]*?<ID>([^<]*)/) || [])[1] || 0) }));
}
async function creerDossier(mid, nom, parentId) {
    const r = await soap(mid, 'Create', `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI"><Objects xsi:type="DataFolder"><Name>${esc(nom)}</Name><Description>${esc('LP Builder — ' + nom)}</Description><ContentType>dataextension</ContentType><IsActive>true</IsActive><IsEditable>true</IsEditable><AllowChildren>true</AllowChildren><ParentFolder><ID>${parentId}</ID></ParentFolder></Objects></CreateRequest>`);
    if (r.statut !== 'OK') throw new Error(`dossier « ${nom} » refuse : ${r.statut} ${r.message}`);
    return Number((r.text.match(/<NewID>(\d+)/) || [])[1] || 0);
}

/* ---- DE ----------------------------------------------------------------- */
function champXml(c) {
    return `<Field><CustomerKey>${esc(c.nom)}</CustomerKey><Name>${esc(c.nom)}</Name><FieldType>${c.type}</FieldType>`
        + (c.longueur ? `<MaxLength>${c.longueur}</MaxLength>` : '')
        + (c.scale ? `<Scale>${c.scale}</Scale>` : '')
        + (c.pk ? '<IsPrimaryKey>true</IsPrimaryKey>' : '')
        + `<IsRequired>${c.requis || c.pk ? 'true' : 'false'}</IsRequired>`
        + (c.defaut !== undefined && c.defaut !== '' ? `<DefaultValue>${esc(c.defaut)}</DefaultValue>` : '')
        + '</Field>';
}
async function creerDe(mid, nom, def, categorie) {
    const r = await soap(mid, 'Create', `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI"><Objects xsi:type="DataExtension"><CustomerKey>${esc(nom)}</CustomerKey><Name>${esc(nom)}</Name><Description>${esc('LP Builder — voir PASSAGE-EN-PROD.md §2')}</Description><CategoryID>${categorie}</CategoryID><IsSendable>false</IsSendable><Fields>${def.champs.map(champXml).join('')}</Fields></Objects></CreateRequest>`);
    if (r.statut !== 'OK') throw new Error(`DE « ${nom} » refusee : ${r.statut} ${r.message}`);
    const relu = await retrieve(mid, 'DataExtensionField', ['Name'], ['DataExtension.CustomerKey', 'equals', nom]);
    const noms = results(relu.text).map((b) => prop(b, 'Name'));
    const manquants = def.champs.map((c) => c.nom).filter((n) => !noms.includes(n));
    if (manquants.length) throw new Error(`${nom} : champs absents apres creation : ${manquants.join(', ')}`);
    return noms.length;
}

/* ---- Copie des lignes de configuration ---------------------------------- */
async function copier(nom, def) {
    const colonnes = def.champs.map((c) => c.nom);
    const rows = await lignes(SOURCE_MID, nom, colonnes);
    if (!rows.length) { console.log(`    ${nom} : 0 ligne en source, rien a copier`); return 0; }
    let ok = 0, ko = 0;
    for (let i = 0; i < rows.length; i += 100) {
        const lot = rows.slice(i, i + 100);
        const objets = lot.map((row) => `<Objects xsi:type="DataExtensionObject"><CustomerKey>${esc(nom)}</CustomerKey><Properties>${colonnes.filter((c) => row[c] !== undefined && row[c] !== '').map((c) => `<Property><Name>${esc(c)}</Name><Value>${esc(row[c])}</Value></Property>`).join('')}</Properties></Objects>`).join('');
        const r = await soap(MID, 'Update', `<UpdateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI"><Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>${objets}</UpdateRequest>`);
        for (const b of results(r.text)) (/<StatusCode>OK<\/StatusCode>/.test(b) ? ok++ : ko++);
        if (!results(r.text).length) ko += lot.length;
    }
    console.log(`    ${nom} : ${ok} ligne(s) copiee(s) depuis la BU ${SOURCE_MID}${ko ? `, ${ko} en echec` : ''}`);
    return ko;
}

(async () => {
    const defs = JSON.parse(fs.readFileSync(DEFS_PATH, 'utf8'));
    if (args.relever) { await relever(defs); return; }
    if (!MID) throw new Error('SFMC_ACCOUNT_ID absent');
    if (String(args.mid || '') !== MID) throw new Error(`--mid=${args.mid || '?'} ne correspond pas a SFMC_ACCOUNT_ID=${MID} : garde-fou, rien n'est fait`);
    console.log(`\n  LP Builder — Data Extensions dans la BU ${MID} ${PUSH ? '(ECRITURE)' : '(simulation, --push pour ecrire)'}`);

    const tous = await dossiers(MID);
    const racine = tous.find((d) => d.nom === RACINE && d.parent === 0);
    if (!racine) throw new Error(`dossier racine « ${RACINE} » introuvable dans la BU ${MID}`);
    let parent = tous.find((d) => d.nom === DOSSIER_PARENT && d.parent === racine.id);
    if (parent) console.log(`  dossier ${DOSSIER_PARENT} : existe (id ${parent.id})`);
    else if (PUSH) { parent = { id: await creerDossier(MID, DOSSIER_PARENT, racine.id), nom: DOSSIER_PARENT }; console.log(`  dossier ${DOSSIER_PARENT} : cree (id ${parent.id})`); }
    else console.log(`  dossier ${DOSSIER_PARENT} : a creer sous « ${RACINE} » (${racine.id})`);

    const existantes = results((await retrieve(MID, 'DataExtension', ['Name', 'CustomerKey', 'CategoryID'], ['Name', 'like', 'LPB_%'])).text).map((b) => ({ nom: prop(b, 'Name'), cat: Number(prop(b, 'CategoryID')) }));
    let creees = 0, presentes = 0, echecs = 0;
    for (const [sousDossier, noms] of Object.entries(defs.dossiers)) {
        let cat = parent ? tous.find((d) => d.nom === sousDossier && d.parent === parent.id) : null;
        if (cat) console.log(`\n  ${sousDossier} : existe (id ${cat.id})`);
        else if (PUSH && parent) { cat = { id: await creerDossier(MID, sousDossier, parent.id) }; console.log(`\n  ${sousDossier} : cree (id ${cat.id})`); }
        else console.log(`\n  ${sousDossier} : a creer`);
        for (const nom of noms) {
            const def = defs.de[nom];
            if (!def) { console.log(`    ✗ ${nom} : pas de definition`); echecs++; continue; }
            const ex = existantes.find((e) => e.nom === nom);
            if (ex) { console.log(`    = ${nom} : existe deja (dossier ${ex.cat}), rien touche`); presentes++; continue; }
            if (!PUSH) { console.log(`    + ${nom} : a creer, ${def.champs.length} champs (${def.champs.filter((c) => c.pk).map((c) => c.nom).join(', ')} en cle)`); continue; }
            try { const n = await creerDe(MID, nom, def, cat.id); console.log(`    ✓ ${nom} : creee, ${n} champs relus`); creees++; }
            catch (e) { console.log(`    ✗ ${nom} : ${e.message}`); echecs++; }
        }
    }
    console.log(`\n  bilan : ${creees} creee(s), ${presentes} deja presente(s), ${echecs} echec(s)`);
    if (args['copier-config']) {
        if (!PUSH) console.log('  copie des lignes de configuration : simulation, rien copie');
        else { console.log(`\n  copie des lignes de configuration depuis la BU ${SOURCE_MID} :`); for (const nom of defs.copieConfig) echecs += await copier(nom, defs.de[nom]); }
    }
    console.log('');
    process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
