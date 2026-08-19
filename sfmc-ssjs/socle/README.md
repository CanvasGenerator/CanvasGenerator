# Socle d'écriture commun — Formulaires MC → Salesforce Core (SSJS)

> **Sources du contrat**
> - `OneDrive_1_11-08-2026/Formulaires pour les 10 écoles - mapping API SF v4`,
>   onglet **« À écrire par Reetain (v4) »** (décision « queue-first » du 2026-07-09).
> - Artefact **« Plan d'implémentation backend — Formulaires MC → Salesforce »** (§03 fonctions communes, §04 plan par formulaire).
> - Diagrammes de séquence OneDrive **n°3** (création inscription événement) et **n°4** (re-soumission Summit).
>
> **Aucune API REST.** Tout passe par les **Platform Functions SSJS Salesforce**
> natives de SFMC (`RetrieveSalesforceObjects`, `CreateSalesforceObject`,
> `UpdateSingleSalesforceObject`), qui parlent à l'org Salesforce Core connectée.
> L'artefact décrit REST/Composite : il est antérieur à la consigne SSJS, qui prime.

---

## 1. Ce que fait le socle

Une **séquence d'écriture unique**, partagée par les 6 formulaires. Toujours en
**UPSERT**, jamais d'insert sec. Seule la 3ᵉ étape change selon la famille.

```
1. Account (Person Account)        upsert clé PersonEmail   — fill-if-blank
2. ContactPointConsent             upsert ParentId+Channel  — 1 record / canal coché
3a. CampaignMember                 upsert CampaignId+PA     — brochure / candidature
    └─ CampaignMemberInteraction__c    si le CM existe déjà (interaction répétée)
3b. summit__Registration__c        upsert externalId__c     — JPO / Atelier / Stage
    └─ summit__Appointment__c          1 par atelier coché (master-detail)
```

> ⚠ Reetain **n'écrit PLUS** l'Intérêt Académique ni la Candidature. Il pose
> `Account.Application_Requested__c` + `Account.PTAT_Id__c` ; un trigger Apex
> dépose un tampon qu'un flow CRM (EDH/Swan) consomme en asynchrone. Le
> déclencheur n'est pas un champ : c'est l'identité de l'utilisateur
> d'intégration (`IntegrationUser__mdt`) **ET** `Ecole__c` renseignée.

## 2. Fichiers (dans l'ordre d'inclusion)

| Ordre | Fichier | Content Block SFMC | Rôle |
|---|---|---|---|
| 1 | `config.ssjs` | `LPB_Socle_Config_AG` | Mapping champs + IDs propres à l'org (UAT ≠ Prod) |
| 2 | `sf-helpers.ssjs` | `LPB_Socle_Helpers_AG` | Wrappers Retrieve/Create/Update (**jamais Delete**), fill-if-blank, retry, tracking |
| 3 | `socle-resolvers.ssjs` | `LPB_Socle_Resolvers_AG` | Campagne / marque / zone / picklists depuis des Data Extensions |
| 4 | `socle-upsert.ssjs` | `LPB_Socle_Upsert_AG` | Étapes 1, 2, 3a |
| 5 | `socle-summit.ssjs` | `LPB_Socle_Summit_AG` | Étape 3b (famille Événement) |
| — | `socle-read.ssjs` | `LPB_Socle_Read_AG` | Lecture des référentiels (menus déroulants) |
| — | `picklist-handler.ssjs` | `LPB_Picklist_Handler_AG` | Remplit les `<select>` du formulaire — **lecture seule**, à inclure APRÈS le formulaire |

Tous les blocs `<script runat="server">` d'une même CloudPage **partagent le même
scope SSJS** : une fonction définie dans un bloc est appelable depuis un autre.

## 3. Utilisation depuis le handler (`LPB_Form_Handler_AG`)

```ssjs
Platform.Load("Core", "1.1.1");
Platform.Function.ContentBlockByKey("LPB_Socle_Config_AG");
Platform.Function.ContentBlockByKey("LPB_Socle_Helpers_AG");
Platform.Function.ContentBlockByKey("LPB_Socle_Resolvers_AG");
Platform.Function.ContentBlockByKey("LPB_Socle_Upsert_AG");
Platform.Function.ContentBlockByKey("LPB_Socle_Summit_AG");

var form = Socle.readForm();
form.brandId    = form.brandId    || SocleResolvers.resolveBrand(form.ecole).brandId;
form.campaignId = form.campaignId || SocleResolvers.resolveCampaign(form);

var pa = Socle.withRetry(function () { return upsertPersonAccount(form); });
if (pa && pa.id) {
    upsertConsents(pa, form);
    if (isCampaign)   upsertCampaignMember(pa, form);
    else if (isEvent) { var r = upsertSummitRegistration(pa, form); if (r) createAppointments(r, form); }
}
```

