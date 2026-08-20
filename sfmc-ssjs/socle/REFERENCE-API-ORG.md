# Noms d'API réels de l'org — relevés le 2026-08-16

Source : sonde AMPscript sur `cloud.groupe-edh.net/test-forms-recette`, modes
`?champs=` et `?obj=`, contre la sandbox `00DAW00000NfjE32AJ`.

**Ce ne sont plus des hypothèses.** Chaque nom ci-dessous a été lu dans
`EntityParticle` ou confirmé par un retrieve qui a abouti. Les mentions
« À CONFIRMER » du socle sont levées, sauf indication contraire.

---

## Objets — noms validés

| Objet | Lignes | Note |
|---|---|---|
| `Account` | — | 271 champs |
| `LearningProgram` | ✅ | 45 champs |
| `ProgramTermApplnTimeline` | ✅ | 43 champs |
| `AcademicTerm` | ✅ | |
| `SchoolCampusAssociation__c` | ✅ | |
| `EntityParticle` · `PicklistValueInfo` | ✅ | **les value sets sont lisibles** |
| `summit__Summit_Events_Instance__c` | 169 | ⛔ pas `summit__Instance__c` |
| `summit__Summit_Events_Registration__c` | 1210 | ⛔ pas `summit__Registration__c` |
| `summit__Summit_Events_Appointment_Type__c` | 228 | **catalogue** des ateliers |
| `summit__Summit_Events_Appointments__c` | 0 | ateliers **choisis** — vide en sandbox |

⛔ `summit__Instance__c` renvoie `INVALID_TYPE`. Le package préfixe
`summit__Summit_Events_*__c`.

---

## Corrections appliquées au socle

### `LearningProgram` — 3 erreurs sur 5

| Socle (avant) | Réel | Nature |
|---|---|---|
| `Campus__c` | **`campusNameFor__c`** | le champ n'existait pas ; le réel est un **libellé**, pas un Id |
| `Academic_Level__c` | **`AcademicLevel`** / `Academic_Level_List__c` | n'existait pas ; voir ci-dessous |
| `Instructionlanguage__c` | **`InstructionLanguage__c`** | casse — SFMC est sensible à la casse |
| `Speciality__c` | `Speciality__c` | ✅ correct |
| `Rhythm__c` | `Rhythm__c` | ✅ correct |

> **Niveau : deux champs, et le bon n'est pas l'évident.** `AcademicLevel` est le
> picklist standard (une valeur). `Academic_Level_List__c` est un **multipicklist** :
> un programme peut viser plusieurs niveaux. C'est lui qui doit servir au filtrage —
> sinon un programme `bac+3;bac+4` ne remonte sur aucun des deux.

### `ProgramTermApplnTimeline`

| Socle (avant) | Réel |
|---|---|
| `SchoolId` | **`SchoolId__c`** (texte, pas un lookup) |
| `LearningProgramId` · `AcademicTermId` | ✅ corrects |

**Deux champs que le socle ignorait, et qui portent des règles métier :**

- `VisibleOnWebsite__c` (boolean) — un PTAT non publié ne doit pas alimenter le
  formulaire. Aucun filtre de ce type n'existait.
- `MidYearIntake__c` (boolean) — c'est la **« rentrée décalée »** de la matrice par
  école (EFAP, ICART), jusqu'ici sans équivalent technique identifié.

### `summit__Summit_Events_Instance__c`

| Socle (avant) | Réel |
|---|---|
| `summit__Campus__c` | **`Campus__c`** — sans préfixe, et c'est un **lookup** (Id). Libellé : `campusNameFor__c` |
| `summit__Start_Date__c` | **`summit__Instance_Start_Date__c`** |
| `summit__Address__c` | **`summit__Location_Address_Override__c`** |
| `summit__Event_Type__c` | ✅ correct |

