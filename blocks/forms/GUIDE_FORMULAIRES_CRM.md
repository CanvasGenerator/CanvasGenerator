# Guide des formulaires EDH & connexion CRM

> Documentation des 6 formulaires du LandingPageGenerator : métier, schéma de
> champs, types de données, champs cachés, et **comment brancher les champs sur
> un objet CRM** (Salesforce Education Cloud / Marketing Cloud).
>
> Source fonctionnelle : `Formulaires pour les 10 écoles.xlsx`.

---

## 1. Vue d'ensemble

Les 6 formulaires demandés :

| # | Formulaire | Bloc(s) GrapesJS (FR + EN) | Fichier |
|---|---|---|---|
| 1 | **Brochure** | `form-brochure` / `form-brochure-en` | [form-brochure/index.js](form-brochure/index.js) |
| 2 | **JPO** | `form-jpo` / `form-jpo-en` | [form-jpo/index.js](form-jpo/index.js) |
| 3 | **Atelier découverte** | `form-atelier` / `form-atelier-en` | [form-jpo/index.js](form-jpo/index.js) |
| 4 | **Inscription stage** | `form-stage` / `form-stage-en` | [form-jpo/index.js](form-jpo/index.js) |
| 5 | **Demande immersion** | `form-immersion` / `form-immersion-en` | [form-immersion/index.js](form-immersion/index.js) |
| 6 | **Candidature** | `form-candidature` / `form-candidature-en` | [form-candidature/index.js](form-candidature/index.js) |

> JPO, Atelier et Stage partagent **un seul fichier** (`form-jpo`) : la même
> fonction `buildBlock()` est appelée avec des paramètres différents
> (`typeEvenement`, `showVousEtes`, `showChild`…).

### Architecture (commune à tous)

- Chaque formulaire est un **bloc GrapesJS** généré en JavaScript pur
  (`buildContent(lang)` / `buildBlock(...)` → HTML + CSS), **sans `<script>`
  inline** (non exécuté par GrapesJS chargé via CDN).
- La logique interactive est attachée après le rendu via
  `editor.on('component:mount')`, en accédant au DOM de l'iframe canvas
  (`editor.Canvas.getDocument()`).
- **2 langues** (FR/EN) via l'objet `TRANS`. La langue est portée par
  `data-lang` sur le `<form>`.
