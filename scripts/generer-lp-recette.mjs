/**
 * ============================================================================
 *  GENERATION DES LANDING PAGES DE RECETTE — 10 ECOLES x 6 FORMULAIRES
 * ============================================================================
 *  Assemble le trio header + formulaire + footer de chaque ecole et publie la
 *  page dans Content Builder sous la cle `Recette_<TYPE>_<ECOLE>_V0`.
 *
 *  Usage :
 *      node scripts/generer-lp-recette.mjs                          simulation
 *      node scripts/generer-lp-recette.mjs --only=efap:BRCH         une seule
 *      SFMC_SYNC_ENABLED=true node scripts/generer-lp-recette.mjs --push --mid=536010339
 *
 *  --mid est OBLIGATOIRE avec --push : il confirme la Business Unit visee.
 *  536010339 = RECETTE EDH · 536009308 = entreprise parente (a eviter).
 *
 *  ⚠ SFMC_SYNC_ENABLED. La synchro sortante est coupee par defaut dans
 *  lib/sfmc.js (`SFMC_SYNC_ENABLED`), et sans elle syncProjectToSfmc rend
 *  `{skipped:true}` SANS erreur — on croirait avoir publie 60 pages sans en
 *  publier une seule. Le script refuse donc de tourner en --push sans elle.
 *
 *  ⚠ POURQUOI UN STUB D'EDITEUR. Les blocs sont des modules GrapesJS :
 *  `export default (editor) => editor.BlockManager.add(id, { content })`. Ils
 *  ne rendent pas du HTML, ils s'ENREGISTRENT. On leur passe donc un editeur
 *  factice dont le seul role est de capturer `content`. Aucun des blocs
 *  utilises ici ne touche `window` ni `document` a l'enregistrement — verifie
 *  sur les 22 modules concernes.
 * ============================================================================
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
require('dotenv').config({ quiet: true });

const { syncProjectToSfmc, customerKeyFor, isSfmcConfigured } = require('../lib/sfmc');
const ECOLES = require('../schools.json');

/* Type -> bloc GrapesJS. Les codes sont ceux deja employes dans Content
   Builder (Formulaire_BRCH_EFAP, Formulaire_AD_EFAP...). */
const FORMULAIRES = [
    { code: 'BRCH', bloc: 'blocks/forms/form-brochure/index.js',    id: 'form-brochure',    libelle: 'Brochure' },
    { code: 'CAND', bloc: 'blocks/forms/form-candidature/index.js', id: 'form-candidature', libelle: 'Candidature' },
    { code: 'JPO',  bloc: 'blocks/forms/form-jpo/index.js',         id: 'form-jpo',         libelle: 'Journee portes ouvertes' },
    { code: 'AD',   bloc: 'blocks/forms/form-atelier/index.js',     id: 'form-atelier',     libelle: 'Atelier decouverte' },
    { code: 'STG',  bloc: 'blocks/forms/form-stage/index.js',       id: 'form-stage',       libelle: 'Inscription stage' },
    { code: 'IMM',  bloc: 'blocks/forms/form-immersion/index.js',   id: 'form-immersion',   libelle: 'Demande immersion' },
];

/* -- arguments ----------------------------------------------------------- */
const args = process.argv.slice(2);
const PUSH = args.includes('--push');
const MID  = (args.find((a) => a.startsWith('--mid=')) || '').split('=')[1];
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const SORTIE = path.join(process.cwd(), '.lp-recette');

const RACINE = process.cwd();

/* ---- LE SOCLE EST TOUJOURS INLINE -------------------------------------
   Avec SOCLE_INLINE=false la page appelle `%%=ContentBlockByKey("LPB_...")=%%`,
   donc la version du socle DEPLOYEE dans Content Builder — qui peut dater
   d'une autre branche. Les pages de recette doivent porter le code de la
   branche qu'on est en train de tester, pas celui d'hier.

   On force donc l'inlining ici plutot que de dependre de l'environnement : une
   variable oubliee publierait 60 pages sur du vieux code, sans que rien ne le
   dise. */
process.env.SOCLE_INLINE = 'true';

