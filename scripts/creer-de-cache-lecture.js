/**
 * ============================================================================
 *  CREE LA DATA EXTENSION LPB_Cache_Lecture
 * ============================================================================
 *  Cache des blocs JS que le socle de LECTURE (`picklist-handler.ampscript`)
 *  construit a chaque affichage a partir du CRM : picklists, libelles de la
 *  cascade, programmes / PTAT / rentrees d'une ecole, dates d'evenement et
 *  ateliers. Une ligne par bloc, le JS decoupe en tranches de 4 000
 *  caracteres (Json1..Json16, soit 64 Ko au plus — un bloc plus gros n'est
 *  simplement pas mis en cache).
 *
 *  La DE est alimentee PAR LA PAGE ELLE-MEME (bloc SSJS ==CACHE_LECTURE_ECRIRE==)
 *  au premier affichage apres expiration : aucune automation a planifier.
 *
 *  A creer AVANT d'ouvrir SFMC_CACHE_LECTURE. Le socle la lit et l'ecrit en
 *  SSJS sous try/catch : absente, elle ne tue pas la page (le CRM est relu a
 *  chaque affichage, comme avant), mais le cache ne sert a rien.
 *
 *  Pourquoi SOAP : l'API REST ne cree pas de Data Extension (meme chemin que
 *  creer-de-indicatifs.js). Dossier : celui de LPB_File_Soumissions, lu sur
 *  l'org — les DE LPB rangees ailleurs sont invisibles dans l'UI de la BU.
 *
 *  IDEMPOTENT : si la DE existe deja, rien n'est touche.
 *
 *  Usage :
 *      node scripts/creer-de-cache-lecture.js           # simulation
 *      node scripts/creer-de-cache-lecture.js --push    # creation reelle
 * ============================================================================
 */
'use strict';

require('dotenv').config({ quiet: true });
const sfmc = require('../lib/sfmc');

const CLE = 'LPB_Cache_Lecture';
const DE_VOISINE = 'LPB_File_Soumissions';
const NB_TRANCHES = 16;
const PUSH = process.argv.includes('--push');

const CHAMPS = [
    { nom: 'Cle',      type: 'Text',   len: 120, pk: true, requis: true },
    { nom: 'Famille',  type: 'Text',   len: 120 },
    { nom: 'Ecole',    type: 'Text',   len: 40 },
    { nom: 'MisAJour', type: 'Date' },
    { nom: 'Epoch',    type: 'Text',   len: 20 },
    { nom: 'Octets',   type: 'Number' },
];
for (let i = 1; i <= NB_TRANCHES; i++) CHAMPS.push({ nom: `Json${i}`, type: 'Text', len: 4000 });

const esc = sfmc.soapEsc;

async function retrieve(objet, props, filtreProp, filtreVal) {
    const r = await sfmc.soapRequest('Retrieve',
        '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>'
        + `<ObjectType>${objet}</ObjectType>` + props.map((p) => `<Properties>${p}</Properties>`).join('')
        + `<Filter xsi:type="SimpleFilterPart"><Property>${filtreProp}</Property><SimpleOperator>equals</SimpleOperator><Value>${esc(filtreVal)}</Value></Filter>`
        + '</RetrieveRequest></RetrieveRequestMsg>');
    return r.text;
}

(async () => {
    console.log(`\n  Data Extension « ${CLE} »  —  BU ${process.env.SFMC_ACCOUNT_ID}`);

    if (/<CustomerKey>/.test(await retrieve('DataExtension', ['CustomerKey', 'Name'], 'CustomerKey', CLE))) {
        console.log('  ✓ Elle existe déjà. Rien à faire.\n');
        return;
    }
    const voisine = await retrieve('DataExtension', ['CategoryID'], 'CustomerKey', DE_VOISINE);
    const categorie = (voisine.match(/<CategoryID>(\d+)/) || [])[1];
    if (!categorie) throw new Error(`dossier introuvable : ${DE_VOISINE} absente de cette BU`);
    console.log(`  Absente. Dossier cible : ${categorie} (celui de ${DE_VOISINE})`);
    console.log(`  ${CHAMPS.length} champs : Cle (PK), Famille, Ecole, MisAJour, Epoch, Octets, Json1..Json${NB_TRANCHES}\n`);

    if (!PUSH) { console.log('  MODE SIMULATION — relancer avec --push pour créer.\n'); return; }

    const champsXml = CHAMPS.map((c) =>
        `<Field><CustomerKey>${c.nom}</CustomerKey><Name>${c.nom}</Name><FieldType>${c.type}</FieldType>`
        + (c.len ? `<MaxLength>${c.len}</MaxLength>` : '')
        + (c.pk ? '<IsPrimaryKey>true</IsPrimaryKey>' : '')
        + `<IsRequired>${c.requis ? 'true' : 'false'}</IsRequired></Field>`).join('');
    const r = await sfmc.soapRequest('Create',
        '<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">'
        + `<Objects xsi:type="DataExtension"><CustomerKey>${CLE}</CustomerKey><Name>${CLE}</Name>`
        + `<CategoryID>${categorie}</CategoryID><IsSendable>false</IsSendable><Fields>${champsXml}</Fields>`
        + '</Objects></CreateRequest>');
    const statut = (r.text.match(/<OverallStatus>([^<]*)/) || [])[1];
    if (statut !== 'OK') throw new Error(`création refusée : ${(r.text.match(/<StatusMessage>([^<]*)/) || [])[1] || statut}`);

    const relu = await retrieve('DataExtensionField', ['Name'], 'DataExtension.CustomerKey', CLE);
    const noms = [...relu.matchAll(/<Name>([^<]*)<\/Name>/g)].map((m) => m[1]);
    const manquants = CHAMPS.map((c) => c.nom).filter((n) => !noms.includes(n));
    if (manquants.length) throw new Error(`champs absents après création : ${manquants.join(', ')}`);
    console.log(`  ✓ Créée, ${noms.length} champs relus sur l'org.\n`);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
