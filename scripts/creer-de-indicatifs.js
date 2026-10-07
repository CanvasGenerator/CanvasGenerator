/**
 * ============================================================================
 *  CREE LA DATA EXTENSION LPB_Mapping_Indicatifs
 * ============================================================================
 *  Longueur de numéro attendue par indicatif, lue par le socle
 *  (`picklist-handler.ampscript`, étape 2bis) pour bloquer les erreurs de
 *  saisie du téléphone. Retour client du 02/09.
 *
 *  La DE est créée **VIDE** : le contenu est du ressort du métier, et
 *  `sfmc-ssjs/socle/LPB_Mapping_Indicatifs.csv` sert d'amorce à importer.
 *
 *  Pourquoi SOAP et pas REST : l'API REST de Marketing Cloud ne crée pas de
 *  Data Extension. `ensureCampusDE` dans lib/sfmc.js suit le même chemin.
 *
 *  IDEMPOTENT : si la DE existe déjà, on ne touche à rien et on le dit. Aucune
 *  suppression, aucune modification de champ, aucune écriture de ligne — ce
 *  script ne peut pas détruire de données.
 *
 *  Usage :
 *      node scripts/creer-de-indicatifs.js               # simulation
 *      node scripts/creer-de-indicatifs.js --push        # création réelle
 * ============================================================================
 */
'use strict';

require('dotenv').config({ quiet: true });

const { getAccessToken, isSfmcCredentialsConfigured } = require('../lib/sfmc');

const NOM = 'LPB_Mapping_Indicatifs';
const CLE = 'LPB_Mapping_Indicatifs';

/* Le dossier des autres DE de mapping (LPB_Mapping_Ecoles, _Niveaux,
   _Campagnes). Sans effet fonctionnel — le socle fait `Lookup` par NOM, pas par
   dossier — mais une DE égarée ailleurs est une DE qu'on ne retrouve pas. */
const CATEGORIE = process.env.SFMC_DE_CATEGORY_ID
    ? parseInt(process.env.SFMC_DE_CATEGORY_ID, 10) : null;

/* Longueurs volontairement courtes : un champ trop large invite à y ranger
   autre chose. `Actif` tient "false" (5). Types TEXTE partout, comme les autres
   DE de mapping — AMPscript lit tout en texte de toute façon, et un champ
   Number rendrait `Empty()` moins prévisible. */
const CHAMPS = [
    { nom: 'Indicatif', len: 6,   pk: true,  requis: true },
    { nom: 'Pays',      len: 100, pk: false, requis: false },
    { nom: 'NbMin',     len: 3,   pk: false, requis: false },
    { nom: 'NbMax',     len: 3,   pk: false, requis: false },
    { nom: 'Actif',     len: 5,   pk: false, requis: false },
];

const PUSH = process.argv.includes('--push');

const SOUS_DOMAINE = (process.env.SFMC_AUTH_SUBDOMAIN || '').trim();