## 4. Règles câblées à ne pas casser

| Règle | Où | Comportement |
|---|---|---|
| **Fill-if-blank** | `Socle.fillIfBlank` | On n'écrase jamais une valeur CRM existante non vide. S'applique à l'identité **et au tracking** (first-touch). |
| **Idempotence** | par objet | PA/`PersonEmail` · CPC/`ParentId+Channel__c` · CM/`Campagne×PA` · Summit/`externalId__c` |
| **Unicité Summit** | `buildRegistrationExternalId` | `(personne × instance)`, **pas** par personne : une autre journée JPO = nouvelle Registration. |
| **Anti-écho Summit** | `SUMMIT_REGISTRATION.neverUpdate` | En **update**, ne jamais renvoyer `summit__Status__c` (présence pointée le jour J) ni `actionNameStatus__c` (un flow quotidien le passe `Origin` → `checkin` ; le réécrire relance scoring + écho MC). |
| **Nommage UTM** | `Socle.mapTracking` | **Sans** underscore sur Account (`UTMSource__c`), **avec** sur CampaignMember et Registration (`UTM_Source__c`). |
| **Téléphone** | `ACCOUNT.fillIfBlank.mobile` | Écrire `MobileNumber__c` + `IndicatifPick__c`. Jamais `PersonMobilePhone` (E.164 calculé par flow). |
| **Preuve de consentement** | `Socle.buildConsentProof` | `[version] — phrase formulaire — phrase footer` dans `Legal_Texte_Accepted__c`. |
| **Référentiels Summit** | lecture seule | Reetain ne crée **jamais** Event / Instance / Appointment Type (déjà paramétrés côté org). |

## 5. À paramétrer avant la Prod (voir `config.ssjs`)

