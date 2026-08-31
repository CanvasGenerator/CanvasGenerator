/**
 * ============================================================================
 *  LECTEUR DES DE DE CORRESPONDANCE DU SOCLE
 * ============================================================================
 *  À QUOI ÇA SERT
 *  Les valeurs qu'une landing page propose ne viennent pas de Salesforce
 *  directement : elles en viennent À TRAVERS les DE de correspondance. C'est
 *  `LPB_Mapping_Ecoles.campusprefix` qui décide quels campus Salesforce sont
 *  rattachés à une marque, et `businessbrandid` la marque écrite dans le CRM.
 *  Une mauvaise association de marque naît presque toujours ici, pas dans
 *  Salesforce.
 *
 *  Ce script lit ces DE via l'API REST de Marketing Cloud — la seule voie
 *  depuis un poste sans accès SOQL — et confronte leurs lignes entre elles.
 *
 *  USAGE
 *    node scripts/dump-socle-mappings.js              toutes les écoles
 *    node scripts/dump-socle-mappings.js efap         une seule
 *    node scripts/dump-socle-mappings.js --brut       + le détail ligne à ligne
 *
 *  Code de sortie 1 s'il existe au moins une anomalie BLOQUANTE : utilisable
 *  en pré-vol avant une campagne de test.
 *
 *  LECTURE SEULE. Aucune écriture, aucune création de DE.
 *
 *  --- Deux pièges de l'API, qui expliquent la forme du code ----------------
 *  1. Le rowset renvoie la CLÉ PRIMAIRE dans `keys` et le reste dans `values` :
 *     une ligne complète est la fusion des deux. Ne lire que `values` fait
 *     disparaître la colonne la plus utile (`ecole`, `campus`, `cle`…).
 *  2. Les noms de colonnes reviennent en MINUSCULES, quelle que soit leur
 *     casse dans Content Builder. `CampusPrefix` se lit `campusprefix`.
 *     L'AMPscript, lui, est insensible à la casse — d'où l'écart facile à
 *     rater en portant un Lookup vers du JS.
 * ============================================================================
 */
'use strict';

require('dotenv').config({ quiet: true });
const { sfmcFetch, isSfmcCredentialsConfigured } = require('../lib/sfmc');

const DE = {
    ecoles: 'LPB_Mapping_Ecoles',
    config: 'LPB_Config_Formulaires',
    campus: 'LPB_Mapping_Campus',
    campagnes: 'LPB_Mapping_Campagnes',
    niveaux: 'LPB_Mapping_Niveaux'
};

const args = process.argv.slice(2);
const brut = args.includes('--brut');
const filtre = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();

const anomalies = [];
function anomalie(gravite, texte) { anomalies.push({ gravite, texte }); }

function norm(v) { return String(v ?? '').trim().toLowerCase(); }
function estVrai(v) { return norm(v) === 'true'; }

async function cataloguer() {
    const r = await sfmcFetch('GET', '/data/v1/customobjects?$search=LPB&$pagesize=100');
    const parNom = {};
    (r.items || []).forEach((d) => {
        parNom[d.name] = { key: d.key, lignes: d.rowCount };
    });
    return parNom;
}

/** Toutes les lignes, clé primaire fusionnée dans la ligne. Cf. piège n°1. */
async function lire(cleExterne) {
    const lignes = [];
    for (let page = 1; page <= 40; page++) {
        const r = await sfmcFetch(
            'GET',
            `/data/v1/customobjectdata/key/${encodeURIComponent(cleExterne)}/rowset` +
            `?$pagesize=250&$page=${page}`
        );
        const items = r.items || [];
        items.forEach((it) => lignes.push(Object.assign({}, it.keys, it.values)));
        if (items.length < 250) break;
    }
    return lignes;
}

/** `cols` en minuscules (noms API), `entetes` pour l'affichage. */
function tableau(lignes, cols, entetes) {
    if (!lignes.length) { console.log('   (aucune ligne)'); return; }
    const tetes = entetes || cols;
    const larg = cols.map((c, i) =>
        Math.max(tetes[i].length, ...lignes.map((l) => String(l[c] ?? '').length)));
    console.log('   ' + tetes.map((t, i) => t.padEnd(larg[i])).join('  '));
    console.log('   ' + larg.map((w) => '-'.repeat(w)).join('  '));
    lignes.forEach((l) => {
        console.log('   ' + cols.map((c, i) => String(l[c] ?? '').padEnd(larg[i])).join('  '));
    });
}

