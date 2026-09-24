# Passation — déclenchement des journeys SFMC depuis les formulaires (API Event)

Document de reprise, écrit le 18/09/2026 pour un collègue qui poursuit le sujet
avec Claude. Il dit où on en est, ce qui est prouvé, ce qui reste à la main du
client, et les règles à respecter. Point de départ : `git pull` sur la branche
`optimisation-temps`, dernier commit du sujet `d040185`.

## 1. Règles de travail à conserver (dites par anouar, à faire respecter par Claude)

- **Ne jamais toucher aux journeys implémentées par le client**
  (`Journey_auto_confirmation_inscription_evenements`, `Post_Demande_De_Doc`,
  leurs copies UAT). On ne les lit qu'en lecture. Ne pas supprimer les journeys
  de test non plus.
- **Pas d'écriture dans le CRM sans accord explicite.** Une soumission de
  formulaire de test crée un compte Salesforce : demander avant, sauf si anouar
  vient de dire « teste en interne ».
- **Pas de déploiement en recette sans demande explicite** (« déploie en
  recette »). Le lot interne (`Interne_*`) peut être publié librement après une
  modification.
- **Proposer le commit et attendre « ok pour commit ».**
- **Aucun secret dans le chat ni dans le dépôt.** Les identifiants du paquet API
  vivent dans la DE `LPB_Config_Api` (Clé/Valeur). On peut lire la colonne
  `Cle` et `Note`, jamais afficher `Valeur` de `ClientSecret`.
- La recette tourne avec `SFMC_JOURNEY_LAUNCH=false` tant que le client n'a pas
  publié ses journeys.

## 2. Ce que fait le socle (état du code)

Fichier : `sfmc-ssjs/socle/handler-form.ampscript`.

1. Les écritures CRM se font d'abord (compte, consentements, CampaignMember ou
   inscription Summit).
2. La branche métier **désigne une clé** dans `@jrnCleEvt` :
   - inscription événement créée (JPO, atelier, stage, immersion) →
     `EventKey_Evenement` ; une inscription déjà existante ne redéclenche rien ;
   - demande de brochure avec un CampaignMember (créé ou existant) →
     `EventKey_Brochure`.
3. Le **bloc commun « PREPARATION DES ENTREES DE JOURNEY »**, juste avant la
   ligne de journal « 99 - fin », construit le corps JSON (`@jrnData`) selon la
   clé : relecture du compte (langue, locale SMS, pays), téléphone, marque,
   échappement JSON, puis colonnes de la DE cible. Drapeau fermé → rien ne part,
   le journal porte `JOURNEY:desactive`.
4. Le **bloc SSJS de fin de page** (entre `==JOURNEY_FIRE_DEBUT==` et
   `==JOURNEY_FIRE_FIN==`) lit `LPB_Config_Api`, prend un jeton OAuth, poste
   sur `interaction/v1/events`, et écrit la ligne de journal « 99 - journey »
   (OK + `eventInstanceId`, ou KO + motif). Tout est en try/catch : un échec ne
   bloque jamais le visiteur. Le corps est échappé en ASCII pur (`\uXXXX`) :
   `HTTP.Post` abîmait les accents.

Le drapeau `SFMC_JOURNEY_LAUNCH` est injecté **à la publication** (`lib/socle-env.js`),
une CloudPage n'a pas de `process.env`. Changer le drapeau = republier.

### Les deux DE d'entrée et le vocabulaire des journeys

| Clé `LPB_Config_Api` | Event definition (prod) | DE d'entrée | Colonnes |
|---|---|---|---|
| `EventKey_Evenement` | `Data_contacts_evenement_new` | `Data_contacts_evenement_new` | 19 |
| `EventKey_Brochure` | `APIEvent-8060f81d-99b8-bae7-c91b-4b37093295d8` | `Post_Demande_De_Doc_Target` | 17 |

Ce que les splits des journeys lisent, donc à respecter à la lettre :