Aussi disponibles : `summit__Instance_Start_Time__c`, `summit__Instance_End_Date__c`,
`summit__Instance_Title__c`, `summit__Open_Registration__c`,
`summit__Registration_Close_Date__c`, `summit__Current_Available_Capacity__c`,
et `summit__Event__c` (lookup vers l'Événement parent).

### Ateliers — erreur de **modèle**, pas de nommage

C'est la correction la plus lourde. Le socle lisait `summit__Appointment__c`
filtré sur une Instance, avec un drapeau `summit__Is_Required__c`. Aucun des
trois n'existe. Le modèle réel :

```
Événement  (summit__Summit_Events__c)
   │
   ├── Instance          summit__Summit_Events_Instance__c
   │      └── summit__Event__c ──> Événement
   │
   ├── CATALOGUE         summit__Summit_Events_Appointment_Type__c
   │      ├── summit__Summit_Events__c            ──> Événement
   │      ├── summit__Restrict_To_Instance_Title__c ──> Instance (facultatif)
   │      └── summit__Required_Appointment__c      ← le vrai drapeau « obligatoire »
   │
   └── Registration      summit__Summit_Events_Registration__c
          └── CHOISIS    summit__Summit_Events_Appointments__c
                 └── summit__Event_Registration__c ──> Registration
```

Deux conséquences :

1. **Le catalogue est porté par l'ÉVÉNEMENT, pas par l'instance.** Pour les
   ateliers d'une journée : instance → `summit__Event__c` → types de l'événement,
   puis ne garder que ceux dont `summit__Restrict_To_Instance_Title__c` est vide
   ou vaut l'instance courante. C'est ce que fait désormais
   `SocleRead.getAppointmentOptions()`.
2. **`summit__Summit_Events_Appointments__c` est une donnée d'écriture**, pas un
   référentiel : l'atelier *choisi* par un inscrit, rattaché à sa Registration
   via `summit__Event_Registration__c`. Il n'a aucun lien vers l'Instance.

L'ancienne lecture ne remontait rien — et n'aurait jamais pu.

### `summit__Summit_Events_Registration__c`

| Socle (avant) | Réel |
|---|---|
| `externalId__c` · `actionNameStatus__c` · `summit__Status__c` · `summit__Contact__c` · `summit__Event_Instance__c` · `actionIdOscar__c` | ✅ tous corrects |
| `UTM_Source__c` … `UTM_Id__c` | ⛔ **absents** → `summit__utm_source__c` … `summit__utm_id__c` (minuscules, préfixés) |
| `Client_ID__c` | ⛔ **absent** — aucune cible pour le ClientID sur cet objet |
| `AcquisitionChannel__c` · `AcquisitionSubChannel__c` | ✅ corrects |

Le tracking de la Registration ne suit donc **pas** le nommage du CampaignMember,
contrairement à ce que supposait le socle. Ces écritures échouaient en silence.

### `Account` — aucune correction

Les 22 champs attendus existent tous, **y compris** ceux que le document de
cadrage donnait comme « à créer côté SF » :

- `Application_Requested__c` (boolean) ✅ **existe**
- `PTAT_Id__c` (texte) ✅ **existe**

Également confirmés : les 4 picklists (`Academic_Level_List__c`,
`LivingCountry__c`, `IndicatifPick__c`, `PersonAccountType__c`), `Ecole__c`
(lookup), `MobileNumber__c`, `Brands_Cities__c`, les 6 `UTM*__c` sans underscore,
`gclid__c` / `fbclid__c` (textarea), `ClientID__c`, et les interdits d'écriture
(`Scoring__c`, `SourceCreation__c`, `Academic_Level_Historical__c`).

---

---

## Données réelles — relevées le 2026-08-16 (`?rows=`)

Connaître le nom d'un champ ne suffit pas : il faut voir ce qu'il **contient**.

| Champ | Valeur réelle | Conséquence |
|---|---|---|
| `LearningProgram.campusNameFor__c` | `"EFAP PARIS"` | école **et** ville accolées — pas seulement la ville |
| `LearningProgram.Academic_Level_List__c` | `"Bac+3"` · `"Terminale;Bac obtenu"` | **multipicklist**, séparateur `;` |
| `LearningProgram.AcademicLevel` | `1` `2` `3` `4` `5` | **ordinal**, pas un libellé — inutilisable à l'affichage |
| `PTAT.SchoolId__c` | `001AW00001r8WLgYAM` | Id d'`Account`, pas un code école |
| ↳ cet Account | `"BRASSART AIX-EN-PROVENCE"` | c'est un **campus**, pas une école |

### Couverture

| Mesure | Résultat |
|---|---|
| `LearningProgram` avec `campusNameFor__c` rempli | **533 / 576** |
| `LearningProgram` avec `Academic_Level_List__c` rempli | **496 / 576** |
| `ProgramTermApplnTimeline` avec `VisibleOnWebsite__c = true` | **0 / 509** ⛔ |

> ⚠ **Piège d'échantillonnage.** Un premier relevé sans filtre semblait montrer ces
> champs vides. C'était faux : le début de table ne contient que des enregistrements
> de test (`TEST Z4-5`, `[DEMO] …`). Toujours filtrer avant de conclure à l'absence
> de données — d'où le paramètre `&w=&op=&val=` de la sonde.

### Le multipicklist n'est pas un détail de format

`Academic_Level_List__c` vaut parfois `"Terminale;Bac obtenu"` : un programme ouvert
à deux niveaux. Avec une comparaison stricte — ce que faisait le socle — ce programme
ne remontait sous **aucun** des deux, et un candidat en Terminale ne le voyait jamais.
Pire, l'option affichée aurait été la chaîne entière, inchoisissable.

Corrigé aux deux endroits qui filtrent :
`SocleRead.matchMulti()` / `distinctMulti()` côté serveur, `contient()` / `distinct()`
côté navigateur dans `picklist-handler.ssjs`.

### `VisibleOnWebsite__c` : ne pas l'activer en recette

Zéro PTAT publié sur 509. Filtrer dessus viderait entièrement le formulaire. Le champ
porte une vraie règle métier et devra servir en production — mais il doit rester
**désactivable par configuration** tant que la recette n'est pas alimentée.

---

## Reste ouvert

- **La langue d'exécution.** Ces corrections portent sur du SSJS, qui **ne peut pas
  lire Salesforce depuis une CloudPage** sur cette org (voir
  `../diagnostic/README.md`). Les noms sont bons quel que soit le langage, mais la
  couche de lecture reste à porter en AMPscript.
- **Ateliers non testables** : `summit__Summit_Events_Appointments__c` est vide en
  sandbox. Le nom est validé, le comportement ne l'est pas.
- **Filtre campus** : `campusNameFor__c` est un libellé. Vérifier qu'il correspond
  exactement aux valeurs `Campus` du formulaire, sinon prévoir une normalisation.
- **`?ls=` ne fonctionne pas** : `RetrieveSalesforceObjects` n'honore pas
  l'opérateur `like` sur `EntityDefinition` — il rend 0 ligne **au lieu d'une
  erreur**. Ne jamais conclure d'un `?ls=` vide qu'un objet n'existe pas.
