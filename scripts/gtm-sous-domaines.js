#!/usr/bin/env node
/**
 * ============================================================================
 *  GTM DES ECOLES : www.googletagmanager.com -> sous-domaine de tracking (sGTM)
 * ============================================================================
 *  Le code marketing de chaque ecole (table Schools, colonnes custom_head_code
 *  et custom_body_code) porte le snippet Google Tag Manager, fige dans chaque
 *  page a sa publication. Les dix ecoles le portaient avec l'hote
 *  www.googletagmanager.com ; l'equipe Tracking demande (retour du 08/10) le
 *  snippet officiel de sa liste du 24/09, qui charge gtm.js et ns.html depuis
 *  le sous-domaine sGTM de la marque. Ce script remplace l'hote, et rien
 *  d'autre : le reste du code de l'ecole est garde a l'identique.
 *
 *  Les pages DEJA publiees ne sont pas touchees ici : la CloudPage reecrit
 *  l'hote au rendu (sfmc-ssjs/cloudpage-global.html, section 8quater). Ce
 *  script vaut pour les publications a venir.
 *
 *  Usage :
 *      node scripts/gtm-sous-domaines.js            simulation (rien n'est ecrit)
 *      node scripts/gtm-sous-domaines.js --push     ecrit dans Supabase
 * ========================================================================== */
require('dotenv').config({ quiet: true });
const { supabaseRequest } = require('../lib/supabase');

/* Meme table que la CloudPage (GTM_CONTENEURS) et que generer-lp.mjs. */
const SGTM = {
    'efap':        { id: 'GTM-NM7G8V9',  hote: 'sgtm.efap.com' },
    'ifa-paris':   { id: 'GTM-NBXZRK8',  hote: 'sgtm.ifaparis.com' },
    'brassart':    { id: 'GTM-52GFCN3',  hote: 'sgtm.brassart.fr' },
    'cread':       { id: 'GTM-MJRTDTJ',  hote: 'sgtm.cread.fr' },
    'mopa':        { id: 'GTM-TX6KR8J',  hote: 'sgtm.ecole-mopa.fr' },
    'ecole-bleue': { id: 'GTM-K8Q4NDRX', hote: 'sgtm.ecole-bleue.fr' },
    'esec':        { id: 'GTM-WMND2GN',  hote: 'sgtm.esec.fr' },
    'efj':         { id: 'GTM-5CVJCTF',  hote: 'sgtm.efj.fr' },
    'icart':       { id: 'GTM-W944F2W',  hote: 'sgtm.icart.fr' },
    '3wa':         { id: 'GTM-M9LVS7DR', hote: 'sgtm.3wacademy.fr' },
};
const PUSH = process.argv.includes('--push');
const RE_HOTE = /https:\/\/www\.googletagmanager\.com\/(gtm\.js|ns\.html)/g;

(async () => {
    const schools = await supabaseRequest('GET', '/Schools?select=id,name,custom_head_code,custom_body_code&order=id.asc');
    let modifiees = 0;
    for (const s of schools) {
        const cible = SGTM[s.id];
        const head = String(s.custom_head_code || '');
        const body = String(s.custom_body_code || '');
        if (!cible) { console.log(`- ${s.id.padEnd(12)} : pas de sous-domaine connu, ignoree`); continue; }
        const ids = (head + body).match(/GTM-[A-Z0-9]+/g) || [];
        const idInattendu = ids.find((id) => id !== cible.id);
        if (idInattendu) { console.log(`- ${s.id.padEnd(12)} : conteneur ${idInattendu} au lieu de ${cible.id}, ignoree (a verifier a la main)`); continue; }
        const nHead = (head.match(RE_HOTE) || []).length;
        const nBody = (body.match(RE_HOTE) || []).length;
        if (nHead + nBody === 0) { console.log(`- ${s.id.padEnd(12)} : deja sur ${cible.hote} (ou sans GTM), rien a faire`); continue; }
        const headNeuf = head.replace(RE_HOTE, `https://${cible.hote}/$1`);
        const bodyNeuf = body.replace(RE_HOTE, `https://${cible.hote}/$1`);
        console.log(`- ${s.id.padEnd(12)} : ${nHead} URL dans le head, ${nBody} dans le body -> ${cible.hote}${PUSH ? '' : ' (simulation)'}`);
        if (PUSH) {
            await supabaseRequest('PATCH', `/Schools?id=eq.${encodeURIComponent(s.id)}`,
                { custom_head_code: headNeuf, custom_body_code: bodyNeuf },
                { Prefer: 'return=minimal' });
            modifiees++;
        }
    }
    console.log(PUSH ? `\n${modifiees} ecole(s) mise(s) a jour.` : '\nSimulation : relancer avec --push pour ecrire.');
})().catch((e) => { console.error('ERREUR :', e.message); process.exit(1); });
