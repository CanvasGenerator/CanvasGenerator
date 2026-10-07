#!/usr/bin/env node
'use strict';
/**
 * Depose (cree ou met a jour) les deux code snippets du bloc de lecture CRM
 * dans le Content Builder d'une BU :
 *   efap_crm_mcc_testing_fr      (enveloppe SSJS, sfmc-ssjs/blocs-test/*.ssjs)
 *   efap_crm_mcc_testing_fr_amp  (lecture AMPscript,   .../*.ampscript)
 *
 *   SFMC_ACCOUNT_ID=536009308 node scripts/deployer-bloc-test-crm.js --mid=536009308 [--dossier=41422]
 *
 * --mid doit repeter SFMC_ACCOUNT_ID (garde-fou). --dossier : categoryId du
 * dossier Content Builder cible (defaut SFMC_CATEGORY_ID du .env).
 * Appel ensuite : <CloudPage>?id=efap_crm_mcc_testing_fr&email=<adresse>
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || true] : [a, true]; }));
const MID = String(process.env.SFMC_ACCOUNT_ID || '');
const SUB = String(process.env.SFMC_SUBDOMAIN || '').replace(/^https?:\/\//, '').split('.')[0];
const DOSSIER = Number(args.dossier || process.env.SFMC_CATEGORY_ID || 0);
const SRC = path.join(__dirname, '..', 'sfmc-ssjs', 'blocs-test');
const BLOCS = [
    { key: 'efap_crm_mcc_testing_fr_amp', fichier: 'efap_crm_mcc_testing_fr_amp.ampscript' },
    { key: 'efap_crm_mcc_testing_fr', fichier: 'efap_crm_mcc_testing_fr.ssjs' },
];

(async () => {
    if (!MID) throw new Error('SFMC_ACCOUNT_ID absent');
    if (String(args.mid || '') !== MID) throw new Error(`--mid=${args.mid || '?'} ne correspond pas a SFMC_ACCOUNT_ID=${MID} : garde-fou, rien n'est fait`);
    if (!DOSSIER) throw new Error('--dossier=<categoryId> ou SFMC_CATEGORY_ID requis');
    const r = await fetch(`https://${SUB}.auth.marketingcloudapis.com/v2/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.SFMC_CLIENT_ID, client_secret: process.env.SFMC_CLIENT_SECRET, account_id: MID }) });
    const tok = (await r.json()).access_token;
    if (!tok) throw new Error('jeton refuse');
    const H = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
    const base = `https://${SUB}.rest.marketingcloudapis.com/asset/v1/content/assets`;
    for (const b of BLOCS) {
        const content = fs.readFileSync(path.join(SRC, b.fichier), 'utf8');
        const q = await (await fetch(`${base}/query`, { method: 'POST', headers: H, body: JSON.stringify({ page: { page: 1, pageSize: 1 }, query: { property: 'customerKey', simpleOperator: 'equal', value: b.key }, fields: ['id', 'customerKey'] }) })).json();
        const existant = (q.items || []).find((x) => x.customerKey === b.key);
        const payload = { name: b.key, customerKey: b.key, assetType: { id: 220, name: 'codesnippet' }, content, category: { id: DOSSIER } };
        const res = existant
            ? await fetch(`${base}/${existant.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ content }) })
            : await fetch(base, { method: 'POST', headers: H, body: JSON.stringify(payload) });
        const j = await res.json();
        if (!res.ok) throw new Error(`${b.key} : HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
        console.log(`  ${existant ? 'mis a jour' : 'cree'}  ${b.key}  (id ${j.id}, ${content.length} car., BU ${MID}, dossier ${DOSSIER})`);
    }
})().catch((e) => { console.error(e.message); process.exit(1); });
