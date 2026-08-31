#!/usr/bin/env node
/**
 * Relevé de mesures pour le cahier de recette des formulaires.
 *
 * LECTURE SEULE. Le script ne fait que des Retrieve SOAP et des GET REST sur la
 * business unit de recette. Il n'écrit rien, ni dans Marketing Cloud, ni dans le CRM.
 *
 * Usage :
 *   node scripts/recette-mesures.js --list-de          liste les Data Extensions du socle
 *   node scripts/recette-mesures.js --de "<CustomerKey>" [--max 500]   lit les lignes d'une DE
 *   node scripts/recette-mesures.js --mesures          produit le relevé complet en JSON
 *
 * La sortie JSON est écrite dans ../recette-mesures.json à la racine du projet.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUB = String(process.env.SFMC_SUBDOMAIN || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split('.')[0];
const CLIENT_ID = process.env.SFMC_CLIENT_ID;
const CLIENT_SECRET = process.env.SFMC_CLIENT_SECRET;
const ACCOUNT_ID = process.env.SFMC_ACCOUNT_ID;

if (!SUB || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('Credentials SFMC absents de .env (SFMC_SUBDOMAIN / CLIENT_ID / CLIENT_SECRET).');
    process.exit(1);
}

function post(url, body, headers) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const data = Buffer.from(body, 'utf8');
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: Object.assign({ 'Content-Length': data.length }, headers),
            timeout: 60000,
        }, (res) => {
            let out = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { out += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: out }));
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end(data);
    });
}

async function getToken() {
    const res = await post(
        `https://${SUB}.auth.marketingcloudapis.com/v2/token`,
        JSON.stringify({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            account_id: ACCOUNT_ID,
        }),
        { 'Content-Type': 'application/json' }
    );
    if (res.status !== 200) throw new Error(`token ${res.status} : ${res.body.slice(0, 300)}`);
    const j = JSON.parse(res.body);
    return { token: j.access_token, scope: j.scope, soap: j.soap_instance_url, rest: j.rest_instance_url };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function soap(auth, inner) {
    const host = `https://${SUB}.soap.marketingcloudapis.com`;
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <s:Header><fueloauth xmlns="http://exacttarget.com">${auth.token}</fueloauth></s:Header>
  <s:Body>${inner}</s:Body>
</s:Envelope>`;
    const res = await post(`${host}/Service.asmx`, envelope, {
        'Content-Type': 'text/xml',
        SOAPAction: 'Retrieve',
    });
    if (res.status !== 200) throw new Error(`soap ${res.status} : ${res.body.slice(0, 400)}`);
    return res.body;
}

function retrieveXml(objectType, props, filterXml, continueRequest) {
    if (continueRequest) {
        return `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>`
            + `<ContinueRequest>${esc(continueRequest)}</ContinueRequest></RetrieveRequest></RetrieveRequestMsg>`;
    }
    return `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>`
        + `<ObjectType>${objectType}</ObjectType>`
        + props.map((p) => `<Properties>${p}</Properties>`).join('')
        + (filterXml || '')
        + `</RetrieveRequest></RetrieveRequestMsg>`;
}

function parseStatus(xml) {
    const s = /<OverallStatus>([^<]*)<\/OverallStatus>/.exec(xml);
    const r = /<RequestID>([^<]*)<\/RequestID>/.exec(xml);
    return { status: s ? s[1] : '?', requestId: r ? r[1] : null };
}

/** Résultats d'un Retrieve sur un objet standard (DataExtension, etc.). */
function parseObjects(xml, props) {
    const rows = [];
    const blocks = xml.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];
    for (const b of blocks) {
        const o = {};
        for (const p of props) {
            const m = new RegExp(`<${p}>([\\s\\S]*?)</${p}>`).exec(b);
            if (m) o[p] = unesc(m[1]);
        }
        rows.push(o);
    }
    return rows;
}

/** Résultats d'un Retrieve sur DataExtensionObject : paires Name/Value. */
function parseDeRows(xml) {
    const rows = [];
    const blocks = xml.match(/<Results[^>]*>[\s\S]*?<\/Results>/g) || [];
    for (const b of blocks) {
        const o = {};
        const props = b.match(/<Property>[\s\S]*?<\/Property>/g) || [];
        for (const p of props) {
            const n = /<Name>([\s\S]*?)<\/Name>/.exec(p);
            const v = /<Value>([\s\S]*?)<\/Value>/.exec(p);
            if (n) o[unesc(n[1])] = v ? unesc(v[1]) : '';
        }
        if (Object.keys(o).length) rows.push(o);
    }
    return rows;
}

