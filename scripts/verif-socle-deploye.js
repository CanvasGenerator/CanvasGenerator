/**
 * ============================================================================
 *  LE SOCLE DEPLOYE EST-IL CELUI DU DEPOT ?
 * ============================================================================
 *  LECTURE SEULE. N'ecrit rien, ni dans SFMC ni sur le disque.
 *
 *  Pourquoi ce script : `npm run deploy:socle` en simulation ne dit que « les
 *  fichiers locaux sont prets ». Il ne compare RIEN avec l'org. Quand un
 *  correctif « ne prend pas » sur une page publiee, la premiere question est
 *  donc restee sans reponse outillee : le bloc a-t-il ete redeploye ?
 *
 *  Trois causes possibles a un correctif invisible, et ce script tranche les
 *  deux premieres :
 *
 *    1. le bloc n'a pas ete redeploye        -> ce script le dit
 *    2. le bloc est a jour mais la PAGE porte une copie figee du socle
 *       (inlining, cf. PASSATION-FORMULAIRES.md §1.3) -> ce script le dit aussi
 *    3. cache navigateur                     -> Ctrl+F5, ou ?socleDebug=1
 *
 *  Usage :
 *      node scripts/verif-socle-deploye.js
 *      node scripts/verif-socle-deploye.js --page=Formulaire_CANDIDATURE_EFAP
 * ============================================================================
 */
'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { isSfmcConfigured, sfmcFetch, findAssetIdByCustomerKey } = require('../lib/sfmc');

const SOCLE_DIR = path.join(__dirname, '..', 'sfmc-ssjs', 'socle');

const BLOCS = [
    { fichier: 'picklist-handler.ampscript', key: 'LPB_Picklist_Handler_AG' },
    { fichier: 'handler-form.ampscript',     key: 'LPB_Form_Handler_AG' },
];

/* Marqueurs a chercher dans le contenu deploye. Un marqueur = une regle qui
   doit etre en ligne. On ne compare pas les fichiers octet a octet : l'API
   SFMC normalise les sauts de ligne et peut reindenter, un diff brut crierait
   au loup a chaque fois. */
const MARQUEURS = [
    { texte: "REGLES D'AFFICHAGE", quoi: 'bloc des regles d affichage (02/09)' },
    { texte: "VousEtes: ['JURY']", quoi: 'masquage de « Jury »' },
    { texte: "['EDH STUDENT',   20]", quoi: 'ordre de « Vous etes »' },
    { texte: "['BAC OBTENU', 50]",    quoi: 'ordre du niveau d etudes' },
    { texte: 'Lookup("LPB_Mapping_Ecoles", "Libelle"', quoi: 'lecture du libelle de marque' },
    { texte: 'function cleDeTri', quoi: 'indicatifs par ordre alphabetique de pays' },
    { texte: 'LPB_Mapping_Indicatifs', quoi: 'lecture de la DE des longueurs de telephone' },
    { texte: 'function erreurLongueurTel', quoi: 'controle de longueur du telephone' },
    { texte: 'erreursTelephone(form)', quoi: '  et son refus a la soumission' },
];

const args = process.argv.slice(2);
const pageDemandee = (args.find((a) => a.startsWith('--page=')) || '').split('=')[1];

const ok = (s) => console.log('  \x1b[32m✓\x1b[0m ' + s);
const ko = (s) => console.log('  \x1b[31m✗\x1b[0m ' + s);
const info = (s) => console.log('    ' + s);

/**
 * TOUT le contenu d'un asset, ou qu'il soit range.
 *
 * ⚠ `views.html.content` ne suffit PAS pour une CloudPage : ce champ ne porte
 * que le gabarit, et le contenu reel vit dans `views.html.slots[*].blocks[*]`,
 * imbriques a profondeur variable. S'en tenir au premier champ faisait
 * conclure « pas de socle sur cette page » sur des pages qui en portent un —
 * un diagnostic faux est pire que pas de diagnostic.
 *
 * On concatene donc tout ce qui ressemble a du contenu, en descendant l'arbre.
 */
function contenuDe(asset) {
    const morceaux = [];
    const vus = new Set();
    (function descendre(n) {
        if (!n || typeof n !== 'object' || vus.has(n)) return;
        vus.add(n);
        for (const [k, v] of Object.entries(n)) {
            if (typeof v === 'string') {
                if (k === 'content' || k === 'superContent' || k === 'html') morceaux.push(v);
            } else if (v && typeof v === 'object') descendre(v);
        }
    })(asset);
    return morceaux.join('\n');
}

