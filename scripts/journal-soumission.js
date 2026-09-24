#!/usr/bin/env node
'use strict';
/**
 * Journal complet d'une soumission de formulaire, lu dans la DE
 * LPB_Log_Soumissions : toutes les etapes (10 → 99), dont « 99 - journey »
 * qui dit si l'API Event est parti (cle, eventInstanceId) ou pourquoi non.
 *
 *   node scripts/journal-soumission.js <email>
 *
 * Les morceaux du payload de creation de compte (etape 29) sont omis ici :
 * voir scratchpad/payload_email.js pour les reconstituer.
 * Lecture SOAP avec les identifiants du .env (aucun scope journey requis).
 */
require('dotenv').config({ quiet: true });
const sfmc = require('../lib/sfmc');

const email = process.argv[2];
if (!email) { console.error('usage: node scripts/journal-soumission.js <email>'); process.exit(1); }

const props = ['RunId', 'Ordre', 'Horodatage', 'Etape', 'Statut', 'Objet', 'RecordId', 'Detail', 'Email', 'Ecole', 'FormType']
    .map((p) => `<Properties>${p}</Properties>`).join('');
const filtre = `<Filter xsi:type="SimpleFilterPart"><Property>Email</Property><SimpleOperator>equals</SimpleOperator><Value>${sfmc.soapEsc(email)}</Value></Filter>`;
const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");

(async () => {
    const rows = [];
    let reqId = null;
    do {
        const inner = reqId
            ? `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ContinueRequest>${reqId}</ContinueRequest><ObjectType>DataExtensionObject[LPB_Log_Soumissions]</ObjectType>${props}</RetrieveRequest></RetrieveRequestMsg>`
            : `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ObjectType>DataExtensionObject[LPB_Log_Soumissions]</ObjectType>${props}${filtre}</RetrieveRequest></RetrieveRequestMsg>`;
        const r = await sfmc.soapRequest('Retrieve', inner);
        for (const b of r.text.match(/<Results\b[\s\S]*?<\/Results>/g) || []) {
            const o = {};
            for (const p of b.match(/<Property>[\s\S]*?<\/Property>/g) || []) {
                const n = (p.match(/<Name>([^<]*)/) || [])[1];
                o[n] = dec((p.match(/<Value>([\s\S]*?)<\/Value>/) || [])[1] || '');
            }
            rows.push(o);
        }
        reqId = (/<OverallStatus>MoreDataAvailable/.test(r.text) && (r.text.match(/<RequestID>([^<]+)/) || [])[1]) || null;
    } while (reqId);

    if (!rows.length) { console.log(`aucune ligne de journal pour ${email}`); return; }
    const runs = {};
    for (const o of rows) (runs[o.RunId] = runs[o.RunId] || []).push(o);
    for (const run of Object.values(runs).sort((a, b) => new Date(a[0].Horodatage) - new Date(b[0].Horodatage))) {
        run.sort((a, b) => +a.Ordre - +b.Ordre);
        console.log(`\n=== run ${run[0].RunId}  ${run[0].Horodatage}  ${run[0].Ecole}  ${run[0].FormType}`);
        for (const r of run) {
            if (/payload creation compte/.test(r.Etape)) continue;
            console.log(`  ${String(r.Ordre).padStart(2)}  ${r.Horodatage.replace(/^\d+\/\d+\/\d+ /, '')}  ${r.Etape.padEnd(32)} ${r.Statut.padEnd(7)} ${r.RecordId}  ${r.Detail.slice(0, 400)}`);
        }
    }
})().catch((e) => { console.error(e.message); process.exit(1); });
