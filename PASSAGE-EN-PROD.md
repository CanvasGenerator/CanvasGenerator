# Passage en production — procédure et inventaire

État de référence : `dev-forms` (Recette) et `optimisation-temps` (Interne) au 27/09/2026.
BU de travail actuelle : **RECETTE EDH (MID 536010339)**. BU cible : **la BU de prod
(MID 536009308, l'entreprise parente — à confirmer avec l'admin SFMC avant toute
écriture)**. Le paquet API du `.env` obtient déjà un jeton sur cette BU
(`account_id=536009308`) : il a servi à lire `CTA_demande_documentation` de prod le 27/09.

Rien dans le code n'est propre à la Recette, sauf ce que la section 1 liste.
Tout le reste est de la **configuration SFMC** : Data Extensions, blocs, pages,
automation, journeys, et les identifiants Salesforce des tables de mapping.

---

## 1. Ce qui doit changer dans le dépôt avant le passage

| Sujet | Où | Quoi |
|---|---|---|
| Lot de publication | `scripts/generer-lp.mjs`, `PREFIXES` | Ajouter le lot `prod` (préfixe des clés, ex. `Prod_`) ou décider que la prod publie sous un préfixe existant. Les clés Content Builder deviennent `<Prefixe>_<TYPE>[_EN]_<ECOLE>_V0` et `<Prefixe>_TRAITEMENT_V0`. |
| Garde-fou `--mid` | `generer-lp.mjs`, `deploy-socle-blocks.js` | `--mid` doit égaler `SFMC_ACCOUNT_ID` ; les commentaires disent « 536009308 à éviter ». À inverser le jour J. |
| GTM temporaire | `generer-lp.mjs --gtm` | Décider : retirer l'injection (les sites portent leur propre GTM) ou la garder avec les conteneurs de prod. Aujourd'hui elle est **temporaire**, activée à la main par `--gtm`. |
| Lien des pages | `generer-lp.mjs` (tableau de sortie) | Le domaine `cloud.groupe-edh.net/landingpage` est celui de la CloudPage : vérifier qu'il est le même en prod, sinon corriger l'affichage des liens (le socle, lui, ne le code pas en dur : le beacon lit `window.location`). |
| Sondes de diagnostic | `mini-blocks-recette?contentkey=LPB_TST_*` | Pages de recette uniquement. Facultatif en prod (voir §6). |
| `.env` | racine | `SFMC_ACCOUNT_ID`, `SFMC_CATEGORY_ID`/`_NAME`, `SFMC_SOCLE_CATEGORY_ID`, `SFMC_DE_CATEGORY_ID` de la BU de prod ; drapeaux de la section 5. |

---

## 2. Data Extensions de la BU de prod

> ✅ **Créées le 05/10/2026 dans la BU 536009308** par
> `scripts/creer-de-prod.js` (définitions : `sfmc-ssjs/de/LPB_DE_definitions.json`,
> relevées sur la Recette). Dossier `Data Extensions / LP_Builder` (41678) :
> `LPB 1 - Mapping CRM` (50615), `LPB 2 - Configuration formulaires` (50616),
> `LPB 3 - Journeys et API` (50617), `LPB 4 - Technique` (50618). Les 13 DE y
> sont, noms et clés identiques, non sendable, mêmes champs. Les lignes des
> tables de **configuration pure** ont été copiées depuis la Recette (niveaux 18,
> indicatifs 60, config formulaires 10, champs école 10, conditions 2,
> dictionnaire 415). **Restent vides** : les trois mappings (Ids de prod à
> saisir), `LPB_Config_Api` (`journey-config-upsert.js`), et les tables
> techniques (remplies par les pages). Le script est idempotent :
> `SFMC_ACCOUNT_ID=536009308 node -r dotenv/config scripts/creer-de-prod.js --mid=536009308 [--push] [--copier-config]`.