/** Editeur factice : il ne sait qu'une chose, retenir ce qu'on lui ajoute. */
function stubEditor(recolte) {
    return {
        BlockManager: { add: (id, def) => { recolte.set(id, (def && def.content) || ''); return def; },
                        getAll: () => [], get: () => null, remove() {} },
        DomComponents: { addType() {}, getType: () => null },
        Components: { addType() {} },
        on() {}, Canvas: { getDocument: () => null },
        getConfig: () => ({}), Commands: { add() {} }, Panels: { addButton() {} },
        StyleManager: { addSector() {} }, CssComposer: { addRules() {} },
    };
}

const cache = new Map();
/** Le HTML d'un bloc, par son chemin de module et son identifiant. */
async function rendreBloc(cheminModule, blocId) {
    if (!cache.has(cheminModule)) {
        const recolte = new Map();
        const m = await import('file://' + path.join(RACINE, cheminModule));
        if (typeof m.default !== 'function') throw new Error(`${cheminModule} n'exporte pas de fonction`);
        m.default(stubEditor(recolte), {});
        cache.set(cheminModule, recolte);
    }
    const recolte = cache.get(cheminModule);
    if (!recolte.has(blocId)) {
        throw new Error(`bloc « ${blocId} » absent de ${cheminModule} (vus : ${[...recolte.keys()].join(', ') || 'aucun'})`);
    }
    return recolte.get(blocId);
}

/**
 * Les `<svg>` inline TUENT la page a la publication — silencieusement.
 *
 * Mesure du 03/09, reproduite a l'identique : la meme page de 369 Ko avec ses
 * sept `<svg>` est stockee tronquee a 21 Ko, sans aucun `<form>` ; debarrassee
 * de ses SVG, elle passe INTACTE. La divergence commence a l'octet pres sur le
 * premier `<svg>` : le sanitiseur de l'API bute dessus et jette tout le reste
 * du corps. L'API repond 200, et rien ne signale la perte.
 *
 * ⚠ Ce n'est PAS une question de taille : 400 Ko de HTML ordinaire passent
 * sans broncher, et un `<svg>` seul dans un document de 271 octets passe aussi.
 * C'est la conjonction des deux. J'ai cru successivement a un plafond de poids
 * puis a un rejet du SVG en soi : les deux hypotheses ont ete refutees par
 * l'experience, et seule celle-ci tient.
 *
 * On encode donc chaque SVG en data-URI porte par un `<img>` — du HTML
 * ordinaire, que le sanitiseur laisse passer. La classe est conservee, donc le
 * CSS continue de dimensionner l'icone.
 *
 * `currentColor` devient #333 : dans un `<img>`, la couleur n'est plus heritee
 * du texte. C'est la valeur que `.jpo-event-ico` porte deja, et le commentaire
 * de event-form.js prevoyait explicitement ce cas.
 */