- `ACCOUNT.recordTypeId` — RecordTypeId du Person Account de l'org.
- `CONSENT.parentSource` — cible réelle de `ContactPointConsent.ParentId`
  (Account Id vs PersonContactId selon le modèle EDC de l'org).
- `CONSENT.channels.HasOptedInAdvertising` — valeur SF du 5ᵉ canal à confirmer.
- `CAMPAIGN_MEMBER.linkField` — `ContactId` (PersonContactId) ou `PersonAccount__c`.
- `SUMMIT_REGISTRATION.object` / `linkField` / `regStatusValue` — API du package `summit__`.
- `RESOLVERS.campaignDE` / `brandDE` — **les 2 Data Extensions de mapping n'existent pas encore**.
- `PICKLISTS.fields` — les 4 champs picklist (objet + nom d'API). **Aucune DE ici** :
  le value set est lu directement dans Salesforce.
- Les IDs de campagnes/marques sont **propres à l'UAT** : à basculer en config,
  jamais en dur (cf. `Mapping ID campagnes x formulaires.xlsx`).

## 6. Points laissés en `TODO` (à arbitrer en atelier)

- `ContactPointConsent.GDPR_Status__c` : la feuille détaillée le liste côté
  Reetain, le contrat v4 laisse le flow poser le statut RGPD → écrit **désactivé
  par défaut** (`writeGdprStatus = false`).
- `ContactPointConsent.Opt_In_Date__c` : **jamais écrit** (flow + VR sans bypass).
- **Famille « immersion »** : v4 la classe en Summit, le support en CampaignMember.
  Le handler ne fait que journaliser, aucun 3ᵉ objet écrit tant que ce n'est pas tranché.
- **Suppression d'Appointments — hors périmètre.** Le diagramme 4 prévoit
  d'ajuster les enfants (ajout **et** suppression) à la re-soumission. Le socle
  ne fait que l'ajout : ces blocs tournent sur une CloudPage **publique**
  soumise par des prospects, et le backend des formulaires n'expose donc que
  Create/Update. Un atelier décoché reste en place et est journalisé
  (`obsolete`) ; son retrait relève d'un outil d'administration CRM.
- **Champs enfant** (`childLastName` / `childFirstName` / `childPhone`) : lus par
  `readForm()`, **écrits nulle part** — cible Salesforce à définir.
- **Picklists — à valider sur l'org.** `SocleRead.getPicklist()` lit le value set
  directement (`EntityParticle` → `PicklistValueInfo`), donc **rien à synchroniser** :
  une valeur ajoutée par l'admin CRM apparaît aussitôt dans le formulaire.
  Reste à confirmer que Marketing Cloud Connect expose ces objets de métadonnées —
  `test-read-diagnostic.ssjs` contient une sonde dédiée qui répond en une publication.

## 7. Mise en production — deux modes

### Mode A — Inlining automatique (défaut, **rien à installer dans SFMC**)

`lib/socle-inliner.js` développe les `%%=ContentBlockByKey("LPB_…")=%%` **au
moment de la publication**, dans `buildAssetPayload`. La page envoyée à SFMC est
donc **autonome** : elle embarque tout le SSJS dont elle a besoin.

```
npm start → créer la page → ajouter le formulaire → PUBLIER → c'est tout
```

> ⚠ **Depuis le 2026-08-17, les deux handlers inlinés sont en AMPSCRIPT**
> (`handler-form.ampscript`, `picklist-handler.ampscript`). Motif : sur cette org
> le SSJS n'atteint Salesforce ni depuis une CloudPage ni depuis une Automation.
> Voir `../diagnostic/README.md`.
>
> `lib/socle-inliner.js` connaît le langage de chaque brique et **refuse**
> d'injecter de l'AMPscript à l'intérieur d'un bloc `<script runat="server">` :
> le mélange produirait du JavaScript invalide, donc une page morte. En cas
> d'appel incohérent, l'inclusion est laissée intacte et un avertissement est
> émis — la publication n'est jamais cassée.
>
> Les fichiers `.ssjs` du socle restent dans le dépôt comme **spécification de
> référence** (mieux factorisée et testée), mais ne sont plus émis.

- Le HTML stocké en base garde la forme courte : le builder reste lisible.
- Coût : **~47 Ko** ajoutés à la page publiée (contre ~87 Ko en SSJS — les deux
  handlers AMPscript sont autonomes, sans briques partagées à dédoublonner).
- Contrepartie : une modification du socle exige de **republier les pages**.
- Une clé hors socle (`MonBloc_AG`) n'est jamais touchée.

Pour désactiver et revenir aux Content Blocks : `SOCLE_INLINE=false` dans `.env`.

### Mode B — Content Blocks partagés

Les 8 fichiers sont téléversés dans Content Builder comme Code Snippets
(assetType 220), **une seule fois**, et toutes les pages les appellent par
`ContentBlockByKey`. Une correction du socle profite alors à toutes les pages
sans republication.

```bash
npm run deploy:socle            # simulation — n'écrit rien (défaut)
npm run deploy:socle -- --push  # déploiement réel dans Content Builder
npm run deploy:socle -- --push --only=LPB_Socle_Read_AG
```

Le script contrôle avant tout appel réseau que chaque fichier porte son
`<script runat="server">` : sans cette enveloppe, SFMC afficherait le code en
clair sur la page. Les blocs atterrissent dans le dossier `socle`.

> **Quel que soit le mode** : tant que l'OAuth `invalid_request` n'est pas résolu,
> les blocs s'exécutent mais toutes les lectures Salesforce reviennent vides.
> Signature dans le code source de la page publiée :
> `<!-- picklist: school=efap campus=0 programs=0 ptats=0 -->`.

## 8. Tester en local

```bash
npm test                  # 14 tests, ~250 ms
npm run test:socle:watch  # relance à chaque sauvegarde
```

Le SSJS étant de l'ECMAScript 3, il s'exécute tel quel dans Node. Le banc
d'essai `sfmc-ssjs/test/harness.js` remplace les Platform Functions et l'objet
`DataExtension` par un **faux Salesforce en mémoire**, et charge les 6 blocs
dans **un seul contexte `vm`** — ce qui reproduit le scope SSJS partagé d'une
CloudPage. Une erreur de syntaxe dans un `.ssjs` fait donc échouer les tests.

| Testé en local | Testable seulement sur l'org |
|---|---|
| fill-if-blank, idempotence, anti-écho, diff des ateliers | Noms d'API réels des objets et champs |
| Double nommage UTM, cascade de lecture, résolveurs | Validation rules, triggers, dédup Salesforce |
| Garde-fous (email vide, instance vide) | Connexion Marketing Cloud Connect |

## 9. Diagnostic

Tout est dans `sfmc-ssjs/diagnostic/` (**lecture seule**, aucune écriture Salesforce).
Voir le README du dossier pour le mode d'emploi.

- `A-COLLER-cloudpage-diagnostic.ssjs` — fichier généré, **prêt à coller** dans une
  CloudPage. Sonde en 4 étages : connexion MC Connect → objets de métadonnées
  → les 4 value sets → les référentiels métier. Sort un tableau OK/VIDE/ERREUR
  avec échantillon, et un **verdict** en clair.
- `test-read-automation.ssjs` — même sonde, exécutée dans Automation Studio et
  déversée dans une DE. Sert d'arbitre : si l'Automation répond et pas la
  CloudPage, la panne est dans la page, pas dans Marketing Cloud Connect.
