#!/usr/bin/env node
'use strict';
/**
 * ============================================================================
 *  PURGE DU CACHE DE LECTURE (DE LPB_Cache_Lecture)
 * ============================================================================
 *  Le socle garde en cache, dans LPB_Cache_Lecture, ce qu'il lit pour afficher
 *  un formulaire : picklists (7 jours), programmes/PTAT/rentrees (7 jours),
 *  dates d'evenement (1 jour). Ce script vide ce cache pour forcer une
 *  relecture a la prochaine visite — a lancer par cron cote serveur, ou a la
 *  main apres une modification dans le CRM qu'on veut voir tout de suite.
 *
 *    node -r dotenv/config scripts/purger-cache-lecture.js                 # tout
 *    node -r dotenv/config scripts/purger-cache-lecture.js --famille=evenements
 *    node -r dotenv/config scripts/purger-cache-lecture.js --famille=programmes --ecole=efap
 *    node -r dotenv/config scripts/purger-cache-lecture.js --dry-run         # compte sans supprimer
 *
 *  Familles : picklists, programmes, evenements (prefixe de la colonne Famille).
 *  Sans filtre : ClearData SOAP sur la DE (une requete, toutes les lignes).
 *  Avec filtre : lecture des cles puis suppression par cle exacte, par lots.
 *  Le visiteur suivant chaque purge paie la relecture (~0,5 s par famille)
 *  et reecrit le cache ; rien d'autre ne change pour lui.
 *  Identifiants : ceux du .env (SFMC_CLIENT_ID / SECRET / SUBDOMAIN / ACCOUNT_ID),
 *  jamais dans ce fichier. Sortie sur une ligne, code 0 si tout est passe.
 */
const path = require('node:path');
const sfmc = require(path.join(__dirname, '..', 'lib', 'sfmc'));

const DE = 'LPB_Cache_Lecture';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const famille = args.famille ? String(args.famille).toLowerCase() : '';
const ecole = args.ecole ? String(args.ecole).toLowerCase() : '';
const dryRun = !!args['dry-run'];
if (famille && !['picklists', 'programmes', 'evenements'].includes(famille)) {
    console.error(`famille inconnue « ${famille} » : picklists, programmes ou evenements`);
    process.exit(2);
}

const dec = (t) => String(t).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const status = (t) => ({ statut: (t.match(/<OverallStatus>([^<]*)/) || [])[1] || '?', message: (t.match(/<StatusMessage>([^<]*)/) || [])[1] || '' });

async function lireCles() {
    const props = ['Cle', 'Famille', 'Ecole'].map((p) => `<Properties>${p}</Properties>`).join('');
    const rows = [];
    let reqId = null;
    do {
        const inner = reqId
            ? `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ContinueRequest>${reqId}</ContinueRequest><ObjectType>DataExtensionObject[${DE}]</ObjectType>${props}</RetrieveRequest></RetrieveRequestMsg>`
            : `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest><ObjectType>DataExtensionObject[${DE}]</ObjectType>${props}</RetrieveRequest></RetrieveRequestMsg>`;
        const r = await sfmc.soapRequest('Retrieve', inner);
        const st = status(r.text);
        if (st.statut !== 'OK' && st.statut !== 'MoreDataAvailable') throw new Error(`lecture ${DE} : ${st.statut} ${st.message}`);
        for (const b of r.text.match(/<Results\b[\s\S]*?<\/Results>/g) || []) {
            const o = {};
            for (const p of b.match(/<Property>[\s\S]*?<\/Property>/g) || []) o[(p.match(/<Name>([^<]*)/) || [])[1]] = dec((p.match(/<Value>([\s\S]*?)<\/Value>/) || [])[1] || '');
            rows.push(o);
        }
        reqId = st.statut === 'MoreDataAvailable' ? (r.text.match(/<RequestID>([^<]*)/) || [])[1] : null;
    } while (reqId);
    return rows;
}

async function supprimerParCles(cles) {
    let ok = 0, ko = 0;
    for (let i = 0; i < cles.length; i += 100) {
        const lot = cles.slice(i, i + 100);
        const objets = lot.map((c) => `<Objects xsi:type="DataExtensionObject"><CustomerKey>${DE}</CustomerKey><Keys><Key><Name>Cle</Name><Value>${sfmc.soapEsc(c)}</Value></Key></Keys></Objects>`).join('');
        const r = await sfmc.soapRequest('Delete', `<DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">${objets}</DeleteRequest>`);
        const resultats = r.text.match(/<Results\b[\s\S]*?<\/Results>/g) || [];
        for (const b of resultats) (/<StatusCode>OK<\/StatusCode>/.test(b) ? ok++ : ko++);
        if (!resultats.length) ko += lot.length;
    }
    return { ok, ko };
}

(async () => {
    const debut = Date.now();
    const lignes = await lireCles();
    const cibles = lignes.filter((l) => (!famille || String(l.Famille || '').toLowerCase().startsWith(famille + '|') || String(l.Famille || '').toLowerCase() === famille)
        && (!ecole || String(l.Ecole || '').toLowerCase() === ecole || (famille !== 'picklists' && String(l.Famille || '').toLowerCase().split('|')[1] === ecole)));
    const portee = `${famille || 'toutes familles'}${ecole ? ' / ' + ecole : ''}`;
    if (dryRun) {
        console.log(`[purge cache] ${portee} : ${cibles.length} ligne(s) sur ${lignes.length} seraient supprimees (dry-run)`);
        return;
    }
    if (!famille && !ecole) {
        const r = await sfmc.soapRequest('Perform', `<PerformRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><Action>ClearData</Action><Definitions><Definition xsi:type="DataExtension"><CustomerKey>${DE}</CustomerKey></Definition></Definitions></PerformRequestMsg>`);
        const st = status(r.text);
        if (st.statut !== 'OK') {
            /* ClearData refuse (droit, version) : on retombe sur la suppression par cle. */
            const res = await supprimerParCles(cibles.map((l) => l.Cle));
            console.log(`[purge cache] ${portee} : ClearData refuse (${st.statut} ${st.message}), suppression par cle : ${res.ok} supprimee(s), ${res.ko} en echec, ${Date.now() - debut} ms`);
            process.exit(res.ko ? 1 : 0);
        }
        console.log(`[purge cache] ${portee} : ClearData OK, ${lignes.length} ligne(s) videes, ${Date.now() - debut} ms`);
        return;
    }
    const res = await supprimerParCles(cibles.map((l) => l.Cle));
    console.log(`[purge cache] ${portee} : ${res.ok} ligne(s) supprimee(s) sur ${cibles.length} ciblee(s) (${lignes.length} au total), ${res.ko} en echec, ${Date.now() - debut} ms`);
    process.exit(res.ko ? 1 : 0);
})().catch((e) => { console.error(`[purge cache] erreur : ${e.message}`); process.exit(1); });