(async () => {
    if (!isSfmcConfigured()) {
        console.error('✗ SFMC non configure (.env) : impossible de lire l org.');
        process.exit(2);
    }

    console.log('\n  Socle deploye vs depot — LECTURE SEULE');
    console.log('  ─────────────────────────────────────────────');
    console.log(`  Business Unit : ${process.env.SFMC_ACCOUNT_ID}\n`);

    let aJour = true;

    /* ---- 1. Les blocs du socle ---------------------------------------- */
    for (const b of BLOCS) {
        const local = fs.readFileSync(path.join(SOCLE_DIR, b.fichier), 'utf8');
        const id = await findAssetIdByCustomerKey(b.key);

        if (!id) {
            ko(`${b.key} — ABSENT de l org. Le bloc n a jamais ete deploye.`);
            aJour = false;
            continue;
        }

        const asset = await sfmcFetch('GET', `/asset/v1/content/assets/${id}`);
        const distant = contenuDe(asset);

        console.log(`  ${b.key}`);
        info(`local ${local.length} o · deploye ${distant.length} o` +
             (asset.modifiedDate ? ` · modifie ${asset.modifiedDate}` : ''));

        if (b.fichier !== 'picklist-handler.ampscript') {
            info(distant.length ? 'present' : 'VIDE');
            console.log('');
            continue;
        }

        for (const m of MARQUEURS) {
            if (distant.includes(m.texte)) ok(m.quoi);
            else { ko(`${m.quoi} — ABSENT du bloc deploye`); aJour = false; }
        }
        console.log('');
    }

    if (!aJour) {
        console.log('  \x1b[31mLe bloc deploye n est pas celui du depot.\x1b[0m');
        console.log('  → npm run deploy:socle -- --push --mid=' +
                    process.env.SFMC_ACCOUNT_ID + '\n');
    } else {
        ok('Le bloc deploye porte bien les regles du depot.\n');
    }

    /* ---- 2. La page porte-t-elle une copie figee du socle ? ------------
       C est le piege §1.3 : avec l inlining, redeployer le bloc ne touche
       AUCUNE page deja publiee. Une page publiee avant SOCLE_INLINE=false
       execute donc encore le code d avant, indefiniment. */
    console.log('  Pages publiees');
    console.log('  ─────────────────────────────────────────────');
    console.log(`  SOCLE_INLINE = ${process.env.SOCLE_INLINE || '(non pose -> inlining ACTIF)'}`);
    /* Portee reelle, dite franchement : on n'interroge que les assets
       `webpage` de Content Builder. Une CloudPage creee depuis l'app
       CloudPages n'y figure pas forcement. Une liste vide ne prouve donc PAS
       qu'aucune page ne porte de socle fige — le verdict du bloc ci-dessus,
       lui, est sur. */
    console.log('  (assets « webpage » de Content Builder uniquement)\n');

    const r = await sfmcFetch('POST', '/asset/v1/content/assets/query', {
        page: { page: 1, pageSize: 50 },
        query: { property: 'assetType.name', simpleOperator: 'equal', value: 'webpage' },
        fields: ['id', 'name', 'customerKey', 'modifiedDate'],
    });
    let pages = (r && r.items) || [];
    if (pageDemandee) {
        const f = pageDemandee.toLowerCase();
        pages = pages.filter((p) => String(p.name || '').toLowerCase().includes(f));
    }

    if (!pages.length) {
        info(pageDemandee ? `aucune page ne contient « ${pageDemandee} »`
                          : 'aucune page trouvee sur cette BU');
        console.log('');
        return;
    }

    let figees = 0, orphelines = 0;
    for (const p of pages) {
        const a = await sfmcFetch('GET', `/asset/v1/content/assets/${p.id}`);
        const html = contenuDe(a);

        // Espaces libres dans l'appel : le builder ne l'ecrit pas toujours pareil.
        const parCle = /ContentBlockByKey\(\s*["']LPB_Picklist_Handler_AG["']/.test(html);
        const inline = html.includes("REGLES D'AFFICHAGE");
        const socleInline = html.includes('window.SOCLE_DATA');
        // Une page SANS socle mais AVEC un de nos <select> est le cas le plus
        // trompeur : le formulaire s'affiche, avec ses seules options statiques.
        const aFormulaire = /name="(VousEtes|StudyLevel|Campus)"/.test(html);

        if (parCle) {
            ok(`${p.name} — appelle le bloc par cle : le correctif s applique aussitot`);
        } else if (inline) {
            ok(`${p.name} — socle inline, et A JOUR`);
        } else if (socleInline) {
            ko(`${p.name} — socle inline FIGE, version d AVANT le correctif`);
            info('a republier depuis le builder (redeployer le bloc n y changera rien)');
            figees++;
        } else if (aFormulaire) {
            ko(`${p.name} — formulaire SANS socle : seules les options statiques s affichent`);
            info('page anterieure au correctif du builder — a republier');
            orphelines++;
        } else {
            info(`${p.name} — ni socle ni formulaire (page hors perimetre)`);
        }
    }

    console.log('');
    if (orphelines) {
        console.log(`  \x1b[31m${orphelines} page(s) portent un formulaire sans socle.\x1b[0m ` +
                    'Aucune liste ne vient du CRM : republier ces pages.\n');
    }
    if (figees) {
        console.log(`  \x1b[31m${figees} page(s) a republier.\x1b[0m ` +
                    'Cf. PASSATION-FORMULAIRES.md §1.3.\n');
    }
})().catch((e) => {
    console.error('✗ ' + e.message);
    if (e.payload) console.error('  ' + JSON.stringify(e.payload));
    process.exit(1);
});