- événement : `EventType` ∈ `Open House`, `Discovery Workshop`, `Internship`,
  `Immersion Day` (vocabulaire Summit, la même table que le bloc des listes) et
  `summit__Instance_Start_Date` ;
- brochure : `Brand` ∈ `EFAP`, `BRASSART`, `ICART`, `CREAD`, `ESEC`, `IFA Paris`,
  `MoPA`, `Ecole Bleue`, `EFJ`, `3W Academy` (sans accents, contrairement aux
  noms CRM `ÉSEC` / `École Bleue`) et `Academic_Level_List` ∈ `BAC+3`, `BAC+4`,
  `BAC+5`, `BAC+5 et +`.

`MobileNumber` est un champ Phone : chiffres seuls, indicatif en tête, sans `+`
(`33612345678`). `MobileE164Auto` (brochure seulement) garde le `+`.

Le test `sfmc-ssjs/test/test-env.js` fige les deux listes de colonnes et ce
vocabulaire : une colonne inconnue de la DE fait refuser l'événement entier.

## 3. Ce qui a été corrigé le 18/09 (commit `d040185`)

- La DE événement avait été modifiée par le client : `MobileE164Auto` →
  `MobileNumber`. Le socle envoyait l'ancien nom, l'événement aurait été refusé.
- `EventType` était envoyé dans notre vocabulaire (JPO, Atelier, Stage,
  Immersion) alors que le split compare le vocabulaire Summit : tout tombait
  dans « Remainder ».
- Branchement complet de la journey post-brochure (clé, DE, vocabulaire).
- Accents abîmés dans `Nom_action` : corps JSON échappé en ASCII.
- Repli de `Campus` sur le campus choisi pour la DE brochure (`@utmCampus` est
  lu avant que le campus soit connu).

## 4. Banc de test en place dans SFMC (BU RECETTE EDH, MID 536010339)

Tout est en **Draft**, sans aucune activité de communication. Un API Event posé
sur une journey en Draft est accepté : SFMC renvoie un `eventInstanceId` et
écrit la ligne dans la DE d'entrée, sans faire entrer le contact. C'est
suffisant pour valider le payload.

| Objet | Nom / clé |
|---|---|
| DE test événement | `Data_contacts_evenement_new_TEST` (mêmes colonnes que la prod, `MobileNumber` ajoutée le 18/09) |
| Event definition test événement | `Data_contacts_evenement_new_TEST` |
| Journey test événement | `Journey_TEST_socle_evenements_Reetain` (clé `test-socle-evenements-reetain-20260910`) |
| DE test brochure | `Post_Demande_De_Doc_Target_TEST` (17 colonnes, dossier « Post demande de doc ») |
| Event definition test brochure | `Post_Demande_De_Doc_TEST` |
| Journey test brochure | `Journey_TEST_socle_brochure_Reetain` (clé `test-socle-brochure-reetain-20260918`) |

Aujourd'hui `LPB_Config_Api` pointe sur les **tests** :
`EventKey_Evenement = Data_contacts_evenement_new_TEST`,
`EventKey_Brochure = Post_Demande_De_Doc_TEST`.

Tirs validés le 18/09 (interne EFAP) : brochure `test.journey.brch@gmail.com`,
JPO `test.journey.jpo@gmail.com` et `test.journey.jpo2@gmail.com` (celui-ci
après le correctif des accents). Les pages `Interne_BRCH_EFAP_V0` et
`Interne_JPO_EFAP_V0` sont publiées **avec le drapeau ouvert** vers les tests ;
toutes les autres pages, interne comme recette, ont le drapeau fermé.

### Rejouer un test

```bash
SFMC_JOURNEY_LAUNCH=true SFMC_SYNC_ENABLED=true node scripts/generer-lp.mjs --push --mid=536010339 --lot=interne --only=efap:BRCH
```

