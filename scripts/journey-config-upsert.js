#!/usr/bin/env node
'use strict';
/**
 * Alimente la DE de configuration `LPB_Config_Api` (cle/valeur) lue par le
 * socle AMPscript pour declencher les journeys (API Event).
 *
 *   node scripts/journey-config-upsert.js --from=<fichier.json> [--dry]
 *   node scripts/journey-config-upsert.js                       (lit process.env)
 *
 * Cles ecrites : AuthBaseUrl, RestBaseUrl, ClientId, ClientSecret, AccountId,
 *                EventKey_Evenement (et toute cle EventKey_* du fichier).
 *
 * Les valeurs ne sont JAMAIS affichees : seule la liste des cles et la longueur
 * de chaque valeur sortent a l'ecran. L'ecriture passe par SOAP UpdateAdd avec
 * les identifiants du .env (le paquet .env n'a pas besoin de journeys_* pour
 * ecrire dans une DE).
 *
 * Fichier JSON attendu (memes noms que la config MCP) :
 *   { "SFMC_SUBDOMAIN": "...", "SFMC_CLIENT_ID": "...", "SFMC_CLIENT_SECRET": "...",
 *     "SFMC_ACCOUNT_ID": "...", "EventKey_Evenement": "...", "EventKey_Brochure": "..." }
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const sfmc = require('../lib/sfmc');

const DE_KEY = 'LPB_Config_Api';
const args = process.argv.slice(2);
const opt = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const dry = args.includes('--dry');

let src = process.env;
const from = opt('from');
if (from) src = JSON.parse(fs.readFileSync(path.resolve(from), 'utf8'));

const sub = src.SFMC_JOURNEY_SUBDOMAIN || src.SFMC_SUBDOMAIN;
const lignes = {
    AuthBaseUrl: sub ? `https://${sub}.auth.marketingcloudapis.com/` : '',
    RestBaseUrl: sub ? `https://${sub}.rest.marketingcloudapis.com/` : '',
    ClientId: src.SFMC_JOURNEY_CLIENT_ID || src.SFMC_CLIENT_ID || '',
    ClientSecret: src.SFMC_JOURNEY_CLIENT_SECRET || src.SFMC_CLIENT_SECRET || '',
    AccountId: src.SFMC_JOURNEY_ACCOUNT_ID || src.SFMC_ACCOUNT_ID || '',
};
for (const [k, v] of Object.entries(src)) if (k.startsWith('EventKey_')) lignes[k] = String(v);
const notes = {
    AuthBaseUrl: 'Base OAuth du paquet (v2/token)',
    RestBaseUrl: 'Base REST (interaction/v1/events)',
    ClientId: 'Paquet installe, scopes journeys_*',
    ClientSecret: 'Secret du paquet — ne pas exporter',
    AccountId: 'MID de la BU cible',
};

const manquantes = Object.entries(lignes).filter(([, v]) => !v).map(([k]) => k);
if (manquantes.length) { console.error(`Valeurs manquantes : ${manquantes.join(', ')}`); process.exit(1); }

console.log(`DE ${DE_KEY} — ${Object.keys(lignes).length} cle(s)${dry ? ' (simulation)' : ''}`);
for (const [k, v] of Object.entries(lignes)) console.log(`  ${k.padEnd(20)} ${String(v).length} car.`);
if (dry) process.exit(0);

(async () => {
    const objets = Object.entries(lignes).map(([k, v]) =>
        `<Objects xsi:type="DataExtensionObject"><CustomerKey>${DE_KEY}</CustomerKey><Properties>`
        + `<Property><Name>Cle</Name><Value>${sfmc.soapEsc(k)}</Value></Property>`
        + `<Property><Name>Valeur</Name><Value>${sfmc.soapEsc(v)}</Value></Property>`
        + `<Property><Name>Note</Name><Value>${sfmc.soapEsc(notes[k] || (k.startsWith('EventKey_') ? 'Cle d evenement API (eventDefinitionKey)' : ''))}</Value></Property>`
        + `</Properties></Objects>`).join('');
    const inner = `<UpdateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">`
        + `<Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>`
        + `${objets}</UpdateRequest>`;
    const res = await sfmc.soapRequest('Update', inner);
    if (res.overall !== 'OK') {
        const m = res.text.match(/<StatusMessage>([^<]*)<\/StatusMessage>/i);
        console.error(`Echec : ${m ? m[1] : res.overall || 'HTTP ' + res.httpStatus}`);
        process.exit(1);
    }
    console.log('  ✅ lignes ecrites');
})().catch((e) => { console.error(e.message); process.exit(1); });