function esc(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function soap(action, innerXml) {
    const { accessToken } = await getAccessToken();
    const url = `https://${SOUS_DOMAINE}.soap.marketingcloudapis.com/Service.asmx`;
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <s:Header><fueloauth xmlns="http://exacttarget.com">${accessToken}</fueloauth></s:Header>
  <s:Body>${innerXml}</s:Body>
</s:Envelope>`;
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml', 'SOAPAction': action },
        body,
    });
    const text = await r.text();
    return {
        ok: r.ok,
        statut: (text.match(/<OverallStatus>([^<]*)<\/OverallStatus>/i) || [])[1] || '',
        message: (text.match(/<StatusMessage>([^<]*)<\/StatusMessage>/i) || [])[1] || '',
        text,
    };
}

(async () => {
    if (!isSfmcCredentialsConfigured()) {
        console.error('✗ Identifiants SFMC absents du .env.');
        process.exit(2);
    }
    if (!SOUS_DOMAINE) {
        console.error('✗ SFMC_AUTH_SUBDOMAIN absent du .env : endpoint SOAP introuvable.');
        process.exit(2);
    }

    console.log(`\n  Data Extension « ${NOM} »`);
    console.log('  ─────────────────────────────────────────────');
    console.log(`  BU      : ${process.env.SFMC_ACCOUNT_ID}`);
    console.log(`  Dossier : ${CATEGORIE || '(racine)'}\n`);

    /* ---- 1. Existe-t-elle deja ? ------------------------------------- */
    const check = await soap('Retrieve',
        '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>'
        + '<ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties>'
        + '<Properties>Name</Properties>'
        + '<Filter xsi:type="SimpleFilterPart"><Property>CustomerKey</Property>'
        + `<SimpleOperator>equals</SimpleOperator><Value>${esc(CLE)}</Value></Filter>`
        + '</RetrieveRequest></RetrieveRequestMsg>');

    if (/<CustomerKey>/.test(check.text)) {
        console.log('  ✓ Elle existe déjà. Rien à faire — ce script ne modifie');
        console.log('    jamais une DE en place (ni champs, ni lignes).\n');
        process.exit(0);
    }
    console.log('  Absente de cette BU.\n');

    console.log('  Champs à créer :');
    for (const c of CHAMPS) {
        console.log(`    ${c.nom.padEnd(11)} Text(${String(c.len).padEnd(3)})`
            + `${c.pk ? ' · clé primaire' : ''}${c.requis && !c.pk ? ' · requis' : ''}`);
    }
    console.log('');

    if (!PUSH) {
        console.log('  MODE SIMULATION — rien n\'est envoyé à SFMC.');
        console.log('  Relancer avec --push pour créer réellement.\n');
        process.exit(0);
    }

    /* ---- 2. Creation --------------------------------------------------- */
    const champsXml = CHAMPS.map((c) =>
        `<Field><CustomerKey>${esc(c.nom)}</CustomerKey><Name>${esc(c.nom)}</Name>`
        + `<FieldType>Text</FieldType><MaxLength>${c.len}</MaxLength>`
        + (c.pk ? '<IsPrimaryKey>true</IsPrimaryKey>' : '')
        + `<IsRequired>${c.requis ? 'true' : 'false'}</IsRequired></Field>`
    ).join('');

    const creation = await soap('Create',
        '<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">'
        + `<Objects xsi:type="DataExtension"><CustomerKey>${esc(CLE)}</CustomerKey>`
        + `<Name>${esc(NOM)}</Name>`
        + (CATEGORIE ? `<CategoryID>${CATEGORIE}</CategoryID>` : '')
        + `<IsSendable>false</IsSendable><Fields>${champsXml}</Fields>`
        + '</Objects></CreateRequest>');

    if (creation.statut !== 'OK' && !/already exists/i.test(creation.text)) {
        console.error(`  ✗ Création refusée : ${creation.message || creation.statut || 'HTTP ' + creation.ok}`);
        console.error('    Réponse brute (extrait) :');
        console.error('    ' + creation.text.replace(/\s+/g, ' ').slice(0, 500));
        process.exit(1);
    }

    console.log('  ✓ Data Extension créée, et VIDE.\n');

    /* ---- 3. Relecture : on ne se fie pas au statut renvoye ------------- */
    const relu = await soap('Retrieve',
        '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>'
        + '<ObjectType>DataExtensionField</ObjectType>'
        + '<Properties>Name</Properties><Properties>FieldType</Properties>'
        + '<Properties>MaxLength</Properties><Properties>IsPrimaryKey</Properties>'
        + '<Filter xsi:type="SimpleFilterPart"><Property>DataExtension.CustomerKey</Property>'
        + `<SimpleOperator>equals</SimpleOperator><Value>${esc(CLE)}</Value></Filter>`
        + '</RetrieveRequest></RetrieveRequestMsg>');

    const noms = [...relu.text.matchAll(/<Name>([^<]*)<\/Name>/g)].map((m) => m[1]);
    console.log('  Champs relus sur l\'org : ' + (noms.length ? noms.join(', ') : '(aucun)'));

    const manquants = CHAMPS.map((c) => c.nom).filter((n) => !noms.includes(n));
    if (manquants.length) {
        console.error(`\n  ✗ Champs absents après création : ${manquants.join(', ')}`);
        process.exit(1);
    }

    console.log('\n  Prochaine étape : importer');
    console.log('  sfmc-ssjs/socle/LPB_Mapping_Indicatifs.csv (virgule, en-têtes, Overwrite),');
    console.log('  puis `npm run dump:socle` avant tout déploiement du socle.\n');
})().catch((e) => {
    console.error('✗ ' + e.message);
    process.exit(1);
});