Puis soumettre `https://cloud.groupe-edh.net/landingpage?id=Interne_BRCH_EFAP_V0`
avec un email de test (crée un compte CRM : demander l'accord), et lire :

```bash
node scripts/journal-soumission.js test.xxx@gmail.com
```

La ligne « 99 - journey » donne la clé et l'`eventInstanceId`, ou le motif du
refus. Vérifier ensuite la ligne dans la DE `_TEST` (outil MCP `sfmc_de_rows`,
ou SOAP `DataExtensionObject[<DE>]` filtré sur `PersonEmail`).

Pièges rencontrés :

- les outils MCP `sfmc_journey_get` / `sfmc_rest_get` tronquent à ~60 000
  caractères ; une journey riche ne se parse plus, extraire les critères par
  regex (`criteriaDescription`, `CDATA`, `Event.<clé>.<colonne>`) ;
- le paquet API du `.env` n'a pas les scopes `journeys_*` (403 sur
  `/interaction/v1/interactions`) ; seul le MCP lit les journeys ;
- `sfmc_de_rows` avec `filter` échoue (code 10003) : passer par SOAP.

## 5. Passage en production — à faire dans l'ordre

1. **Client** : publier `Journey_auto_confirmation_inscription_evenements` et
   `Post_Demande_De_Doc` (toutes deux en Draft le 18/09). Nous n'y touchons pas.
2. **Client** : confirmer trois points de la DE brochure, posés par nous :
   `Id` = Id du compte ; `Schoolname` et `Ecole` = compte campus (« EFAP PARIS »),
   `Campus` = `utm_campus` avec repli campus choisi ; politique de ré-entrée de
   la journey brochure (son `entryMode` est « NotSet »).
3. **Nous, sur demande d'anouar** : basculer les deux clés de `LPB_Config_Api`
   vers la prod (tableau du § 2). Écriture DE, pas CRM ; via l'outil MCP
   `sfmc_de_upsert_rows` (clé `Cle`) ou `scripts/journey-config-upsert.js`.
4. **Nous, sur demande d'anouar** : `.env` → `SFMC_JOURNEY_LAUNCH=true`, puis
   déploiement recette :
   ```bash
   SFMC_SYNC_ENABLED=true node scripts/generer-lp.mjs --push --mid=536010339 --lot=recette --confirme-recette
   ```
5. Nettoyage, quand le client a validé : les DE, event definitions et journeys
   `_TEST` / `Journey_TEST_*`, et les comptes de test ci-dessus dans le CRM
   (à la main du client).

## 6. Points ouverts à connaître

- Le CRM alimente de son côté `Journey_Inscription_ContactData`
  (contactabilité, statut d'inscription) : hors de notre périmètre.
- `Account.UTMCampus__c` reste vide sur une page sans `utm_campus` : `@utmCampus`
  est lu avant `@campusSel` dans le handler (lignes ~490 et ~523). Contourné
  pour la journey seulement, pas corrigé côté compte.
- Les formulaires événement n'ont pas de champ pays : `LivingCountry` part vide
  et la zone est « Intl » sur ces soumissions. Comportement existant.
- Le CampaignMember de candidature met ~20 s côté CRM (trigger) : c'est la
  raison de l'attente visible après « Envoi en cours… », pas l'API Event
  (le tir prend ~1 s).

## 7. Fichiers utiles

- `sfmc-ssjs/socle/handler-form.ampscript` — bloc commun et tir SSJS.
- `sfmc-ssjs/test/test-env.js` — colonnes et vocabulaire figés.
- `lib/socle-env.js` — injection du drapeau à la publication.
- `scripts/journey-config-upsert.js` — écriture de `LPB_Config_Api` (jamais
  afficher les valeurs).
- `scripts/journal-soumission.js` — journal d'une soumission par email.
- `.env.example` — drapeaux `SFMC_JOURNEY_LAUNCH`, `SFMC_LOG_DETAIL`.
