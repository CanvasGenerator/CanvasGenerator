'use strict';
/**
 * Injection de variables d'environnement dans le socle AMPscript, a la
 * PUBLICATION — jamais a l'execution : une CloudPage n'a pas de process.env.
 *
 * Un jeton `%%ENV:NOM%%` dans un fichier du socle est remplace par la valeur
 * de `process.env.NOM` au moment ou le fichier est inline dans une page
 * (lib/socle-inliner.js) ou pousse en Content Block (scripts/deploy-socle-
 * blocks.js). Les deux chemins passent ici, pour qu'une page et le bloc
 * partage disent la meme chose.
 *
 * Les drapeaux `*_LAUNCH` sont normalises en "true" / "false" : l'AMPscript
 * compare des chaines, et « TRUE », « 1 » ou une variable absente ne doivent
 * pas ouvrir une fonctionnalite par accident. Absent = ferme.
 *
 * ⚠ Ce mecanisme sert aux DRAPEAUX, pas aux secrets : ce qui passe ici finit
 * dans 120 pages publiees et deux Content Blocks. Les identifiants d'API
 * vivent dans la DE LPB_Config_Api, lue par Lookup a l'execution.
 */
const DEFAUTS = {
    SFMC_JOURNEY_LAUNCH: 'false',
    /* Lignes de journal « avant ... » du handler : utiles en developpement,
       9 InsertData de trop en production (piste 2 du 14/09). */
    SFMC_LOG_DETAIL: 'false',
    /* Soumission asynchrone : le POST du visiteur est mis en file et repond
       aussitot, le traitement CRM + journey est rejoue en arriere-plan. */
    SFMC_ASYNC_SOUMISSION: 'false',
    /* Cache DE des blocs JS du socle de lecture (picklists, programmes,
       dates) : 14 a 16 lectures CRM par affichage evitees. Picklists sous une
       cle du JOUR (nouvelle valeur chaque jour), programmes 6 h, dates 1 h ;
       les deux derniers sortent du cache quand SFMC_LECTURE_DE_SYNC les sert. */
    SFMC_CACHE_LECTURE: 'false',
    /* Lecture des evenements (instances, ateliers), du nom de marque et,
       depuis le 30/09, des programmes / PTAT / rentrees dans les DE
       synchronisees Salesforce (ENT.*, ~15 min) au lieu du CRM. */
    SFMC_LECTURE_DE_SYNC: 'false',
    /* Cle de la page de traitement dediee (Interne_TRAITEMENT_V0…), posee par
       generer-lp quand le mode asynchrone est ouvert. Vide : le traitement
       repasse par la page du visiteur. */
    SFMC_PAGE_TRAITEMENT: '',
};

const RE_ENV = /%%ENV:([A-Z0-9_]+)%%/g;

/* Drapeaux booleens : les `*_LAUNCH`, plus ceux nommes ici. */
const BOOLEENS = new Set(['SFMC_LOG_DETAIL', 'SFMC_ASYNC_SOUMISSION', 'SFMC_CACHE_LECTURE', 'SFMC_LECTURE_DE_SYNC']);

function normaliser(nom, valeur) {
    if (nom.endsWith('_LAUNCH') || BOOLEENS.has(nom)) {
        return String(valeur).trim().toLowerCase() === 'true' ? 'true' : 'false';
    }
    return String(valeur);
}

function injecterEnv(contenu, env = process.env) {
    return String(contenu).replace(RE_ENV, (jeton, nom) => {
        let v = env[nom];
        if (v === undefined || v === '') v = Object.prototype.hasOwnProperty.call(DEFAUTS, nom) ? DEFAUTS[nom] : '';
        return normaliser(nom, v);
    });
}

/** Les jetons encore presents apres injection — pour un garde-fou de publication. */
function jetonsRestants(contenu) {
    return [...String(contenu).matchAll(RE_ENV)].map((m) => m[1]);
}

module.exports = { injecterEnv, jetonsRestants, DEFAUTS };