- **Modules partagés** :
  - [shared/picklist-config.js](shared/picklist-config.js) — listes déroulantes (les `value` = noms d'API Salesforce).
  - [shared/tracking-fields.js](shared/tracking-fields.js) — champs cachés (tracking + mapping CRM) + auto-remplissage.
  - [shared/programme-config.js](shared/programme-config.js) — écoles concernées + programmes conditionnels.
  - [shared/rgpd-config.js](shared/rgpd-config.js) — texte + lien RGPD (source centralisable).

### Types de données (attributs HTML)

| Type HTML | Usage | Validation |
|---|---|---|
| `text` | Nom, Prénom | requis |
| `email` | Adresse mail | format + blocage des domaines jetables |
| `tel` | Téléphone | format + **normalisation E.164** (indicatif + numéro) |
| `select` | Menus déroulants (picklists) | requis |
| `checkbox` | RGPD | → génère les opt-in |
| `hidden` | Tracking / mapping CRM | auto-rempli |

---

## 2. Champs cachés communs (tracking + CRM)

Générés par `buildHiddenFields()` dans [shared/tracking-fields.js](shared/tracking-fields.js)
et **auto-remplis** par `populateHiddenFields()` à l'initialisation.

| `name` du champ | Contenu | Source de remplissage | Objet / Champ CRM cible |
|---|---|---|---|
| `submitted` | `"true"` | statique | — |
| `NomFormulaire` | nom logique (ex. `Inscription_JPO`) | statique | Contact / Détail source création |
| `TypeFormulaire` | `brochure` \| `evenement` \| `immersion` \| `candidature` | statique | Contact / Type de formulaire |
| `Marque` | école (mix marque + campus) | `window.CURRENT_SCHOOL` | Contact + Consentement / Ecole |
| `LanguePreferee` | langue du formulaire (`fr`/`en`) | `data-lang` | Contact / Langue préférée de contact |
| `LangueSouhaitee` | langue d'enseignement (défaut `français` pour IFA Paris) | contexte école | Intérêt académique / Langue souhaitée |
| `DateDernierContact` | (vide, à alimenter) | — | Contact / Date dernier point de contact marketing |
| `TypeDernierContact` | (vide) | — | Contact / Type dernier point de contact marketing |
| `CampagneAssociee` | (vide) | — | Contact / Campagne associée |
| `utm_source` … `utm_campus` | paramètres de campagne | `URLSearchParams` | Contact + Membre de campagne / utm_* |
| `gclid`, `fbclid` | identifiants pub Google/Meta | `URLSearchParams` | Contact + Membre de campagne |
| `clientId` | identifiant visiteur persistant | `localStorage` | Contact + Membre de campagne / client ID |
| `consent` | consentement cookies | cookie `cookie_consent` | Contact / consent |
| `date_consentement_cookies` | date du consentement cookies | cookie | Contact / date_consentement_cookies |
| `canal`, `sous_canal` | canal d'acquisition | (mapping à fournir) | Contact + Membre de campagne |

**Champs calculés à la soumission** (dans le handler `submit`, pas dans le HTML) :

| Clé ajoutée à `data` | Valeur | Cible CRM |
|---|---|---|
| `MobilePhone` | téléphone **normalisé** `+33…` | Contact / Téléphone |
| `HasOptedInEmail` | `1`/`0` selon RGPD | Consentement (record Email) |
| `HasOptedInSMS` | `1`/`0` | Consentement (record SMS) |
| `HasOptedInWhatsApp` | `1`/`0` | Consentement (record WhatsApp) |
| `HasOptedInPhone` | `1`/`0` | Consentement (record Téléphone) |

> ⚠️ **`Rentrée générale` n'est PAS un champ du formulaire** (règle métier #4 de
> l'Excel) : elle est poussée côté CRM par **Salesforce Flow Builder**.

---

## 3. Détail par formulaire

Légende : ✅ requis · 🔹 optionnel · 🔀 conditionnel · 🕶️ caché

### 3.1 Brochure — `form-brochure`

**Métier :** un prospect (ou un parent) télécharge une ou plusieurs brochures ;
il les reçoit par e-mail (envoi Marketing Cloud). Commun **FR + International**.

| Champ | `name` | Type | Statut | Objet CRM | Champ CRM |
|---|---|---|---|---|---|
| Vous êtes | `VousEtes` | select | ✅ | Person Account | Type |
| Nom | `LastName` | text | ✅ | Contact + Membre campagne | Nom |
| Prénom | `FirstName` | text | ✅ | Contact + Membre campagne | Prénom |
| Pays de résidence | `Country` | select | ✅ | Contact | Pays de résidence |
| Adresse mail | `EmailAddress` | email | ✅ | Contact | Adresse mail |
| Indicatif | (préfixe) | select | ✅ | Contact | Indicatif |
| Téléphone | `MobilePhone` | tel | ✅ | Contact | Téléphone |
| Niveau d'études | `StudyLevel` | select | ✅ | Contact | Niveau d'études |
| Campus | `Campus` | select | ✅ | Contact | Campus |
| Programme souhaité | `Programme` | select | 🔀 (niveau+campus+école) | Contact | Spécialité |
| Nom enfant | `ChildLastName` | text | 🔀 (si parent) | — | — |
| Prénom enfant | `ChildFirstName` | text | 🔀 (si parent) | — | — |
| Téléphone enfant | `ChildPhone` | tel | 🔀 (si parent) | — | — |
| RGPD | `RGPDConsent` | checkbox | ✅ | Consentement | (4 canaux) |
| *(cachés communs)* | — | hidden | 🕶️ | *(voir §2)* | — |

**À la soumission :** message dans le formulaire + envoi brochure via MC.
**Écoles concernées :** EFAP, BRASSART, ESEC, CREAD, ICART, MOPA, École Bleue, IFA Paris, EFJ, 3WA, EDH.

---

### 3.2 JPO — `form-jpo`

**Métier :** inscription à une **Journée Portes Ouvertes**. Le choix du campus
affiche un encart **date + horaires + adresse + heure de conférence** (objet
`jpoEvents`). Un paramètre d'URL peut pré-sélectionner le campus depuis un CTA.

| Champ | `name` | Type | Statut | Objet CRM | Champ CRM |
|---|---|---|---|---|---|
| Campus | `Campus` | select | ✅ | Contact | Campus |
| Encart « Prochaine JPO » | `EventDate` (caché) | hidden | auto | Événement | Date |
| Type d'événement | `TypeEvenement` = `JPO` | hidden | 🕶️ | Événement | Type |
| Vous êtes | `VousEtes` | select | ✅ | Contact | Type |
| Nom / Prénom | `LastName` / `FirstName` | text | ✅ | Contact + Membre campagne | Nom / Prénom |
| Adresse mail | `EmailAddress` | email | ✅ | Contact | Adresse mail |
| Indicatif + Téléphone | `MobilePhone` | tel | ✅ | Contact | Indicatif / Téléphone |
| Niveau d'études | `StudyLevel` | select | ✅ | Contact | Niveau d'études |
| Programme souhaité | `Programme` | select | 🔀 | Contact | Spécialité |
| Nom / Prénom / Tél enfant | `ChildLastName`/`ChildFirstName`/`ChildPhone` | text/tel | 🔀 (si parent) | — | — |
| RGPD | `RGPDConsent` | checkbox | ✅ | Consentement | (4 canaux) |
| *(cachés communs)* | — | hidden | 🕶️ | *(voir §2)* | — |

**À la soumission :** message de confirmation + mail d'inscription (MC).
**Objets CRM :** Contact, Intérêt académique, Consentement, **Événement**, **Campagne**.

---

### 3.3 Atelier découverte — `form-atelier`

**Métier :** inscription à un **atelier découverte** (même moteur que la JPO,
`TypeEvenement=Atelier_Decouverte`, encart Nom AD + date + horaires + adresse).

**Différence vs JPO (conforme Excel) :** ❌ pas de « Vous êtes », ❌ pas de champs enfant.

| Champ | `name` | Type | Statut |
|---|---|---|---|
| Campus | `Campus` | select | ✅ |
| Encart « Prochain AD » + `EventDate` | hidden | auto | |
| Nom / Prénom | `LastName` / `FirstName` | text | ✅ |
| Adresse mail | `EmailAddress` | email | ✅ |
| Indicatif + Téléphone | `MobilePhone` | tel | ✅ |
| Niveau d'études | `StudyLevel` | select | ✅ |
| Programme souhaité | `Programme` | select | 🔀 |
| RGPD | `RGPDConsent` | checkbox | ✅ |

**Objets CRM :** Compte personnel, Intérêt académique, Consentement, Événement/Campagne.

---

### 3.4 Inscription stage — `form-stage`

**Métier :** inscription à un **stage découverte** (`TypeEvenement=Stage`).
Structure identique à l'Atelier. **Écoles concernées : 4** (BRASSART, CREAD, MOPA, École Bleue).

Champs : Campus, encart événement, Nom/Prénom, Email, Indicatif+Tél, Niveau,
Programme 🔀, RGPD. (Pas de « Vous êtes », pas d'enfant.)

**Objets CRM :** identiques à l'Atelier.

---

### 3.5 Demande immersion — `form-immersion`

**Métier :** le prospect demande à **vivre une journée d'immersion**. Pas
d'événement daté → **demande de rappel** : accusé de réception puis contact
téléphonique par le responsable développement (règle métier #2).

| Champ | `name` | Type | Statut | Objet CRM | Champ CRM |
|---|---|---|---|---|---|
| Nom / Prénom | `LastName` / `FirstName` | text | ✅ | Compte personnel + Campagne | Nom / Prénom |
| Adresse mail | `EmailAddress` | email | ✅ | Compte personnel | Adresse mail |
| Indicatif + Téléphone | `MobilePhone` | tel | ✅ | Compte personnel | Indicatif / Téléphone |
| Niveau d'études | `StudyLevel` | select | ✅ | Compte personnel | Niveau d'études |
| Campus | `Campus` | select | ✅ | Intérêt académique | Campus |
| Programme souhaité | `Programme` | select | 🔀 | Intérêt académique | Spécialité |
| RGPD | `RGPDConsent` | checkbox | ✅ | Consentement | (4 canaux) |
| *(cachés communs)* | — | hidden | 🕶️ | *(voir §2)* | — |

**À la soumission :** message de confirmation + mail d'accusé de réception + notification resp. dev.
**Écoles concernées :** BRASSART, ESEC, CREAD, MOPA, École Bleue, 3WA, IFA Paris.

---

### 3.6 Candidature — `form-candidature`

**Métier :** dépôt de **candidature** ; le candidat reçoit un e-mail pour
**activer son compte sur le portail candidature**. Commun **FR + International**.

| Champ | `name` | Type | Statut | Objet CRM | Champ CRM |
|---|---|---|---|---|---|
| Nom / Prénom | `LastName` / `FirstName` | text | ✅ | Compte personnel + Campagne | Nom / Prénom |
| Pays de résidence | `Country` | select | ✅ | Compte personnel | Pays de résidence |
| Adresse mail | `EmailAddress` | email | ✅ | Compte personnel | Adresse mail |
| Indicatif + Téléphone | `MobilePhone` | tel | ✅ | Compte personnel | Indicatif / Téléphone |
| Niveau d'études | `StudyLevel` | select | ✅ | Compte personnel | Niveau d'études |
| Campus | `Campus` | select | ✅ | Intérêt académique | Campus |
| Programme souhaité | `Programme` | select | 🔀 | Candidature | PTAT |
| Langue souhaitée | `LangueSouhaitee` | hidden | 🕶️ (défaut fr IFA) | Intérêt académique | Langue d'enseignement |
| RGPD | `RGPDConsent` | checkbox | ✅ | Consentement | (4 canaux) |
| *(cachés communs)* | — | hidden | 🕶️ | *(voir §2)* | — |

> ⚠️ Pas de champ **Nationalité** (conforme au fichier détaillé).
> `Rentrée générale` = poussée par Flow Builder (pas dans le formulaire).

**À la soumission :** message « consultez votre mail » + mail d'activation portail.
**Objets CRM :** Compte personnel, **Candidature**, Intérêt académique, Consentement.

---

## 4. Champ conditionnel « Programme souhaité »

Piloté par [shared/programme-config.js](shared/programme-config.js) :

- **Affiché uniquement** pour certaines écoles → `isProgrammeSchool(school)`
  (BRASSART, IFA Paris, MOPA, CREAD, EFAP). En mode builder (sans école), affiché
  dès qu'un niveau propose des programmes.
- **Valeurs dépendantes** du **niveau d'études + campus** →
  `getProgrammes(niveau, campus, lang)`.

Pour brancher les vrais programmes : remplacer `PROGRAMMES_DEFAULT` /
`PROGRAMMES_BY_CAMPUS` par les données réelles (ou un appel API).

---

## 5. Où vont les données aujourd'hui (MODE TEST)

Actuellement, **aucune donnée n'est envoyée à un serveur**. Le flux à la
soumission est :

```
submit
  → validation (email, téléphone, champs requis)
  → collecte : const data = {}; new FormData(form).forEach(...)
  → normalisation téléphone (indicatif + numéro → +33…)
  → calcul des opt-in (HasOptedInEmail/SMS/WhatsApp/Phone)
  → SIMULATION : new Promise(r => setTimeout(() => r({ ok:true }), 1000))
  → affichage du message de confirmation
```

L'objet `data` contient **tous les champs** (visibles + cachés + calculés),
prêts à être envoyés.

---

## 6. Comment connecter les champs à un objet CRM

### Étape 1 — Remplacer la simulation par un vrai envoi

Dans chaque formulaire, il y a **un seul endroit** à modifier : la promesse
simulée dans le handler `submit`.

**Avant (mode test) :**
```js
new Promise(resolve => setTimeout(() => resolve({ ok: true }), 1000))
    .then(res => { /* affichage confirmation */ });
```

**Après (envoi réel) :**
```js
fetch('/api/forms/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formName: data.NomFormulaire, data })
})
.then(r => r.json())
.then(res => { /* même affichage de confirmation */ })
.catch(() => { /* réafficher le bouton + message d'erreur */ });
```

> Pour `form-jpo`, ce point est centralisé dans la fonction `handleSubmit(data)` :
> il suffit d'y mettre le `fetch` une seule fois pour JPO + Atelier + Stage.

### Étape 2 — Créer l'endpoint serveur

Dans [../../server.js](../../server.js) ou [../../api/router.js](../../api/router.js),
ajouter une route `POST /api/forms/submit` qui :

1. reçoit `{ formName, data }` ;
2. applique le **mapping** vers les objets CRM (étape 3) ;
3. appelle l'API Salesforce (et/ou Marketing Cloud) ;
4. renvoie `{ ok: true }`.

### Étape 3 — Table de mapping (formulaire → Salesforce)

Créer un dictionnaire par formulaire, ex. :

```js
// mapping.js (côté serveur)
const FIELD_MAP = {
  // name HTML → { object, field }
  LastName:     { object: 'Contact',            field: 'LastName' },
  FirstName:    { object: 'Contact',            field: 'FirstName' },
  EmailAddress: { object: 'Contact',            field: 'Email' },
  MobilePhone:  { object: 'Contact',            field: 'MobilePhone' },
  StudyLevel:   { object: 'Contact',            field: 'Niveau_etudes__c' },
  Campus:       { object: 'Interet_academique', field: 'Campus__c' },
  Programme:    { object: 'Interet_academique', field: 'Specialite__c' },
  Country:      { object: 'Contact',            field: 'Pays_residence__c' },
  Marque:       { object: 'Contact',            field: 'Ecole__c' },
  LangueSouhaitee: { object: 'Interet_academique', field: 'Langue_enseignement__c' },
  // utm_*, gclid, fbclid, clientId → Membre_de_campagne / Contact
  // RGPDConsent + HasOptedIn* → 4 records Consentement (optin)
};
```

> Les `value` des menus déroulants sont **déjà les noms d'API Salesforce**
> (voir [shared/picklist-config.js](shared/picklist-config.js)), donc pas de
> conversion de valeurs à prévoir côté picklists.

### Étape 4 — Objets CRM à créer / mettre à jour (par soumission)

D'après l'Excel :

1. **Compte personnel / Contact** — identité (Nom, Prénom, Email, Téléphone, Pays, Niveau).
2. **Intérêt académique** — Campus + Programme + Langue.
   - Règle #3 : si un intérêt académique correspondant (école, campus, programme,
     rentrée) existe → mise à jour, sinon création. **Géré par Flow Builder.**
3. **Consentement** — **4 records** (Email, SMS, WhatsApp, Téléphone), statut
   `optin`, date d'optin, source = formulaire, détail source = nom du formulaire,
   texte légal accepté, statut RGPD = actif marketing.
4. **Campagne / Membre de campagne** — rattachement + tracking (utm_*, gclid…).
5. **Événement** (JPO / Atelier / Stage uniquement) — date de l'événement.
6. **Candidature** (Candidature uniquement) — programme + rentrée (PTAT).

### Étape 5 — Actions post-soumission (Marketing Cloud)

| Formulaire | Action attendue |
|---|---|
| Brochure | Envoi de la/des brochure(s) par mail (MC) |
| JPO / Atelier / Stage | Mail de confirmation d'inscription (MC) |
| Demande immersion | Mail d'accusé de réception + notification resp. dev |
| Candidature | Mail d'activation du compte portail candidature |

### Étape 6 — RGPD centralisé

Le texte et le lien RGPD proviennent de
[shared/rgpd-config.js](shared/rgpd-config.js) (`fetchRgpdConfig(lang, schoolId)`).
Pour une source réelle (API / DE SFMC), remplacer le corps de cette fonction :
tous les formulaires en bénéficient automatiquement.

---

## 7. Résumé du parcours d'un champ

```
[Utilisateur saisit]  ou  [auto-rempli: URL / cookie / contexte école]
        │
        ▼
name="..." dans le <form>            ← défini dans buildContent/buildBlock
        │  (validation email/tel + conditions d'affichage)
        ▼
FormData → objet `data` (submit)     ← + MobilePhone normalisé + HasOptedIn*
        │
        ▼
POST /api/forms/submit  (à brancher) ← étape 1 & 2
        │
        ▼
Mapping name → { objet, champ }      ← étape 3
        │
        ▼
Salesforce (Contact, Intérêt acad., Consentement, Campagne, Événement/Candidature)
        │
        ▼
Marketing Cloud (mail) + Flow Builder (rentrée, intérêt académique)  ← étape 5
```
