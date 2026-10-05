#!/usr/bin/env node
'use strict';
/**
 * ============================================================================
 *  PURGE ET RECHAUFFEMENT DU CACHE DE LECTURE (DE LPB_Cache_Lecture)
 * ============================================================================
 *  Le socle garde en cache, dans LPB_Cache_Lecture, ce qu'il lit pour afficher
 *  un formulaire : picklists (7 jours), programmes/PTAT/rentrees (7 jours),
 *  dates d'evenement (1 jour). Ce script vide ce cache pour forcer une
 *  relecture — et, avec --rechauffer=<lot>, VISITE ensuite les pages du lot
 *  pour que ce soit lui, et non le premier visiteur, qui paie la relecture et
 *  reecrive le cache. A lancer par cron cote serveur, ou a la main apres une
 *  modification dans le CRM qu'on veut voir tout de suite.
 *
 *    node -r dotenv/config scripts/purger-cache-lecture.js                 # vide tout
 *    node -r dotenv/config scripts/purger-cache-lecture.js --famille=evenements
 *    node -r dotenv/config scripts/purger-cache-lecture.js --famille=programmes --ecole=efap
 *    node -r dotenv/config scripts/purger-cache-lecture.js --dry-run         # compte sans supprimer
 *
 *    node -r dotenv/config scripts/purger-cache-lecture.js --rechauffer=recette
 *        # vide tout PUIS visite les 60 pages FR du lot Recette : chaque
 *        # famille manquante est relue et reecrite par la page elle-meme
 *    node -r dotenv/config scripts/purger-cache-lecture.js --famille=evenements --rechauffer=recette
 *        # cron du matin : efface les dates de la veille, reecrit celles du jour (40 pages)
 *    node -r dotenv/config scripts/purger-cache-lecture.js --rechauffer=recette --sans-purge
 *        # ne vide rien : visite les pages avec ?socle_cache=refresh (reecriture forcee)
 *
 *  Familles : picklists, programmes, evenements (prefixe de la colonne Famille).
 *  Sans filtre : ClearData SOAP sur la DE (une requete, toutes les lignes).
 *  Avec filtre : lecture des cles puis suppression par cle exacte, par lots.
 *
 *  Rechauffement : les cles du cache ne dependent que de l'ecole, du type de
 *  formulaire et du jour — pas de la langue ni du lot. Une page BRCH ecrit
 *  `picklists` (commune a toutes) et `programmes|<ecole>|tous`, une page CAND
 *  `programmes|<ecole>|cand`, chaque page evenement (JPO, AD, STG, IMM)
 *  `evenements|<ecole>|<type>|<jour>` : 6 pages FR par ecole suffisent, les
 *  pages EN et les autres lots de la meme BU lisent les memes lignes. La
 *  premiere page est visitee seule (elle ecrit les picklists), les suivantes
 *  par --parallele (2 : a 3, SFMC renvoie des HTTP 429) avec 3 essais ; une
 *  page morte (HTTP 500 ou sans commentaire « socle ampscript ») compte
 *  comme un echec. Le jour des evenements est
 *  celui du serveur SFMC (UTC-6, sans heure d'ete) : la cle tombe a 07:00
 *  (hiver) ou 08:00 (ete) heure de Paris, le cron du matin se lance apres.
 *  Options : --url=<base> (defaut https://cloud.groupe-edh.net/landingpage),
 *  --parallele=<n>, --lang=en pour viser les pages EN a la place des FR.
 *
 *  Identifiants : ceux du .env (SFMC_CLIENT_ID / SECRET / SUBDOMAIN / ACCOUNT_ID),
 *  jamais dans ce fichier. Code 0 si tout est passe, 1 sinon.
 */
const path = require('node:path');

const DE = 'LPB_Cache_Lecture';
const URL_DEFAUT = 'https://cloud.groupe-edh.net/landingpage';
const FAMILLES = ['picklists', 'programmes', 'evenements'];
/* Type de formulaire -> familles de cache qu'une visite de la page ecrit.
   Memes codes et meme ordre que FORMULAIRES dans scripts/generer-lp.mjs. */
const PAGES = [
    { code: 'BRCH', familles: ['picklists', 'programmes'] },
    { code: 'CAND', familles: ['programmes'] },
    { code: 'JPO',  familles: ['evenements'] },
    { code: 'AD',   familles: ['evenements'] },
    { code: 'STG',  familles: ['evenements'] },
    { code: 'IMM',  familles: ['evenements'] },
];