Toutes **non sendable**, noms et clés externes **identiques** (`Cle == Nom`), sauf
`CTA_demande_documentation` qui existe déjà en prod. Les colonnes sont celles
relevées en Recette (`*` = clé primaire).

### 2.1 Tables de mapping — à REMPLIR avec les identifiants Salesforce de PROD

Les Ids Salesforce (comptes école, marques, campagnes) diffèrent entre l'org de
recette et l'org de prod : **ne pas copier les lignes de Recette telles quelles**.

| DE | Colonnes | Lignes en recette | À refaire en prod |
|---|---|---|---|
| `LPB_Mapping_Ecoles` | `Ecole*` T40, `Libelle` T80, `CampusPrefix` T60, `SchoolAccountId` T18, `BusinessBrandId` T18, `BrandCode` T40, `Actif` Bool | 10 | `SchoolAccountId`, `BusinessBrandId` de prod |
| `LPB_Mapping_Campus` | `Campus*` T80, `Ecole` T40, `SchoolAccountId` T18, `Actif` Bool, `Commentaire` T200 | 47 | `SchoolAccountId` de prod (compte campus, RecordType schoolEntity) |
| `LPB_Mapping_Campagnes` | `Cle*` T80, `FormType` T30, `Ecole` T40, `Zone` T10, `CampaignId` T18, `Libelle` T120, `Actif` Bool | 40 | `CampaignId` des 40 campagnes de prod (brochure × candidature × 10 écoles × FR/Intl), puis `Actif=true` |
| `LPB_Mapping_Niveaux` | `Niveau*` T60, `Ordre` Number, `Verifie` Bool | 18 | copie telle quelle |
| `LPB_Mapping_Indicatifs` | `Indicatif*` T6, `Pays` T100, `NbMin` T3, `NbMax` T3, `Actif` T5 | 60 | copie telle quelle (`sfmc-ssjs/socle/LPB_Mapping_Indicatifs.csv`) |

### 2.2 Configuration par école — copie telle quelle depuis la Recette

| DE | Colonnes | Lignes |
|---|---|---|
| `LPB_Config_Formulaires` | `Ecole*` T40, `Progressif` Bool, `OrdreChamps` T140, `LangueDefaut` T10, `SpecialiteVisible` T20, `SpecialiteNiveauMin` Num, `RythmeVisible` T20, `RythmeNiveauMin` Num, `LangueVisible` T20, `LangueNiveauMin` Num, `RentreeDecalee` Bool, `BrochureSpecialite` T20, `BrochureSpecialiteNiveauMin` Num, `Commentaire` T250 | 10 |
| `LPB_Config_Champs_Ecole` | `Ecole*` T50, `CampusVisible` T20, `ProgrammeVisible` T20, `Commentaire` T500 | 10 |
| `LPB_Config_Conditions` | `Ecole*` T50, `TypeFormulaire*` T30, `Champ*` T30, `Conditions` T500, `Actif` T5, `Commentaire` T500 | 2 |
| `LPB_Dico_Traductions` | `Cle*` T200, `Fr` T200, `En` T200, `Champ` T120, `Origine` T40, `Actif` T5, `DateMaj` Date | 415 |

⚠ `LPB_Config_Champs_Ecole` est lue par `LookupRows` sans filet : une DE absente tue
la page (voir `PASSATION-FORMULAIRES.md` §1.3).

### 2.3 Journeys et API — à renseigner avec les valeurs de PROD

| DE | Colonnes | Contenu |
|---|---|---|
| `LPB_Config_Api` | `Cle*` T50, `Valeur` T500, `Note` T300 | 8 lignes : `AuthBaseUrl`, `RestBaseUrl`, `ClientId`, `ClientSecret`, `AccountId`, `EventKey_Evenement`, `EventKey_Brochure` (résidence France), `EventKey_Brochure_Inter` (hors France, journey `Post_Demande_De_Doc_INTER`). Écrites par `node scripts/journey-config-upsert.js --from=<prod.json>` — jamais de secret dans le dépôt. |

