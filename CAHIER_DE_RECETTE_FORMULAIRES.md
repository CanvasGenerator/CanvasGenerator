# Cahier de recette — Formulaires EDH (Landing Page Generator)

> **Version** : 1.0 — 20/08/2026
> **Périmètre** : les 6 formulaires EDH actifs du Landing Page Generator
> **Base d'analyse** : code du dépôt `LandingPageGenerator` à l'état actuel (HEAD = `8a48b41`, working tree)
> **Public visé** : équipe QA / recette, sans connaissance préalable du développement

---

## 1. Objectif

Fournir un jeu de cas de test **dérivé du code réel** permettant de valider :

1. le comportement fonctionnel des 6 formulaires EDH dans l'éditeur (builder GrapesJS) ;
2. le comportement des mêmes formulaires une fois la page **exportée / publiée** ;
3. les flux de **lecture** (options des listes déroulantes, encarts événement, config RGPD, relecture d'une page enregistrée) ;
4. les flux d'**écriture** (collecte du payload, normalisation, envoi) ;
5. les **écarts documentés** entre ce qui est spécifié (guide CRM, contrat Mapping API SF v4) et ce qui est réellement implémenté.

Ce document ne modifie aucun code. Il constate et documente.

### 1.1 Avertissement majeur à lire avant d'exécuter la recette

Trois faits structurants, vérifiés dans le code, conditionnent l'interprétation de **tous** les résultats :

| # | Constat | Preuve dans le code |
|---|---|---|
| **A** | **Aucun des 6 formulaires n'envoie de données à un serveur.** La soumission est une promesse simulée qui résout toujours `{ ok: true }` après 900–1000 ms. | [form-brochure/index.js:575](blocks/forms/form-brochure/index.js#L575), [form-immersion/index.js:475](blocks/forms/form-immersion/index.js#L475), [form-candidature/index.js:493](blocks/forms/form-candidature/index.js#L493), [shared/event-form.js:837-839](blocks/forms/shared/event-form.js#L837-L839) |
| **B** | **Toute la logique des formulaires vit dans l'éditeur, pas dans la page.** Les blocs ne contiennent aucun `<script>` inline ; la logique est attachée via `editor.on('component:mount')` sur le document du canvas GrapesJS. L'export ([js/export.js:59](js/export.js#L59)) et la publication ([lib/api-shared.js:41-59](lib/api-shared.js#L41-L59)) ne réinjectent aucun JavaScript. **Une page publiée contient donc des formulaires inertes** : ni validation, ni champs conditionnels, ni encart événement, ni normalisation du téléphone, ni handler de soumission. | [form-brochure/index.js:620-621](blocks/forms/form-brochure/index.js#L620-L621), [shared/event-form.js:1084-1085](blocks/forms/shared/event-form.js#L1084-L1085), [js/export.js](js/export.js), [lib/api-shared.js](lib/api-shared.js) |
| **C** | **Le socle SSJS d'écriture Marketing Cloud → Salesforce n'est pas présent dans le dépôt.** Le commit `28a4034` (« Revert "Regles forms" ») a retiré `lib/socle-inliner.js`, `sfmc-ssjs/socle/config.ssjs`, `sf-helpers.ssjs`, `socle-resolvers.ssjs`, `socle-upsert.ssjs`, `socle-summit.ssjs`, `socle-read.ssjs`. Seuls subsistent les **tests** qui les référencent (`sfmc-ssjs/test/`, dossier non suivi par git) et les pages de **diagnostic** en lecture seule. | `git show --stat 28a4034` · [sfmc-ssjs/test/harness.js:28-35](sfmc-ssjs/test/harness.js#L28-L35) · [sfmc-ssjs/test/inliner.test.js:13](sfmc-ssjs/test/inliner.test.js#L13) |

**Conséquence pour la recette :** les cas marqués `⛔ NON EXÉCUTABLE EN L'ÉTAT` documentent le comportement **attendu** et servent de recette de non-régression pour le jour où le socle sera rebranché. Ils ne doivent pas être comptés comme des échecs de la version actuelle, mais comme des **manques fonctionnels connus**.

---

## 2. Périmètre

### 2.1 Dans le périmètre — les 6 formulaires EDH

Identifiés par le registre des blocs ([blocks/registry.js](blocks/registry.js)) **et** par leur import effectif dans [blocks/index.js:40-45](blocks/index.js#L40-L45) :

| Réf. | Formulaire | Bloc(s) GrapesJS | Fichier | `enabled` |
|---|---|---|---|---|
| **F01** | Brochure | `form-brochure`, `form-brochure-en` | [blocks/forms/form-brochure/index.js](blocks/forms/form-brochure/index.js) | ✅ |
| **F02** | JPO | `form-jpo`, `form-jpo-en` | [blocks/forms/form-jpo/index.js](blocks/forms/form-jpo/index.js) + moteur partagé | ✅ |
| **F03** | Atelier Découverte | `form-atelier`, `form-atelier-en` | [blocks/forms/form-atelier/index.js](blocks/forms/form-atelier/index.js) + moteur partagé | ✅ |
| **F04** | Stage | `form-stage`, `form-stage-en` | [blocks/forms/form-stage/index.js](blocks/forms/form-stage/index.js) + moteur partagé | ✅ |
| **F05** | Demande d'immersion | `form-immersion`, `form-immersion-en` | [blocks/forms/form-immersion/index.js](blocks/forms/form-immersion/index.js) | ✅ |
| **F06** | Candidature | `form-candidature`, `form-candidature-en` | [blocks/forms/form-candidature/index.js](blocks/forms/form-candidature/index.js) | ✅ |

Moteur partagé F02/F03/F04 : [blocks/forms/shared/event-form.js](blocks/forms/shared/event-form.js).

### 2.2 Hors périmètre — vérifié, non testé ici

| Élément | Raison | Preuve |
|---|---|---|
| `form-precandidature` | `enabled: false` dans le registre **et** non importé dans `blocks/index.js` → jamais chargé dans l'éditeur | [blocks/registry.js:35](blocks/registry.js#L35) |
| `form-webconf` | Absent du registre **et** absent des imports de `blocks/index.js` → bloc mort | [blocks/forms/form-webconf/index.js](blocks/forms/form-webconf/index.js) |
| `form-sfmc`, `form-salesforce-core` | Blocs actifs mais hors du lot « 6 formulaires EDH » (catégorie *Essential*, périmètre historique SFMC / snippet `LPB_Form_Handler_AG`) | [blocks/form-sfmc/index.js](blocks/form-sfmc/index.js), [blocks/form-salesforce-core/index.js](blocks/form-salesforce-core/index.js) |
| Générateur visuel de formulaires (`FormGenerator`) | Fonctionnalité distincte : construit un formulaire ad hoc puis crée une Data Extension + un asset SFMC. N'utilise aucun des 6 blocs. | [js/form-generator.js](js/form-generator.js), routes `/api/sfmc/create-data-extension`, `/api/sfmc/create-form-asset` |
| Modules partagés non importés | `shared/form-validators.js`, `shared/form-conditions.js`, `shared/form-styles.js`, `shared/rgpd-block.js` : aucun import dans le dépôt (vérifié par recherche globale) → code mort | voir §8 PV-21 |

### 2.3 Environnements de recette

Chaque cas de test précise l'environnement dans lequel il doit être exécuté.

| Code | Environnement | Ce qui fonctionne |
|---|---|---|
| **ENV-1** | **Builder** — éditeur GrapesJS (`index.html?school=<id>`), canvas iframe | Tout : validation, conditionnels, encart événement, RGPD, soumission simulée |
| **ENV-2** | **Page publiée / exportée** — aperçu `/preview/<projectName>`, page publique, export HTML/ZIP, CloudPage SFMC | HTML + CSS uniquement. **Aucun JavaScript de formulaire.** |
| **ENV-3** | **Socle SSJS / Salesforce Core** — CloudPage SFMC avec le socle inliné | ⛔ Non déployable en l'état (voir §1.1 constat C) |

---

## 3. Architecture et flux

### 3.1 Chaîne complète telle qu'implémentée

```
┌─────────────────────────── ENV-1 : BUILDER (éditeur GrapesJS) ───────────────────────────┐
│                                                                                           │
│  blocks/index.js  ──registerBlocks()──►  form-brochure / form-jpo / form-atelier /        │
│                                          form-stage / form-immersion / form-candidature   │
│                                                    │                                      │
│                          buildContent(lang) / buildEventBlock(opts)                       │
│                                                    │                                      │
│      ┌─────────────────────────────────────────────┼──────────────────────────────┐       │
│      │ shared/picklist-config.js  → <option> (values = noms d'API Salesforce)      │       │
│      │ shared/tracking-fields.js  → <input type="hidden"> (tracking + CRM)         │       │
│      │ shared/rgpd-config.js      → texte + lien RGPD (mock / window.CURRENT_SCHOOL)│      │
│      │ shared/programme-config.js → programmes conditionnels (mock)                │       │
│      └────────────────────────────────────────────────────────────────────────────┘       │
│                                                    │                                      │
│                                        HTML + <style> (sans <script>)                     │
│                                                    │                                      │
│  editor.on('component:mount') ──► initXxxForm(form) sur editor.Canvas.getDocument()       │
│      • populateHiddenFields()   • listeners change/blur   • listener submit                │
│                                                    │                                      │
│  blocks/forms/shared/campus-select.js ──► remplace les <option> du select Campus           │
│      (source : GET /api/campuses → Supabase [Vercel] ou Data Extension SFMC [local])       │
│                                                    │                                      │
│  submit ──► validation ──► FormData ──► normalisation tél. ──► HasOptedIn*                 │
│         ──► ⚠ Promise simulée { ok:true } ──► affichage du bloc de confirmation            │
│                                                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                       editor.getHtml() + editor.getCss()
                                          │
┌─────────────────────── ENV-2 : SAUVEGARDE / PUBLICATION ────────────────────────────┐
│  POST /api/save                                                                      │
│    └─ ensureFormAnchors(html)  → id stable sur chaque <form> (form-brochure, …)       │
│    └─ buildStoredHtml()        → <!DOCTYPE> + <style>css</style> + body               │
│    └─ Supabase `Projects` + sync `pages` / `page_variants`                            │
│    └─ enqueueOrProcessInline() → cleanHtmlForSfmc() → publication SFMC                 │
│                                                                                       │
│  GET /preview/<projectName>  /  page publique  /  export HTML / ZIP                   │
│    └─ HTML + CSS uniquement — ⚠ aucun script de formulaire réinjecté                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                          │
┌─────────────────── ENV-3 : SOCLE SSJS → SALESFORCE CORE (⛔ absent) ────────────────┐
│  readForm() → upsertPersonAccount() → upsertConsents() → upsertCampaignMember()       │
│             → upsertSummitRegistration() → createAppointments()                       │
│  Objets : Account (Person Account), ContactPointConsent, CampaignMember,               │
│           CampaignMemberInteraction__c, summit__Registration__c, summit__Appointment__c│
│  Règles : upsert systématique · fill-if-blank · idempotence · anti-écho Summit          │
│           · double nommage UTM · appointments additifs                                 │
│  Source : sfmc-ssjs/test/socle.test.js + sfmc-ssjs/socle/recap-socle-ssjs.html          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Flux de LECTURE réellement présents

| # | Donnée lue | Source réelle | Consommateur | Fichier |
|---|---|---|---|---|
| L1 | Liste des campus | `GET /api/campuses` → **Supabase `campuses`** (Vercel) **ou** Data Extension SFMC filtrée par école (local) | `select[name="Campus"]` de F01, F02, F03, F04, F05, F06 | [shared/campus-select.js](blocks/forms/shared/campus-select.js), [js/campus.js:58-71](js/campus.js#L58-L71) |
| L2 | Texte + lien RGPD | `window.CURRENT_SCHOOL.rgpdText` / `.rgpdUrl`, sinon mock FR/EN | case RGPD des 6 formulaires | [shared/rgpd-config.js](blocks/forms/shared/rgpd-config.js) |
| L3 | Niveau d'études, Pays, « Vous êtes » | **Mock en dur** | selects des 6 formulaires | [shared/picklist-config.js](blocks/forms/shared/picklist-config.js) |
| L4 | Programmes | **Mock en dur**, indexé par niveau (+ surcharge campus vide) | `select[name="Programme"]` | [shared/programme-config.js](blocks/forms/shared/programme-config.js) |
| L5 | Dates / adresses d'événement | **Mock en dur** `jpoEvents` (10 campus × FR/EN) | encart `.jpo-event-card` de F02, F03, F04 | [shared/event-form.js:33-58](blocks/forms/shared/event-form.js#L33-L58) |
| L6 | Liste des brochures | **Mock en dur** `BROCHURES` (2 campus × 3 niveaux) | bloc de confirmation de F01 | [form-brochure/index.js:83-94](blocks/forms/form-brochure/index.js#L83-L94) |
| L7 | Paramètres de campagne (`utm_*`, `gclid`, `fbclid`) | `URLSearchParams` de la fenêtre porteuse du formulaire | champs cachés des 6 formulaires | [shared/tracking-fields.js:78-90](blocks/forms/shared/tracking-fields.js#L78-L90) |
| L8 | `clientId` | `localStorage.edh_client_id` (généré si absent) | champ caché `clientId` | [shared/tracking-fields.js:92-101](blocks/forms/shared/tracking-fields.js#L92-L101) |
| L9 | Consentement cookies | cookies `cookie_consent` / `cookie_consent_date` | champs cachés `consent`, `date_consentement_cookies` | [shared/tracking-fields.js:103-111](blocks/forms/shared/tracking-fields.js#L103-L111) |
| L10 | Marque / école | `window.CURRENT_SCHOOL.name` **de la fenêtre du formulaire** | champ caché `Marque` | [shared/tracking-fields.js:113-125](blocks/forms/shared/tracking-fields.js#L113-L125) |
| L11 | Page enregistrée | `GET /api/project/…` / `/preview/…` / page publique | relecture du formulaire posé (options figées dans le HTML) | [api/router.js:923](api/router.js#L923) |
| L12 | Picklists Salesforce (`EntityParticle` + `PicklistValueInfo`), PTAT, campus, dates Summit | ⛔ `SocleRead` absent — pages de diagnostic en lecture seule uniquement | — | [sfmc-ssjs/socle/test-read-diagnostic.ssjs](sfmc-ssjs/socle/test-read-diagnostic.ssjs) |

### 3.3 Flux d'ÉCRITURE réellement présents

| # | Écriture | État | Fichier |
|---|---|---|---|
| E1 | Collecte du payload (`FormData` → objet `data`) | ✅ implémenté | handlers `submit` des 6 formulaires |
| E2 | Normalisation téléphone (indicatif + numéro → `+33…`) | ⚠️ implémenté avec défauts (voir PV-05, PV-06) | idem |
| E3 | Calcul des opt-in `HasOptedInEmail/SMS/WhatsApp/Phone` | ✅ implémenté | idem |
| E4 | Envoi vers un backend | ❌ **absent** — promesse simulée | idem |
| E5 | Écriture Salesforce (Person Account, Consentements, Campagne, Summit) | ⛔ socle absent du dépôt | `sfmc-ssjs/socle/*.ssjs` (manquants) |
| E6 | Sauvegarde de la **page** contenant le formulaire | ✅ `POST /api/save` → Supabase `Projects` + `pages`/`page_variants` | [api/router.js:669](api/router.js#L669) |
| E7 | Publication SFMC de la page | ✅ `POST /api/publish-sfmc` | [api/router.js:849](api/router.js#L849) |

### 3.4 Champs cachés communs aux 6 formulaires

Générés par `buildHiddenFields()` ([shared/tracking-fields.js:36-57](blocks/forms/shared/tracking-fields.js#L36-L57)) :

`submitted` (=`true`), `NomFormulaire`, `TypeFormulaire`, `Marque`, `LanguePreferee`, `LangueSouhaitee`, `DateDernierContact`, `TypeDernierContact`, `CampagneAssociee`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `utm_id`, `utm_campus`, `gclid`, `fbclid`, `clientId`, `consent`, `date_consentement_cookies`, `canal`, `sous_canal`.

Ajoutés **au moment de la soumission** (jamais dans le HTML) : `MobilePhone` (normalisé), `HasOptedInEmail`, `HasOptedInSMS`, `HasOptedInWhatsApp`, `HasOptedInPhone`.

### 3.5 Règles de validation communes (code de référence)

| Règle | Implémentation | Fichiers |
|---|---|---|
| **Champ requis** | `!el.value.trim()` → message `errRequired` + classe `.err` sur le champ | tous |
| **E-mail — format** | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` | tous |
| **E-mail — domaine jetable** | liste de 8 domaines : `mailinator.com`, `guerrillamail.com`, `tempmail.com`, `yopmail.com`, `trashmail.com`, `throwam.com`, `spam4.me`, `dispostable.com` | tous |
| **Téléphone — format** | on retire `espace - . ( )`, on retire le `0` initial, puis `/^[0-9]{7,14}$/` | tous |
| **Téléphone — normalisation** | on retire `espace - .` (**pas** les parenthèses), on retire le `0` initial, on préfixe avec l'indicatif si la valeur ne commence pas par `+` | tous |
| **RGPD** | **aucune vérification** — la case n'est jamais obligatoire | tous |
| **Programme** | **jamais obligatoire**, même affiché | tous |
| **Validation native HTML** | désactivée : attribut `novalidate` sur chaque `<form>` | tous |

---

## 4. Les 6 formulaires actifs

### 4.1 F01 — Brochure

| Rubrique | Détail |
|---|---|
| **Blocs** | `form-brochure` (FR) · `form-brochure-en` (EN) — catégorie *Form Blocks* |
| **Fichier** | [blocks/forms/form-brochure/index.js](blocks/forms/form-brochure/index.js) (637 lignes) |
| **Emplacement** | Panneau *Blocs* → catégorie **Form Blocks** ; déposable dans n'importe quelle page |
| **Fonction métier** | Un prospect (ou un parent) demande à recevoir une ou plusieurs brochures par e-mail |
| **Objectif** | Collecter l'identité + le projet d'études, puis afficher la liste des brochures |
| **Sélecteurs racine** | `section.brf-section` › `div.brf-card` › `form.brf-form` |
| **Champs cachés** | communs (§3.4) avec `NomFormulaire="Telechargement_Brochure"`, `TypeFormulaire="brochure"` |
| **Source des données** | picklists mock (L3), campus API (L1), programmes mock (L4), RGPD (L2), tracking URL/cookies (L7-L9) |
| **Destination** | ❌ aucune (promesse simulée) — destination cible : Person Account + ContactPointConsent + CampaignMember |
| **Flux lecture** | L1, L2, L3, L4, L6, L7, L8, L9, L10 |
| **Flux écriture** | E1, E2, E3 puis **E4 absent** |
| **API appelées** | `GET /api/campuses` (indirect, via la synchro des selects). Aucune API à la soumission. |
| **Systèmes externes** | Supabase / SFMC pour les campus uniquement |

**Champs (dans l'ordre du DOM)**

| # | Libellé FR | `name` | Type | Obligatoire | Valeur par défaut | Options / contraintes |
|---|---|---|---|---|---|---|
| 1 | Vous êtes | `VousEtes` | `select` | ✅ | `""` | `student`, `student_enrolled`, `parent`, `professional` (+ 1re option vide **sans libellé**) |
| 2 | Nom | `LastName` | `text` | ✅ | `""` | aucune contrainte de longueur |
| 3 | Prénom | `FirstName` | `text` | ✅ | `""` | aucune contrainte de longueur |
| 4 | Adresse email | `EmailAddress` | `email` | ✅ | `""` | regex + liste noire de domaines |
| 5 | Indicatif | *(aucun `name`)* | `select` | — | `+33` | `+33 +32 +41 +352 +1 +44 +212` — **non transmis tel quel**, sert au préfixage |
| 6 | Portable | `MobilePhone` | `tel` | ✅ | `""` | 7 à 14 chiffres après nettoyage |
| 7 | Niveau d'études | `StudyLevel` | `select` | ✅ | `""` | 9 valeurs : `seconde` → `bac+5` |
| 8 | Campus souhaité | `Campus` | `select` | ✅ | `""` | 10 valeurs statiques, **remplacées** par les campus de la page si l'API en renvoie |
| 9 | Programme souhaité | `Programme` | `select` | ❌ | `""` | 🔀 affiché si `getProgrammes(niveau, campus, lang)` non vide |
| 10 | Pays de résidence | `Country` | `select` | ✅ | `""` | 18 valeurs (`FR`, `BE`, …, `OTHER`) |
| 11 | Nom de votre enfant | `ChildLastName` | `text` | ❌ | `""` | 🔀 affiché si `VousEtes === 'parent'` |
| 12 | Prénom de votre enfant | `ChildFirstName` | `text` | ❌ | `""` | 🔀 idem |
| 13 | Téléphone de votre enfant | `ChildPhone` | `tel` | ❌ | `""` | 🔀 idem ; validé **seulement si non vide** |
| 14 | RGPD | `RGPDConsent` | `checkbox` | ❌ *(non vérifié)* | décoché | `value="true"` |

**Comportements conditionnels** ([form-brochure/index.js:478-512](blocks/forms/form-brochure/index.js#L478-L512))
- `VousEtes = parent` → affiche les 3 champs enfant ; tout autre choix les masque **et vide leurs valeurs**.
- `StudyLevel` ou `Campus` change → recalcule les options de `Programme` ; liste vide → champ masqué et valeur remise à `""`.

**Boutons / actions** : un seul `<button type="submit" class="brf-submit">` avec libellé éditable dans un `<span>`.

**Comportement à la soumission** ([form-brochure/index.js:530-608](blocks/forms/form-brochure/index.js#L530-L608))
1. `preventDefault()`.
2. Vérifie `VousEtes, LastName, FirstName, StudyLevel, Campus, Country` non vides après `trim()`.
3. Valide e-mail puis téléphone. Valide `ChildPhone` uniquement s'il est **visible et non vide**.
4. En cas d'erreur : `scrollIntoView` sur le premier champ en erreur, et **arrêt**.
5. Sinon : bouton désactivé + spinner « Envoi en cours… ».
6. `FormData` → `data` ; normalisation du téléphone ; calcul des 4 `HasOptedIn*`.
7. Promesse simulée 1000 ms → masque `form`, `.brf-title`, `.brf-subtitle` ; affiche `.brf-success`.
8. Liste de brochures = `BROCHURES[Campus][StudyLevel]`, sinon `["Brochure générale <Campus>"]`.

**Messages**

| Cas | Message FR | Message EN |
|---|---|---|
| Champ requis | `Ce champ est requis.` | `This field is required.` |
| E-mail mal formé | `Format e-mail invalide.` | `Invalid email format.` |
| Domaine jetable | `Veuillez utiliser une adresse valide.` | `Please use a valid email address.` |
| Téléphone invalide | `Numéro invalide (ex: 06 12 34 56 78).` | `Invalid number (e.g. 07 12 34 56 78).` |
| Succès — titre | `Merci, {Prénom} {Nom} !` | `Thank you, {Prénom} {Nom}!` |
| Succès — corps | `Votre demande a été enregistrée. Vos documents seront envoyés à <email>.` | idem EN |
| Erreur générique | `Une erreur est survenue, veuillez réessayer.` | ⚠️ **branche inatteignable** (voir PV-04) |

---

### 4.2 F02 — JPO (Journée Portes Ouvertes)

| Rubrique | Détail |
|---|---|
| **Blocs** | `form-jpo` (FR) · `form-jpo-en` (EN) |
| **Fichier** | [blocks/forms/form-jpo/index.js](blocks/forms/form-jpo/index.js) — moteur : [blocks/forms/shared/event-form.js](blocks/forms/shared/event-form.js) |
| **Fonction métier** | Inscription à une journée portes ouvertes, sur un campus donné, à une date donnée |
| **Objectif** | Collecter l'inscription + rattacher la personne à un événement daté |
| **Sélecteurs racine** | `section.jpo-section[data-header-align]` › `div.jpo-card` › `div.jpo-campus-zone` (**hors formulaire**) + `div.jpo-form-zone` › `form.jpo-form` |
| **Paramètres du moteur** | `typeEvenement='JPO'`, `nomAction='Inscription_JPO'`, `showVousEtes=true`, `showChild=true`, `formVariant=''` |
| **Champs cachés** | communs + `NomFormulaire="Inscription_JPO"`, `TypeFormulaire="evenement"`, `TypeEvenement="JPO"`, `EventDate=""` |
| **Flux lecture** | L1, L2, L3, L4, **L5 (encart événement)**, L7-L10 |
| **Flux écriture** | E1, E2, E3 puis **E4 absent** |
| **Trait GrapesJS** | *Alignement du titre* (`data-header-align` : Centré / Gauche / Droite) via le type `jpo-event-section` |

**Champs**

| # | Libellé FR | `name` | Type | Obligatoire | Particularité |
|---|---|---|---|---|---|
| 1 | Campus | `Campus` | `select` | ✅ | ⚠️ **situé hors du `<form>`** ; à chaque `change`, un `<input type="hidden" name="Campus">` est créé/mis à jour **dans** le formulaire |
| 2 | *(encart événement)* | `EventDate` | `hidden` | auto | alimenté par `jpoEvents[lang][campus].date` — **libellé texte**, pas une date ISO |
| 3 | Type d'événement | `TypeEvenement` | `hidden` | auto | `JPO` |
| 4 | Vous êtes | `VousEtes` | `select` | ✅ | seulement `student`, `parent`, `professional` (**pas** `student_enrolled`) |
| 5 | Niveau d'études | `StudyLevel` | `select` | ✅ | 9 valeurs |
| 6 | Nom | `LastName` | `text` | ✅ | |
| 7 | Prénom | `FirstName` | `text` | ✅ | |
| 8 | Adresse email | `EmailAddress` | `email` | ✅ | |
| 9 | Indicatif | *(aucun `name`)* | `select` | — | défaut `+33` |
| 10 | Portable | `MobilePhone` | `tel` | ✅ | |
| 11 | Programme souhaité | `Programme` | `select` | ❌ | 🔀 conditionnel |
| 12 | Nom / Prénom / Tél. enfant | `ChildLastName` / `ChildFirstName` / `ChildPhone` | `text`/`tel` | ❌ | 🔀 si `VousEtes = parent` |
| 13 | RGPD | `RGPDConsent` | `checkbox` | ❌ *(non vérifié)* | |

**Encart « Prochaine JPO »** ([shared/event-form.js:917-938](blocks/forms/shared/event-form.js#L917-L938))
- Campus **avec** événement : `paris`, `lille`, `lyon`, `nice`, `nantes`, `toulouse` → encart visible (date, horaires, conférences, « Campus \<Ville\> » + adresse) et `EventDate` renseigné.
- Campus **sans** événement : `bordeaux`, `montpellier`, `aix`, `rennes` → encart masqué, `EventDate` remis à `""`.

**Soumission** ([shared/event-form.js:1019-1072](blocks/forms/shared/event-form.js#L1019-L1072))
1. Requis : `VousEtes`, `LastName`, `FirstName`, `StudyLevel`.
2. Campus : si vide → classe `.err` sur le select, **sans message d'erreur**.
3. E-mail, téléphone. `ChildPhone` si visible et non vide.
4. Échec → **`return` sec, sans `scrollIntoView`**.
5. Succès → masque `.jpo-form-zone`, affiche `.jpo-success` : « Merci, X ! » + « Votre inscription du **\<EventDate\>** sur le campus de **\<valeur du campus\>** a bien été enregistrée. »

---

### 4.3 F03 — Atelier Découverte

Même moteur que F02. **Seules** les différences sont listées.

| Rubrique | Détail |
|---|---|
| **Blocs** | `form-atelier` (FR) · `form-atelier-en` (EN) |
| **Fichier** | [blocks/forms/form-atelier/index.js](blocks/forms/form-atelier/index.js) |
| **Paramètres** | `typeEvenement='Atelier_Decouverte'`, `nomAction='Inscription_Atelier'`, `showVousEtes=true`, `showChild=true`, `formVariant=''` |
| **Champs cachés** | `NomFormulaire="Inscription_Atelier"`, `TypeFormulaire="evenement"`, `TypeEvenement="Atelier_Decouverte"` |
| **Titre FR / EN** | « Inscription à l'Atelier Découverte » / « Discovery Workshop Registration » |
| **Bouton FR / EN** | « RÉSERVER MA PLACE » / « BOOK MY SPOT » |
| **Structure des champs** | ⚠️ **strictement identique à F02** : « Vous êtes » et les champs enfant sont **présents**, alors que [GUIDE_FORMULAIRES_CRM.md §3.3](blocks/forms/GUIDE_FORMULAIRES_CRM.md) les exclut explicitement (voir PV-27) |
| **Encart événement** | ⚠️ alimenté par le **même** objet `jpoEvents` que la JPO → affiche des **dates de JPO** (voir PV-14) |

---

### 4.4 F04 — Stage

| Rubrique | Détail |
|---|---|
| **Blocs** | `form-stage` (FR) · `form-stage-en` (EN) |
| **Fichier** | [blocks/forms/form-stage/index.js](blocks/forms/form-stage/index.js) |
| **Paramètres** | `typeEvenement='Stage'`, `nomAction='Inscription_Stage'`, `showVousEtes=**false**`, `showChild=**false**`, `formVariant='stage'` |
| **Champs cachés** | `NomFormulaire="Inscription_Stage"`, `TypeFormulaire="evenement"`, `TypeEvenement="Stage"` |
| **Champs absents** | `VousEtes`, `ChildLastName`, `ChildFirstName`, `ChildPhone` |
| **Champs requis** | `LastName`, `FirstName`, `StudyLevel` + `Campus` + e-mail + téléphone (la boucle de contrôle ignore `VousEtes` car `form.querySelector('[name="VousEtes"]')` renvoie `null`) |
| **Différences d'affichage** | `data-form-variant="stage"` → le jeton `--jpo-field-bg` retombe sur `var(--brand-background)` et l'indicatif redevient transparent ; **pas** de trait *Alignement du titre* (`isComponent` exclut la variante stage — [shared/event-form.js:871-873](blocks/forms/shared/event-form.js#L871-L873)) |
| **Titre FR / EN** | « Inscription au Stage » / « Internship Application » |
| **Bouton FR / EN** | « Je m'inscris au stage » / « Apply for the internship » |
| **Écoles concernées (doc)** | BRASSART, CREAD, MOPA, École Bleue — ⚠️ **aucun filtrage par école n'est implémenté** dans le registre ni dans le bloc |
| **Encart événement** | ⚠️ même `jpoEvents` que la JPO (PV-14) |

---

### 4.5 F05 — Demande d'immersion

| Rubrique | Détail |
|---|---|
| **Blocs** | `form-immersion` (FR) · `form-immersion-en` (EN) |
| **Fichier** | [blocks/forms/form-immersion/index.js](blocks/forms/form-immersion/index.js) (528 lignes) |
| **Fonction métier** | Le prospect demande à vivre une journée d'immersion ; pas d'événement daté → demande de rappel |
| **Sélecteurs racine** | `section.imf-section` › `div.imf-card` › `form.imf-form` |
| **Champs cachés** | communs + `NomFormulaire="Demande_Immersion"`, `TypeFormulaire="immersion"` |
| **Flux lecture** | L1, L2, L3, L4, L7-L10 (**pas** de L5 ni L6) |
| **Flux écriture** | E1, E2, E3 puis **E4 absent** |

**Champs**

| # | Libellé FR | `name` | Type | Obligatoire |
|---|---|---|---|---|
| 1 | Nom | `LastName` | `text` | ✅ |
| 2 | Prénom | `FirstName` | `text` | ✅ |
| 3 | Adresse email | `EmailAddress` | `email` | ✅ |
| 4 | Indicatif | *(aucun `name`)* | `select` | — |
| 5 | Portable | `MobilePhone` | `tel` | ✅ |
| 6 | Niveau d'études | `StudyLevel` | `select` | ✅ |
| 7 | Campus | `Campus` | `select` | ✅ |
| 8 | Programme souhaité | `Programme` | `select` | ❌ 🔀 |
| 9 | RGPD | `RGPDConsent` | `checkbox` | ❌ *(non vérifié)* |

> **Absents par rapport à F01/F06** : `VousEtes`, `Country`, champs enfant. Le champ « Vous êtes » n'existe pas → aucun conditionnel parent.

**Soumission** : requis `LastName, FirstName, StudyLevel, Campus` + e-mail + téléphone → `scrollIntoView` sur la 1re erreur → promesse simulée 1000 ms → masque `form` + titre + sous-titre, affiche `.imf-success` : « Merci, X ! » + « Votre demande d'immersion a bien été enregistrée. Un accusé de réception vous a été envoyé à \<email\>. Notre responsable développement vous contactera très prochainement par téléphone. »

---

### 4.6 F06 — Candidature

| Rubrique | Détail |
|---|---|
| **Blocs** | `form-candidature` (FR) · `form-candidature-en` (EN) |
| **Fichier** | [blocks/forms/form-candidature/index.js](blocks/forms/form-candidature/index.js) (546 lignes) |
| **Fonction métier** | Dépôt de candidature ; le candidat reçoit un e-mail d'activation du portail candidature |
| **Sélecteurs racine** | `section.cnd-section` › `div.cnd-card` › `form.cnd-form` |
| **Champs cachés** | communs + `NomFormulaire="Candidature"`, `TypeFormulaire="candidature"` ; `LangueSouhaitee` valorisé à `"français"` **uniquement** si `CURRENT_SCHOOL.id` contient `ifa` |
| **Flux lecture** | L1, L2, L3, L4, L7-L10 |
| **Flux écriture** | E1, E2, E3 puis **E4 absent** |

**Champs**

| # | Libellé FR | `name` | Type | Obligatoire |
|---|---|---|---|---|
| 1 | Nom | `LastName` | `text` | ✅ |
| 2 | Prénom | `FirstName` | `text` | ✅ |
| 3 | Pays de résidence | `Country` | `select` | ✅ |
| 4 | Adresse email | `EmailAddress` | `email` | ✅ |
| 5 | Indicatif | *(aucun `name`)* | `select` | — |
| 6 | Portable | `MobilePhone` | `tel` | ✅ |
| 7 | Niveau d'études | `StudyLevel` | `select` | ✅ |
| 8 | Campus | `Campus` | `select` | ✅ |
| 9 | Programme souhaité | `Programme` | `select` | ❌ 🔀 |
| 10 | RGPD | `RGPDConsent` | `checkbox` | ❌ *(non vérifié)* |

> **Conforme au guide** : pas de champ *Nationalité*, pas de champ *Rentrée générale* (posée par Flow Builder côté CRM).

**Soumission** : requis `LastName, FirstName, Country, StudyLevel, Campus` + e-mail + téléphone → `scrollIntoView` → promesse simulée 1000 ms → `.cnd-success` (emoji 📧) : « Merci, X ! » + « Votre candidature a bien été enregistrée. Consultez votre boîte mail : un e-mail vient d'être envoyé à \<email\> pour activer votre compte et accéder au portail candidature. »

---

## 5. Cas de recette

### Conventions

- **ID** : `F<nn>-<CAT>-<nnn>` — `F01`…`F06` · catégories `NOM` (nominal), `VAL` (validation), `READ` (lecture), `WRITE` (écriture), `ERR` (erreur technique), `EDGE` (cas limite), `INT` (intégration), `SEC` (sécurité).
- **Priorité** : **P1** critique (bloque le parcours ou risque de perte / corruption de données) · **P2** majeure · **P3** mineure.
- **Environnement** : ENV-1 (builder) · ENV-2 (page publiée) · ENV-3 (socle SSJS).
- ⛔ = cas **non exécutable en l'état** (documente le comportement attendu).
- **Préconditions par défaut (PRE-0)**, valables sauf mention contraire : éditeur ouvert sur `index.html?school=<école>`, une page vierge, le bloc du formulaire testé déposé une fois dans le canvas, console navigateur ouverte.
- **Colonnes** : le *formulaire* et la *catégorie* sont portés par l'ID (`F01-VAL-003` = formulaire 1, catégorie validation, test 3) ; les colonnes du tableau sont donc `ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio`.

---

### 5.1 F01 — Brochure

#### 5.1.1 Cas nominaux

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-NOM-001 | ENV-1 | Soumission complète valide (étudiant) | PRE-0 | 1. Renseigner tous les champs requis. 2. Cliquer sur *Je télécharge la brochure*. | VousEtes=`Étudiant(e)`, Nom=`Dupont`, Prénom=`Marie`, Email=`marie.dupont@exemple.com`, Indicatif=`FR (+33)`, Tél=`06 12 34 56 78`, Niveau=`Bac+3`, Campus=`Paris`, Pays=`France` | Bouton désactivé + spinner « Envoi en cours… » ~1 s, puis le formulaire, le titre et le sous-titre disparaissent ; `.brf-success` s'affiche avec « Merci, Marie Dupont ! » et l'e-mail en gras | P1 |
| F01-NOM-002 | ENV-1 | Liste de brochures affichée pour une combinaison connue | PRE-0 | Soumettre avec Campus=Paris et Niveau=Bac+5 | idem F01-NOM-001 + Campus=`Paris`, Niveau=`Bac+5 et +` | La liste contient exactement `Brochure MBA Communication (Paris)` et `Brochure MBA Marketing Digital (Paris)` (2 liens PDF inertes) | P2 |
| F01-NOM-003 | ENV-1 | Liste de brochures — repli générique | PRE-0 | Soumettre avec un couple campus/niveau absent de `BROCHURES` | Campus=`Lyon`, Niveau=`Terminale` | La liste contient un seul élément `Brochure générale lyon (PDF)` | P3 |
| F01-NOM-004 | ENV-1 | Parcours parent complet | PRE-0 | 1. Choisir *Parent*. 2. Vérifier l'apparition des 3 champs enfant. 3. Les renseigner. 4. Soumettre. | VousEtes=`Parent`, enfant : `Dupont` / `Léo` / `06 98 76 54 32` | Champs enfant visibles, soumission acceptée, `ChildLastName`/`ChildFirstName`/`ChildPhone` présents dans le payload | P1 |
| F01-NOM-005 | ENV-1 | Programme conditionnel visible et transmis | PRE-0 | 1. Niveau=`Bac+5 et +`. 2. Vérifier l'affichage du champ *Programme souhaité*. 3. Choisir `Master 2`. 4. Soumettre. | Niveau=`Bac+5 et +`, Programme=`Master 2` | Le champ apparaît avec 4 options (placeholder + 3), `Programme=master2` dans le payload | P2 |
| F01-NOM-006 | ENV-1 | Variante EN — bloc `form-brochure-en` | Bloc *Formulaire Brochure Anglais* déposé | Soumettre avec des données valides | idem F01-NOM-001 | Libellés et messages en anglais ; `data-lang="en"` sur le `<form>` ; champ caché `LanguePreferee=en` | P2 |
| F01-NOM-007 | ENV-1 | Payload complet — inspection console | PRE-0, point d'arrêt ou `console.log` sur l'objet `data` | Soumettre un cas valide et inspecter `data` | idem F01-NOM-001 | `data` contient les champs visibles renseignés + les 23 champs cachés + `HasOptedInEmail/SMS/WhatsApp/Phone` | P1 |

#### 5.1.2 Champs obligatoires et validation

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-VAL-001 | ENV-1 | Formulaire entièrement vide | PRE-0 | Cliquer directement sur *Je télécharge la brochure* | — | 8 erreurs affichées (`VousEtes`, `LastName`, `FirstName`, `StudyLevel`, `Campus`, `Country`, e-mail, téléphone), bordure rouge, défilement automatique vers le 1er champ en erreur, **aucune** confirmation | P1 |
| F01-VAL-002 | ENV-1 | `LastName` vide seul | PRE-0 | Tout renseigner sauf le nom, soumettre | Nom vide | `Ce champ est requis.` sous le champ Nom uniquement ; soumission bloquée | P1 |
| F01-VAL-003 | ENV-1 | `LastName` composé uniquement d'espaces | PRE-0 | Saisir 5 espaces dans Nom | Nom = 5 espaces | Bloqué (`!el.value.trim()`) — même message que F01-VAL-002 | P2 |
| F01-VAL-004 | ENV-1 | `VousEtes` laissé sur l'option vide | PRE-0 | Ne pas toucher au 1er select | VousEtes vide | Bloqué, message `Ce champ est requis.` | P1 |
| F01-VAL-005 | ENV-1 | `Country` vide | PRE-0 | Tout renseigner sauf Pays | Country vide | Bloqué | P1 |
| F01-VAL-006 | ENV-1 | E-mail sans arobase | PRE-0 | Saisir un e-mail invalide, quitter le champ | `marie.dupont.exemple.com` | Au `blur` : `Format e-mail invalide.` ; soumission bloquée | P1 |
| F01-VAL-007 | ENV-1 | E-mail avec TLD à 1 caractère | PRE-0 | Saisir puis quitter le champ | `marie@exemple.f` | Rejeté (2 caractères minimum exigés) — `Format e-mail invalide.` | P2 |
| F01-VAL-008 | ENV-1 | E-mail sur domaine jetable | PRE-0 | Saisir puis quitter | `test@yopmail.com` | `Veuillez utiliser une adresse valide.` (message distinct du format) | P2 |
| F01-VAL-009 | ENV-1 | Domaine jetable en majuscules | PRE-0 | Saisir puis quitter | `test@YOPMAIL.COM` | Rejeté également (`domain.toLowerCase()`) | P3 |
| F01-VAL-010 | ENV-1 | Sous-domaine d'un domaine jetable | PRE-0 | Saisir puis quitter | `test@sub.yopmail.com` | ✅ **Accepté** — la liste noire compare le domaine exact. Comportement actuel : accepté. Comportement recommandé : rejeter les sous-domaines (voir §9) | P3 |
| F01-VAL-011 | ENV-1 | Téléphone trop court | PRE-0 | Saisir puis quitter | `06 12 34` (soit 5 chiffres utiles) | `Numéro invalide (ex: 06 12 34 56 78).` | P1 |
| F01-VAL-012 | ENV-1 | Téléphone trop long | PRE-0 | Saisir puis quitter | `0612345678901234` (15 chiffres utiles) | Rejeté (14 maximum après retrait du zéro initial) | P2 |
| F01-VAL-013 | ENV-1 | Téléphone avec lettres | PRE-0 | Saisir puis quitter | `06 12 34 56 AB` | Rejeté | P2 |
| F01-VAL-014 | ENV-1 | Téléphone déjà au format international | PRE-0 | Saisir puis quitter | `+33612345678` | ⚠️ **Rejeté** : le `+` n'est pas retiré avant le test `^[0-9]{7,14}$`. Comportement actuel : erreur. Comportement recommandé : accepter. Voir **PV-05** | P1 |
| F01-VAL-015 | ENV-1 | Téléphone enfant invalide (champ facultatif renseigné) | VousEtes=`Parent` | Saisir un tél. enfant invalide et soumettre | ChildPhone=`123` | Erreur sur le champ enfant, soumission bloquée | P2 |
| F01-VAL-016 | ENV-1 | Téléphone enfant vide (champ facultatif) | VousEtes=`Parent` | Laisser le tél. enfant vide, soumettre | ChildPhone vide | ✅ Accepté — le champ n'est validé que s'il est non vide | P2 |
| F01-VAL-017 | ENV-1 | Correction d'une erreur | Erreur affichée sur le Nom | Renseigner le nom puis re-soumettre | Nom=`Dupont` | L'erreur disparaît (`clearFieldErr`), la soumission aboutit | P2 |
| F01-VAL-018 | ENV-1 | RGPD non coché | PRE-0 | Soumettre sans cocher la case RGPD | RGPDConsent absent | ⚠️ **Soumission acceptée**, les 4 `HasOptedIn*` valent `"0"`. Comportement actuel : autorisé. Comportement recommandé : bloquer. Voir **PV-03** | P1 |
| F01-VAL-019 | ENV-1 | RGPD coché | PRE-0 | Cocher la case et soumettre | RGPDConsent=`true` | `RGPDConsent="true"` et les 4 `HasOptedIn*` valent `"1"` | P1 |
| F01-VAL-020 | ENV-1 | Programme masqué : valeur résiduelle | Programme choisi pour Bac+5 | 1. Choisir Bac+5 et un programme. 2. Repasser sur `Seconde`. 3. Soumettre. | Niveau : `Bac+5 et +` puis `Seconde` | Le champ Programme est masqué **et** sa valeur remise à vide → `Programme` vide dans le payload | P2 |
| F01-VAL-021 | ENV-1 | Champ Programme non obligatoire | PRE-0 | Afficher le champ Programme puis soumettre sans le renseigner | Programme vide | ✅ Soumission acceptée — le champ n'est jamais requis | P2 |

#### 5.1.3 Lecture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-READ-001 | ENV-1 | Campus lus depuis l'API | École avec au moins 1 campus en base | 1. Ouvrir l'éditeur. 2. Déposer le bloc. 3. Ouvrir la liste Campus. | `GET /api/campuses?school=<id>` | Les options correspondent aux campus de la page (`value` = id/slug, libellé = `name`), la 1re option vide est conservée | P1 |
| F01-READ-002 | ENV-1 | Aucune donnée campus retournée | École sans campus, ou API en erreur | Ouvrir la liste Campus | tableau vide | ⚠️ Repli silencieux sur les **10 campus statiques** de `picklist-config.js` (`syncOne` sort si la liste est vide) — aucun message | P2 |
| F01-READ-003 | ENV-1 | Sélection de campus au niveau page | Modale *Campus* : cocher 2 campus sur 5 | Confirmer, puis rouvrir la liste du formulaire | 2 ids | La liste ne contient que les 2 campus sélectionnés, dans l'ordre de la sélection | P2 |
| F01-READ-004 | ENV-1 | Texte RGPD lu depuis l'école | École avec `rgpdText` / `rgpdUrl` renseignés | Déposer le bloc et lire la case RGPD | — | Le texte et l'URL de l'école sont affichés en FR ; en EN, seul `rgpdUrl` est repris, le texte reste le mock EN ([rgpd-config.js:43](blocks/forms/shared/rgpd-config.js#L43)) | P2 |
| F01-READ-005 | ENV-1 | Texte RGPD — repli mock | École sans `rgpdText` | Lire la case RGPD | — | Texte par défaut FR/EN et lien `#privacy-policy` | P3 |
| F01-READ-006 | ENV-1 | Champs cachés de tracking à l'initialisation | PRE-0 | Inspecter les `input[type=hidden]` du formulaire dans le canvas | — | `submitted=true`, `NomFormulaire=Telechargement_Brochure`, `TypeFormulaire=brochure`, `LanguePreferee=fr` ; `Marque` **vide** (voir **PV-09**) ; `utm_*`, `gclid`, `fbclid` vides dans le canvas (voir **PV-11**) | P2 |
| F01-READ-007 | ENV-1 | `clientId` persistant | PRE-0 | 1. Inspecter `clientId`. 2. Recharger l'éditeur. 3. Réinspecter. | `localStorage.edh_client_id` du document canvas | La même valeur `cid_<hash>` est réutilisée après rechargement | P3 |
| F01-READ-008 | ENV-1 | Consentement cookies repris | Cookies `cookie_consent` et `cookie_consent_date` posés sur le document du canvas | Recharger et inspecter les champs cachés | `cookie_consent=all` | `consent=all` et `date_consentement_cookies` renseignés | P3 |
| F01-READ-009 | ENV-2 | Relecture d'une page enregistrée | Page contenant F01 enregistrée | 1. Rouvrir la page dans l'éditeur. 2. Ouvrir `/preview/<projectName>`. | — | Le formulaire est restitué à l'identique : mêmes champs, mêmes options (celles figées à l'enregistrement), même texte RGPD | P1 |
| F01-READ-010 | ENV-2 | Ancre de formulaire | Page enregistrée | Inspecter le HTML retourné par `/preview/<projectName>` | — | Le `<form>` porte `id="form-telechargement-brochure"` (dérivé de `NomFormulaire` par `deriveFormId`) et l'id figure dans `properties.formIds` | P2 |
| F01-READ-011 | ENV-2 | Deux formulaires Brochure sur la même page | 2 blocs `form-brochure` déposés | Enregistrer puis inspecter les ids | — | Ids dédoublonnés : `form-telechargement-brochure` et `form-telechargement-brochure-2` | P3 |
| F01-READ-012 | ENV-3 ⛔ | Lecture des picklists depuis Salesforce | Socle déployé | Ouvrir la CloudPage | — | Niveau, Pays, Indicatif et « Vous êtes » lus via `EntityParticle` + `PicklistValueInfo` ; valeurs `IsActive=false` exclues ; repli sur le filtre `Objet.Champ` si `EntityParticle` ne répond pas | P1 |

#### 5.1.4 Écriture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-WRITE-001 | ENV-1 | Aucun appel réseau à la soumission | PRE-0, onglet *Réseau* ouvert | Soumettre un cas valide | idem F01-NOM-001 | ⚠️ **Aucune requête XHR/fetch** n'est émise. Comportement actuel : simulation. Comportement attendu : POST vers le backend. Voir **PV-01** | P1 |
| F01-WRITE-002 | ENV-1 | Normalisation FR standard | PRE-0 | Soumettre et inspecter `data.MobilePhone` | Indicatif=`+33`, Tél=`06 12 34 56 78` | `MobilePhone = "+33612345678"` | P1 |
| F01-WRITE-003 | ENV-1 | Normalisation avec un autre indicatif | PRE-0 | Choisir `MA (+212)` et soumettre | Tél=`0612345678` | `MobilePhone = "+212612345678"` | P2 |
| F01-WRITE-004 | ENV-1 | Normalisation avec séparateurs | PRE-0 | Soumettre | Tél=`06-12.34 56 78` | `MobilePhone = "+33612345678"` (espaces, tirets et points retirés) | P2 |
| F01-WRITE-005 | ENV-1 | Normalisation avec parenthèses | PRE-0 | Soumettre | Tél=`(06) 12 34 56 78` | ⚠️ Validation OK mais `MobilePhone = "+33(06)12345678"` — parenthèses conservées. Voir **PV-06** | P1 |
| F01-WRITE-006 | ENV-1 | Opt-in dérivés du RGPD | PRE-0 | Soumettre avec puis sans la case cochée | RGPDConsent coché / décoché | Les 4 `HasOptedIn*` valent `"1"` si coché, `"0"` sinon — les 4 canaux sont toujours identiques | P1 |
| F01-WRITE-007 | ENV-1 | Valeurs non nettoyées dans le payload | PRE-0 | Saisir un nom entouré d'espaces et soumettre | Nom = espaces + `Dupont` + espaces | ⚠️ `data.LastName` conserve les espaces — la validation trime, pas la collecte. Voir **PV-20** | P2 |
| F01-WRITE-008 | ENV-1 | Champs enfant vidés après changement de profil | VousEtes=`Parent` avec enfant renseigné | Repasser sur *Étudiant(e)* puis soumettre | — | `ChildLastName`, `ChildFirstName`, `ChildPhone` vides dans le payload | P2 |
| F01-WRITE-009 | ENV-2 | Soumission sur page publiée | Page contenant F01 publiée | Cliquer sur le bouton *Je télécharge la brochure* | — | ⚠️ Le `<form>` n'a ni `action` ni `method` et **aucun handler** → soumission GET vers l'URL courante, données visibles dans la barre d'adresse, page rechargée, aucune confirmation. Voir **PV-02** | P1 |
| F01-WRITE-010 | ENV-3 ⛔ | Création du Person Account | Socle SSJS déployé | POST du formulaire vers la CloudPage | e-mail inédit | 1 `Account` créé avec `PersonEmail`, `LastName`, `FirstName`, `LivingCountry__c`, `Application_Requested__c="false"` (type ≠ candidature) | P1 |
| F01-WRITE-011 | ENV-3 ⛔ | Idempotence — 2e soumission même e-mail | 1 soumission déjà passée | Re-soumettre avec un prénom différent | Prénom modifié | Aucun doublon : 1 seul `Account`, prénom d'origine **conservé** (fill-if-blank) | P1 |
| F01-WRITE-012 | ENV-3 ⛔ | Consentements — 1 enregistrement par canal | RGPD coché | Soumettre | `HasOptedIn* = 1` | 1 `ContactPointConsent` par canal coché, avec `CaptureSource = NomFormulaire` et `Legal_Texte_Accepted__c` versionné `[v1] — …` ; **ni** `Opt_In_Date__c` **ni** `GDPR_Status__c` écrits par le socle | P1 |
| F01-WRITE-013 | ENV-3 ⛔ | Pas de doublon de consentement | 1 soumission déjà passée | Re-soumettre à l'identique | — | Le nombre de `ContactPointConsent` reste inchangé | P1 |
| F01-WRITE-014 | ENV-3 ⛔ | Membre de campagne + interaction | 1 soumission déjà passée sur la même campagne | Re-soumettre | même `CampaignId` | 1 seul `CampaignMember`, et 1 `CampaignMemberInteraction__c` créé au 2e passage | P2 |
| F01-WRITE-015 | ENV-3 ⛔ | Attribution first-touch du tracking | 1re soumission avec `utm_source=google` | Re-soumettre avec `utm_source=facebook` | — | `Account.UTMSource__c` reste `google` (fill-if-blank) ; le `CampaignMember` reflète la nouvelle valeur | P2 |

#### 5.1.5 Erreurs techniques

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-ERR-001 | ENV-1 | Branche d'erreur de soumission | PRE-0 | Tenter de provoquer `res.ok === false` | — | ⚠️ **Impossible** : la promesse résout toujours `{ ok: true }`. Le bloc `else` (réactivation du bouton + `alert`) est du **code mort**. Voir **PV-04** | P2 |
| F01-ERR-002 | ENV-1 | `GET /api/campuses` en HTTP 500 | Backend arrêté ou SFMC non configuré | Ouvrir l'éditeur puis la liste Campus | HTTP 500 | `console.error('Campus: chargement impossible')`, liste statique conservée, **aucun message utilisateur** | P2 |
| F01-ERR-003 | ENV-1 | `GET /api/campuses` renvoie un JSON invalide | Réponse tronquée simulée | Ouvrir l'éditeur | `{invalid` | Le `catch` de `loadCampuses` vide la liste → repli statique, pas de crash | P2 |
| F01-ERR-004 | ENV-1 | `GET /api/campuses` renvoie un objet au lieu d'un tableau | Réponse `{}` simulée | Ouvrir l'éditeur | `{}` | `Array.isArray(data)` faux → liste vide → repli statique | P3 |
| F01-ERR-005 | ENV-1 | Timeout de l'API campus | Latence > 30 s simulée | Ouvrir l'éditeur, déposer le bloc | — | ⚠️ **Aucun timeout n'est implémenté** (`fetch` nu). Comportement à vérifier ; recommandation §9 | P2 |
| F01-ERR-006 | ENV-1 | Canvas non prêt à l'initialisation | — | Recharger l'éditeur plusieurs fois d'affilée | — | `tryInitBrf` capture l'exception silencieusement ; le `setTimeout(…, 300)` sur `load` rattrape l'initialisation ; aucune erreur en console | P2 |
| F01-ERR-007 | ENV-1 | Double initialisation du même formulaire | Bloc déplacé plusieurs fois dans le canvas | Déplacer le bloc, resoumettre | — | `form.dataset.brfInit` empêche un second jeu de listeners → une **seule** soumission par clic | P1 |
| F01-ERR-008 | ENV-2 | `POST /api/save` en HTTP 400 | `projectName` absent | Sauvegarder sans nom de projet | — | HTTP 400 `{ error: 'projectName required' }` ; la page n'est pas enregistrée | P2 |
| F01-ERR-009 | ENV-2 | Page inexistante en aperçu | — | Ouvrir `/preview/projet-inexistant` | — | HTTP 404 `{ error: 'Project not found' }` | P2 |
| F01-ERR-010 | ENV-2 | Traduction : réponse Gemini incohérente | Clé API valide, réponse mockée à N-1 éléments | Lancer une traduction | — | HTTP 500 `Réponse de traduction incohérente (nombre de segments différent).` — la page **n'est pas** modifiée | P2 |
| F01-ERR-011 | ENV-2 | Traduction : clé API manquante | `GEMINI_API_KEY_TRANSLATION` non définie | Lancer une traduction | — | Erreur `Clé API de traduction manquante` ; aucune modification de la page | P3 |
| F01-ERR-012 | ENV-3 ⛔ | Soumission sans e-mail côté socle | Socle déployé | POST sans `EmailAddress` | `EmailAddress` vide | `upsertPersonAccount` renvoie `null`, **aucune** écriture Salesforce, journal contenant « pas d'email » | P1 |
| F01-ERR-013 | ENV-3 ⛔ | Objet Salesforce absent / non exposé | Org sans l'objet interrogé | Ouvrir la CloudPage | — | La lecture renvoie une liste vide sans exception (`getProgramsForSchool`, `getBrandsCampuses`, `getAppointmentOptions` → 0 ; `resolvePtatId` → `null`) | P2 |
| F01-ERR-014 | ENV-3 ⛔ | `RecordTypeId` du Person Account absent | Org non configurée | Soumettre | — | ⚠️ Blocage connu documenté dans `recap-socle-ssjs.html` : la création de compte échoue. Voir **PV-24** | P1 |

#### 5.1.6 Cas limites

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-EDGE-001 | ENV-1 | Téléphone à la borne basse | PRE-0 | Soumettre | `01234567` (7 chiffres utiles) | ✅ Accepté | P2 |
| F01-EDGE-002 | ENV-1 | Téléphone juste sous la borne basse | PRE-0 | Soumettre | `0123456` (6 chiffres utiles) | ❌ Rejeté | P2 |
| F01-EDGE-003 | ENV-1 | Téléphone à la borne haute | PRE-0 | Soumettre | 14 chiffres utiles | ✅ Accepté | P2 |
| F01-EDGE-004 | ENV-1 | Téléphone juste au-dessus de la borne haute | PRE-0 | Soumettre | 15 chiffres utiles | ❌ Rejeté | P2 |
| F01-EDGE-005 | ENV-1 | Numéro ne commençant pas par zéro | PRE-0 | Soumettre | `612345678` | ✅ Accepté, normalisé en `+33612345678` | P3 |
| F01-EDGE-006 | ENV-1 | Nom très long | PRE-0 | Coller 5 000 caractères dans Nom et soumettre | 5 000 caractères | ⚠️ Accepté — **aucune contrainte de longueur** (`maxlength` absent). Risque de rejet côté Salesforce (`LastName` = 80 caractères). Voir §9 | P2 |
| F01-EDGE-007 | ENV-1 | Caractères accentués et apostrophes | PRE-0 | Soumettre | Nom=`Nguyễn-D'Alembert`, Prénom=`Élodie` | ✅ Accepté et transmis tel quel | P2 |
| F01-EDGE-008 | ENV-1 | Caractères arabes | PRE-0 | Soumettre | Nom=`محمد`, Prénom=`فاطمة` | ✅ Accepté ; vérifier l'affichage dans le message de confirmation | P3 |
| F01-EDGE-009 | ENV-1 | Emoji dans le nom | PRE-0 | Soumettre | Nom=`Dupont 🎓` | ✅ Accepté — aucun filtrage. Vérifier le rendu du message de succès | P3 |
| F01-EDGE-010 | ENV-1 | E-mail avec espace initial | PRE-0 | Saisir, quitter le champ, puis soumettre | espace + `marie@exemple.com` | ⚠️ **Incohérence** : le `blur` (qui trime) ne signale rien, la soumission (qui ne trime pas) rejette avec `Format e-mail invalide.`. Voir **PV-07** | P2 |
| F01-EDGE-011 | ENV-1 | E-mail avec double point dans le domaine | PRE-0 | Saisir, quitter | `marie@exemple..com` | ⚠️ **Accepté** par la regex. Comportement actuel : passe. Recommandation §9 | P3 |
| F01-EDGE-012 | ENV-1 | Double clic rapide sur le bouton | PRE-0 | Double-cliquer avec un formulaire valide | — | Le bouton est désactivé dès le 1er clic → une **seule** confirmation | P1 |
| F01-EDGE-013 | ENV-1 | Validation par la touche Entrée | PRE-0 | Placer le curseur dans *Nom* et appuyer sur `Entrée` | — | Déclenche le même handler `submit` ; résultats identiques au clic | P2 |
| F01-EDGE-014 | ENV-1 | Rechargement pendant la soumission | PRE-0 | Soumettre puis recharger l'éditeur pendant la seconde d'attente | — | La confirmation est perdue, aucune donnée n'est persistée ; le formulaire revient vierge | P2 |
| F01-EDGE-015 | ENV-1 | Retour navigateur après confirmation | Confirmation affichée | Utiliser le bouton *Précédent* | — | ⚠️ Aucune gestion d'historique : l'éditeur se recharge, l'état de confirmation est perdu | P3 |
| F01-EDGE-016 | ENV-1 | Deux blocs Brochure sur la même page | 2 blocs déposés | Soumettre le 1er | — | Seul le formulaire soumis est masqué (`form.closest('.brf-card')` scope la confirmation) ; le 2e reste utilisable | P2 |
| F01-EDGE-017 | ENV-1 | Titre de succès avec nom/prénom vides | Test technique | Forcer un succès avec `FirstName` et `LastName` vides | — | Le titre affiche `Merci,  !` — vérifier l'absence d'affichage dégradé | P3 |
| F01-EDGE-018 | ENV-1 | Campus sans brochure ni programme | PRE-0 | Campus=`Rennes`, Niveau=`Seconde`, soumettre | — | Programme masqué, brochure générique `Brochure générale rennes` | P3 |
| F01-EDGE-019 | ENV-2 | Rendu mobile sous 460 px | Page publiée | Réduire la fenêtre à 400 px | — | `.brf-row` passe en 1 colonne, `.brf-phone-prefix-wrap` à 80 px, aucun débordement horizontal | P2 |
| F01-EDGE-020 | ENV-1 | Option vide sans libellé | PRE-0 | Ouvrir chacun des selects | — | ⚠️ La 1re option est **vide** (`buildOptions(..., '')`) : aucun texte `Sélectionnez…`. Voir **PV-18** | P3 |

#### 5.1.7 Intégration

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-INT-001 | ENV-1 | Endpoint et méthode des campus | PRE-0, onglet Réseau | Ouvrir l'éditeur | — | `GET /api/campuses?school=<id>` ; réponse `200` avec un tableau `[{id,name,slug,…}]` | P2 |
| F01-INT-002 | ENV-1 | Divergence local / Vercel sur `/api/campuses` | Accès aux 2 environnements | Appeler l'endpoint des deux côtés | `?school=efap` | ⚠️ Local : Data Extension SFMC **filtrée par école** ; Vercel : table Supabase `campuses` **sans filtre école** et sans `image_url`/`address`. Les options du select peuvent différer selon l'hébergement. Voir **PV-16** | P1 |
| F01-INT-003 | ENV-1 | `value` des options = noms d'API Salesforce | PRE-0 | Inspecter le HTML des selects | — | `StudyLevel` entre `seconde` et `bac+5`, `Country` en codes ISO 2 lettres, `VousEtes` parmi `student / student_enrolled / parent / professional` — conformes à `picklist-config.js` | P1 |
| F01-INT-004 | ENV-1 | Libellés des options en variante EN | Bloc `form-brochure-en` déposé | Ouvrir les selects du bloc anglais | — | ⚠️ Les libellés sont **en français** (`buildOptions` au lieu de `buildOptionsEn`) alors que les libellés de champs sont en anglais. Voir **PV-17** | P2 |
| F01-INT-005 | ENV-2 | Enregistrement de la page | PRE-0 | Renseigner un nom de projet et enregistrer | — | `POST /api/save` → `200` `{ message:'Saved', page_id, translation_info }` ; ligne dans `Projects` ; `properties.formIds` contient l'ancre ; `properties.status = 'draft'` | P1 |
| F01-INT-006 | ENV-2 | Publication SFMC | Page enregistrée, SFMC configuré | `POST /api/publish-sfmc` | — | Asset SFMC créé/mis à jour, HTML nettoyé par `cleanHtmlForSfmc` (attributs `data-gjs-*` retirés, commentaires supprimés, CSS minifié) | P2 |
| F01-INT-007 | ENV-2 | CSS orphelin supprimé à la publication | Page publiée | Inspecter le CSS de la page publiée | — | ⚠️ Les règles `.brf-input.err`, `.brf-select.err`, `.brf-err-msg.show` sont **supprimées** par `removeOrphanedCss`. Sans conséquence tant qu'il n'y a pas de JS, bloquant s'il est réintroduit. Voir **PV-30** | P2 |
| F01-INT-008 | ENV-2 | Traduction automatique de la page | Page FR enregistrée | Lancer la traduction EN | `targetLang=EN` | Libellés, `<option>` et `placeholder` traduits ; les **attributs `value`** des options sont **préservés** (valeurs Salesforce intactes) | P1 |
| F01-INT-009 | ENV-2 | `data-lang` après traduction | Page FR traduite en EN | Inspecter le `<form>` et le champ `LanguePreferee` | — | ⚠️ `data-lang="fr"` **inchangé** et `LanguePreferee` reste `fr` → un formulaire visuellement anglais serait remonté comme francophone. Voir **PV-19** | P1 |
| F01-INT-010 | ENV-3 ⛔ | Double nommage du tracking | Socle déployé | Soumettre avec `?utm_source=google&gclid=abc` | — | `Account.UTMSource__c = "google"` (**sans** underscore) et `CampaignMember.UTM_Source__c = "google"` (**avec** underscore) ; une valeur vide n'est jamais mappée | P2 |

#### 5.1.8 Sécurité

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F01-SEC-001 | ENV-1 | HTML injecté dans le nom | PRE-0 | Saisir du HTML dans Nom et soumettre | `<b>Dupont</b>` | Le titre de confirmation utilise `textContent` → le HTML s'affiche **littéralement**, non interprété ✅ | P2 |
| F01-SEC-002 | ENV-1 | Injection via l'e-mail (message de succès) | PRE-0 | Saisir un e-mail sans espace contenant du HTML, soumettre | `a<img/src=x/onerror=alert(1)>@b.co` | ⚠️ La regex laisse passer (aucun espace, un seul `@`) et le message utilise `innerHTML` → **exécution de script dans le canvas**. Auto-XSS limité à l'éditeur. Voir **PV-08** | P1 |
| F01-SEC-003 | ENV-1 | Injection via le nom d'un campus | Campus créé avec un nom contenant du HTML | Ouvrir la liste Campus | `<img src=x onerror=alert(1)>` | Les options sont échappées par `esc()` dans [campus-select.js:46](blocks/forms/shared/campus-select.js#L46) → affichage littéral ✅ | P2 |
| F01-SEC-004 | ENV-1 | Contournement des champs conditionnels | PRE-0 | Via la console, retirer la classe `hidden` des champs enfant sans choisir *Parent*, les renseigner, soumettre | — | ⚠️ Les valeurs sont transmises (`FormData` ignore la visibilité). Aucune vérification serveur n'existe aujourd'hui — à recontrôler côté socle. Voir §9 | P2 |
| F01-SEC-005 | ENV-2 | Fuite des données dans l'URL | Page publiée | Renseigner puis soumettre le formulaire | e-mail + téléphone réels | ⚠️ Soumission GET par défaut → **e-mail et téléphone apparaissent dans l'URL**, l'historique du navigateur et les logs serveur. Voir **PV-02** | P1 |
| F01-SEC-006 | ENV-2 | Absence de validation en page publiée | Page publiée | Soumettre le formulaire entièrement vide | — | ⚠️ Aucun blocage (`novalidate` + aucun JS) → la soumission part vide. Voir **PV-32** | P1 |
| F01-SEC-007 | ENV-3 ⛔ | Appel direct de l'endpoint sans passer par le formulaire | Socle déployé | POST forgé vers la CloudPage avec des paramètres arbitraires | payload manipulé | Le socle doit revalider e-mail, longueurs et valeurs de picklist côté serveur, et refuser l'écriture sans e-mail | P1 |
| F01-SEC-008 | ENV-3 ⛔ | Écriture sur l'enregistrement d'un tiers | Socle déployé | Soumettre l'e-mail d'un contact existant | e-mail d'un autre prospect | `fill-if-blank` protège les valeurs déjà renseignées, **mais** un tiers peut compléter les champs vides d'un compte existant — risque à arbitrer | P2 |

---

### 5.2 F02 — JPO

> Moteur partagé [shared/event-form.js](blocks/forms/shared/event-form.js). Les cas F02 valident le moteur **et** la variante JPO ; F03 et F04 ne re-testent que leurs différences.

#### 5.2.1 Cas nominaux

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-NOM-001 | ENV-1 | Inscription complète sur un campus avec événement | PRE-0 (bloc `form-jpo`) | 1. Choisir un campus. 2. Renseigner tous les champs. 3. Cliquer sur *Réserver ma place*. | Campus=`Paris`, VousEtes=`Étudiant(e)`, Niveau=`Bac+3`, Nom=`Martin`, Prénom=`Léa`, Email=`lea.martin@exemple.com`, Tél=`06 11 22 33 44` | Encart événement visible, spinner ~0,9 s, `.jpo-form-zone` masquée, `.jpo-success` affichée : « Merci, Léa Martin ! » + « Votre inscription du **Samedi 14 mars 2026** sur le campus de **paris** a bien été enregistrée. » | P1 |
| F02-NOM-002 | ENV-1 | Encart événement — contenu complet | PRE-0 | Choisir `Paris` | — | Colonne gauche : `Samedi 14 mars 2026` + `10h - 17h` + `Conférence de présentation : 10h30` + `Conférence MBA : 14h00`. Colonne droite : `Campus Paris` en gras + `16 rue Jules Verne` / `75011 Paris` | P1 |
| F02-NOM-003 | ENV-1 | Changement de campus | Campus=`Paris` sélectionné | Choisir `Lille` | — | L'encart se met à jour (`Samedi 07 mars 2026`, `10h - 13h`, adresse Lille) et `EventDate` suit | P1 |
| F02-NOM-004 | ENV-1 | Campus sans événement | PRE-0 | Choisir `Bordeaux` | — | L'encart `.jpo-event-card` est **masqué** et le champ caché `EventDate` est remis à vide | P2 |
| F02-NOM-005 | ENV-1 | Parcours parent | PRE-0 | Choisir *Parent*, renseigner les 3 champs enfant, soumettre | VousEtes=`Parent` | Les 3 champs enfant apparaissent et sont transmis | P1 |
| F02-NOM-006 | ENV-1 | Variante EN | Bloc `form-jpo-en` déposé | Choisir `Paris` et soumettre | — | Encart en anglais (`Saturday, March 14 2026`, `10am - 5pm`, `Presentation talk: 10:30am`), messages en anglais, `LanguePreferee=en` | P2 |
| F02-NOM-007 | ENV-1 | Trait *Alignement du titre* | PRE-0 | Sélectionner la section, ouvrir *Réglages*, choisir `Gauche` | — | `data-header-align="left"` posé sur `section.jpo-section` ; titre et sous-titre alignés à gauche | P3 |
| F02-NOM-008 | ENV-1 | Payload complet | PRE-0, inspection console | Soumettre un cas valide | — | `data` contient `Campus`, `TypeEvenement="JPO"`, `EventDate`, `NomFormulaire="Inscription_JPO"`, `TypeFormulaire="evenement"` + les champs de contact + les 4 `HasOptedIn*` | P1 |

#### 5.2.2 Champs obligatoires et validation

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-VAL-001 | ENV-1 | Formulaire entièrement vide | PRE-0 | Cliquer sur *Réserver ma place* | — | Erreurs sur `VousEtes`, `StudyLevel`, `LastName`, `FirstName`, e-mail, téléphone ; bordure rouge sur le select Campus ; soumission bloquée | P1 |
| F02-VAL-002 | ENV-1 | Campus non sélectionné — message d'erreur | PRE-0 | Renseigner tout sauf le campus, soumettre | Campus vide | ⚠️ Le select prend la classe `.err` (bordure rouge) mais **aucun message texte** n'est affiché et **aucun défilement** n'a lieu. Comportement actuel : erreur silencieuse. Voir **PV-13** | P1 |
| F02-VAL-003 | ENV-1 | Absence de défilement vers l'erreur | Formulaire long, en bas de page | Soumettre avec une erreur en haut du formulaire | — | ⚠️ Aucun `scrollIntoView` (contrairement à F01/F05/F06) : l'utilisateur peut ne pas voir l'erreur. Voir **PV-13** | P2 |
| F02-VAL-004 | ENV-1 | `VousEtes` vide | PRE-0 | Ne pas renseigner *Vous êtes* | — | `Ce champ est requis.` ; soumission bloquée | P1 |
| F02-VAL-005 | ENV-1 | `StudyLevel` vide | PRE-0 | Ne pas renseigner le niveau | — | Bloqué | P1 |
| F02-VAL-006 | ENV-1 | Nom / Prénom contenant uniquement des espaces | PRE-0 | Saisir des espaces | — | Bloqué (`trim()`) | P2 |
| F02-VAL-007 | ENV-1 | E-mail invalide | PRE-0 | Saisir `lea@` et quitter le champ | `lea@` | `Format e-mail invalide.` | P1 |
| F02-VAL-008 | ENV-1 | E-mail sur domaine jetable | PRE-0 | Saisir `lea@spam4.me` | — | `Veuillez utiliser une adresse valide.` | P2 |
| F02-VAL-009 | ENV-1 | Téléphone invalide | PRE-0 | Saisir `12` | — | `Numéro invalide (ex: 06 12 34 56 78).` | P1 |
| F02-VAL-010 | ENV-1 | Téléphone au format international | PRE-0 | Saisir `+33611223344` | — | ⚠️ **Rejeté** (même défaut que F01). Voir **PV-05** | P1 |
| F02-VAL-011 | ENV-1 | Téléphone enfant invalide | VousEtes=`Parent` | Saisir un tél. enfant invalide et soumettre | `abc` | Erreur affichée sur le champ enfant, soumission bloquée | P2 |
| F02-VAL-012 | ENV-1 | RGPD non coché | PRE-0 | Soumettre sans cocher | — | ⚠️ **Accepté**, les 4 `HasOptedIn*` valent `"0"`. Voir **PV-03** | P1 |
| F02-VAL-013 | ENV-1 | `student_enrolled` absent de la liste *Vous êtes* | PRE-0 | Ouvrir le select *Vous êtes* | — | 3 options seulement (`student`, `parent`, `professional`) — contrairement à F01 qui en propose 4 | P3 |
| F02-VAL-014 | ENV-1 | Programme non obligatoire | Champ Programme visible | Soumettre sans le renseigner | — | ✅ Accepté | P2 |

#### 5.2.3 Lecture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-READ-001 | ENV-1 | Encart alimenté au chargement | Page enregistrée avec un campus déjà sélectionné | Rouvrir la page dans l'éditeur | — | `updateCard(campusSelect.value)` est appelé à l'init → l'encart est immédiatement à jour | P2 |
| F02-READ-002 | ENV-1 | Encart pour chacun des 10 campus | PRE-0 | Parcourir les 10 campus un par un | — | Encart visible pour `paris`, `lille`, `lyon`, `nice`, `nantes`, `toulouse` ; masqué pour `bordeaux`, `montpellier`, `aix`, `rennes` | P2 |
| F02-READ-003 | ENV-1 | Encart muet après synchro des campus BDD | École dont les ids de campus diffèrent des slugs statiques (ex. `paris-la-defense`) | Sélectionner ce campus | — | ⚠️ `jpoEvents[lang][val]` ne trouve rien → **encart jamais affiché** et `EventDate` toujours vide. Voir **PV-15** | P1 |
| F02-READ-004 | ENV-1 | Libellé du campus dans l'encart | PRE-0 | Choisir `Nantes` | — | La colonne droite affiche `Campus Nantes` (texte de l'option, pas la valeur) | P3 |
| F02-READ-005 | ENV-1 | `EventDate` stocke un libellé, pas une date | PRE-0 | Choisir `Paris` et inspecter `input[name="EventDate"]` | — | ⚠️ Valeur = `Samedi 14 mars 2026` (chaîne localisée). Aucune date exploitable côté CRM. Voir **PV-25** | P1 |
| F02-READ-006 | ENV-1 | Champs cachés spécifiques | PRE-0 | Inspecter les champs cachés | — | `TypeEvenement="JPO"`, `NomFormulaire="Inscription_JPO"`, `TypeFormulaire="evenement"` | P2 |
| F02-READ-007 | ENV-1 | Programme conditionnel piloté par niveau + campus | PRE-0 | Choisir Niveau=`Bac+4` puis changer de campus | — | La liste des programmes est recalculée aux deux événements (`niveauEl` et `campusSelect` écoutés) | P2 |
| F02-READ-008 | ENV-2 | Ancre du formulaire | Page enregistrée | Inspecter le HTML publié | — | Le `<form>` porte `id="form-inscription-jpo"` | P2 |
| F02-READ-009 | ENV-2 | Relecture d'une page enregistrée | Page contenant F02 enregistrée | Rouvrir dans l'éditeur et en aperçu | — | Le formulaire, l'encart (statique dans le HTML enregistré) et le campus sélectionné sont restitués | P1 |
| F02-READ-010 | ENV-3 ⛔ | Dates d'événement lues depuis Salesforce | Socle déployé | Ouvrir la CloudPage, choisir un campus | — | `getNextEventDates(campus, 'JPO')` ne remonte que les instances des **15 prochains jours**, triées chronologiquement, filtrées par campus et par type, avec l'adresse | P1 |

#### 5.2.4 Écriture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-WRITE-001 | ENV-1 | Aucun appel réseau | PRE-0, onglet Réseau | Soumettre | — | ⚠️ Aucune requête (`handleSubmit` = promesse simulée 900 ms). Voir **PV-01** | P1 |
| F02-WRITE-002 | ENV-1 | Campus transmis alors qu'il est hors du formulaire | PRE-0 | Choisir un campus puis soumettre, inspecter `data` | Campus=`Lyon` | `data.Campus = "lyon"` — via l'initialisation `{ Campus: campusSelect.value }` **et** via le `<input type="hidden" name="Campus">` créé au `change` | P1 |
| F02-WRITE-003 | ENV-1 | Campus jamais modifié (valeur par défaut) | PRE-0 | Soumettre sans toucher au select Campus | — | Le hidden n'est jamais créé (créé uniquement au `change`) ; la validation bloque puisque la valeur est vide | P2 |
| F02-WRITE-004 | ENV-1 | Normalisation du téléphone | PRE-0 | Soumettre | Tél=`06 11 22 33 44`, indicatif `+33` | `MobilePhone = "+33611223344"` | P1 |
| F02-WRITE-005 | ENV-1 | Opt-in dérivés | PRE-0 | Soumettre avec/sans RGPD | — | 4 `HasOptedIn*` à `"1"` ou `"0"` | P1 |
| F02-WRITE-006 | ENV-1 | `EventDate` transmis | PRE-0 | Choisir `Toulouse` puis soumettre | — | `data.EventDate = "Samedi 23 mai 2026"` | P2 |
| F02-WRITE-007 | ENV-1 | `EventDate` vide sur campus sans événement | PRE-0 | Choisir `Rennes` puis soumettre | — | `data.EventDate = ""` ; le message de confirmation affiche le caractère `—` | P2 |
| F02-WRITE-008 | ENV-2 | Soumission sur page publiée | Page publiée | Cliquer sur *Réserver ma place* | — | ⚠️ Aucun handler → soumission GET. **De plus** le select Campus est **hors du `<form>`** : il ne serait pas transmis même par une soumission native. Voir **PV-02**, **PV-12** | P1 |
| F02-WRITE-009 | ENV-3 ⛔ | Inscription Summit — clé (personne × instance) | Socle déployé | Soumettre 2 fois pour la même instance, puis 1 fois pour une autre | `InstanceId=JPO-12oct` puis `JPO-09nov` | 1 seul `summit__Registration__c` pour `JPO-12oct` (mise à jour en place), un **nouveau** pour `JPO-09nov` | P1 |
| F02-WRITE-010 | ENV-3 ⛔ | Anti-écho après émargement | Inscription existante passée à `Present` / `checkin` | Re-soumettre le formulaire après l'événement | `utm_source=newsletter` | `summit__Status__c` reste `Present`, `actionNameStatus__c` reste `checkin` ; **seul** le tracking est rafraîchi (`UTM_Source__c = newsletter`) | P1 |
| F02-WRITE-011 | ENV-3 ⛔ | Ateliers additifs | 2 ateliers déjà posés | Re-soumettre en décochant B et en ajoutant C | `Appointments=atelier-A,atelier-C` | `added=1`, `kept=1`, `obsolete=1` ; l'atelier B **reste en base** (aucune suppression) | P2 |

#### 5.2.5 Erreurs techniques

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-ERR-001 | ENV-1 | Branche d'erreur inatteignable | PRE-0 | Tenter d'obtenir `res.ok === false` | — | ⚠️ Impossible — `handleSubmit` résout toujours `{ ok: true }`. Voir **PV-04** | P2 |
| F02-ERR-002 | ENV-1 | Logique événement attachée une seule fois | Blocs JPO **et** Atelier **et** Stage déposés | Recharger l'éditeur, inspecter | — | `editor.__eventFormLogicAttached` garantit un seul enregistrement du type et des hooks, malgré 3 appels à `attachEventFormLogic` | P2 |
| F02-ERR-003 | ENV-1 | Double initialisation d'un même select campus | Bloc déplacé plusieurs fois | Déplacer le bloc puis changer de campus | — | `campusSelect.dataset.jpoInit` empêche un second jeu de listeners → l'encart n'est mis à jour qu'une fois | P1 |
| F02-ERR-004 | ENV-1 | Formulaire absent de la carte | Suppression manuelle du `<form>` dans le canvas | Changer de campus | — | `if (!form) return;` : l'encart se met à jour, aucun crash | P3 |
| F02-ERR-005 | ENV-1 | `.jpo-card` absente | Section partiellement supprimée | Recharger l'éditeur | — | `if (!card) return;` : initialisation abandonnée sans exception | P3 |
| F02-ERR-006 | ENV-3 ⛔ | Instance Summit inexistante | Socle déployé | Soumettre avec un `InstanceId` inconnu | `InstanceId=INEXISTANT` | Comportement à définir : soit refus explicite, soit inscription orpheline. **Non spécifié dans les tests du socle** — à arbitrer | P2 |

#### 5.2.6 Cas limites

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-EDGE-001 | ENV-1 | Retour à l'option campus vide | Campus=`Paris` sélectionné | Resélectionner l'option vide puis soumettre | — | Encart masqué, `EventDate` vidé, hidden `Campus` mis à `""`, validation bloquante | P2 |
| F02-EDGE-002 | ENV-1 | Deux formulaires événement sur la même page | 1 bloc JPO + 1 bloc Atelier | Changer le campus du 1er | — | Seul l'encart de la carte concernée est mis à jour (`initOneCampusSelect` scope sur `.jpo-card`) | P1 |
| F02-EDGE-003 | ENV-1 | Confirmation scopée | 2 formulaires événement sur la page | Soumettre le 1er | — | Seule `.jpo-form-zone` du formulaire soumis est masquée ; le 2e reste opérationnel | P1 |
| F02-EDGE-004 | ENV-1 | Doublon de styles | 2 blocs événement déposés | Inspecter le HTML | — | Deux blocs `<style>` identiques (~470 lignes chacun) sont émis. Voir **PV-29** | P3 |
| F02-EDGE-005 | ENV-1 | Bornes du téléphone | PRE-0 | Tester 6, 7, 14 et 15 chiffres utiles | — | Rejeté / accepté / accepté / rejeté | P2 |
| F02-EDGE-006 | ENV-1 | Nom très long | PRE-0 | 5 000 caractères dans Nom | — | ⚠️ Accepté, aucune limite | P2 |
| F02-EDGE-007 | ENV-1 | Caractères non latins | PRE-0 | Nom en arabe, prénom accentué | — | Accepté ; vérifier le rendu de la confirmation | P3 |
| F02-EDGE-008 | ENV-1 | Double clic sur *Réserver ma place* | PRE-0 | Double-cliquer | — | Bouton désactivé dès le 1er clic → une seule confirmation | P1 |
| F02-EDGE-009 | ENV-1 | Rechargement pendant la soumission | PRE-0 | Recharger dans les 900 ms | — | Confirmation perdue, aucune donnée persistée | P2 |
| F02-EDGE-010 | ENV-1 | Confirmation affichant la valeur du campus | PRE-0 | Soumettre avec Campus=`Aix-en-Provence` | — | ⚠️ Le message affiche `sur le campus de aix` (la **valeur**, pas le libellé). Voir **PV-26** | P2 |
| F02-EDGE-011 | ENV-1 | Libellé original du bouton conservé | PRE-0 | Observer le bouton pendant la soumission | — | `originalLabel` est capturé avant remplacement ; sa restauration n'est jamais exercée (branche d'erreur morte) | P3 |
| F02-EDGE-012 | ENV-2 | Rendu mobile sous 460 px | Page publiée | Réduire à 400 px | — | `.jpo-row` en 1 colonne, `.jpo-event-inner` en colonne, aucun débordement | P2 |

#### 5.2.7 Intégration

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-INT-001 | ENV-1 | Synchronisation des campus | École avec campus en base | Ouvrir l'éditeur | — | Le select `.jpo-campus-select.lp-campus-select` est repeuplé depuis `/api/campuses` ; le placeholder est préservé | P1 |
| F02-INT-002 | ENV-1 | Cohérence campus BDD / `jpoEvents` | École dont les ids campus = slugs statiques | Sélectionner chaque campus | — | Encart affiché pour les 6 campus disposant d'une date. Si les ids diffèrent → aucun encart (**PV-15**) | P1 |
| F02-INT-003 | ENV-1 | Valeur `TypeEvenement` conforme au CRM | PRE-0 | Inspecter le champ caché | — | `JPO` (valeur attendue par le mapping) | P2 |
| F02-INT-004 | ENV-2 | Enregistrement + publication | PRE-0 | Enregistrer puis publier | — | `POST /api/save` puis `POST /api/publish-sfmc` en `200` ; formulaire et encart présents dans le HTML publié | P1 |
| F02-INT-005 | ENV-2 | Traduction de l'encart | Page FR enregistrée | Traduire en EN | — | Le texte de l'encart (statique dans le HTML) est traduit ; les `value` des options restent intacts | P2 |
| F02-INT-006 | ENV-2 | Trait *Alignement du titre* sur une page ancienne | Page enregistrée avant l'ajout du trait | Rouvrir et modifier l'alignement | — | ⚠️ L'attribut est bien posé mais le CSS gravé de l'ancienne page ne contient pas les règles `[data-header-align]` → aucun effet visuel tant que le bloc n'est pas reposé (comportement documenté dans le code) | P3 |
| F02-INT-007 | ENV-3 ⛔ | Résolution de la campagne | Socle déployé, DE de mapping alimentées | Soumettre depuis la France | `formType=jpo`, `Ecole=EFAP` | `resolveCampaign` trouve la campagne avec zone, sinon retombe sur le mapping sans zone ; `resolveBrand` renvoie le `BusinessBrandId` | P2 |

#### 5.2.8 Sécurité

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F02-SEC-001 | ENV-1 | Injection via le nom du campus dans l'encart | Campus créé avec un nom contenant du HTML | Sélectionner ce campus | `<img src=x onerror=alert(1)>` | ⚠️ `confEl.innerHTML = '<strong>Campus ' + campusName + '</strong>…'` — le texte de l'option est concaténé **sans échappement** ([event-form.js:931](blocks/forms/shared/event-form.js#L931)). Le texte provenant du DOM est déjà décodé, mais l'injection via un nom de campus administrable doit être vérifiée. Voir §9 | P2 |
| F02-SEC-002 | ENV-1 | Injection via l'e-mail dans la confirmation | PRE-0 | Soumettre avec un e-mail contenant du HTML sans espace | `a<img/src=x/onerror=alert(1)>@b.co` | ⚠️ `msg.innerHTML = t.successConfirm(...)` → même faille que F01. Voir **PV-08** | P1 |
| F02-SEC-003 | ENV-1 | Injection via le nom (titre de succès) | PRE-0 | Soumettre avec du HTML dans Nom | `<b>Martin</b>` | `thanks.textContent` → affichage littéral ✅ | P2 |
| F02-SEC-004 | ENV-2 | Fuite des données dans l'URL | Page publiée | Soumettre le formulaire | — | ⚠️ Soumission GET ; le campus n'est même pas transmis (hors `<form>`). Voir **PV-02**, **PV-12** | P1 |
| F02-SEC-005 | ENV-3 ⛔ | Manipulation de `InstanceId` | Socle déployé | Forger un POST avec l'`InstanceId` d'un autre événement | — | Le socle doit vérifier que l'instance appartient bien à l'école / au type d'événement du formulaire | P2 |

---

### 5.3 F03 — Atelier Découverte

> Moteur identique à F02. Les cas ci-dessous couvrent les **spécificités** ; les cas F02-VAL-*, F02-EDGE-* et F02-ERR-* s'appliquent à l'identique et doivent être rejoués si la recette est exhaustive.

#### 5.3.1 Cas nominaux

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F03-NOM-001 | ENV-1 | Inscription complète | PRE-0 (bloc `form-atelier`) | Renseigner tous les champs et cliquer sur *RÉSERVER MA PLACE* | Campus=`Lyon`, VousEtes=`Étudiant(e)`, Niveau=`Bac+2`, Nom/Prénom, e-mail, tél. valides | Confirmation affichée ; `TypeEvenement="Atelier_Decouverte"`, `NomFormulaire="Inscription_Atelier"` dans le payload | P1 |
| F03-NOM-002 | ENV-1 | Titre et bouton | PRE-0 | Lire l'en-tête et le bouton | — | Titre « Inscription à l'Atelier Découverte », sous-titre « Participez à notre atelier et explorez nos programmes. », bouton « RÉSERVER MA PLACE » | P3 |
| F03-NOM-003 | ENV-1 | Variante EN | Bloc `form-atelier-en` | Soumettre | — | Titre « Discovery Workshop Registration », bouton « BOOK MY SPOT », `LanguePreferee=en` | P2 |
| F03-NOM-004 | ENV-1 | Trait *Alignement du titre* disponible | PRE-0 | Sélectionner la section, ouvrir *Réglages* | — | Le trait est présent (`formVariant=''` → `data-header-align`) | P3 |

#### 5.3.2 Validation

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F03-VAL-001 | ENV-1 | Formulaire vide | PRE-0 | Soumettre à vide | — | Mêmes erreurs que F02-VAL-001 (`VousEtes` inclus) | P1 |
| F03-VAL-002 | ENV-1 | Présence du champ *Vous êtes* | PRE-0 | Inspecter la structure du formulaire | — | ⚠️ Le champ **existe** (`showVousEtes: true`) alors que [GUIDE_FORMULAIRES_CRM.md §3.3](blocks/forms/GUIDE_FORMULAIRES_CRM.md) indique « ❌ pas de Vous êtes ». **Écart doc / code** — voir **PV-27** | P1 |
| F03-VAL-003 | ENV-1 | Présence des champs enfant | VousEtes=`Parent` | Choisir *Parent* | — | ⚠️ Les 3 champs enfant apparaissent (`showChild: true`) alors que le guide les exclut. **Écart doc / code** — voir **PV-27** | P1 |
| F03-VAL-004 | ENV-1 | Campus obligatoire sans message | PRE-0 | Soumettre sans campus | — | Bordure rouge seule, aucun message. Voir **PV-13** | P1 |
| F03-VAL-005 | ENV-1 | RGPD non obligatoire | PRE-0 | Soumettre sans cocher | — | ⚠️ Accepté. Voir **PV-03** | P1 |
| F03-VAL-006 | ENV-1 | Téléphone international rejeté | PRE-0 | Saisir `+33611223344` | — | ⚠️ Rejeté. Voir **PV-05** | P1 |

#### 5.3.3 Lecture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F03-READ-001 | ENV-1 | Encart événement — source des dates | PRE-0 | Choisir `Paris` | — | ⚠️ L'encart affiche **`Samedi 14 mars 2026`, la date de la JPO** : `jpoEvents` est partagé entre JPO, Atelier et Stage. Aucun calendrier d'atelier n'existe. Voir **PV-14** | P1 |
| F03-READ-002 | ENV-1 | Campus sans événement | PRE-0 | Choisir `Montpellier` | — | Encart masqué, `EventDate` vide | P2 |
| F03-READ-003 | ENV-1 | Campus synchronisés depuis l'API | École avec campus | Ouvrir la liste | — | Options remplacées par les campus de la page | P1 |
| F03-READ-004 | ENV-1 | Champs cachés spécifiques | PRE-0 | Inspecter | — | `TypeEvenement="Atelier_Decouverte"`, `NomFormulaire="Inscription_Atelier"`, `TypeFormulaire="evenement"` | P2 |
| F03-READ-005 | ENV-2 | Ancre du formulaire | Page enregistrée | Inspecter le HTML publié | — | `id="form-inscription-atelier"` | P2 |

#### 5.3.4 Écriture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F03-WRITE-001 | ENV-1 | Aucun appel réseau | PRE-0, onglet Réseau | Soumettre | — | ⚠️ Aucune requête. Voir **PV-01** | P1 |
| F03-WRITE-002 | ENV-1 | Payload conforme au type d'événement | PRE-0 | Soumettre et inspecter `data` | — | `TypeEvenement="Atelier_Decouverte"` et `EventDate` issu de `jpoEvents` (donc **une date de JPO**) — anomalie de donnée à remonter | P1 |
| F03-WRITE-003 | ENV-1 | Normalisation du téléphone | PRE-0 | Soumettre | Tél=`0611223344` | `+33611223344` | P1 |
| F03-WRITE-004 | ENV-2 | Soumission sur page publiée | Page publiée | Soumettre | — | ⚠️ GET, campus non transmis. Voir **PV-02**, **PV-12** | P1 |
| F03-WRITE-005 | ENV-3 ⛔ | Distinction JPO / Atelier côté CRM | Socle déployé | Soumettre les 2 formulaires pour la même personne | — | 2 `summit__Registration__c` distincts (instances différentes), 1 seul `Account` | P1 |

#### 5.3.5 Erreurs, cas limites, intégration, sécurité

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F03-ERR-001 | ENV-1 | Branche d'erreur inatteignable | PRE-0 | Provoquer un échec de soumission | — | ⚠️ Impossible. Voir **PV-04** | P2 |
| F03-ERR-002 | ENV-1 | Coexistence JPO + Atelier | Les 2 blocs déposés | Recharger, soumettre l'un puis l'autre | — | Les 2 formulaires fonctionnent indépendamment ; la logique n'est attachée qu'une fois | P1 |
| F03-ERR-003 | ENV-1 | Suppression partielle du bloc | Formulaire supprimé, encart conservé | Changer de campus | — | Aucune exception (`if (!form) return;`) | P3 |
| F03-EDGE-001 | ENV-1 | Double clic sur *RÉSERVER MA PLACE* | PRE-0 | Double-cliquer | — | Une seule confirmation | P1 |
| F03-EDGE-002 | ENV-1 | Confirmation affichant la valeur du campus | PRE-0 | Soumettre avec `Aix-en-Provence` | — | ⚠️ `sur le campus de aix`. Voir **PV-26** | P2 |
| F03-EDGE-003 | ENV-1 | Bornes du téléphone | PRE-0 | 6 / 7 / 14 / 15 chiffres | — | Rejeté / accepté / accepté / rejeté | P2 |
| F03-EDGE-004 | ENV-1 | Caractères spéciaux et emoji | PRE-0 | Nom avec emoji et accents | — | Accepté sans filtrage | P3 |
| F03-EDGE-005 | ENV-2 | Rendu mobile | Page publiée | 400 px | — | Mise en page 1 colonne, aucun débordement | P2 |
| F03-INT-001 | ENV-1 | Synchronisation des campus | École avec campus | Ouvrir la liste | — | Options issues de `/api/campuses` | P1 |
| F03-INT-002 | ENV-1 | Valeurs de picklist Salesforce | PRE-0 | Inspecter les `value` | — | Conformes à `picklist-config.js` | P1 |
| F03-INT-003 | ENV-2 | Enregistrement + publication | PRE-0 | Enregistrer puis publier | — | `200` sur les 2 appels, formulaire présent dans le HTML publié | P1 |
| F03-INT-004 | ENV-2 | Traduction EN | Page FR | Traduire | — | Libellés traduits, `value` préservés, ⚠️ `data-lang` inchangé (**PV-19**) | P2 |
| F03-SEC-001 | ENV-1 | Injection via l'e-mail | PRE-0 | E-mail contenant du HTML sans espace | — | ⚠️ `innerHTML` dans le message de confirmation. Voir **PV-08** | P1 |
| F03-SEC-002 | ENV-2 | Fuite des données dans l'URL | Page publiée | Soumettre | — | ⚠️ Soumission GET. Voir **PV-02** | P1 |

---

### 5.4 F04 — Stage

#### 5.4.1 Cas nominaux

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F04-NOM-001 | ENV-1 | Inscription complète | PRE-0 (bloc `form-stage`) | Renseigner tous les champs et cliquer sur *Je m'inscris au stage* | Campus=`Nantes`, Niveau=`Terminale`, Nom/Prénom, e-mail, tél. valides | Confirmation ; `TypeEvenement="Stage"`, `NomFormulaire="Inscription_Stage"` dans le payload | P1 |
| F04-NOM-002 | ENV-1 | Structure allégée | PRE-0 | Inspecter la structure | — | **Pas** de champ *Vous êtes*, **pas** de champs enfant ; le niveau d'études occupe toute la largeur (pas de `.jpo-row`) | P1 |
| F04-NOM-003 | ENV-1 | Variante de style « stage » | PRE-0 | Inspecter la section | — | `data-form-variant="stage"` présent, `data-header-align` **absent** ; le jeton `--jpo-field-bg` retombe sur `var(--brand-background)` et l'indicatif est transparent | P2 |
| F04-NOM-004 | ENV-1 | Variante EN | Bloc `form-stage-en` | Soumettre | — | Titre « Internship Application », bouton « Apply for the internship », `LanguePreferee=en` | P2 |

#### 5.4.2 Validation

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F04-VAL-001 | ENV-1 | Formulaire vide | PRE-0 | Soumettre à vide | — | Erreurs sur `LastName`, `FirstName`, `StudyLevel`, e-mail, téléphone + bordure rouge sur le campus. **Aucune** erreur `VousEtes` (le champ n'existe pas → la boucle l'ignore) | P1 |
| F04-VAL-002 | ENV-1 | Champ *Vous êtes* absent du payload | PRE-0 | Soumettre et inspecter `data` | — | Aucune clé `VousEtes` dans `data` | P2 |
| F04-VAL-003 | ENV-1 | Champs enfant absents | PRE-0 | Chercher `ChildLastName` dans le DOM | — | Aucun champ enfant ; aucun conditionnel parent | P2 |
| F04-VAL-004 | ENV-1 | Campus obligatoire sans message | PRE-0 | Soumettre sans campus | — | Bordure rouge seule. Voir **PV-13** | P1 |
| F04-VAL-005 | ENV-1 | E-mail invalide | PRE-0 | Saisir `abc@` | — | `Format e-mail invalide.` | P1 |
| F04-VAL-006 | ENV-1 | Téléphone international rejeté | PRE-0 | Saisir `+33611223344` | — | ⚠️ Rejeté. Voir **PV-05** | P1 |
| F04-VAL-007 | ENV-1 | RGPD non obligatoire | PRE-0 | Soumettre sans cocher | — | ⚠️ Accepté. Voir **PV-03** | P1 |
| F04-VAL-008 | ENV-1 | Programme conditionnel | PRE-0 | Choisir Niveau=`Bac+3` | — | Le champ *Programme souhaité* apparaît avec 2 programmes ; il reste facultatif | P2 |

#### 5.4.3 Lecture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F04-READ-001 | ENV-1 | Encart événement — source des dates | PRE-0 | Choisir `Lille` | — | ⚠️ Affiche `Samedi 07 mars 2026`, **la date de la JPO** : `jpoEvents` est partagé. Voir **PV-14** | P1 |
| F04-READ-002 | ENV-1 | Campus sans événement | PRE-0 | Choisir `Aix-en-Provence` | — | Encart masqué, `EventDate` vide | P2 |
| F04-READ-003 | ENV-1 | Campus synchronisés | École avec campus | Ouvrir la liste | — | Options issues de `/api/campuses` | P1 |
| F04-READ-004 | ENV-1 | Champs cachés spécifiques | PRE-0 | Inspecter | — | `TypeEvenement="Stage"`, `NomFormulaire="Inscription_Stage"`, `TypeFormulaire="evenement"` | P2 |
| F04-READ-005 | ENV-1 | Restriction aux 4 écoles | Ouvrir l'éditeur sur une école hors périmètre (ex. EFAP) | Chercher le bloc *Formulaire Stage* dans la palette | — | ⚠️ Le bloc est **proposé pour toutes les écoles** : la restriction documentée (BRASSART, CREAD, MOPA, École Bleue) n'est pas implémentée (`scope: 'global'`, `schools: []`). Voir **PV-33** | P2 |
| F04-READ-006 | ENV-2 | Ancre du formulaire | Page enregistrée | Inspecter le HTML publié | — | `id="form-inscription-stage"` | P2 |

#### 5.4.4 Écriture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F04-WRITE-001 | ENV-1 | Aucun appel réseau | PRE-0, onglet Réseau | Soumettre | — | ⚠️ Aucune requête. Voir **PV-01** | P1 |
| F04-WRITE-002 | ENV-1 | Payload sans `VousEtes` ni champs enfant | PRE-0 | Soumettre et inspecter | — | `data` ne contient ni `VousEtes`, ni `ChildLastName`, ni `ChildFirstName`, ni `ChildPhone` | P1 |
| F04-WRITE-003 | ENV-1 | Normalisation du téléphone | PRE-0 | Soumettre | Tél=`06.11.22.33.44` | `+33611223344` | P1 |
| F04-WRITE-004 | ENV-1 | Opt-in dérivés | PRE-0 | Soumettre avec/sans RGPD | — | 4 `HasOptedIn*` à `"1"` ou `"0"` | P1 |
| F04-WRITE-005 | ENV-2 | Soumission sur page publiée | Page publiée | Soumettre | — | ⚠️ GET, campus non transmis. Voir **PV-02**, **PV-12** | P1 |

#### 5.4.5 Erreurs, cas limites, intégration, sécurité

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F04-ERR-001 | ENV-1 | Branche d'erreur inatteignable | PRE-0 | Provoquer un échec | — | ⚠️ Impossible. Voir **PV-04** | P2 |
| F04-ERR-002 | ENV-1 | Type GrapesJS non appliqué à la variante stage | PRE-0 | Sélectionner la section, ouvrir *Réglages* | — | Aucun trait *Alignement du titre* : `isComponent` exclut `data-form-variant="stage"` ([event-form.js:871-873](blocks/forms/shared/event-form.js#L871-L873)) | P3 |
| F04-ERR-003 | ENV-1 | Coexistence Stage + JPO | Les 2 blocs déposés | Recharger, changer les campus des 2 | — | Chaque encart est mis à jour indépendamment | P1 |
| F04-EDGE-001 | ENV-1 | Double clic sur le bouton | PRE-0 | Double-cliquer | — | Une seule confirmation | P1 |
| F04-EDGE-002 | ENV-1 | Bornes du téléphone | PRE-0 | 6 / 7 / 14 / 15 chiffres | — | Rejeté / accepté / accepté / rejeté | P2 |
| F04-EDGE-003 | ENV-1 | Nom très long | PRE-0 | 5 000 caractères | — | ⚠️ Accepté, aucune limite | P2 |
| F04-EDGE-004 | ENV-1 | Caractères non latins et emoji | PRE-0 | Nom en arabe + emoji | — | Accepté | P3 |
| F04-EDGE-005 | ENV-1 | Fond des champs dépendant de la marque | École dont `--brand-background` n'est pas blanc | Regarder les champs | — | ⚠️ Les champs prennent la couleur de la marque (variante stage), au risque de se confondre avec le beige de la carte — comportement historique volontairement conservé (commentaire du code) | P2 |
| F04-EDGE-006 | ENV-2 | Rendu mobile | Page publiée | 400 px | — | 1 colonne, aucun débordement | P2 |
| F04-INT-001 | ENV-1 | Synchronisation des campus | École avec campus | Ouvrir la liste | — | Options issues de `/api/campuses` | P1 |
| F04-INT-002 | ENV-1 | Valeurs de picklist | PRE-0 | Inspecter les `value` | — | Conformes à `picklist-config.js` | P1 |
| F04-INT-003 | ENV-2 | Enregistrement + publication | PRE-0 | Enregistrer puis publier | — | `200`, formulaire présent dans le HTML publié | P1 |
| F04-INT-004 | ENV-2 | Traduction EN | Page FR | Traduire | — | Libellés traduits, `value` préservés, ⚠️ `data-lang` inchangé (**PV-19**) | P2 |
| F04-SEC-001 | ENV-1 | Injection via l'e-mail | PRE-0 | E-mail contenant du HTML sans espace | — | ⚠️ `innerHTML` dans la confirmation. Voir **PV-08** | P1 |
| F04-SEC-002 | ENV-2 | Fuite des données dans l'URL | Page publiée | Soumettre | — | ⚠️ Soumission GET. Voir **PV-02** | P1 |

---

### 5.5 F05 — Demande d'immersion

#### 5.5.1 Cas nominaux

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-NOM-001 | ENV-1 | Demande complète valide | PRE-0 (bloc `form-immersion`) | Renseigner tous les champs et cliquer sur *Envoyer ma demande* | Nom=`Bernard`, Prénom=`Hugo`, Email=`hugo.bernard@exemple.com`, Tél=`06 55 44 33 22`, Niveau=`Bac+1`, Campus=`Bordeaux` | Spinner ~1 s, formulaire + titre + sous-titre masqués, `.imf-success` affichée : « Merci, Hugo Bernard ! » + « Votre demande d'immersion a bien été enregistrée… Notre responsable développement vous contactera très prochainement par téléphone. » | P1 |
| F05-NOM-002 | ENV-1 | Structure du formulaire | PRE-0 | Inspecter les champs | — | 8 champs visibles : Nom, Prénom, Email, Indicatif, Portable, Niveau, Campus, RGPD (+ Programme conditionnel). **Aucun** champ *Vous êtes*, **aucun** champ *Pays*, **aucun** champ enfant | P1 |
| F05-NOM-003 | ENV-1 | Programme conditionnel | PRE-0 | Choisir Niveau=`Bac+4` | — | Le champ *Programme souhaité* apparaît avec `Master 1` et `MBA 1re année` | P2 |
| F05-NOM-004 | ENV-1 | Programme transmis | Programme visible | Choisir `MBA 1re année` et soumettre | — | `Programme="mba1"` dans le payload | P2 |
| F05-NOM-005 | ENV-1 | Variante EN | Bloc `form-immersion-en` | Soumettre | — | Titre « Immersion request », bouton « Send my request », message EN, `LanguePreferee=en` | P2 |
| F05-NOM-006 | ENV-1 | Payload complet | PRE-0, inspection console | Soumettre | — | `NomFormulaire="Demande_Immersion"`, `TypeFormulaire="immersion"` + champs de contact + 4 `HasOptedIn*` | P1 |

#### 5.5.2 Champs obligatoires et validation

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-VAL-001 | ENV-1 | Formulaire entièrement vide | PRE-0 | Soumettre à vide | — | 6 erreurs (`LastName`, `FirstName`, `StudyLevel`, `Campus`, e-mail, téléphone) + défilement vers la 1re erreur | P1 |
| F05-VAL-002 | ENV-1 | `LastName` vide | PRE-0 | Tout renseigner sauf le nom | — | `Ce champ est requis.` ; soumission bloquée | P1 |
| F05-VAL-003 | ENV-1 | `FirstName` composé d'espaces | PRE-0 | Saisir des espaces | — | Bloqué (`trim()`) | P2 |
| F05-VAL-004 | ENV-1 | `StudyLevel` vide | PRE-0 | Ne pas choisir de niveau | — | Bloqué | P1 |
| F05-VAL-005 | ENV-1 | `Campus` vide | PRE-0 | Ne pas choisir de campus | — | Bloqué **avec message** (contrairement à F02/F03/F04 : ici le select est dans un `.imf-field` doté d'un `.imf-err-msg`) | P1 |
| F05-VAL-006 | ENV-1 | E-mail sans domaine | PRE-0 | Saisir `hugo@` et quitter | — | `Format e-mail invalide.` | P1 |
| F05-VAL-007 | ENV-1 | E-mail sur domaine jetable | PRE-0 | Saisir `hugo@dispostable.com` | — | `Veuillez utiliser une adresse valide.` | P2 |
| F05-VAL-008 | ENV-1 | Téléphone trop court | PRE-0 | Saisir `061234` | — | `Numéro invalide (ex: 06 12 34 56 78).` | P1 |
| F05-VAL-009 | ENV-1 | Téléphone au format international | PRE-0 | Saisir `+33655443322` | — | ⚠️ Rejeté. Voir **PV-05** | P1 |
| F05-VAL-010 | ENV-1 | RGPD non coché | PRE-0 | Soumettre sans cocher | — | ⚠️ Accepté, 4 `HasOptedIn*` à `"0"`. Voir **PV-03** | P1 |
| F05-VAL-011 | ENV-1 | RGPD coché | PRE-0 | Cocher et soumettre | — | 4 `HasOptedIn*` à `"1"` | P1 |
| F05-VAL-012 | ENV-1 | Programme facultatif | Champ visible | Soumettre sans le renseigner | — | ✅ Accepté | P2 |
| F05-VAL-013 | ENV-1 | Programme masqué : valeur vidée | Programme choisi | Repasser sur un niveau sans programme | Niveau `Bac+3` puis `Seconde` | Champ masqué et valeur remise à vide | P2 |
| F05-VAL-014 | ENV-1 | Correction d'une erreur | Erreur affichée | Corriger puis re-soumettre | — | L'erreur disparaît, la soumission aboutit | P2 |

#### 5.5.3 Lecture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-READ-001 | ENV-1 | Campus lus depuis l'API | École avec campus | Ouvrir la liste Campus | — | Options remplacées par les campus de la page (`.imf-campus.lp-campus-select`) | P1 |
| F05-READ-002 | ENV-1 | Repli sur la liste statique | Aucun campus en base | Ouvrir la liste | — | 10 campus statiques, sans message | P2 |
| F05-READ-003 | ENV-1 | Texte RGPD | École avec `rgpdText` | Lire la case RGPD | — | Texte et lien de l'école en FR | P2 |
| F05-READ-004 | ENV-1 | Champs cachés à l'initialisation | PRE-0 | Inspecter les hidden | — | `NomFormulaire="Demande_Immersion"`, `TypeFormulaire="immersion"`, `LanguePreferee=fr`, `Marque` **vide** (**PV-09**) | P2 |
| F05-READ-005 | ENV-1 | Programme dépendant du niveau et du campus | PRE-0 | Changer le niveau, puis le campus | — | `refreshProgramme` déclenché sur les deux `change` | P2 |
| F05-READ-006 | ENV-2 | Relecture d'une page enregistrée | Page contenant F05 enregistrée | Rouvrir dans l'éditeur et en aperçu | — | Formulaire restitué à l'identique | P1 |
| F05-READ-007 | ENV-2 | Ancre du formulaire | Page enregistrée | Inspecter le HTML publié | — | `id="form-demande-immersion"` | P2 |
| F05-READ-008 | ENV-3 ⛔ | Lecture des programmes depuis Salesforce | Socle déployé | Ouvrir la CloudPage | — | La cascade PTAT ne propose que des combinaisons existantes (campus, niveau, spécialité, rythme, langue, rentrée) et remonte l'Id du PTAT | P1 |

#### 5.5.4 Écriture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-WRITE-001 | ENV-1 | Aucun appel réseau | PRE-0, onglet Réseau | Soumettre | — | ⚠️ Aucune requête. Voir **PV-01** | P1 |
| F05-WRITE-002 | ENV-1 | Normalisation du téléphone | PRE-0 | Soumettre | Tél=`06 55 44 33 22` | `+33655443322` | P1 |
| F05-WRITE-003 | ENV-1 | Normalisation avec parenthèses | PRE-0 | Soumettre | `(06) 55 44 33 22` | ⚠️ `+33(06)55443322`. Voir **PV-06** | P1 |
| F05-WRITE-004 | ENV-1 | Opt-in dérivés | PRE-0 | Soumettre avec/sans RGPD | — | 4 `HasOptedIn*` à `"1"` ou `"0"` | P1 |
| F05-WRITE-005 | ENV-1 | Absence de `Country` dans le payload | PRE-0 | Soumettre et inspecter | — | Aucune clé `Country` — ⚠️ le contrat de lecture SF (`recap-lecture-sf.html`) mentionne pourtant « Pays » pour l'immersion. **Écart contrat / code** — voir **PV-34** | P2 |
| F05-WRITE-006 | ENV-1 | Valeurs non nettoyées | PRE-0 | Nom entouré d'espaces | — | ⚠️ Espaces conservés dans le payload. Voir **PV-20** | P2 |
| F05-WRITE-007 | ENV-2 | Soumission sur page publiée | Page publiée | Soumettre | — | ⚠️ Soumission GET, aucune confirmation. Voir **PV-02** | P1 |
| F05-WRITE-008 | ENV-3 ⛔ | Création Person Account + consentements | Socle déployé | Soumettre | — | 1 `Account` (`Application_Requested__c="false"`) + 1 `ContactPointConsent` par canal coché | P1 |
| F05-WRITE-009 | ENV-3 ⛔ | Aucune inscription événementielle | Socle déployé | Soumettre | `TypeFormulaire="immersion"` | Aucun `summit__Registration__c` créé (pas d'événement daté) | P2 |

#### 5.5.5 Erreurs techniques

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-ERR-001 | ENV-1 | Branche d'erreur inatteignable | PRE-0 | Provoquer un échec | — | ⚠️ Impossible. Voir **PV-04** | P2 |
| F05-ERR-002 | ENV-1 | API campus indisponible | Backend arrêté | Ouvrir l'éditeur | — | `console.error`, repli statique, aucun message utilisateur | P2 |
| F05-ERR-003 | ENV-1 | Double initialisation | Bloc déplacé plusieurs fois | Soumettre | — | `form.dataset.imfInit` empêche le doublon de listeners | P1 |
| F05-ERR-004 | ENV-1 | Canvas non prêt | — | Recharger plusieurs fois | — | Exception capturée, rattrapage par le `setTimeout` sur `load` | P2 |
| F05-ERR-005 | ENV-2 | Enregistrement sans nom de projet | — | Sauvegarder | — | HTTP 400 `{ error: 'projectName required' }` | P2 |
| F05-ERR-006 | ENV-3 ⛔ | Écriture sans e-mail | Socle déployé | POST sans `EmailAddress` | — | Aucune écriture, journal « pas d'email » | P1 |

#### 5.5.6 Cas limites

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-EDGE-001 | ENV-1 | Bornes du téléphone | PRE-0 | 6 / 7 / 14 / 15 chiffres utiles | — | Rejeté / accepté / accepté / rejeté | P2 |
| F05-EDGE-002 | ENV-1 | Numéro sans zéro initial | PRE-0 | `655443322` | — | Accepté → `+33655443322` | P3 |
| F05-EDGE-003 | ENV-1 | Nom très long | PRE-0 | 5 000 caractères | — | ⚠️ Accepté, aucune limite | P2 |
| F05-EDGE-004 | ENV-1 | Caractères accentués et arabes | PRE-0 | `Nguyễn`, `محمد` | — | Acceptés | P3 |
| F05-EDGE-005 | ENV-1 | Emoji dans le prénom | PRE-0 | `Hugo 🚀` | — | Accepté | P3 |
| F05-EDGE-006 | ENV-1 | E-mail avec espace initial | PRE-0 | espace + `hugo@exemple.com` | — | ⚠️ `blur` silencieux, soumission rejetée. Voir **PV-07** | P2 |
| F05-EDGE-007 | ENV-1 | Double clic sur *Envoyer ma demande* | PRE-0 | Double-cliquer | — | Une seule confirmation | P1 |
| F05-EDGE-008 | ENV-1 | Validation par la touche Entrée | PRE-0 | `Entrée` depuis un champ texte | — | Même comportement que le clic | P2 |
| F05-EDGE-009 | ENV-1 | Rechargement pendant la soumission | PRE-0 | Recharger dans la seconde | — | Confirmation perdue, aucune donnée persistée | P2 |
| F05-EDGE-010 | ENV-1 | Deux blocs Immersion sur la même page | 2 blocs déposés | Soumettre le 1er | — | Seul le formulaire soumis est masqué (`form.closest('.imf-card')`) | P2 |
| F05-EDGE-011 | ENV-1 | Option vide sans libellé | PRE-0 | Ouvrir les selects | — | ⚠️ 1re option sans texte. Voir **PV-18** | P3 |
| F05-EDGE-012 | ENV-2 | Rendu mobile | Page publiée | 400 px | — | 1 colonne, aucun débordement | P2 |

#### 5.5.7 Intégration

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-INT-001 | ENV-1 | Endpoint campus | PRE-0, onglet Réseau | Ouvrir l'éditeur | — | `GET /api/campuses?school=<id>` en `200` | P2 |
| F05-INT-002 | ENV-1 | Valeurs de picklist conformes | PRE-0 | Inspecter les `value` | — | `StudyLevel` et `Campus` conformes à `picklist-config.js` | P1 |
| F05-INT-003 | ENV-1 | Libellés FR dans la variante EN | Bloc `form-immersion-en` | Ouvrir les selects | — | ⚠️ Libellés d'options en français. Voir **PV-17** | P2 |
| F05-INT-004 | ENV-2 | Enregistrement | PRE-0 | Enregistrer la page | — | `POST /api/save` en `200` ; `properties.formIds` contient `form-demande-immersion` | P1 |
| F05-INT-005 | ENV-2 | Publication SFMC | Page enregistrée | Publier | — | Asset SFMC créé/mis à jour, HTML nettoyé | P2 |
| F05-INT-006 | ENV-2 | Traduction EN | Page FR | Traduire | — | Libellés traduits, `value` préservés, ⚠️ `data-lang` inchangé (**PV-19**) | P1 |
| F05-INT-007 | ENV-3 ⛔ | Notification du responsable développement | Socle + Journey MC | Soumettre | — | Accusé de réception envoyé au prospect + notification interne — **non implémenté à ce jour** | P2 |

#### 5.5.8 Sécurité

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F05-SEC-001 | ENV-1 | HTML dans le nom | PRE-0 | `<b>Bernard</b>` | — | Affiché littéralement (`textContent`) ✅ | P2 |
| F05-SEC-002 | ENV-1 | Injection via l'e-mail | PRE-0 | `a<img/src=x/onerror=alert(1)>@b.co` | — | ⚠️ `innerHTML` dans le message de succès. Voir **PV-08** | P1 |
| F05-SEC-003 | ENV-2 | Fuite des données dans l'URL | Page publiée | Soumettre | — | ⚠️ Soumission GET. Voir **PV-02** | P1 |
| F05-SEC-004 | ENV-2 | Absence de validation en page publiée | Page publiée | Soumettre à vide | — | ⚠️ Aucun blocage. Voir **PV-32** | P1 |
| F05-SEC-005 | ENV-3 ⛔ | Appel direct de l'endpoint | Socle déployé | POST forgé | payload manipulé | Revalidation serveur attendue | P1 |

---

### 5.6 F06 — Candidature

#### 5.6.1 Cas nominaux

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-NOM-001 | ENV-1 | Candidature complète valide | PRE-0 (bloc `form-candidature`) | Renseigner tous les champs et cliquer sur *Je candidate* | Nom=`Rossi`, Prénom=`Chiara`, Pays=`Italie`, Email=`chiara.rossi@exemple.com`, Tél=`06 77 88 99 00`, Niveau=`Bac+3 (Licence / Bachelor)`, Campus=`Paris` | Spinner ~1 s, formulaire + titre + sous-titre masqués, `.cnd-success` (emoji 📧) : « Merci, Chiara Rossi ! » + « … un e-mail vient d'être envoyé à **chiara.rossi@exemple.com** pour activer votre compte et accéder au portail candidature. » | P1 |
| F06-NOM-002 | ENV-1 | Structure du formulaire | PRE-0 | Inspecter les champs | — | 9 champs visibles : Nom, Prénom, Pays, Email, Indicatif, Portable, Niveau, Campus, RGPD (+ Programme conditionnel). **Pas** de *Vous êtes*, **pas** de *Nationalité*, **pas** de *Rentrée générale*, **pas** de champs enfant | P1 |
| F06-NOM-003 | ENV-1 | Programme conditionnel | PRE-0 | Choisir Niveau=`Bac+5 et +` | — | Le champ apparaît avec `Master 2`, `MBA 2e année (alternance)`, `Mastère Spécialisé` | P2 |
| F06-NOM-004 | ENV-1 | Programme transmis | Programme visible | Choisir `Mastère Spécialisé` et soumettre | — | `Programme="mastere_spe"` dans le payload | P2 |
| F06-NOM-005 | ENV-1 | Variante EN | Bloc `form-candidature-en` | Soumettre | — | Titre « Application », bouton « Apply now », message EN, `LanguePreferee=en` | P2 |
| F06-NOM-006 | ENV-1 | Payload complet | PRE-0, inspection console | Soumettre | — | `NomFormulaire="Candidature"`, `TypeFormulaire="candidature"` + champs de contact + 4 `HasOptedIn*` | P1 |

#### 5.6.2 Champs obligatoires et validation

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-VAL-001 | ENV-1 | Formulaire entièrement vide | PRE-0 | Soumettre à vide | — | 7 erreurs (`LastName`, `FirstName`, `Country`, `StudyLevel`, `Campus`, e-mail, téléphone) + défilement vers la 1re erreur | P1 |
| F06-VAL-002 | ENV-1 | `Country` vide | PRE-0 | Tout renseigner sauf le pays | — | `Ce champ est requis.` sous le champ Pays ; soumission bloquée | P1 |
| F06-VAL-003 | ENV-1 | `LastName` composé d'espaces | PRE-0 | Saisir des espaces | — | Bloqué (`trim()`) | P2 |
| F06-VAL-004 | ENV-1 | `Campus` vide | PRE-0 | Ne pas choisir de campus | — | Bloqué avec message | P1 |
| F06-VAL-005 | ENV-1 | `StudyLevel` vide | PRE-0 | Ne pas choisir de niveau | — | Bloqué | P1 |
| F06-VAL-006 | ENV-1 | E-mail invalide | PRE-0 | `chiara@exemple` (sans TLD) | — | `Format e-mail invalide.` | P1 |
| F06-VAL-007 | ENV-1 | E-mail sur domaine jetable | PRE-0 | `chiara@trashmail.com` | — | `Veuillez utiliser une adresse valide.` | P2 |
| F06-VAL-008 | ENV-1 | Téléphone trop court | PRE-0 | `067788` | — | `Numéro invalide (ex: 06 12 34 56 78).` | P1 |
| F06-VAL-009 | ENV-1 | Téléphone au format international | PRE-0 | `+39067788990` | — | ⚠️ Rejeté alors que le pays sélectionné est l'Italie. Voir **PV-05** | P1 |
| F06-VAL-010 | ENV-1 | Cohérence Pays / Indicatif | PRE-0 | Pays=`Italie`, indicatif laissé sur `FR (+33)` | — | ⚠️ **Aucun contrôle de cohérence** : `MobilePhone = "+33…"` pour un candidat italien. La liste d'indicatifs ne contient d'ailleurs que 7 pays sur 18 dans la liste Pays. Voir **PV-35** | P2 |
| F06-VAL-011 | ENV-1 | RGPD non coché | PRE-0 | Soumettre sans cocher | — | ⚠️ Accepté, 4 `HasOptedIn*` à `"0"`. Voir **PV-03** | P1 |
| F06-VAL-012 | ENV-1 | RGPD coché | PRE-0 | Cocher et soumettre | — | 4 `HasOptedIn*` à `"1"` | P1 |
| F06-VAL-013 | ENV-1 | Programme facultatif | Champ visible | Soumettre sans le renseigner | — | ✅ Accepté — ⚠️ pour une candidature, le programme (PTAT) est pourtant structurant côté CRM. Voir §9 | P2 |
| F06-VAL-014 | ENV-1 | Programme masqué : valeur vidée | Programme choisi | Repasser sur un niveau sans programme | — | Champ masqué et valeur remise à vide | P2 |
| F06-VAL-015 | ENV-1 | Correction d'une erreur | Erreur affichée | Corriger puis re-soumettre | — | L'erreur disparaît, la soumission aboutit | P2 |

#### 5.6.3 Lecture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-READ-001 | ENV-1 | Campus lus depuis l'API | École avec campus | Ouvrir la liste Campus | — | Options remplacées par les campus de la page (`.cnd-campus.lp-campus-select`) | P1 |
| F06-READ-002 | ENV-1 | Liste des pays | PRE-0 | Ouvrir la liste Pays | — | 18 options mock (`FR`…`OTHER`), valeurs = codes ISO 2 lettres | P2 |
| F06-READ-003 | ENV-1 | Texte RGPD | École avec `rgpdText` | Lire la case RGPD | — | Texte et lien de l'école en FR | P2 |
| F06-READ-004 | ENV-1 | Champs cachés à l'initialisation | PRE-0 | Inspecter les hidden | — | `NomFormulaire="Candidature"`, `TypeFormulaire="candidature"`, `LanguePreferee=fr`, `Marque` **vide** (**PV-09**) | P2 |
| F06-READ-005 | ENV-1 | `LangueSouhaitee` par défaut pour IFA Paris | Ouvrir l'éditeur sur l'école `ifa-paris` | Inspecter `input[name="LangueSouhaitee"]` | — | ⚠️ Le champ reste **vide** : `populateHiddenFields` lit `CURRENT_SCHOOL` sur la fenêtre de l'iframe canvas, où la variable n'existe pas. La règle « français par défaut pour IFA Paris » n'est donc jamais appliquée. Voir **PV-09** | P1 |
| F06-READ-006 | ENV-2 | Relecture d'une page enregistrée | Page contenant F06 enregistrée | Rouvrir dans l'éditeur et en aperçu | — | Formulaire restitué à l'identique | P1 |
| F06-READ-007 | ENV-2 | Ancre du formulaire | Page enregistrée | Inspecter le HTML publié | — | `id="form-candidature"` | P2 |
| F06-READ-008 | ENV-3 ⛔ | Cascade PTAT (Programme + Rentrée) | Socle déployé | Choisir campus puis niveau puis spécialité | — | Chaque étape filtre la suivante ; seules les rentrées réellement disponibles pour le programme retenu sont proposées, avec leur libellé lisible ; l'Id du PTAT est résolu à la fin | P1 |
| F06-READ-009 | ENV-3 ⛔ | Absence de données Salesforce | Org vide | Ouvrir la CloudPage | — | Listes vides sans exception, `resolvePtatId` renvoie `null` | P2 |

#### 5.6.4 Écriture

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-WRITE-001 | ENV-1 | Aucun appel réseau | PRE-0, onglet Réseau | Soumettre | — | ⚠️ Aucune requête. Voir **PV-01** | P1 |
| F06-WRITE-002 | ENV-1 | Normalisation du téléphone | PRE-0 | Soumettre | Tél=`06 77 88 99 00`, indicatif `+33` | `+33677889900` | P1 |
| F06-WRITE-003 | ENV-1 | Normalisation avec un indicatif étranger | PRE-0 | Indicatif `GB (+44)` | Tél=`07123456789` | `+447123456789` | P2 |
| F06-WRITE-004 | ENV-1 | Normalisation avec parenthèses | PRE-0 | `(06) 77 88 99 00` | — | ⚠️ `+33(06)77889900`. Voir **PV-06** | P1 |
| F06-WRITE-005 | ENV-1 | Opt-in dérivés | PRE-0 | Soumettre avec/sans RGPD | — | 4 `HasOptedIn*` à `"1"` ou `"0"` | P1 |
| F06-WRITE-006 | ENV-1 | Valeurs non nettoyées | PRE-0 | Nom entouré d'espaces | — | ⚠️ Espaces conservés. Voir **PV-20** | P2 |
| F06-WRITE-007 | ENV-2 | Soumission sur page publiée | Page publiée | Soumettre | — | ⚠️ Soumission GET, aucune confirmation. Voir **PV-02** | P1 |
| F06-WRITE-008 | ENV-3 ⛔ | `Application_Requested__c` à `true` | Socle déployé | Soumettre | `TypeFormulaire="candidature"` | `Account.Application_Requested__c = "true"` (contrairement aux autres formulaires qui posent `"false"`) | P1 |
| F06-WRITE-009 | ENV-3 ⛔ | Candidature posée par le flow, pas par le socle | Socle déployé | Soumettre | — | Le socle n'écrit **ni** l'Intérêt académique **ni** la Candidature : ils sont posés en aval par un flow CRM à partir du tampon (conforme au contrat v4) | P1 |
| F06-WRITE-010 | ENV-3 ⛔ | Idempotence sur re-candidature | 1 candidature déjà déposée | Re-soumettre avec le même e-mail | — | Aucun doublon de `Account`, valeurs existantes conservées (fill-if-blank) | P1 |

#### 5.6.5 Erreurs techniques

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-ERR-001 | ENV-1 | Branche d'erreur inatteignable | PRE-0 | Provoquer un échec | — | ⚠️ Impossible. Voir **PV-04** | P2 |
| F06-ERR-002 | ENV-1 | API campus indisponible | Backend arrêté | Ouvrir l'éditeur | — | Repli statique silencieux | P2 |
| F06-ERR-003 | ENV-1 | Double initialisation | Bloc déplacé plusieurs fois | Soumettre | — | `form.dataset.cndInit` empêche le doublon de listeners | P1 |
| F06-ERR-004 | ENV-1 | Canvas non prêt | — | Recharger plusieurs fois | — | Exception capturée, rattrapage par le `setTimeout` sur `load` | P2 |
| F06-ERR-005 | ENV-2 | Publication d'une page non enregistrée | — | Publier sans enregistrer | — | Comportement à vérifier : la publication porte sur la dernière version enregistrée | P2 |
| F06-ERR-006 | ENV-3 ⛔ | Échec d'écriture Salesforce | Socle déployé, quota / droits insuffisants | Soumettre | — | L'identité (Person Account) ne doit **jamais** échouer à cause d'une étape aval ; les étapes suivantes sont journalisées en erreur sans casser la séquence | P1 |
| F06-ERR-007 | ENV-3 ⛔ | Connexion Marketing Cloud Connect KO | Auth OAuth invalide | Ouvrir la page de diagnostic `test-connexion-minimal.ssjs` | — | Les 3 sondes (Contact, Account, Campaign) affichent `KO` avec l'erreur OAuth → problème de configuration MCC, pas du code | P1 |

#### 5.6.6 Cas limites

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-EDGE-001 | ENV-1 | Bornes du téléphone | PRE-0 | 6 / 7 / 14 / 15 chiffres utiles | — | Rejeté / accepté / accepté / rejeté | P2 |
| F06-EDGE-002 | ENV-1 | Nom très long | PRE-0 | 5 000 caractères | — | ⚠️ Accepté, aucune limite | P2 |
| F06-EDGE-003 | ENV-1 | Caractères accentués, arabes, emoji | PRE-0 | `Nguyễn`, `محمد`, `Chiara 🎓` | — | Acceptés sans filtrage | P3 |
| F06-EDGE-004 | ENV-1 | E-mail avec espace initial | PRE-0 | espace + `chiara@exemple.com` | — | ⚠️ `blur` silencieux, soumission rejetée. Voir **PV-07** | P2 |
| F06-EDGE-005 | ENV-1 | Pays `Autre` | PRE-0 | Pays=`Autre` | — | `Country="OTHER"` transmis ; aucun champ de saisie libre associé | P3 |
| F06-EDGE-006 | ENV-1 | Double clic sur *Je candidate* | PRE-0 | Double-cliquer | — | Une seule confirmation | P1 |
| F06-EDGE-007 | ENV-1 | Validation par la touche Entrée | PRE-0 | `Entrée` depuis un champ texte | — | Même comportement que le clic | P2 |
| F06-EDGE-008 | ENV-1 | Rechargement pendant la soumission | PRE-0 | Recharger dans la seconde | — | Confirmation perdue, aucune donnée persistée | P2 |
| F06-EDGE-009 | ENV-1 | Deux blocs Candidature sur la même page | 2 blocs déposés | Soumettre le 1er | — | Seul le formulaire soumis est masqué (`form.closest('.cnd-card')`) | P2 |
| F06-EDGE-010 | ENV-1 | Libellé du bouton modifié dans l'éditeur | PRE-0 | Modifier le texte du bouton, ajouter des espaces | — | Le libellé vit dans un `<span data-gjs-type="text">` : les espaces sont bien insérés (correctif documenté dans le code) | P3 |
| F06-EDGE-011 | ENV-2 | Rendu mobile | Page publiée | 400 px | — | 1 colonne, aucun débordement | P2 |

#### 5.6.7 Intégration

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-INT-001 | ENV-1 | Endpoint campus | PRE-0, onglet Réseau | Ouvrir l'éditeur | — | `GET /api/campuses?school=<id>` en `200` | P2 |
| F06-INT-002 | ENV-1 | Valeurs de picklist conformes | PRE-0 | Inspecter les `value` | — | `Country` en ISO 2 lettres, `StudyLevel` conforme à `picklist-config.js` | P1 |
| F06-INT-003 | ENV-1 | Libellés FR dans la variante EN | Bloc `form-candidature-en` | Ouvrir les selects | — | ⚠️ Libellés d'options en français. Voir **PV-17** | P2 |
| F06-INT-004 | ENV-2 | Enregistrement | PRE-0 | Enregistrer la page | — | `POST /api/save` en `200` ; `properties.formIds` contient `form-candidature` | P1 |
| F06-INT-005 | ENV-2 | Publication SFMC | Page enregistrée | Publier | — | Asset SFMC créé/mis à jour, HTML nettoyé | P2 |
| F06-INT-006 | ENV-2 | Traduction EN et `value` préservés | Page FR | Traduire | — | Les libellés des pays sont traduits, les codes ISO en `value` **ne changent pas** | P1 |
| F06-INT-007 | ENV-2 | `data-lang` après traduction | Page traduite | Inspecter | — | ⚠️ `data-lang="fr"` inchangé, `LanguePreferee=fr`. Voir **PV-19** | P1 |
| F06-INT-008 | ENV-3 ⛔ | Mapping `Country` vers Salesforce | Socle déployé | Soumettre avec Pays=`Italie` | `Country="IT"` | `Account.LivingCountry__c` reçoit la valeur — ⚠️ vérifier que le value set Salesforce attend bien un **code ISO** et non un libellé | P1 |
| F06-INT-009 | ENV-3 ⛔ | Résolution de la zone géographique | Socle déployé, DE de mapping alimentées | Soumettre depuis la France puis depuis l'Italie | — | `computeZone` renvoie `FR` pour la France ; la campagne est résolue avec zone, avec repli sur le mapping sans zone | P2 |

#### 5.6.8 Sécurité

| ID | Env | Scénario | Préconditions | Étapes | Données de test | Résultat attendu | Prio |
|---|---|---|---|---|---|---|---|
| F06-SEC-001 | ENV-1 | HTML dans le nom | PRE-0 | `<b>Rossi</b>` | — | Affiché littéralement (`textContent`) ✅ | P2 |
| F06-SEC-002 | ENV-1 | Injection via l'e-mail | PRE-0 | `a<img/src=x/onerror=alert(1)>@b.co` | — | ⚠️ `innerHTML` dans le message de succès. Voir **PV-08** | P1 |
| F06-SEC-003 | ENV-1 | Manipulation du champ caché `LangueSouhaitee` | PRE-0 | Modifier la valeur via la console puis soumettre | `LangueSouhaitee="anglais"` | La valeur est transmise telle quelle — ⚠️ aucun contrôle. Le socle devra valider les valeurs autorisées | P2 |
| F06-SEC-004 | ENV-2 | Fuite des données dans l'URL | Page publiée | Soumettre | — | ⚠️ Soumission GET avec e-mail et téléphone en clair. Voir **PV-02** | P1 |
| F06-SEC-005 | ENV-2 | Absence de validation en page publiée | Page publiée | Soumettre à vide | — | ⚠️ Aucun blocage. Voir **PV-32** | P1 |
| F06-SEC-006 | ENV-3 ⛔ | Candidature au nom d'un tiers | Socle déployé | Soumettre avec l'e-mail d'un candidat existant | — | `fill-if-blank` protège les valeurs renseignées, mais `Application_Requested__c` passe à `true` sur le compte d'autrui — **risque à arbitrer** (vérification d'identité / double opt-in) | P1 |

---

## 6. Matrice de couverture

### 6.1 Nombre de cas par formulaire et par catégorie

| Formulaire | Nominal | Validation | Lecture | Écriture | Erreurs | Edge cases | Intégration | Sécurité | **Total** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **F01 — Brochure** | 7 | 21 | 12 | 15 | 14 | 20 | 10 | 8 | **107** |
| **F02 — JPO** | 8 | 14 | 10 | 11 | 6 | 12 | 7 | 5 | **73** |
| **F03 — Atelier Découverte** | 4 | 6 | 5 | 5 | 3 | 5 | 4 | 2 | **34** |
| **F04 — Stage** | 4 | 8 | 6 | 5 | 3 | 6 | 4 | 2 | **38** |
| **F05 — Demande d'immersion** | 6 | 14 | 8 | 9 | 6 | 12 | 7 | 5 | **67** |
| **F06 — Candidature** | 6 | 15 | 9 | 10 | 7 | 11 | 9 | 6 | **73** |
| **TOTAL** | **35** | **78** | **50** | **55** | **39** | **66** | **41** | **28** | **392** |

> F03 et F04 partagent le moteur `shared/event-form.js` avec F02 : leurs jeux de cas ne couvrent que les **différences**. Pour une recette exhaustive, rejouer sur F03 et F04 les cas `F02-VAL-*`, `F02-EDGE-*` et `F02-ERR-*` non repris — soit **+22 exécutions** par formulaire.

### 6.2 Répartition par priorité

| Formulaire | P1 — Critique | P2 — Majeure | P3 — Mineure | Total |
|---|---:|---:|---:|---:|
| F01 — Brochure | 37 | 53 | 17 | 107 |
| F02 — JPO | 33 | 31 | 9 | 73 |
| F03 — Atelier | 21 | 9 | 4 | 34 |
| F04 — Stage | 21 | 15 | 2 | 38 |
| F05 — Immersion | 31 | 32 | 4 | 67 |
| F06 — Candidature | 37 | 33 | 3 | 73 |
| **TOTAL** | **180** | **173** | **39** | **392** |

### 6.3 Répartition par environnement

| Environnement | Cas | Exécutables aujourd'hui |
|---|---:|---|
| **ENV-1** — Builder GrapesJS | 298 | ✅ oui |
| **ENV-2** — Page publiée / exportée | 57 | ✅ oui |
| **ENV-3** — Socle SSJS / Salesforce | 37 | ⛔ non (socle absent du dépôt) |
| **TOTAL** | **392** | **355 exécutables · 37 bloqués** |

### 6.4 Couverture des exigences transverses

| Exigence | F01 | F02 | F03 | F04 | F05 | F06 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Soumission nominale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tous champs obligatoires vides | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Champ à espaces uniquement | ✅ | ✅ | — | — | ✅ | ✅ |
| Validation e-mail (format + domaine) | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Validation téléphone (bornes) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Normalisation E.164 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RGPD / opt-in | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Champs conditionnels | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lecture des campus (API) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lecture RGPD | ✅ | — | — | — | ✅ | ✅ |
| Encart événement | — | ✅ | ✅ | ✅ | — | — |
| Relecture d'une page enregistrée | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ancre de formulaire | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Traduction FR → EN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Double soumission | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rafraîchissement pendant soumission | ✅ | ✅ | — | — | ✅ | ✅ |
| Injection HTML / XSS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comportement en page publiée | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Écriture Salesforce (⛔) | ✅ | ✅ | ✅ | — | ✅ | ✅ |

---

## 7. Synthèse des résultats attendus

### 7.1 Ce qui doit passer aujourd'hui (ENV-1)

- Affichage, mise en page et responsive des 12 blocs (6 formulaires × FR/EN).
- Validation des champs obligatoires, de l'e-mail (format + domaines jetables) et du téléphone (7 à 14 chiffres).
- Champs conditionnels : *Programme souhaité* (F01–F06), champs enfant (F01, F02, F03), encart événement (F02, F03, F04).
- Normalisation du téléphone au format `+<indicatif><numéro>` pour les saisies nationales usuelles.
- Calcul des 4 indicateurs `HasOptedIn*`.
- Affichage du bloc de confirmation, scopé au formulaire soumis.
- Synchronisation des campus depuis `/api/campuses` et préservation du placeholder.
- Enregistrement, aperçu, publication et traduction de la page contenant les formulaires.

### 7.2 Ce qui échouera nécessairement (anomalies connues, ENV-1)

| Cas | Anomalie |
|---|---|
| `F0x-VAL-*` téléphone international | Saisie `+33…` rejetée (**PV-05**) |
| `F0x-WRITE-*` parenthèses | Normalisation cassée (**PV-06**) |
| `F0x-VAL-*` RGPD non coché | Soumission autorisée sans consentement (**PV-03**) |
| `F0x-WRITE-001` | Aucun envoi réseau (**PV-01**) |
| `F0x-READ-*` `Marque` / `LangueSouhaitee` | Champs cachés jamais renseignés (**PV-09**) |
| `F02/F03/F04-READ-*` encart | Dates de JPO affichées pour l'Atelier et le Stage (**PV-14**) |
| `F02/F03/F04-VAL-*` campus | Erreur sans message ni défilement (**PV-13**) |
| `F0x-INT-*` variantes EN | Libellés d'options en français (**PV-17**) |
| `F0x-SEC-002` | Auto-XSS via l'e-mail dans le message de confirmation (**PV-08**) |

### 7.3 Ce qui échouera nécessairement (ENV-2)

Tous les cas `ENV-2` touchant au **comportement** du formulaire (`F0x-WRITE-009`, `F0x-SEC-005/006`) : la page publiée ne contient aucun JavaScript de formulaire. Seuls les cas de **rendu**, d'**ancre**, d'**enregistrement** et de **traduction** doivent passer.

### 7.4 Ce qui n'est pas exécutable (ENV-3)

Les 37 cas marqués ⛔ : le socle SSJS et l'inliner ne sont pas présents dans le dépôt. Ils constituent la recette de référence à rejouer dès que le socle sera rebranché et que les identifiants d'org (RecordTypeId, ParentId, lookups) seront fournis.

---

## 8. Points de vigilance identifiés dans le code

> Chaque point indique : le **fichier** et la **fonction** concernés, le **problème constaté**, l'**impact**, les **cas de recette** qui le mettent en évidence, et une **recommandation**.

### PV-01 — Aucune donnée n'est envoyée à un serveur

- **Fichiers / fonctions** : [form-brochure/index.js:575](blocks/forms/form-brochure/index.js#L575) (`initBrfForm` › handler `submit`), [form-immersion/index.js:475](blocks/forms/form-immersion/index.js#L475), [form-candidature/index.js:493](blocks/forms/form-candidature/index.js#L493), [shared/event-form.js:837-839](blocks/forms/shared/event-form.js#L837-L839) (`handleSubmit`)
- **Problème** : la soumission est remplacée par `new Promise(resolve => setTimeout(() => resolve({ ok: true }), 900|1000))`.
- **Impact** : **P1 — aucune donnée prospect n'est collectée.** Le parcours métier des 6 formulaires est inopérant de bout en bout.
- **Cas** : `F01-WRITE-001`, `F02-WRITE-001`, `F03-WRITE-001`, `F04-WRITE-001`, `F05-WRITE-001`, `F06-WRITE-001`
- **Recommandation** : brancher l'envoi réel. Pour F02/F03/F04, un seul point à modifier (`handleSubmit`) ; pour F01, F05 et F06, un point par fichier.

### PV-02 — Les formulaires sont inertes une fois la page publiée

- **Fichiers / fonctions** : blocs sans `<script>` inline + [js/export.js:59](js/export.js#L59) (`exportHtml`), [lib/api-shared.js:41-59](lib/api-shared.js#L41-L59) (`buildStoredHtml`), [api/router.js:923](api/router.js#L923) (`/preview`), route de page publique
- **Problème** : la logique n'est attachée que par `editor.on('component:mount')`, jamais réinjectée à l'export ni à la publication. Le `<form>` publié n'a ni `action`, ni `method`, ni handler.
- **Impact** : **P1** — sur une page réelle : aucune validation, aucun champ conditionnel, aucun encart événement, aucune normalisation ; le clic sur *Envoyer* provoque une **soumission GET** vers l'URL courante, exposant e-mail et téléphone dans la barre d'adresse, l'historique et les logs.
- **Cas** : `F01-WRITE-009`, `F02-WRITE-008`, `F03-WRITE-004`, `F04-WRITE-005`, `F05-WRITE-007`, `F06-WRITE-007`, `F0x-SEC-005/006`
- **Recommandation** : produire un runtime de formulaire embarquable (script inline ou fichier référencé) injecté à la publication, ou porter la validation côté SSJS/AMPscript de la CloudPage.

### PV-03 — Le consentement RGPD n'est jamais obligatoire

- **Fichiers / fonctions** : handlers `submit` des 6 formulaires — la case `RGPDConsent` n'apparaît dans **aucune** liste de champs requis.
- **Problème** : une soumission sans consentement est acceptée et produit `HasOptedInEmail/SMS/WhatsApp/Phone = "0"`.
- **Impact** : **P1** — contradiction avec [GUIDE_FORMULAIRES_CRM.md](blocks/forms/GUIDE_FORMULAIRES_CRM.md) qui marque le RGPD ✅ requis, et avec l'attente CRM de 4 enregistrements `ContactPointConsent`. Risque de conformité.
- **Cas** : `F01-VAL-018`, `F02-VAL-012`, `F03-VAL-005`, `F04-VAL-007`, `F05-VAL-010`, `F06-VAL-011`
- **Recommandation** : arbitrer avec le métier — soit rendre la case bloquante, soit assumer une soumission sans opt-in et documenter le traitement CRM associé.

### PV-04 — La branche d'erreur de soumission est du code mort

- **Fichiers** : mêmes emplacements que PV-01, bloc `else { btn.disabled = false; … alert(t.errGeneric); }`
- **Problème** : la promesse résout toujours `{ ok: true }`, le `else` n'est jamais atteint.
- **Impact** : **P2** — aucune gestion d'erreur de soumission n'est réellement testable ; l'`alert()` prévu n'est de toute façon pas un pattern d'UI acceptable en production.
- **Cas** : `F01-ERR-001`, `F02-ERR-001`, `F03-ERR-001`, `F04-ERR-001`, `F05-ERR-001`, `F06-ERR-001`
- **Recommandation** : remplacer l'`alert()` par un message inline dans la carte, et couvrir explicitement 4xx / 5xx / timeout / réseau lors du branchement de PV-01.

### PV-05 — Un téléphone saisi au format international est rejeté

- **Fichiers / fonctions** : `validatePhone()` — 4 copies : [form-brochure/index.js:419-424](blocks/forms/form-brochure/index.js#L419-L424), [form-immersion/index.js:353-358](blocks/forms/form-immersion/index.js#L353-L358), [form-candidature/index.js:371-376](blocks/forms/form-candidature/index.js#L371-L376), [shared/event-form.js:792-797](blocks/forms/shared/event-form.js#L792-L797)
- **Problème** : le `+` n'est pas retiré avant le test `^[0-9]{7,14}$`, alors que la normalisation, elle, prévoit le cas `raw.startsWith('+')`.
- **Impact** : **P1** — un prospect international saisissant `+212612345678` est bloqué, sans message explicatif utile.
- **Cas** : `F01-VAL-014`, `F02-VAL-010`, `F03-VAL-006`, `F04-VAL-006`, `F05-VAL-009`, `F06-VAL-009`
- **Recommandation** : accepter un `+` optionnel en tête (`/^\+?[0-9]{7,15}$/`) et factoriser les 4 copies de la fonction dans un module partagé.

### PV-06 — Les parenthèses ne sont pas retirées à la normalisation

- **Fichiers** : blocs de normalisation — `raw = (data.MobilePhone || '').replace(/[\s\-.]/g, '')`, 4 copies (dont [form-brochure/index.js:565](blocks/forms/form-brochure/index.js#L565))
- **Problème** : `validatePhone` retire `( )`, la normalisation non → asymétrie.
- **Impact** : **P1** — `(06) 12 34 56 78` passe la validation puis produit `MobilePhone = "+33(06)12345678"`, valeur non conforme E.164, rejetée par Salesforce ou inutilisable pour l'envoi de SMS.
- **Cas** : `F01-WRITE-005`, `F05-WRITE-003`, `F06-WRITE-004`
- **Recommandation** : aligner les deux expressions sur `/[\s\-.()]/g`, et couvrir par un test unitaire.

### PV-07 — Validation e-mail incohérente entre `blur` et `submit`

- **Fichiers** : `emailEl.addEventListener('blur', … this.value.trim() …)` vs `validateEmail((emailEl || {}).value || '', t)` au `submit` — 4 copies.
- **Problème** : le `blur` trime la valeur, le `submit` non.
- **Impact** : **P2** — une adresse avec espace initial ou final est validée à la sortie du champ puis rejetée à la soumission, sans que l'utilisateur comprenne pourquoi.
- **Cas** : `F01-EDGE-010`, `F05-EDGE-006`, `F06-EDGE-004`
- **Recommandation** : trimer la valeur de manière systématique, idéalement dans le champ lui-même au `blur`.

### PV-08 — Injection HTML via l'e-mail dans le message de confirmation

- **Fichiers** : `msgS.innerHTML = t.successMsg(data.EmailAddress || '')` — [form-brochure/index.js:593](blocks/forms/form-brochure/index.js#L593), [form-immersion/index.js:492](blocks/forms/form-immersion/index.js#L492), [form-candidature/index.js:510](blocks/forms/form-candidature/index.js#L510), [shared/event-form.js:851](blocks/forms/shared/event-form.js#L851)
- **Problème** : l'e-mail est interpolé dans du HTML puis affecté via `innerHTML`. La regex de validation autorise `<`, `>`, `/`, `=` tant qu'il n'y a ni espace ni second `@` — par exemple `a<img/src=x/onerror=alert(1)>@b.co`.
- **Impact** : **P1 en tant que défaut**, **portée limitée aujourd'hui** : l'exécution n'a lieu que dans le canvas de l'éditeur (la page publiée n'exécute pas ce code). Le risque devient réel dès que PV-02 sera corrigé.
- **Cas** : `F01-SEC-002`, `F02-SEC-002`, `F03-SEC-001`, `F04-SEC-001`, `F05-SEC-002`, `F06-SEC-002`
- **Recommandation** : construire le message avec `textContent` sur un nœud dédié, ou échapper systématiquement les valeurs interpolées.

### PV-09 — `Marque` et `LangueSouhaitee` ne sont jamais renseignés

- **Fichier / fonction** : [shared/tracking-fields.js:113-125](blocks/forms/shared/tracking-fields.js#L113-L125) (`populateHiddenFields`)
- **Problème** : la fonction lit `CURRENT_SCHOOL` sur `form.ownerDocument.defaultView`, c'est-à-dire la fenêtre de **l'iframe du canvas**. `window.CURRENT_SCHOOL` n'est défini que sur la fenêtre **parente** ([js/app.js:263](js/app.js#L263)).
- **Impact** : **P1** — le champ `Marque` (cible CRM `Contact.Ecole__c` / `Brand__c`) reste vide sur les 6 formulaires, et la règle « langue souhaitée = français pour IFA Paris » n'est jamais appliquée. Sans marque, l'affectation à l'école côté CRM est impossible.
- **Cas** : `F01-READ-006`, `F05-READ-004`, `F06-READ-004`, `F06-READ-005`
- **Recommandation** : remonter à la fenêtre parente (`win.parent.CURRENT_SCHOOL`) ou injecter la valeur à la construction du bloc via `buildHiddenFields({ marque })`, qui accepte déjà le paramètre.

### PV-10 — `isProgrammeSchool()` renvoie toujours `true` dans le builder

- **Fichier / fonction** : [shared/programme-config.js:83-86](blocks/forms/shared/programme-config.js#L83-L86)
- **Problème** : appelée avec l'école lue depuis l'iframe (donc `null` — cf. PV-09), la fonction retourne `true` (« mode test »). La restriction aux écoles BRASSART, IFA Paris, MOPA, CREAD et EFAP n'est donc **jamais** appliquée.
- **Impact** : **P2** — le champ *Programme souhaité* apparaît pour toutes les écoles.
- **Cas** : `F01-NOM-005`, `F05-NOM-003`, `F06-NOM-003` (à rejouer sur une école hors liste)
- **Recommandation** : corriger la résolution de l'école (PV-09), puis vérifier la liste `PROGRAMME_SCHOOLS`.

### PV-11 — Le tracking `utm_*` / `gclid` n'est pas vérifiable dans le builder

- **Fichier** : [shared/tracking-fields.js:78-90](blocks/forms/shared/tracking-fields.js#L78-L90)
- **Problème** : `URLSearchParams` est construit sur l'URL du document du canvas, qui ne porte pas les paramètres de campagne de la page hôte.
- **Impact** : **P2** — le remplissage réel des champs de tracking ne peut pas être recetté en ENV-1 ; il ne pourra l'être qu'une fois PV-02 corrigé.
- **Cas** : `F01-READ-006`
- **Recommandation** : lire l'URL de la fenêtre parente en contexte builder, et prévoir un jeu de recette dédié en ENV-2 après correction de PV-02.

### PV-12 — Le select Campus des formulaires événement est hors du `<form>`

- **Fichier** : [shared/event-form.js:617-623](blocks/forms/shared/event-form.js#L617-L623) — le bloc `.jpo-campus-zone` précède `<form class="jpo-form">`
- **Problème** : le champ n'est rattaché au formulaire que par un `<input type="hidden" name="Campus">` créé **au premier `change`** par le JavaScript de l'éditeur.
- **Impact** : **P1** — sur une page publiée (sans JS), le campus n'est jamais transmis, même par une soumission native. En ENV-1, un utilisateur qui ne touche pas au select ne crée jamais le hidden.
- **Cas** : `F02-WRITE-002`, `F02-WRITE-003`, `F02-WRITE-008`, `F03-WRITE-004`, `F04-WRITE-005`
- **Recommandation** : déplacer le select dans le `<form>` (ou ajouter l'attribut `form="<id>"`), et poser le hidden dès la construction du bloc.

### PV-13 — Formulaires événement : erreur campus silencieuse et pas de défilement

- **Fichier** : [shared/event-form.js:1029-1030](blocks/forms/shared/event-form.js#L1029-L1030) et [1044](blocks/forms/shared/event-form.js#L1044)
- **Problème** : le campus manquant ne pose qu'une classe `.err` (il n'y a pas de `.jpo-err-msg` dans `.jpo-campus-zone`) ; et l'échec de validation fait un `return` sec, sans `scrollIntoView` — contrairement à F01, F05 et F06.
- **Impact** : **P1** — sur un formulaire long, l'utilisateur clique sur *Réserver ma place* et « il ne se passe rien ». Abandon probable.
- **Cas** : `F02-VAL-002`, `F02-VAL-003`, `F03-VAL-004`, `F04-VAL-004`
- **Recommandation** : ajouter un `<span class="jpo-err-msg">` dans la zone campus et aligner le comportement de défilement sur les autres formulaires.

### PV-14 — JPO, Atelier et Stage partagent le même calendrier d'événements

- **Fichier** : [shared/event-form.js:33-58](blocks/forms/shared/event-form.js#L33-L58) (`jpoEvents`), utilisé par `updateCard` sans tenir compte de `typeEvenement`
- **Problème** : l'encart et le champ `EventDate` affichent des **dates de JPO** pour l'Atelier Découverte et pour le Stage.
- **Impact** : **P1 fonctionnel** — information erronée présentée au prospect et transmise au CRM.
- **Cas** : `F03-READ-001`, `F03-WRITE-002`, `F04-READ-001`
- **Recommandation** : indexer le calendrier par `typeEvenement`, ou brancher la lecture sur `SocleRead.getNextEventDates(campus, type)` déjà spécifié côté socle.

### PV-15 — Données mock indexées sur des slugs, options campus issues de la base

- **Fichiers** : [shared/event-form.js:923](blocks/forms/shared/event-form.js#L923) (`jpoEvents[lang][val]`), [form-brochure/index.js:595](blocks/forms/form-brochure/index.js#L595) (`BROCHURES[data.Campus]`) vs [shared/campus-select.js:45-49](blocks/forms/shared/campus-select.js#L45-L49)
- **Problème** : la synchronisation remplace les `value` des options par les **ids de campus en base**. Les mocks sont indexés sur les slugs statiques (`paris`, `lille`, …). Toute divergence rend le mock muet.
- **Impact** : **P1** — encart événement jamais affiché et `EventDate` toujours vide dès qu'une école utilise des ids différents ; liste de brochures systématiquement générique.
- **Cas** : `F02-READ-003`, `F02-INT-002`, `F01-NOM-003`
- **Recommandation** : à traiter en même temps que le sourcing réel des données (§9), et documenter la convention d'id de campus attendue.

### PV-16 — `/api/campuses` : implémentations divergentes local / Vercel

- **Fichiers** : [server.js:2233-2296](server.js#L2233-L2296) (Data Extension SFMC via `listCampuses`, **filtrée par école**, retourne `image_url`, `address`, `link`, `country`) vs [api/router.js:555-587](api/router.js#L555-L587) (table Supabase `campuses`, **sans filtre école**, champs `id`/`name`/`slug` uniquement)
- **Problème** : deux sources de vérité et deux contrats de réponse pour le même endpoint.
- **Impact** : **P1** — les options du select Campus des 6 formulaires peuvent différer entre le développement local et l'environnement déployé, y compris en exposant les campus d'autres écoles.
- **Cas** : `F01-INT-002`
- **Recommandation** : unifier la source et le contrat, et faire porter le filtre école dans les deux implémentations.

### PV-17 — Les variantes anglaises affichent des libellés d'options en français

- **Fichiers** : `buildContent('en')` appelle `buildOptions(...)` (libellés FR) au lieu de `buildOptionsEn(...)`, pourtant exporté — [picklist-config.js:75-78](blocks/forms/shared/picklist-config.js#L75-L78) ; occurrences dans F01, F05, F06 et [event-form.js:22-30](blocks/forms/shared/event-form.js#L22-L30) pour F02/F03/F04
- **Problème** : dans les blocs `-en`, les libellés de champs sont anglais mais les options restent françaises (`Étudiant(e)`, `Bac+3 (Licence / Bachelor)`, `Allemagne`…).
- **Impact** : **P2** — expérience dégradée sur les pages internationales.
- **Cas** : `F01-INT-004`, `F05-INT-003`, `F06-INT-003`
- **Recommandation** : router vers `buildOptionsEn` quand `lang === 'en'`. La traduction automatique de page (§ `/api/ai/translate`) corrige partiellement le symptôme, pas la cause.

### PV-18 — Le placeholder des listes déroulantes est vide

- **Fichiers** : tous les appels `buildOptions(..., '')` (F01, F05, F06, event-form)
- **Problème** : la première option est `<option value=""></option>` — sans libellé, au lieu du défaut `Sélectionnez...`.
- **Impact** : **P3** — l'utilisateur voit un champ apparemment vide sans consigne.
- **Cas** : `F01-EDGE-020`, `F05-EDGE-011`
- **Recommandation** : passer un libellé traduit (`Sélectionnez…` / `Select…`).

### PV-19 — La traduction de page ne met pas à jour `data-lang` ni `LanguePreferee`

- **Fichier / fonction** : [lib/translate.js:40-80](lib/translate.js#L40-L80) (`collectTargets`) — seuls les nœuds texte, `placeholder`, `alt`, `title`, `aria-label` et les `meta` sont traités.
- **Problème** : `data-lang` sur le `<form>` et la valeur du champ caché `LanguePreferee` restent inchangés après traduction.
- **Impact** : **P1** — une page traduite en anglais remonterait ses prospects comme francophones ; et si le runtime JS est un jour réinjecté (PV-02), les messages d'erreur s'afficheraient en français sur une page anglaise.
- **Cas** : `F01-INT-009`, `F03-INT-004`, `F04-INT-004`, `F05-INT-006`, `F06-INT-007`
- **Recommandation** : ajouter au pipeline de traduction une passe qui réécrit `data-lang` et `input[name="LanguePreferee"]` en fonction de la langue cible.

### PV-20 — Les valeurs saisies ne sont pas nettoyées avant collecte

- **Fichiers** : `new FormData(form).forEach((v, k) => { data[k] = v; })` — 4 copies
- **Problème** : la validation utilise `trim()`, la collecte non.
- **Impact** : **P2** — des espaces parasites partent vers le CRM (`"  Dupont  "`), dégradant la déduplication et les publipostages.
- **Cas** : `F01-WRITE-007`, `F05-WRITE-006`, `F06-WRITE-006`
- **Recommandation** : appliquer `String(v).trim()` à la collecte pour tous les champs texte.

### PV-21 — Modules partagés morts

- **Fichiers** : [shared/form-validators.js](blocks/forms/shared/form-validators.js), [shared/form-conditions.js](blocks/forms/shared/form-conditions.js), [shared/form-styles.js](blocks/forms/shared/form-styles.js), [shared/rgpd-block.js](blocks/forms/shared/rgpd-block.js) — aucun import dans le dépôt. Également : la fonction `updateEventCard` de [shared/event-form.js:813-835](blocks/forms/shared/event-form.js#L813-L835), jamais appelée, et dont l'accès `jpoEvents[campusVal]` **omet le niveau de langue** (bug latent).
- **Problème** : `form-validators.js` contient une validation **plus complète** que celle réellement utilisée (E.164 correcte, opt-in RGPD obligatoire, champ normalisé caché) mais cible des classes `.edh-form` inexistantes.
- **Impact** : **P2** — risque élevé de confusion pour un développeur ou un recetteur qui lirait ce fichier comme la référence.
- **Cas** : —
- **Recommandation** : soit brancher `form-validators.js` (il résout PV-03, PV-05 et PV-06), soit supprimer les 4 modules et la fonction morte.

### PV-22 — Formulaires désactivés toujours présents dans le code

- **Fichiers** : [blocks/forms/form-precandidature/index.js](blocks/forms/form-precandidature/index.js) (`enabled: false`, non importé), [blocks/forms/form-webconf/index.js](blocks/forms/form-webconf/index.js) (absent du registre et des imports)
- **Impact** : **P3** — bruit dans le dépôt ; risque de recetter par erreur un formulaire inactif.
- **Cas** : §2.2
- **Recommandation** : archiver ou supprimer, et documenter la décision.

### PV-23 — Le socle SSJS et son inliner sont absents du dépôt

- **Fichiers attendus** : `lib/socle-inliner.js`, `sfmc-ssjs/socle/{config,sf-helpers,socle-resolvers,socle-upsert,socle-summit,socle-read}.ssjs` — retirés par le commit `28a4034`. Les tests [sfmc-ssjs/test/socle.test.js](sfmc-ssjs/test/socle.test.js) et [sfmc-ssjs/test/inliner.test.js](sfmc-ssjs/test/inliner.test.js) les référencent toujours ; le dossier `sfmc-ssjs/` n'est pas suivi par git.
- **Problème** : les tests ne peuvent pas s'exécuter (`Echec du chargement de config.ssjs`), et `package.json` ne définit **aucun** script `test` ni `test:socle` alors que l'en-tête des tests mentionne `npm run test:socle`.
- **Impact** : **P1** — l'ensemble de la chaîne d'écriture Salesforce est hors du périmètre exécutable ; aucun filet de sécurité automatisé sur les règles métier (idempotence, anti-écho, fill-if-blank).
- **Cas** : les 37 cas ⛔
- **Recommandation** : réintégrer le socle (ou clarifier son dépôt de référence), versionner `sfmc-ssjs/`, et ajouter les scripts npm `test` / `test:socle`.

### PV-24 — Identifiants d'org Salesforce non résolus

- **Source** : [sfmc-ssjs/socle/recap-socle-ssjs.html](sfmc-ssjs/socle/recap-socle-ssjs.html) §4
- **Problème** : `Account.RecordTypeId` (Person Account) manquant — **bloquant** ; `ContactPointConsent.ParentId` (Account Id ou PersonContactId ?), champ de liaison `CampaignMember`, lookup `CampaignMemberInteraction` et écriture de `GDPR_Status__c` restent à confirmer en atelier.
- **Impact** : **P1** — aucun test réel d'écriture n'est possible sur l'org.
- **Cas** : `F01-ERR-014`
- **Recommandation** : obtenir les identifiants UAT et Prod, puis rejouer les 37 cas ⛔.

### PV-25 — `EventDate` transporte un libellé localisé, pas une date

- **Fichier** : [shared/event-form.js:932](blocks/forms/shared/event-form.js#L932) — `hidden.value = ev.date` où `ev.date` vaut `"Samedi 14 mars 2026"` (ou `"Saturday, March 14 2026"` en EN)
- **Impact** : **P1** — valeur inexploitable côté CRM pour un champ date ; dépend de surcroît de la langue du formulaire.
- **Cas** : `F02-READ-005`, `F02-WRITE-006`
- **Recommandation** : transmettre un identifiant d'instance d'événement (le socle attend d'ailleurs un `InstanceId`) et/ou une date ISO 8601, en gardant le libellé pour le seul affichage.

### PV-26 — Le message de confirmation affiche la valeur technique du campus

- **Fichier** : [shared/event-form.js:851](blocks/forms/shared/event-form.js#L851) — `t.successConfirm(data.EventDate, data.Campus, data.EmailAddress)` avec `data.Campus` = la **valeur** de l'option
- **Impact** : **P2** — l'utilisateur lit « sur le campus de **aix** » au lieu de « Aix-en-Provence ». Le libellé est pourtant déjà calculé (`campusName`) dans `updateCard`.
- **Cas** : `F02-EDGE-010`, `F03-EDGE-002`
- **Recommandation** : passer le texte de l'option sélectionnée au message.

### PV-27 — Écart documentation / code sur le formulaire Atelier

- **Fichiers** : [form-atelier/index.js:22-24](blocks/forms/form-atelier/index.js#L22-L24) (`showVousEtes: true, showChild: true`) vs [GUIDE_FORMULAIRES_CRM.md §3.3](blocks/forms/GUIDE_FORMULAIRES_CRM.md) (« ❌ pas de Vous êtes, ❌ pas de champs enfant »)
- **Impact** : **P1 de spécification** — le formulaire livré ne correspond pas au besoin documenté ; les données `VousEtes` et enfant remontent alors qu'elles ne sont pas attendues.
- **Cas** : `F03-VAL-002`, `F03-VAL-003`
- **Recommandation** : trancher avec le métier, puis aligner le code **ou** le guide.

### PV-28 — Protection contre la double soumission limitée à l'éditeur

- **Fichiers** : `btn.disabled = true` dans les 4 handlers
- **Problème** : la protection repose entièrement sur le JavaScript, absent en page publiée (PV-02). Aucun jeton d'idempotence n'accompagne le payload.
- **Impact** : **P2** — risque de doublons dès que l'envoi réel sera branché.
- **Cas** : `F01-EDGE-012`, `F02-EDGE-008`, `F03-EDGE-001`, `F04-EDGE-001`, `F05-EDGE-007`, `F06-EDGE-006`
- **Recommandation** : côté serveur, s'appuyer sur l'upsert par e-mail du socle (déjà idempotent) et ajouter un jeton anti-rejeu côté formulaire.

### PV-29 — Styles dupliqués et classes globales

- **Fichiers** : chaque bloc émet son propre `<style>` (≈ 470 lignes pour `event-form`, ≈ 140 pour les autres), et les classes (`.jpo-*`, `.brf-*`, `.imf-*`, `.cnd-*`) ne sont pas scopées par instance.
- **Impact** : **P3** — poids de page inutilement gonflé si plusieurs formulaires cohabitent ; un restylage manuel d'un formulaire affecte tous ceux qui partagent le préfixe.
- **Cas** : `F02-EDGE-004`
- **Recommandation** : mutualiser la feuille de styles au niveau de la page à la publication.

### PV-30 — Le nettoyage CSS supprime les règles d'erreur à la publication

- **Fichier / fonction** : [lib/htmlCleaner.js:31-88](lib/htmlCleaner.js#L31-L88) (`removeOrphanedCss`)
- **Problème** : les sélecteurs sans correspondance dans le DOM au moment de la publication sont supprimés — notamment `.brf-input.err`, `.brf-select.err`, `.brf-err-msg.show` et leurs équivalents `jpo`/`imf`/`cnd`.
- **Impact** : **P2** — sans conséquence aujourd'hui (aucun JS en page publiée), mais **bloquant** dès que le runtime sera réinjecté : les erreurs ne seraient plus visibles.
- **Cas** : `F01-INT-007`
- **Recommandation** : exclure les règles d'état (`.err`, `.show`, `.hidden`, `:disabled`) du nettoyage, via une liste blanche.

### PV-31 — Libellés non liés aux champs

- **Fichiers** : les 6 formulaires — `<label class="…-label">` sans attribut `for`, les `id` étant réécrits par GrapesJS.
- **Impact** : **P2 accessibilité** — les lecteurs d'écran n'associent pas le libellé au champ, et cliquer sur le libellé ne donne pas le focus. Seuls l'indicatif téléphonique porte un `aria-label`.
- **Cas** : à ajouter lors d'une recette d'accessibilité dédiée
- **Recommandation** : envelopper les champs dans leur `<label>`, ce qui rend l'association indépendante des `id`.

### PV-32 — `novalidate` neutralise aussi la validation native

- **Fichiers** : `<form … novalidate>` dans les 6 formulaires ; les attributs `required` sont présents mais inopérants.
- **Impact** : **P1 en ENV-2** — la page publiée n'a **ni** validation JS **ni** validation navigateur : une soumission entièrement vide part sans obstacle.
- **Cas** : `F01-SEC-006`, `F05-SEC-004`, `F06-SEC-005`
- **Recommandation** : retirer `novalidate` du HTML publié (le conserver uniquement dans le canvas de l'éditeur), pour bénéficier au minimum de la validation navigateur.

### PV-33 — Aucun filtrage des formulaires par école

- **Fichier** : [blocks/registry.js:31-37](blocks/registry.js#L31-L37) — les 6 formulaires sont déclarés `scope: 'global'`, `schools: []`.
- **Problème** : les périmètres documentés (Stage → 4 écoles ; Immersion → 7 écoles ; Brochure et Candidature → toutes) ne sont pas implémentés.
- **Impact** : **P2** — un contributeur peut poser un formulaire Stage sur une école qui n'organise pas de stage.
- **Cas** : `F04-READ-005`
- **Recommandation** : renseigner `scope: 'school'` et la liste `schools` pour F03, F04 et F05, ou documenter que le contrôle est humain.

### PV-34 — `Country` absent du formulaire Immersion

- **Fichiers** : [form-immersion/index.js](blocks/forms/form-immersion/index.js) (aucun champ `Country`) vs [recap-lecture-sf.html §4](sfmc-ssjs/socle/recap-lecture-sf.html) qui liste « Pays » parmi les champs de l'immersion
- **Impact** : **P2** — `Account.LivingCountry__c` ne sera pas alimenté par ce formulaire ; la résolution de zone (`computeZone(country)`) côté socle n'aura pas d'entrée.
- **Cas** : `F05-WRITE-005`
- **Recommandation** : trancher avec le métier — ajouter le champ, ou acter que la zone est déduite autrement pour l'immersion.

### PV-35 — Indicatifs téléphoniques incohérents avec la liste des pays

- **Fichiers** : liste d'indicatifs codée en dur (7 entrées : `+33 +32 +41 +352 +1 +44 +212`) dans les 4 générateurs, vs `EDC_PICKLISTS.countries` (18 pays)
- **Problème** : un candidat italien, sénégalais, tunisien, algérien, ivoirien, camerounais, espagnol, allemand, canadien ou monégasque ne trouve pas son indicatif ; aucun contrôle de cohérence Pays / Indicatif n'existe.
- **Impact** : **P2** — numéros normalisés avec un mauvais indicatif (`+33` par défaut), donc injoignables.
- **Cas** : `F06-VAL-010`
- **Recommandation** : dériver la liste d'indicatifs de la liste des pays (ou la lire depuis `Account.IndicatifPick__c` comme prévu au contrat v4), et présélectionner l'indicatif à partir du pays choisi.

---

## 9. Recommandations de recette

### 9.1 Ordre d'exécution conseillé

1. **Vague 1 — ENV-1, priorité P1** (180 cas P1, dont ~150 en ENV-1). Objectif : statuer sur l'aptitude fonctionnelle du builder.
2. **Vague 2 — ENV-1, P2 puis P3.**
3. **Vague 3 — ENV-2** (57 cas) : enregistrement, aperçu, page publique, export, publication SFMC, traduction. Cette vague **doit** produire un constat explicite sur PV-02.
4. **Vague 4 — ENV-3** (37 cas ⛔) : à programmer après réintégration du socle et obtention des identifiants d'org (PV-23, PV-24).

### 9.2 Prérequis avant de démarrer

| Prérequis | Pourquoi |
|---|---|
| Une école de test disposant de ≥ 3 campus en base, dont les ids correspondent aux slugs `paris`/`lille`/`lyon` | Permet de recetter l'encart événement et la liste de brochures (sinon PV-15 masque tout) |
| Une école de test **sans** campus | Permet de recetter le repli statique (`F0x-READ-002`) |
| Une école avec `rgpdText` et `rgpdUrl` renseignés | `F0x-READ-003/004` |
| L'école `ifa-paris` accessible | `F06-READ-005` (`LangueSouhaitee`) |
| Un environnement local **et** un environnement déployé | `F01-INT-002` (divergence `/api/campuses`) |
| Clé `GEMINI_API_KEY_TRANSLATION` valide | cas de traduction |
| SFMC configuré (`SFMC_SUBDOMAIN`, `CLIENT_ID`, `CLIENT_SECRET`) | publication + campus en local |

### 9.3 Tests recommandés au-delà du code existant

Ces contrôles ne correspondent à **aucune règle actuellement implémentée**. Ils sont proposés parce qu'ils couvrent un risque fonctionnel réel ; ils doivent d'abord faire l'objet d'une décision produit.

| # | Contrôle recommandé | Risque couvert |
|---|---|---|
| R-01 | Longueur maximale sur `LastName`, `FirstName` (80 caractères, limite Salesforce standard) et sur les champs enfant | Rejet ou troncature silencieuse côté CRM (`F0x-EDGE-006/003`) |
| R-02 | Rendre le consentement RGPD bloquant, ou tracer explicitement l'absence de consentement | Conformité (PV-03) |
| R-03 | Accepter le format international du téléphone et normaliser en E.164 strict | Prospects internationaux (PV-05, PV-06) |
| R-04 | Rejeter les sous-domaines de domaines jetables et les doubles points dans le domaine | Qualité de base (`F01-VAL-010`, `F01-EDGE-011`) |
| R-05 | Rendre `Programme` obligatoire sur F06 (Candidature) lorsqu'il est affiché | Le PTAT est structurant pour une candidature (`F06-VAL-013`) |
| R-06 | Contrôle de cohérence Pays / Indicatif, et liste d'indicatifs alignée sur la liste des pays | Numéros injoignables (PV-35) |
| R-07 | Timeout explicite + message utilisateur sur `GET /api/campuses` | Chargement bloqué sans retour (`F01-ERR-005`) |
| R-08 | Revalidation serveur complète du payload (champs requis, longueurs, valeurs de picklist, cohérence des champs conditionnels) | Contournement du frontend (`F0x-SEC-004/007`) |
| R-09 | Jeton anti-rejeu ou clé d'idempotence dans le payload | Doublons à la double soumission (PV-28) |
| R-10 | Journalisation sans données personnelles (pas d'e-mail ni de téléphone en clair dans les logs serveur) | Traçabilité RGPD |
| R-11 | Recette d'accessibilité dédiée (association libellé/champ, navigation clavier, contrastes) | PV-31 |
| R-12 | Test de charge léger sur la page publiée avec 3 formulaires simultanés | PV-29 (poids CSS) |

### 9.4 Modèle de fiche de résultat

| Champ | Valeur |
|---|---|
| ID du cas | `F0x-CAT-nnn` |
| Date / testeur | |
| Environnement | ENV-1 / ENV-2 / ENV-3 · navigateur · école |
| Statut | ✅ Conforme · ⚠️ Conforme avec réserve · ❌ Non conforme · ⛔ Non exécutable · ⏭️ Non joué |
| Écart constaté | |
| Point de vigilance associé | `PV-xx` |
| Anomalie ouverte | référence du ticket |

---

## 10. Statistiques de couverture

| Indicateur | Valeur |
|---|---:|
| **Nombre total de cas de test** | **392** |
| Cas **P1 — Critique** | 180 (46 %) |
| Cas **P2 — Majeure** | 173 (44 %) |
| Cas **P3 — Mineure** | 39 (10 %) |
| Cas exécutables aujourd'hui (ENV-1 + ENV-2) | 355 (91 %) |
| Cas bloqués (ENV-3, socle absent) | 37 (9 %) |
| Formulaires couverts | 6 / 6 |
| Blocs GrapesJS couverts (FR + EN) | 12 / 12 |
| Catégories couvertes par formulaire | 8 / 8 sur les 6 formulaires |
| Points de vigilance documentés | 35 |
| dont **P1** | 18 |
| dont **P2** | 14 |
| dont **P3** | 3 |
| Cas de test rattachés à au moins un point de vigilance | 88 |
| Recommandations hors périmètre du code actuel | 12 (R-01 → R-12) |

### 10.1 Répartition des cas par catégorie

| Catégorie | Cas | Part |
|---|---:|---:|
| `VAL` — Validation | 78 | 20 % |
| `EDGE` — Cas limites | 66 | 17 % |
| `WRITE` — Écriture | 55 | 14 % |
| `READ` — Lecture | 50 | 13 % |
| `INT` — Intégration | 41 | 10 % |
| `ERR` — Erreurs techniques | 39 | 10 % |
| `NOM` — Nominal | 35 | 9 % |
| `SEC` — Sécurité | 28 | 7 % |
| **Total** | **392** | **100 %** |

### 10.2 Verdict d'entrée en recette

| Question | Réponse |
|---|---|
| Les 6 formulaires sont-ils utilisables dans le builder ? | ✅ Oui, sous réserve des anomalies listées au §7.2 |
| Les 6 formulaires sont-ils utilisables sur une page publiée ? | ❌ **Non** — aucun comportement dynamique, soumission GET non maîtrisée (PV-02) |
| Les données arrivent-elles dans Salesforce ? | ❌ **Non** — aucun envoi (PV-01) et socle absent (PV-23) |
| La recette ENV-1 peut-elle démarrer immédiatement ? | ✅ Oui, 298 cas |
| La recette ENV-2 peut-elle démarrer immédiatement ? | ✅ Oui, 57 cas — en s'attendant à des échecs structurels documentés |
| La recette ENV-3 peut-elle démarrer ? | ⛔ Non — prérequis PV-23 et PV-24 |

---

*Document généré à partir de l'analyse du code du dépôt `LandingPageGenerator`. Toute évolution des fichiers cités doit donner lieu à une relecture des cas associés.*