async function listDataExtensions(auth) {
    const props = ['Name', 'CustomerKey', 'CategoryID'];
    let xml = await soap(auth, retrieveXml('DataExtension', props));
    let all = parseObjects(xml, props);
    let st = parseStatus(xml);
    let guard = 0;
    while (st.status === 'MoreDataAvailable' && st.requestId && guard++ < 40) {
        xml = await soap(auth, retrieveXml(null, null, null, st.requestId));
        all = all.concat(parseObjects(xml, props));
        st = parseStatus(xml);
    }
    return all;
}

async function describeDe(auth, customerKey) {
    const props = ['Name', 'ObjectID'];
    const filter = `<Filter xsi:type="SimpleFilterPart"><Property>DataExtension.CustomerKey</Property>`
        + `<SimpleOperator>equals</SimpleOperator><Value>${esc(customerKey)}</Value></Filter>`;
    const xml = await soap(auth, retrieveXml('DataExtensionField', props, filter));
    return parseObjects(xml, props).map((f) => f.Name);
}

async function retrieveDeRows(auth, customerKey, fields, max) {
    const inner = retrieveXml(`DataExtensionObject[${customerKey}]`, fields);
    let xml = await soap(auth, inner);
    let all = parseDeRows(xml);
    let st = parseStatus(xml);
    let guard = 0;
    while (st.status === 'MoreDataAvailable' && st.requestId && all.length < (max || 1e9) && guard++ < 200) {
        xml = await soap(auth, retrieveXml(null, null, null, st.requestId));
        all = all.concat(parseDeRows(xml));
        st = parseStatus(xml);
    }
    return all;
}