/** Cle Content Builder d'une page du lot, comme scripts/generer-lp.mjs la forme. */
function clePage(lot, code, ecoleId, lang) {
    const prefixe = lot.charAt(0).toUpperCase() + lot.slice(1).toLowerCase();
    const suffixe = String(lang || 'fr').toLowerCase() === 'en' ? '_EN' : '';
    return `${prefixe}_${code}${suffixe}_${ecoleId.toUpperCase().replace(/-/g, '_')}_V0`;
}

/**
 * Pages a visiter pour rechauffer le cache : la premiere ecrit les picklists
 * (une seule suffit, la famille est commune), puis une page par cle
 * programmes et evenements. `ecoles` : ids de schools.json.
 */
function pagesARechauffer(lot, { famille = '', ecole = '', lang = 'fr', ecoles }) {
    const ids = (ecoles || require(path.join(__dirname, '..', 'schools.json')).map((e) => e.id))
        .filter((id) => !ecole || id.toLowerCase() === ecole.toLowerCase());
    const pages = [];
    let picklistsFaites = false;
    for (const id of ids) {
        for (const p of PAGES) {
            const utiles = p.familles.filter((f) => (!famille || f === famille) && !(f === 'picklists' && picklistsFaites));
            if (!utiles.length) continue;
            if (utiles.includes('picklists')) picklistsFaites = true;
            pages.push({ cle: clePage(lot, p.code, id, lang), ecole: id, type: p.code, familles: utiles });
        }
    }
    return pages;
}

/** Visite une page et lit le commentaire « socle ampscript » qu'elle rend. */
async function visiter(url) {
    const debut = Date.now();
    const r = await fetch(url, { headers: { 'user-agent': 'LPB-cache-rechauffe/1.0' }, redirect: 'follow' });
    const html = await r.text();
    const socle = (/<!--\s*socle ampscript:([^>]*)-->/.exec(html) || [])[1] || '';
    return {
        http: r.status,
        ms: Date.now() - debut,
        cache: ((/cache=(.*?)\s+desync=/.exec(socle) || [])[1] || '').trim(),
        temps: ((/temps=(.*?)\s*$/.exec(socle) || [])[1] || '').trim(),
        morte: r.status !== 200 || !socle,
    };
}

async function rechauffer(pages, { urlBase, parallele, forcer }) {
    const debut = Date.now();
    const resultats = [];
    const lien = (p) => `${urlBase}?id=${p.cle}${forcer ? '&socle_cache=refresh' : ''}`;
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const une = async (p) => {
        let res;
        /* SFMC repond HTTP 429 a une rafale et coupe parfois la connexion
           (constate le 05/10 : 2 pages sur 60 a 3 en parallele) : jusqu'a
           3 essais, 2 s puis 4 s d'attente, avant de compter la page morte. */
        for (let essai = 1; essai <= 3; essai++) {
            try { res = await visiter(lien(p)); } catch (e) { res = { http: 0, ms: 0, cache: '', temps: '', morte: true, erreur: e.message }; }
            if (!res.morte || (res.http && res.http !== 429 && res.http < 500)) break;
            if (essai < 3) await pause(2000 * essai);
            res.essais = essai + 1;
        }
        resultats.push({ ...p, ...res });
        console.log(`  ${res.morte ? '✗' : '✓'} ${p.cle.padEnd(30)} HTTP ${String(res.http).padEnd(3)} ${String(res.ms).padStart(5)} ms  ${res.cache || res.erreur || 'page sans commentaire socle'}${res.essais ? ` (${res.essais} essais)` : ''}`);
    };
    /* La premiere page seule : elle ecrit les picklists que toutes les autres liront. */
    if (pages.length) await une(pages[0]);
    const reste = pages.slice(1);
    let i = 0;
    await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, reste.length)) }, async () => {
        while (i < reste.length) await une(reste[i++]);
    }));
    const mortes = resultats.filter((r) => r.morte);
    const ecrits = resultats.reduce((n, r) => n + (r.cache.match(/:ecrit/g) || []).length, 0);
    return { resultats, mortes, ecrits, ms: Date.now() - debut };
}

/* -- purge (SOAP) --------------------------------------------------------- */
const dec = (t) => String(t).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const status = (t) => ({ statut: (t.match(/<OverallStatus>([^<]*)/) || [])[1] || '?', message: (t.match(/<StatusMessage>([^<]*)/) || [])[1] || '' });

