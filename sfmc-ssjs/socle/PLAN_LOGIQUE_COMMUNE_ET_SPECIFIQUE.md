# Backend formulaires MC → Salesforce — logique commune vs spécifique

> Synthèse des sources `OneDrive_1_11-08-2026` + artifact + code du socle `sfmc-ssjs/socle/`.
> Contrat : **SSJS Platform Functions natives** (`RetrieveSalesforceObjects`, `CreateSalesforceObject`,
> `UpdateSingleSalesforceObject`, `DataExtension.Init().Rows.Lookup`) — **jamais de REST**.
> Séquence de référence : mapping API SF v4, onglet « À écrire par Reetain (v4) ».

---

## A. Ce que fixe chaque source

| Fichier | Ce qu'il fixe pour le backend |
|---|---|
| **mapping API SF v4** (onglets : `À écrire par Reetain (v4)`, `Téléchargement de brochure`, `Inscription JPO/AD/Stage`, `Demande immersion`, `Candidature`, `Candidature V2`, `Prise de RDV`, `Webconférence`, `Prépa concours`, `Règles métier`, `Champs manquants`) | L'annuaire GET/POST champ par champ + qui écrit (Reetain vs flow CRM). Onglet `Champs manquants` = lignes à ignorer (champ absent de l'objet). |
| **Règles métiers pour formulaires.docx** | 8 sections de règles fonctionnelles (voir §C/§D ci-dessous) : familles d'objets, unicité, dates JPO, sous-événements, champs par école, cascade candidature, tracking, blocages candidature. |
| **Mapping ID campagnes x formulaires.xlsx** (onglet `Campagne filles`) | 40 campagnes = {brochure, candidature} × {France, International} × 10 écoles. Colonnes utiles : `Id` (CampaignId `701…`), `Type` (`Brochure download` / `Application` / `Chatbot`), `Brand__c` (`1BU…` = BusinessBrandId), `Territory__c` (`France`/`International`). **IDs propres à l'UAT → à rebasculer en prod.** |
| **5 diagrammes de séquence** (drawio) | (1) création prospect brochure/candidature/immersion, (2) update prospect existant, (3) création inscription événement JPO/AD/Stage, (4) update inscription événement, (5) rejeu des tampons en erreur. Fixent : clé `externalId__c`, `summit__Event_Instance__c`, anti-écho `actionNameStatus__c`, statut `Inscrit` à la création seulement. |
| **Doc OP - Désabonnement des emails.pdf** | Gestion opt-out (hors chemin d'écriture formulaire : posé par flow). |

**Constat clé (correctif 07/07)** : Reetain **n'écrit plus** `AcademicInterest` ni `IndividualApplication`. Il pose des champs « source » sur le Person Account ; un trigger dépose un **tampon** qu'un flow CRM consomme en aval. Déclencheur = l'utilisateur d'intégration inscrit dans `IntegrationUser__mdt`.

---

## B. La logique COMMUNE (le socle) — identique aux 6 formulaires

C'est **80 % du travail** et c'est **déjà écrit**. Une seule séquence d'écriture, 2 objets communs + 1 objet variable.

### B.1 Séquence d'écriture (toujours dans cet ordre, toujours en UPSERT)

```
1. Person Account          → upsertPersonAccount(form)     [LPB_Socle_Upsert_AG]
2. ContactPointConsent     → upsertConsents(pa, form)      [1 record par canal coché]
3. 3e objet (variable)     → selon la famille du formulaire (voir §C)
```

Le 3e objet est la **seule** chose qui change entre formulaires. Étapes 1 et 2 = 100 % communes.

### B.2 Fonctions communes déjà disponibles

| Fonction | Fichier | Rôle |
|---|---|---|
| `readForm()` | `socle-upsert` | POST → objet `form` normalisé (identité, contexte, event, enfant, 5 canaux, preuve légale, tracking). |
| `upsertPersonAccount(form)` | `socle-upsert` | Upsert PA clé `PersonEmail`, **fill-if-blank**, pose `Application_Requested__c` + `PTAT_Id__c`, tracking first-touch. |
| `upsertConsents(pa, form)` | `socle-upsert` | 1 `ContactPointConsent` par canal coché + preuve légale + `CaptureSource`. |
| `upsertCampaignMember(pa, form)` | `socle-upsert` | Étape 3a (brochure/candidature) + `logCampaignInteraction` si CM existant. |
| `upsertSummitRegistration(pa, form)` | `socle-summit` | Étape 3b (JPO/AD/Stage) : upsert `externalId__c`, anti-écho `Origin`. |
| `createAppointments(regId, form)` | `socle-summit` | Étape 3b-bis : 1 appointment par atelier coché (après la Registration). |
| `resolveCampaign(form)` / `resolveBrand(ecole)` | `socle-resolvers` | Traduction (form × école × zone) → `CampaignId`, école → marque. |
| `getPicklist(champ)` | `socle-resolvers` | Valeurs d'un menu déroulant (DE de référence). |
| `getProgramsForSchool` / `getCampus/Level/Speciality/Rhythm/Language Options` / `getRentreeOptions` / `resolvePtatId` | `socle-read` | Cascade programme candidature. |
| `getNextEventDates` / `getRequiredAppointments` / `getBrandsCampuses` | `socle-read` | Lectures famille événement. |
| `mapTracking` / `withRetry` / `buildConsentProof` / `retrieveRaw` / `betweenFilter` | `sf-helpers` | Utilitaires transverses. |

### B.3 Règles d'or communes (câblées dans le moteur)

- **Upsert jamais insert** — PA dédoublonné sur `PersonEmail` seul, match exact. Pas d'email = pas de dédup.
- **Fill-if-blank** — ne jamais écraser une valeur non vide sur le PA (identité + tracking first-touch).
- **Idempotence par objet** — PA/`email` · CPC/`ParentId+Channel__c` · CM/`Campagne×PA` · Summit/`externalId__c`.
- **Interactions répétées** — 2e soumission même campagne = update CM + 1 `Interaction` (ex : 3 brochures = 1 CM + 3 Interactions).
- **Téléphone** — écrire `MobileNumber__c` + `IndicatifPick__c`, **jamais** `PersonMobilePhone` (E.164 calculé par flow).
- **Tracking à double nommage** — Account : `UTMSource__c` (sans `_`) ; CM/Registration : `UTM_Source__c` (avec `_`). Géré par `mapTracking`.
- **Consentement = preuve** — toujours `Legal_Texte_Accepted__c` (texte versionné) + `Channel__c` + `Status__c` + `CaptureSource`.
- **Champs à ne JAMAIS écrire** — `Scoring__c`, `SMSLocale__c`, `WhatsAppLocale__c`, `Academic_Level_Historical__c`, `SourceCreation__c` (update), `Opt_In/Out_Date__c`, `GDPR_Status__c`, tout `AcademicInterest.*`/`IndividualApplication.*`.
- **Garantie** — l'écriture PA ne peut jamais échouer à cause de l'aval (try/catch global handler, `withRetry`).

---

## C. La logique SPÉCIFIQUE par formulaire — ce qui reste à câbler

Les 6 formulaires se répartissent en **2 familles** selon le 3e objet.

### Famille CAMPAGNE (3e objet = CampaignMember)

#### 1. Téléchargement brochure — `formType = "brochure"`
- **3e objet** : `CampaignMember` via `upsertCampaignMember`.
- **Spécifique écriture** : `Application_Requested__c = false` (explicite). `CampaignId` résolu par `resolveCampaign` (Type `Brochure download` × école × zone).
- **Spécifique lecture** : champ **spécialité** affiché seulement pour BRASSART, IFA Paris, MoPA + conditionnels (EFAP/ICART si niveau > bac+3 *à confirmer*, CREAD si campus=Lyon & reconversion). → `getPicklist('speciality')` filtré école.
- **Aval** : mail brochure envoyé par MC après soumission.

#### 2. Candidature / V2 — `formType = "candidature"` (PRIORITÉ, le plus complexe)
- **3e objet** : `CampaignMember` (Type `Application`).
- **Spécifique écriture** : `Application_Requested__c = true` + `PTAT_Id__c` (résolu) + `PersonAccountType__c`. La candidature elle-même est créée **en aval** par le flow (jamais par Reetain).
- **Spécifique lecture — cascade programme conditionnelle** (le gros morceau, déjà outillé dans `socle-read`) :
  - Champs : Campus → Niveau → Spécialité → Rythme → Langue → Rentrée → `resolvePtatId`.
  - **Affichage progressif** : un champ n'apparaît que si le précédent est renseigné **ET** s'il a > 1 valeur. Si 1 seule valeur → champ masqué mais **valeur par défaut envoyée au CRM**.
  - **Ordre par école (règle §6)** :
    - Général (toutes sauf EFAP/IFA) : campus, niveau, **spécialité, rythme, langue**, rentrée.
    - **IFA Paris** : campus, niveau, **langue, spécialité, rythme**, rentrée.
    - **EFAP** : tous les champs d'emblée (pas d'affichage progressif) sauf rentrée qui apparaît à la fin si ≥ 2 valeurs.