(async function main() {
    const argv = process.argv.slice(2);
    const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

    console.log(`Business unit ${ACCOUNT_ID}, sous-domaine ${SUB.slice(0, 6)}…`);
    const auth = await getToken();
    console.log('Jeton obtenu. Scopes accordés :');
    console.log('  ' + String(auth.scope || '(non communiqués)').split(' ').join('\n  '));

    if (argv.includes('--list-de')) {
        const des = await listDataExtensions(auth);
        console.log(`\n${des.length} Data Extensions visibles.`);
        const interesting = des.filter((d) => /master|summit|campaign|account|contact|applicat|academic|location|term/i.test(d.Name));
        console.log(`\n${interesting.length} correspondant au socle CRM :`);
        for (const d of interesting.sort((a, b) => a.Name.localeCompare(b.Name))) {
            console.log(`  ${d.Name}   [${d.CustomerKey}]`);
        }
        fs.writeFileSync(path.join(__dirname, '..', '..', 'recette-des.json'), JSON.stringify(des, null, 2));
        console.log('\nListe complète écrite dans recette-des.json');
        return;
    }

    if (arg('--de')) {
        const key = arg('--de');
        const fields = await describeDe(auth, key);
        console.log(`\nChamps de ${key} :\n  ${fields.join('\n  ')}`);
        const rows = await retrieveDeRows(auth, key, fields, Number(arg('--max') || 2000));
        console.log(`\n${rows.length} lignes lues. Échantillon :`);
        console.log(JSON.stringify(rows.slice(0, 3), null, 2));
        fs.writeFileSync(path.join(__dirname, '..', '..', `recette-de-${key.replace(/\W+/g, '_')}.json`),
            JSON.stringify(rows, null, 2));
        return;
    }

    if (argv.includes('--mesures')) {
        const TODAY = new Date();
        TODAY.setHours(0, 0, 0, 0);
        const FAM = {
            'Open House': 'JPO',
            'Discovery Workshop': 'Atelier',
            'Internship': 'Stage',
            'Immersion Day': 'Immersion',
        };
        const parseDate = (v) => {
            const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || ''));
            return m ? new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])) : null;
        };
        const load = async (key) => {
            const f = await describeDe(auth, key);
            const r = await retrieveDeRows(auth, key, f, 20000);
            console.log(`  ${key} : ${r.length} lignes`);
            return r;
        };

        console.log('\nLecture des Data Extensions du socle...');
        const brands = await load('Master_BusinessBrand');
        const events = await load('Master_SummitEvent');
        const insts = await load('Master_SummitEventInstance');
        const camps = await load('Master_Campaign');
        const apps = await load('Master_IndividualApplication');

        const brandName = {};
        for (const b of brands) brandName[b.Id] = b.Name;
        const evById = {};
        for (const e of events) evById[e.Id] = e;

        const grid = {};
        const famTotals = {};
        for (const i of insts) {
            const e = evById[i.summit__Event];
            if (!e) continue;
            const fam = FAM[e.EventType] || 'Hors perimetre';
            const brand = brandName[e.BusinessBrand] || '(sans marque)';
            const sd = parseDate(i.summit__Instance_Start_Date);
            const future = sd && sd >= TODAY;
            const open = String(i.summit__Open_Registration) === 'True';
            famTotals[fam] = famTotals[fam] || { total: 0, aVenir: 0, inscriptionsOuvertes: 0 };
            famTotals[fam].total++;
            if (future) {
                famTotals[fam].aVenir++;
                if (open) famTotals[fam].inscriptionsOuvertes++;
                grid[brand] = grid[brand] || {};
                grid[brand][fam] = grid[brand][fam] || { aVenir: 0, inscriptionsOuvertes: 0, campus: {} };
                grid[brand][fam].aVenir++;
                if (open) grid[brand][fam].inscriptionsOuvertes++;
                const cp = i.campusNameFor || i.Campus || '(campus non renseigne)';
                grid[brand][fam].campus[cp] = (grid[brand][fam].campus[cp] || 0) + 1;
            }
        }

        const formCamps = camps.filter((c) => c.Type === 'Brochure download' || c.Type === 'Application');
        // Les campagnes de test ne font pas partie du mapping formulaire : elles sont
        // rapportees a part, sinon elles ecrasent la vraie campagne de la meme marque.
        const isTest = (c) => String(c.Name || '').toLowerCase().includes('test');
        const mappingCamps = formCamps.filter((c) => !isTest(c));
        const campGrid = {};
        for (const c of mappingCamps) {
            const brand = brandName[c.Brand] || '(sans marque)';
            const zone = c.Territory || '(zone non renseignee)';
            const type = c.Type === 'Application' ? 'Candidature' : 'Brochure';
            campGrid[brand] = campGrid[brand] || {};
            campGrid[brand][type + ' ' + zone] = { actif: c.IsActive === 'True', nom: c.Name, id: c.Id };
        }

        const byDecision = {};
        const byStatus = {};
        for (const a of apps) {
            const d = a.FinalDecision || '(sans decision)';
            byDecision[d] = byDecision[d] || { total: 0, avecContact: 0 };
            byDecision[d].total++;
            if (a.ContactId) byDecision[d].avecContact++;
            const st = a.Status || '(sans statut)';
            byStatus[st] = (byStatus[st] || 0) + 1;
        }

        const out = {
            releveDu: new Date().toISOString().slice(0, 10),
            businessUnit: ACCOUNT_ID,
            volumes: {
                marques: brands.length,
                evenements: events.length,
                instances: insts.length,
                campagnes: camps.length,
                campagnesFormulaire: formCamps.length,
                campagnesDuMapping: mappingCamps.length,
                candidatures: apps.length,
            },
            famillesEvenement: famTotals,
            instancesAVenirParMarque: grid,
            campagnesParMarque: campGrid,
            campagnesDuMappingActives: mappingCamps.filter((c) => c.IsActive === 'True').map((c) => c.Name),
            campagnesDeTestActives: formCamps.filter((c) => isTest(c) && c.IsActive === 'True').map((c) => c.Name),
            candidaturesParDecision: byDecision,
            candidaturesParStatut: byStatus,
        };
        const dest = path.join(__dirname, '..', '..', 'recette-mesures.json');
        fs.writeFileSync(dest, JSON.stringify(out, null, 2));
        console.log('\nReleve ecrit dans ' + dest);
        console.log(JSON.stringify(out.famillesEvenement, null, 2));
        return;
    }

    console.log('\nRien à faire. Utiliser --list-de ou --de "<CustomerKey>".');
})().catch((e) => {
    console.error('\nÉCHEC :', e.message);
    process.exit(1);
});