async function lireCles(sfmc) {
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

async function supprimerParCles(sfmc, cles) {
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

/** Vide le cache selon les filtres ; renvoie false si une suppression a echoue. */
async function purger({ famille, ecole, dryRun }) {
    const sfmc = require(path.join(__dirname, '..', 'lib', 'sfmc'));
    const debut = Date.now();
    const lignes = await lireCles(sfmc);
    const cibles = lignes.filter((l) => (!famille || String(l.Famille || '').toLowerCase().startsWith(famille + '|') || String(l.Famille || '').toLowerCase() === famille)
        && (!ecole || String(l.Ecole || '').toLowerCase() === ecole || (famille !== 'picklists' && String(l.Famille || '').toLowerCase().split('|')[1] === ecole)));
    const portee = `${famille || 'toutes familles'}${ecole ? ' / ' + ecole : ''}`;
    if (dryRun) {
        console.log(`[purge cache] ${portee} : ${cibles.length} ligne(s) sur ${lignes.length} seraient supprimees (dry-run)`);
        return true;
    }
    if (!famille && !ecole) {
        const r = await sfmc.soapRequest('Perform', `<PerformRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><Action>ClearData</Action><Definitions><Definition xsi:type="DataExtension"><CustomerKey>${DE}</CustomerKey></Definition></Definitions></PerformRequestMsg>`);
        const st = status(r.text);
        if (st.statut !== 'OK') {
            /* ClearData refuse (droit, version) : on retombe sur la suppression par cle. */
            const res = await supprimerParCles(sfmc, cibles.map((l) => l.Cle));
            console.log(`[purge cache] ${portee} : ClearData refuse (${st.statut} ${st.message}), suppression par cle : ${res.ok} supprimee(s), ${res.ko} en echec, ${Date.now() - debut} ms`);
            return res.ko === 0;
        }
        console.log(`[purge cache] ${portee} : ClearData OK, ${lignes.length} ligne(s) videes, ${Date.now() - debut} ms`);
        return true;
    }
    const res = await supprimerParCles(sfmc, cibles.map((l) => l.Cle));
    console.log(`[purge cache] ${portee} : ${res.ok} ligne(s) supprimee(s) sur ${cibles.length} ciblee(s) (${lignes.length} au total), ${res.ko} en echec, ${Date.now() - debut} ms`);
    return res.ko === 0;
}

/* -- ligne de commande ---------------------------------------------------- */
async function main() {
    const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
    const famille = args.famille ? String(args.famille).toLowerCase() : '';
    const ecole = args.ecole ? String(args.ecole).toLowerCase() : '';
    const dryRun = !!args['dry-run'];
    const lot = typeof args.rechauffer === 'string' ? args.rechauffer.toLowerCase() : '';
    const sansPurge = !!args['sans-purge'];
    if (famille && !FAMILLES.includes(famille)) {
        console.error(`famille inconnue « ${famille} » : ${FAMILLES.join(', ')}`);
        process.exit(2);
    }
    if (args.rechauffer === true || (args.rechauffer && !/^[a-z]+$/.test(lot))) {
        console.error('--rechauffer attend le lot des pages a visiter : --rechauffer=interne ou --rechauffer=recette');
        process.exit(2);
    }
    if (sansPurge && !lot) {
        console.error('--sans-purge n a de sens qu avec --rechauffer=<lot>');
        process.exit(2);
    }

    let tout = true;
    if (!sansPurge) tout = await purger({ famille, ecole, dryRun });

    if (lot) {
        const pages = pagesARechauffer(lot, { famille, ecole, lang: args.lang });
        const urlBase = typeof args.url === 'string' && args.url ? args.url.replace(/\/$/, '') : URL_DEFAUT;
        const parallele = Math.max(1, parseInt(args.parallele, 10) || 2);
        if (!pages.length) {
            console.error(`[rechauffe cache] aucune page pour ${lot}${famille ? ' / ' + famille : ''}${ecole ? ' / ' + ecole : ''} : ecole inconnue de schools.json ?`);
            process.exit(2);
        }
        if (dryRun) {
            console.log(`[rechauffe cache] ${pages.length} page(s) seraient visitees sur ${urlBase} (dry-run) :`);
            for (const p of pages) console.log(`  ○ ${p.cle.padEnd(30)} ${p.familles.join(', ')}`);
        } else {
            console.log(`[rechauffe cache] lot ${lot} : ${pages.length} page(s) sur ${urlBase}, ${parallele} en parallele${sansPurge ? ', ?socle_cache=refresh' : ''}`);
            const r = await rechauffer(pages, { urlBase, parallele, forcer: sansPurge });
            console.log(`[rechauffe cache] ${r.resultats.length - r.mortes.length} page(s) servie(s), ${r.ecrits} famille(s) ecrite(s), ${r.mortes.length} echec(s), ${r.ms} ms`);
            if (r.mortes.length) tout = false;
        }
    }
    process.exit(tout ? 0 : 1);
}

module.exports = { pagesARechauffer, clePage, PAGES, FAMILLES, URL_DEFAUT };

if (require.main === module) {
    main().catch((e) => { console.error(`[purge cache] erreur : ${e.message}`); process.exit(1); });
}