function svgVersImage(html) {
    return html.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g, (tout, attrs, corps) => {
        const classe = (attrs.match(/class="([^"]*)"/) || [, ''])[1];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg"${attrs}>${corps}</svg>`
            .replace(/currentColor/g, '#333');
        const data = Buffer.from(svg, 'utf8').toString('base64');
        return `<img class="${classe} svg-inline" alt="" aria-hidden="true" src="data:image/svg+xml;base64,${data}">`;
    });
}

/**
 * Le CSS qui visait la BALISE `svg` ne trouve plus rien apres la conversion.
 *
 * `school-brand` dimensionne ainsi les icones sociales du pied de page :
 *     .footer-efap .ftr-efap-soc svg { width: 18px; height: 18px; ... }
 * Sans ce complement, ces icones se rendent en 0x0 — mesure faite sur la page
 * publiee, deux icones sur sept invisibles. Le formulaire, lui, s'en tirait :
 * ses icones sont dimensionnees par une CLASSE, qui survit a la conversion.
 *
 * On duplique donc chaque selecteur finissant par `svg` vers la marque
 * `img.svg-inline` que pose la conversion. Borne aux blocs <style> : le reste
 * du document ne doit pas etre touche.
 */
function cssPourImages(html) {
    return html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/g, (tout, css) => {
        const patche = css.replace(/([^,{}\n]+?)\ssvg(\s*[,{])/g,
            (m, prefixe, suite) => `${prefixe} svg, ${prefixe} img.svg-inline${suite}`);
        return tout.replace(css, patche);
    });
}

function page({ titre, header, formulaire, footer }) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre}</title>
</head>
<body>
${header}
${formulaire}
${footer}
</body>
</html>`;
}

/* -- garde-fous ---------------------------------------------------------- */
if (PUSH) {
    if (MID !== process.env.SFMC_ACCOUNT_ID) {
        console.error(`❌ --mid=${MID || '(absent)'} ne correspond pas a SFMC_ACCOUNT_ID=${process.env.SFMC_ACCOUNT_ID}.`);
        process.exit(1);
    }
    if (!isSfmcConfigured()) {
        console.error('❌ Synchro sortante desactivee : relancer avec SFMC_SYNC_ENABLED=true.\n'
                    + '   Sans elle syncProjectToSfmc ignore tout SANS erreur, et le script\n'
                    + '   annoncerait 60 publications sans en faire aucune.');
        process.exit(1);
    }
}

/* -- execution ----------------------------------------------------------- */
const travaux = [];
for (const ecole of ECOLES) {
    for (const f of FORMULAIRES) {
        if (ONLY && ONLY.toLowerCase() !== `${ecole.id}:${f.code}`.toLowerCase()) continue;
        travaux.push({ ecole, f });
    }
}

console.log(`\n  Landing pages de recette — ${travaux.length} page(s)`);
console.log(`  Business Unit : ${process.env.SFMC_ACCOUNT_ID}`);
console.log(`  Mode : ${PUSH ? 'PUBLICATION' : 'simulation (aucun envoi)'}\n`);

if (!PUSH) fs.mkdirSync(SORTIE, { recursive: true });

const liens = [];
const echecs = [];

for (const { ecole, f } of travaux) {
    const ECOLE = ecole.id.toUpperCase().replace(/-/g, '_');
    const nomProjet = `school-${ecole.id}__Recette_${f.code}_${ECOLE}_V0`;
    const cle = customerKeyFor(nomProjet);
    try {
        const [header, formulaire, footer] = await Promise.all([
            rendreBloc(`blocks/header-${ecole.id}/index.js`, `header-${ecole.id}`),
            rendreBloc(f.bloc, f.id),
            rendreBloc(`blocks/footer-${ecole.id}/index.js`, `footer-${ecole.id}`),
        ]);
        const html = cssPourImages(svgVersImage(page({ titre: `${ecole.name} — ${f.libelle}`, header, formulaire, footer })));

        if (!PUSH) {
            fs.writeFileSync(path.join(SORTIE, `${cle}.html`), html);
            console.log(`  ○ ${cle.padEnd(34)} ${String(html.length).padStart(7)} car.`);
        } else {
            const r = await syncProjectToSfmc({ projectName: nomProjet, fullHtml: html });
            if (r.skipped) throw new Error(`ignore par la lib : ${r.error || 'synchro desactivee'}`);
            console.log(`  ✓ ${cle.padEnd(34)} ${r.action || 'ok'}`);
        }
        liens.push({ ecole: ecole.name, formulaire: f.libelle, cle });
    } catch (e) {
        echecs.push({ cle, message: e.message });
        console.log(`  ✗ ${cle.padEnd(34)} ${e.message.slice(0, 90)}`);
    }
}

console.log(`\n  ${liens.length} page(s) ${PUSH ? 'publiee(s)' : 'generee(s)'} · ${echecs.length} echec(s)`);
if (!PUSH) console.log(`  HTML ecrit dans ${SORTIE}`);

/* Le lien a diffuser est celui de la CloudPage `landingpage` : c'est la SEULE
   qui traite les parametres de tracking. Mesure du 01/09 sur une meme page :
   `landingpage?id=` remplit utm_source, utm_campaign, gclid, canal et
   sous_canal ; `mini-blocks-recette?contentkey=` les laisse tous vides. */
if (liens.length) {
    console.log('\n  | École | Formulaire | Lien |');
    console.log('  |---|---|---|');
    for (const l of liens) {
        console.log(`  | ${l.ecole} | ${l.formulaire} | https://cloud.groupe-edh.net/landingpage?id=${l.cle} |`);
    }
}
if (echecs.length) process.exitCode = 1;