- **Spécifique validation — blocages (règle §8, à faire remonter du CRM)** :
  - Candidature déjà en cours même programme (unicité email × PTAT) → message dédié.
  - Candidature après refus même année scolaire → message dédié.
  - ⚠️ Ces contrôles sont **côté CRM** (VR/flow) : le front doit afficher le message renvoyé, le backend Reetain doit gérer le retour d'erreur sans perdre la soumission.

### Famille ÉVÉNEMENT (3e objet = Summit Registration + Appointments)

Règle §2 : ces formulaires créent PA + CPC + `Summit Event Registration` (statut = *inscrit*) lié au bon `Summit Event Instance`.

#### 3. Inscription JPO — `formType = "jpo"` (eventType `JPO`)
- **3e objet** : `upsertSummitRegistration` + `createAppointments`. **Pas de CampaignMember.**
- **Spécifique lecture — dates (règle §4)** : au choix du campus → prochaine date **+ événements des 15 j suivants** (`getNextEventDates(campus,'JPO')`). Affichage **radio**, 1re date (la plus proche) présélectionnée. Par événement afficher : date, heure début/fin, adresse (`Summit Event Instance`) + horaires conférence (`Summit Event Appointment`, type=conférence, **inscription non obligatoire**).
- **Spécifique lecture — sous-événements (règle §5)** : `getRequiredAppointments(instanceId)` → ateliers à inscription obligatoire, affichés en radio **multi-sélection** juste avant le CTA. 1 appointment créé par atelier coché.
- **Spécifique champ** : spécialité affichée pour BRASSART, IFA Paris, MoPA.