(async () => {
    if (!isSfmcCredentialsConfigured()) {
        console.error('❌ Identifiants SFMC absents (SFMC_SUBDOMAIN / SFMC_CLIENT_ID / SFMC_CLIENT_SECRET).');
        process.exit(1);
    }

    console.log('═══ DE de correspondance du socle ═══');
    console.log('BU lue : ' + (process.env.SFMC_ACCOUNT_ID || '(BU par défaut de l\'intégration)'));
    if (filtre) console.log('Filtre école : ' + filtre);
    console.log('');

    const cat = await cataloguer();

    console.log('── Inventaire ──');
    Object.values(DE).forEach((nom) => {
        const d = cat[nom];
        console.log('   ' + nom.padEnd(26) +
            (d ? String(d.lignes).padStart(5) + ' ligne(s)' : '   ⛔ ABSENTE DE CETTE BU'));
        if (!d) {
            anomalie('BLOQUANT', `${nom} absente de cette BU : tout Lookup dessus fait ` +
                'planter le rendu du bloc (AMPscript n\'a pas de try/catch).');
        }
    });
    console.log('');

    /* ---- Écoles : la table qui décide de la marque --------------------- */
    let ecoles = [];
    if (cat[DE.ecoles]) {
        ecoles = await lire(cat[DE.ecoles].key);
        if (filtre) ecoles = ecoles.filter((l) => norm(l.ecole).includes(filtre));

        console.log(`── ${DE.ecoles} (${ecoles.length}) ──`);
        tableau(ecoles,
            ['ecole', 'libelle', 'campusprefix', 'businessbrandid', 'actif'],
            ['clé', 'libellé', 'CampusPrefix', 'BusinessBrandId', 'Actif']);
        console.log('');

        const prefixDe = {};
        ecoles.forEach((l) => {
            const e = l.ecole || '(vide)';
            if (!String(l.campusprefix || '').trim()) {
                anomalie('BLOQUANT', `« ${e} » sans CampusPrefix : aucun campus ni programme ` +
                    'ne sera proposé sur ses landing pages.');
            }
            if (!String(l.businessbrandid || '').trim()) {
                anomalie('ATTENTION', `MARQUE — « ${e} » sans BusinessBrandId : la marque ne ` +
                    'sera pas écrite sur le Person Account.');
            }
            if (!estVrai(l.actif)) {
                anomalie('ATTENTION', `« ${e} » est à Actif=false : cascade désactivée, le ` +
                    'formulaire sortira vide (panne silencieuse, voulue).');
            }
            const p = norm(l.campusprefix);
            if (p) {
                if (prefixDe[p]) {
                    anomalie('BLOQUANT', `MARQUE — préfixe « ${l.campusprefix} » partagé par ` +
                        `« ${prefixDe[p]} » et « ${e} » : chacune verra les campus de l'autre.`);
                }
                prefixDe[p] = e;
            }
        });

        /* Un préfixe qui est le début d'un autre ratisse ses campus :
           « EF » attraperait EFAP ET EFJ. Invisible : le formulaire marche. */
        const liste = Object.keys(prefixDe);
        liste.forEach((a) => liste.forEach((b) => {
            if (a !== b && b.indexOf(a) === 0) {
                anomalie('BLOQUANT', `MARQUE — le préfixe « ${a} » (${prefixDe[a]}) est le début ` +
                    `de « ${b} » (${prefixDe[b]}) : ${prefixDe[a]} proposera aussi les campus ` +
                    `de ${prefixDe[b]}.`);
            }
        }));

        /* Un BusinessBrandId réutilisé par deux écoles = deux marques confondues. */
        const marqueDe = {};
        ecoles.filter((l) => l.businessbrandid).forEach((l) => {
            const b = norm(l.businessbrandid);
            if (marqueDe[b]) {
                anomalie('BLOQUANT', `MARQUE — BusinessBrandId ${l.businessbrandid} partagé par ` +
                    `« ${marqueDe[b]} » et « ${l.ecole} » : les prospects des deux écoles ` +
                    'seront rattachés à la même marque.');
            }
            marqueDe[b] = l.ecole;
        });
    }

    const prefixParEcole = {};
    ecoles.forEach((l) => { if (l.campusprefix) prefixParEcole[norm(l.ecole)] = norm(l.campusprefix); });
    const ecolesConnues = Object.keys(prefixParEcole).length
        ? ecoles.map((l) => norm(l.ecole))
        : [];

    /* ---- Campus : rattachement au compte école Salesforce -------------- */
    if (cat[DE.campus]) {
        let campus = await lire(cat[DE.campus].key);
        if (filtre) campus = campus.filter((l) => norm(l.ecole).includes(filtre));

        const actifs = campus.filter((l) => estVrai(l.actif));
        console.log(`── ${DE.campus} (${campus.length}) ──`);
        console.log(`   ${actifs.length} actif(s) · ${campus.length - actifs.length} inactif(s)`);
        /* Par défaut on ne détaille que les campus INACTIFS : ce sont les seuls
           qui demandent une décision. `--brut` montre tout. */
        const aMontrer = brut ? campus : campus.filter((l) => !estVrai(l.actif));
        if (brut || aMontrer.length) {
            if (!brut) console.log('   Inactifs (à arbitrer) :');
            tableau(aMontrer,
                ['campus', 'ecole', 'schoolaccountid', 'actif', 'commentaire'],
                ['Campus', 'école', 'SchoolAccountId', 'Actif', 'Commentaire']);
        } else {
            console.log('   Tous actifs et rattachés — rien à arbitrer (--brut pour le détail).');
        }
        console.log('');

        campus.forEach((l) => {
            const e = norm(l.ecole);

            if (ecolesConnues.length && e && !ecolesConnues.includes(e)) {
                anomalie('ATTENTION', `MARQUE — campus « ${l.campus} » rattaché à l'école ` +
                    `« ${l.ecole} », absente de LPB_Mapping_Ecoles.`);
            }

            /* LE contrôle de marque. Le socle sélectionne les campus Salesforce
               par le CampusPrefix de l'école ; la colonne `ecole` de cette DE
               dit à quelle école le campus appartient. Si le nom du campus ne
               commence pas par le préfixe de SON école, les deux sources se
               contredisent : le campus sera proposé sous une marque et rattaché
               à une autre. C'est l'erreur la plus coûteuse — invisible, le
               formulaire a l'air de marcher. */
            const p = prefixParEcole[e];
            if (p && norm(l.campus).indexOf(p) !== 0) {
                anomalie('BLOQUANT', `MARQUE — campus « ${l.campus} » est rattaché à ` +
                    `« ${l.ecole} » mais ne commence pas par son préfixe « ${p.toUpperCase()} » : ` +
                    'proposé sous une marque, rattaché à une autre.');
            }

            if (estVrai(l.actif) && !String(l.schoolaccountid || '').trim()) {
                anomalie('BLOQUANT', `Campus « ${l.campus} » est Actif=true sans ` +
                    'SchoolAccountId : le socle écrira un Ecole__c vide.');
            }
        });

        /* Deux campus actifs sur le même compte école : le cas « BRASSART PARIS »
           documenté dans le handler. Un seul des deux peut être le bon. */
        const parCompte = {};
        campus.filter((l) => estVrai(l.actif) && l.schoolaccountid).forEach((l) => {
            (parCompte[l.schoolaccountid] = parCompte[l.schoolaccountid] || []).push(l.campus);
        });
        Object.entries(parCompte).forEach(([id, noms]) => {
            if (noms.length > 1) {
                anomalie('ATTENTION', `Compte école ${id} partagé par ${noms.length} campus ` +
                    `actifs (${noms.join(', ')}) : à arbitrer, un seul peut être le bon.`);
            }
        });

        if (ecolesConnues.length) {
            ecoles.forEach((e) => {
                const n = campus.filter((l) => norm(l.ecole) === norm(e.ecole) && estVrai(l.actif)).length;
                if (!n) {
                    anomalie('ATTENTION', `« ${e.ecole} » n'a aucun campus actif dans ` +
                        `${DE.campus} : Ecole__c restera vide pour tous ses prospects.`);
                }
            });
        }
    }

    /* ---- Campagnes : clé formtype|ecole|zone ---------------------------- */
    if (cat[DE.campagnes]) {
        let camp = await lire(cat[DE.campagnes].key);
        if (filtre) camp = camp.filter((l) => norm(l.ecole).includes(filtre));

        const act = camp.filter((l) => estVrai(l.actif));
        console.log(`── ${DE.campagnes} (${camp.length}) ──`);
        console.log(`   ${act.length} active(s) · ${camp.length - act.length} inactive(s)`);
        tableau(brut ? camp : act,
            ['cle', 'libelle', 'campaignid', 'actif'],
            ['Clé', 'Libellé', 'CampaignId', 'Actif']);
        console.log('');

        const idDe = {};
        camp.forEach((l) => {
            /* Le handler reconstruit la clé par Concat(formType,"|",ecole,"|",zone).
               Si les colonnes et la clé divergent, la clé calculée ne trouvera
               rien et AUCUN CampaignMember ne sera créé — sans erreur. */
            const attendue = `${l.formtype}|${l.ecole}|${l.zone}`;
            if (norm(l.cle) !== norm(attendue)) {
                anomalie('BLOQUANT', `Clé « ${l.cle} » incohérente avec ses colonnes ` +
                    `(attendu « ${attendue} ») : le handler ne la retrouvera pas.`);
            }
            if (ecolesConnues.length && !ecolesConnues.includes(norm(l.ecole))) {
                anomalie('ATTENTION', `MARQUE — campagne « ${l.cle} » désigne l'école ` +
                    `« ${l.ecole} », absente de LPB_Mapping_Ecoles : inatteignable.`);
            }
            if (estVrai(l.actif) && !String(l.campaignid || '').trim()) {
                anomalie('BLOQUANT', `Campagne « ${l.cle} » est Actif=true sans CampaignId : ` +
                    'aucun CampaignMember ne sera créé.');
            }
            /* Un même CampaignId sur deux écoles mélange leurs adhésions. */
            if (l.campaignid) {
                const id = norm(l.campaignid);
                if (idDe[id] && norm(idDe[id].ecole) !== norm(l.ecole)) {
                    anomalie('BLOQUANT', `MARQUE — CampaignId ${l.campaignid} partagé par ` +
                        `« ${idDe[id].cle} » et « ${l.cle} » : deux écoles dans la même campagne.`);
                }
                idDe[id] = l;
            }
        });

        /* Chaque école devrait couvrir brochure+candidature × FR+Intl. */
        ecoles.forEach((e) => {
            ['brochure', 'candidature'].forEach((t) => ['fr', 'intl'].forEach((z) => {
                const cle = `${t}|${norm(e.ecole)}|${z}`;
                if (!camp.some((l) => norm(l.cle) === cle)) {
                    anomalie('INFO', `Combinaison absente de ${DE.campagnes} : « ${cle} ».`);
                }
            }));
        });
    }

    /* ---- Config par école ---------------------------------------------- */
    if (cat[DE.config]) {
        let cfg = await lire(cat[DE.config].key);
        if (filtre) cfg = cfg.filter((l) => norm(l.ecole).includes(filtre));
        console.log(`── ${DE.config} (${cfg.length}) ──`);
        tableau(cfg,
            ['ecole', 'progressif', 'ordrechamps', 'languedefaut', 'rentreedecalee'],
            ['école', 'Progressif', 'OrdreChamps', 'LangueDefaut', 'RentréeDécalée']);
        console.log('');

        const avec = cfg.map((l) => norm(l.ecole));
        ecoles.forEach((e) => {
            if (!avec.includes(norm(e.ecole))) {
                anomalie('INFO', `« ${e.ecole} » sans ligne de config : comportement par défaut ` +
                    '(tout progressif, tous les champs proposés). Pas une régression.');
            }
        });
    }

    /* ---- Niveaux ------------------------------------------------------- */
    if (cat[DE.niveaux] && !filtre) {
        const niv = await lire(cat[DE.niveaux].key);
        console.log(`── ${DE.niveaux} (${niv.length}) ──`);
        tableau(niv.sort((a, b) => Number(a.ordre) - Number(b.ordre)),
            ['niveau', 'ordre', 'verifie'], ['Niveau', 'Ordre', 'Vérifié']);
        console.log('');
    }

    /* ---- Verdict ------------------------------------------------------- */
    const rang = { BLOQUANT: 0, ATTENTION: 1, INFO: 2 };
    anomalies.sort((a, b) => rang[a.gravite] - rang[b.gravite]);
    const bloquants = anomalies.filter((a) => a.gravite === 'BLOQUANT').length;

    console.log('═══ ' + (anomalies.length
        ? `${anomalies.length} anomalie(s), dont ${bloquants} bloquante(s)`
        : 'aucune anomalie') + ' ═══');
    anomalies.forEach((a) => console.log(`   [${a.gravite}] ${a.texte}`));

    process.exit(bloquants ? 1 : 0);
})().catch((e) => {
    console.error('❌ ' + e.message);
    if (e.payload) console.error('   ' + JSON.stringify(e.payload));
    process.exit(1);
});