### 2.4 Tables techniques — créées VIDES

| DE | Colonnes | Rôle |
|---|---|---|
| `LPB_Log_Soumissions` | `RowId*` T60, `RunId` T20, `Ordre` Num, `Horodatage` Date, `Etape` T60, `Statut` T20, `Objet` T60, `RecordId` T20, `Detail` T500, `Email` T120, `Ecole` T40, `FormType` T30 | journal de chaque soumission (`scripts/journal-soumission.js`). Prévoir une purge (2 500+ lignes en recette après un mois). |
| `LPB_File_Soumissions` | `RunId*` T50, `Horodatage` Date, `Url` T500, `PageId` T100, `Ecole` T40, `FormType` T30, `Email` T254, `Statut` T20, `Tentatives` Num, `DerniereTentative` Date, `RunTraitement` T50, `RecordId` T18, `Journal` T500, `Detail` T500, `Payload1..3` T4000 | file du mode asynchrone |
| `LPB_Cache_Lecture` | `Cle*` T120, `Famille` T120, `Ecole` T40, `MisAJour` Date, `Epoch` T20, `Octets` Num, `Json1..16` T4000 | cache des picklists et programmes (`scripts/creer-de-cache-lecture.js --push`) |
| `Journey_OptOut_Entry_DE` | `ConsentId*` T18, `SubscriberKey` T18, `CodeEcole` T50, `ListID` Num, `UpdateType` T20, `NewValue` T20, `DateSFMC` Date | **existe déjà** (file de l'automation de désabonnement, pas à recréer) : le handler y **supprime** la ligne du consentement qu'il vient de repasser en Opt-in (bloc « 97 - optout-purge »). Doit être visible de la BU où tournent les pages. |

### 2.5 Déjà en prod

`CTA_demande_documentation` (313 lignes, colonnes `language` et `pays` remplies) : c'est
la source qui a été recopiée en Recette le 27/09. Rien à faire.

---

## 3. Contenu à déployer (Content Builder)

1. **Blocs du socle** : `npm run deploy:socle -- --push --mid=<MID prod>` → `LPB_Socle_Config_AG`,
   `LPB_Socle_Helpers_AG`, `LPB_Socle_Resolvers_AG`, `LPB_Socle_Upsert_AG`, `LPB_Socle_Summit_AG`,
   `LPB_Socle_Read_AG`, `LPB_Form_Handler_AG`, `LPB_Picklist_Handler_AG`. Les pages inlinent le
   socle à la publication ; les blocs restent la référence et servent aux pages construites
   depuis le builder.
2. **CloudPage `landingpage`** : à créer dans la BU de prod, contenu = `cloudpage-lp.html`
   (le fichier du dépôt, version à jour avec `user_campus` et l'horodatage ISO). Publier, noter l'URL.
3. **Pages** : `node scripts/generer-lp.mjs --push --mid=<MID prod> --lot=prod [--gtm]` (60 FR),
   puis `--lang=en --types=BRCH,CAND` (20 EN). Avec `SFMC_ASYNC_SOUMISSION=true`, la page
   `<Prefixe>_TRAITEMENT_V0` est publiée avec le lot.
4. **Vérification** : `node scripts/verif-socle-deploye.js` (marqueurs du socle sur les pages
   déployées), puis un affichage de chaque type de page.

---

## 4. Automation Studio

**`LPB_Rejouer_File_Soumissions`** — obligatoire dès que le mode asynchrone est ouvert,
sinon un beacon perdu reste en file pour toujours (c'est aussi le cas en recette aujourd'hui :
l'automation existe, statut Ready, **jamais planifiée**).

1. Script Activity `SCR_LPB_Rejouer_File_Soumissions`, contenu =
   `sfmc-ssjs/automations/rejouer-file-soumissions.ssjs` tel quel.
2. Automation à un step, planifiée **toutes les 15 minutes**.
3. Elle reposte sur la colonne `Url` de la file (la page de traitement dédiée),
   3 tentatives maximum, puis statut `erreur`.

**Cron serveur du cache de lecture** (pas une automation SFMC : le script a
besoin du `.env` de prod et visite les pages en HTTP) — `SFMC_CACHE_LECTURE=true`
sans lui veut dire que le premier visiteur de chaque jour paie la relecture :

```
15 7,8 * * *   node -r dotenv/config scripts/purger-cache-lecture.js --famille=evenements --rechauffer=prod
5  6   * * 1   node -r dotenv/config scripts/purger-cache-lecture.js --rechauffer=prod
```

Le préfixe du lot (`Prod_`) doit être celui de `PREFIXES` dans `generer-lp.mjs`.

---

## 5. Drapeaux de publication (`.env` ou ligne de commande)

| Drapeau | Prod recommandé | Effet |
|---|---|---|
| `SFMC_JOURNEY_LAUNCH` | `true` | tir des API Events des journeys de prod (`LPB_Config_Api`) |
| `SFMC_ASYNC_SOUMISSION` | `true` | réception immédiate, traitement sur la page dédiée + rejeu |
| `SFMC_SOCLE_RECEPTION_SEULE` | (automatique) | posé par `generer-lp` : pages du visiteur sans les régions de traitement du handler dès que la page de traitement est publiée ; ne pas le poser à la main |
| `SFMC_CACHE_LECTURE` | `true` | picklists sous une clé du jour dans `LPB_Cache_Lecture` (programmes et dates y restent en repli si la DE synchronisée manque) |
| `SFMC_LECTURE_DE_SYNC` | `true` | événements, marque, programmes, PTAT et rentrées depuis les DE synchronisées `ENT.*` : `BusinessBrand_Salesforce`, `summit__Summit_Events__c_Salesforce_1`, `summit__Summit_Events_Instance__c_Salesforce_1`, `summit__Summit_Events_Appointment_Type__c_Salesforce`, `LearningProgram_Salesforce_1`, `ProgramTermApplnTimeline_Salesforce`, `AcademicTerm_Salesforce` (jeu partagé 32716 de l'Enterprise : en prod, vérifier qu'elles existent avec ces noms et sont visibles de la BU cible, sinon le socle retombe sur le CRM page par page) |
| `SFMC_SOCLE_DEPOUILLE` | `true` (défaut) | socle inliné sans commentaires hors SSJS |
| `SFMC_LOG_DETAIL` | `false` | lignes de journal « avant … » (diagnostic seulement) |

Ces drapeaux sont **injectés à la publication** : tout changement impose de republier le lot.
Plan de repli : republier avec `SFMC_ASYNC_SOUMISSION=false SFMC_CACHE_LECTURE=false
SFMC_LECTURE_DE_SYNC=false` rend le comportement synchrone historique, sans autre changement.

---

## 6. Prérequis côté admin SFMC / CRM

- **Marketing Cloud Connect** rattaché à la BU de prod : toute lecture et écriture
  Salesforce du socle (`RetrieveSalesforceObjects`, `CreateSalesforceObject`) passe par lui.
  En recette, MC Connect n'est pas rattaché à la BU (ticket connu) — les CloudPages
  fonctionnent quand même en AMPscript ; vérifier la même chose en prod dès la première page.
- **Synchronized Data Sources** : le second jeu (`*_Salesforce_1`, `BusinessBrand_Salesforce`,
  summit instances/événements/types d'atelier) doit être visible de la BU de prod, sinon
  `SFMC_LECTURE_DE_SYNC=false`. Pour aller plus loin : demander la synchro de
  `LearningProgram` (avec `Academic_Level_List__c`, `Speciality__c`, `Rhythm__c`,
  `InstructionLanguage__c`), `ProgramTermApplnTimeline`, `AcademicTerm`, et sur les
  instances Summit `Name` et `eventType__c`, sur les types d'atelier
  `summit__Date_Available_Start__c`, `_End__c`, `summit__Required_Appointment__c`.
- **Journeys de prod** : entrées par API Event, DE d'entrée avec **une clé par soumission**
  (`Post_Demande_De_Doc_Target` : `Id` + `Date_telechargement_brochure` ;
  `Data_contacts_evenement_new` : `Subscriberkey` + `RegistrationId` + `Nom_action`).
  L'API Event fait un INSERT strict : une clé déjà présente répond 400.
- **Paquet API** (installed package) avec accès à la BU de prod : scopes Content Builder,
  Data Extensions (SOAP), Automation ; pas besoin de `journeys_*` pour publier.
- **Campagnes** : les 40 campagnes brochure/candidature créées côté CRM prod, ids reportés
  dans `LPB_Mapping_Campagnes`.
- **Sondes** (facultatif, diagnostic) : recréer `LPB_TST_Sonde_Valeurs`, `LPB_TST_Sonde_Ecriture`
  et une page `mini-blocks` équivalente si l'on veut garder la lecture des picklists et de
  l'Apex du CRM depuis SFMC.

---

## 7. Ordre du jour J

1. Admin : MC Connect, paquet API, synchro partagée, campagnes, journeys, CloudPage `landingpage`.
2. Dépôt : lot `prod`, garde `--mid`, décision GTM, `.env` prod (§1).
3. DE : créer §2.1 à §2.4 ; remplir mappings avec les Ids de prod ; `journey-config-upsert.js` ; dico et config copiés de Recette.
4. Contenu : `deploy:socle`, puis `generer-lp` FR + EN (+ page de traitement).
5. Automation de rejeu planifiée ; cron du cache de lecture posé sur le serveur et lancé une première fois à la main (`--rechauffer=prod`, 60 pages servies, 0 échec).
6. Tests : une soumission par famille (brochure, candidature, JPO, atelier, stage, immersion) avec des e-mails de test, contrôle dans `LPB_Log_Soumissions` (`99 - fin success`, `99 - journey OK`), dans `LPB_File_Soumissions` (`traitee`), et dans le CRM. Deuxième soumission d'un même e-mail (compte connu). Page EN. Chronos dans les commentaires de page.
7. Nettoyage des comptes de test côté CRM.

---

## 8. Outils utiles

| Script | Usage |
|---|---|
| `scripts/generer-lp.mjs` | publication des lots, `--traitement` pour la page de traitement seule |
| `scripts/deploy-socle-blocks.js` | blocs du socle |
| `scripts/verif-socle-deploye.js` | marqueurs du socle sur les pages en ligne |
| `scripts/journal-soumission.js <email>` | lecture du journal d'une soumission |
| `scripts/journey-config-upsert.js` | `LPB_Config_Api` |
| `scripts/purger-cache-lecture.js` | `LPB_Cache_Lecture` — vide le cache de lecture (tout, une famille, une école) et, avec `--rechauffer=prod`, revisite les 60 pages FR du lot pour le réécrire aussitôt ; à planifier en cron côté serveur avec le `.env` de prod (événements à 07:15 et 08:15 Paris, purge complète hebdomadaire — voir PASSATION § « Cache de lecture : durées et purge externe ») |
| `scripts/creer-de-prod.js` | dossiers et 13 DE du LP Builder dans une BU (`--mid` = `SFMC_ACCOUNT_ID`, `--push`, `--copier-config`, `--relever` pour régénérer `sfmc-ssjs/de/LPB_DE_definitions.json`) |
| `scripts/creer-de-indicatifs.js`, `scripts/creer-de-cache-lecture.js` | création idempotente de deux DE |
| `scripts/sync-cascade-js.js` | recopie du JS de cascade dans le bloc AMPscript (à lancer après toute modification de `picklist-handler.ssjs`) |
| `npm test` | la suite complète, à passer avant chaque publication |