#### 4. Inscription Atelier (AD) — `formType = "atelier"` (eventType `AD`)
- Identique JPO (dates + sous-événements). Différence = `eventType='AD'` dans `getNextEventDates`.

#### 5. Inscription Stage — `formType = "stage"` (eventType `Stage`)
- Identique AD. `eventType='Stage'`.

#### 6. Demande immersion — `formType = "immersion"` ⚠️ **À ARBITRER**
- **Contradiction** : mapping v4 la classe en **Summit**, le support en **CampaignMember**. Diagramme 1 la met avec brochure/candidature (création prospect).
- 1 appointment par date d'immersion.
- **Action** : trancher famille avec le resp. dev avant implémentation. Le handler la log actuellement sans écrire de 3e objet.

### Hors périmètre / à cadrer

| Formulaire | Statut |
|---|---|
| **Prise de RDV** (FR + Intl) | Outil non tranché (MS Bookings vs Calendly). Mapping objet/champ à définir. PA + CPC seulement pour l'instant. |
| **Webconférence** & **Prépa concours** | Gérés **par Livestorm** (Contact-tampon → conversion PA côté CRM, déjà fait BRE-216). **Aucun backend Reetain.** |

---

## D. Personnalisation par école (règle §6) — transverse

10 écoles / 11 marques : EFAP, BRASSART, ESEC, CREAD, CREAD Pro, ICART, EFJ, Ecole Bleue, IFA Paris, MoPA, 3W Academy.

| Règle | Écoles concernées |
|---|---|
| Champ **spécialité** sur brochure | BRASSART, IFA Paris, MoPA + EFAP/ICART (si niveau > bac+3, *à confirmer*), CREAD (campus Lyon + reconversion) |
| Champ **spécialité** sur JPO/AD/Stage/immersion | BRASSART, IFA Paris, MoPA |
| Ordre cascade candidature **spécial** | IFA Paris (langue avant spécialité), EFAP (tout d'emblée + rentrée à la fin) |

→ À piloter par une **table de config école** (DE ou objet SF) plutôt qu'en dur.

---

## E. Reste à implémenter (checklist)

**Côté Salesforce / org (prérequis)**
- [ ] Confirmer les noms d'API `summit__*` réels (Registration, Appointment, Event_Instance, statut `Inscrit`).
- [ ] Créer/renseigner `Application_Requested__c` et `PTAT_Id__c` sur Account (⛔ v4).
- [ ] Enregistrer l'utilisateur d'intégration dans `IntegrationUser__mdt` (sinon pas de tampon).
- [ ] Confirmer `parentSource` du CPC (Account Id vs PersonContactId) et `linkField` du CM.

**Côté Data Extensions SFMC (mapping, jamais en dur)**
- [ ] `Mapping_Campagnes_x_Formulaires` : colonnes `FormType` (`brochure`→`Brochure download`, `candidature`→`Application`), `Ecole`, `Zone` (`FR`/`Intl` depuis `Territory__c`), `CampaignId`. Alimenter depuis le fichier campagnes (40 lignes).
- [ ] `Mapping_Ecoles_x_Marques` : `Ecole` → `BusinessBrandId` (`1BU…`) + `Brand__c`.
- [x] ~~`Ref_Picklists_CRM`~~ — **abandonnée**. Les valeurs des menus déroulants
  (niveau, pays, indicatif, type de contact) sont lues **directement dans le value
  set Salesforce** par `SocleRead.getPicklist()` : `EntityParticle` → `PicklistValueInfo`.
  Rien à créer, rien à synchroniser. Reste à confirmer que MC Connect expose ces
  objets de métadonnées → sonde dédiée dans `test-read-diagnostic.ssjs`.

**Côté socle SSJS (code)**
- [x] Honorer `neverUpdate` + statut `Inscrit`/`Origin` à la création uniquement dans `upsertSummitRegistration` (fait : `_stripNeverUpdate` + `regStatusField`).
- [ ] Config école (ordre cascade + spécialité) pour §D.
- [ ] Gestion du retour des VR de blocage candidature (§8) → renvoyer le message au front.

**Côté front (formulaires événement)**
- [ ] Ajouter les champs cachés `InstanceId` et `Appointments` (le front poste `EventDate`/`Campus` mais pas encore l'instance réelle ni les ateliers).
- [ ] Brancher `getNextEventDates` / `getRequiredAppointments` (aujourd'hui `jpoEvents` est codé en dur).
- [ ] Support du paramètre d'URL `campus=` + ancre vers le bloc formulaire (règle §1).
