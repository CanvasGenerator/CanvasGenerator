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
| `summit__Event_Type__c` | ⛔ **existe mais VIDE sur les 55 instances** → le champ alimenté est **`eventType__c`** (custom EDH). Filtrer sur le premier ne remonte aucune date, sans erreur. |

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

## Value sets Account — valeurs exactes (2026-08-21)

Relevees par comptage sur les comptes existants : une valeur deja stockee est
necessairement valide. Toute autre valeur est **ignoree en silence** par
Salesforce a l'ecriture — aucune erreur, le champ reste simplement vide.

| Champ | Valeurs confirmees | Piege |
|---|---|---|
| `IndicatifPick__c` | `33` (6285 comptes) | ⛔ `+33` n'existe pas |
| `Academic_Level_List__c` | `BAC+3` (266) · `Terminale` (254) · `BAC+1` (219) · `BAC obtenu ou Prépa` (191) · `BAC+2` (177) · `Collège` (23) · `Seconde` (23) | **majuscules**, accents inclus |
| `PersonAccountType__c` | `Student` (786) · `EDH Student` (522) · `Career Change` (247) · `Parent` (194) | — |
| `LivingCountry__c` | `France` (1073) · `Afghanistan` (100) | ⛔ `Maroc` n'existe pas |

> ⚠ **Deux conventions de casse coexistent.** `LearningProgram.Academic_Level_List__c`
> vaut `Bac+3` (minuscules), `Account.Academic_Level_List__c` vaut `BAC+3`
> (majuscules). La cascade lit le premier et ecrit dans le second : sans
> normalisation, le niveau choisi par le candidat ne s'ecrira jamais.
> Le cas `Bac obtenu` est moins grave que je l'ai ecrit d'abord : cote compte la
> valeur existe, sous le libelle `BAC obtenu ou Prépa` (191 comptes, releve le
> 2026-08-23). C'est donc un mapping de libelle, pas une valeur absente.
> Point a arbitrer, non traite dans le code.

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

---

## Ecriture : ce qui passe et ce qui ne passe pas

Releve le 2026-08-23 par bissection depuis une CloudPage, un objet et un champ
a la fois. AMPscript ne rend aucun message d'erreur : la page meurt, point.
La methode est donc toujours la meme — un appel par variante, et l'absence de
la ligne de succes EST le resultat.

| Operation | Etat | Ce qu'il faut savoir |
|---|---|---|
| Update `Account`, champs custom et identite | ✅ | `FirstName` passe sur Account ET sur Contact |
| Update `Contact` | ✅ | |
| Creation `Account` entreprise | ✅ | `Name` seul suffit |
| Creation **Person Account** | ✅ | jeu de champs impose, voir ci-dessous |
| Creation `CampaignMember` | ✅ | `CampaignId` + `ContactId` |
| Creation `ContactPointConsent` | ✅ | `ContactPointId` + `Channel__c` obligatoires |
| Creation `ContactPointEmail` | ⛔ | bloque le consentement des nouveaux prospects |
| Creation `summit__Summit_Events_Instance__c` | ✅ | |
| Creation `Task` | ✅ | temoin hors package |
| Creation `summit__Summit_Events_Registration__c` | ⛔ | cause inconnue, 5 variantes |
| Creation `summit__Summit_Events_Appointment_Type__c` | ⛔ | |
| Creation `summit__Summit_Events__c` | ⛔ | |

### Person Account : les validation rules dictent le payload

Les noms viennent des journaux Apex, pas d'une supposition.

`VR_PersonAccount_NameMandatory`
: exige `FirstName` ET `LastName` ET un moyen de contact (`PersonEmail`,
  `Invalid_Email__c`, `PersonMobilePhone` ou `Phone`).
  **`FirstName` est donc obligatoire** — le formulaire doit le rendre requis.

`VR_PersonAccount_PreferredLanguageRequir`
: exige `PreferredLangage__c` des que `LivingCountry__c` n'est pas `France`.
  Exemptions : `SourceCreation__c` a `Import` ou `API`.
  Seule valeur relevee : **`French`** — `Francais` n'existe pas.

`VR_PersonAccount_FormTypeRestricted`
: des que `FormType__c` est rempli, `SourceCreation__c` DOIT valoir `Web Form`.

`FormType__c` : `Demande de doc`, `Forum`, `Guide métier` passent.
**`Formulaire de Candidature` est REFUSE** — une regle supplementaire, non
identifiee, s'applique aux candidatures.

Jeu minimal verifie (crees : `001AW00001yrOtxYAE`, `001AW00001yrOIrYAM`) :

```
RecordTypeId, SourceCreation__c = "Web Form",
LastName, FirstName, PersonEmail,
LivingCountry__c = "France"   (ou PreferredLangage__c = "French" hors France)
```

> ⚠ **Un seul appel, tous les champs ensemble.** Les validation rules
> reevaluent l'enregistrement ENTIER a chaque ecriture. Un compte cree
> incomplet puis complete champ par champ echoue a la premiere completion.
> C'est aussi pourquoi un compte existant aux donnees invalides refuse TOUTE
> ecriture, meme celle qui le reparerait : `001AW00001ihDOvYAM` a `FirstName`
> vide et aucune langue, donc les deux regles echouent, et corriger l'un exige
> l'autre. Ce compte est irreparable par notre code — a ecarter des jeux de test.

### ContactPointConsent : le modele n'est pas celui du cadrage

`ParentId` **n'existe pas** sur cet objet. Le consentement se rattache a un
POINT DE CONTACT, pas au compte.

| Champ | Role |
|---|---|
| `ContactPointId` | vers `ContactPointEmail` ou `ContactPointPhone` |
| `Channel__c` | **requis** — sans lui la creation echoue quoi qu'il arrive |
| `PrivacyConsentStatus` | `OptIn` |
| `Status__c` | `Opt-in` — graphie differente, les deux sont remplis en base |
| `DataUsePurposeId` | vide sur les 2461 consentements existants, inutile |

> ⚠ Un Person Account fraichement cree n'a AUCUN point de contact, et leur
> creation echoue. Le consentement est donc impossible pour un nouveau
> prospect. A remonter au CRM.

### summit Registration : ca marche

**RESOLU le 2026-08-23.** L'insert fonctionne : 7 inscriptions creees sur
8 instances testees (`a0AAW00000CuXAT2A3` et suivantes).

Ce n'etait ni les droits, ni le trigger manage, ni un champ manquant. Une SEULE
instance refuse toute inscription : `a07AW00001LE2CiYAL` (`S-010963`, JPO EFAP du
26/09/2026). Or c'est celle que j'utilisais comme valeur par defaut dans tous mes
tests. Quinze combinaisons de champs ont donc echoue pour une raison qui n'avait
rien a voir avec les champs.

Verifie : l'echec ne depend pas du contact (Eric et Bob echouent tous deux sur
cette instance), et ce n'est pas un doublon (le meme contact s'inscrit DEUX fois
de suite sans probleme sur `a07AW00001LE2CjYAL`). Sa configuration est pourtant
identique a celle d'une instance qui marche : meme capacite, meme
`Capacity_Control`, `Open_Registration` vrai, non privee. Cause non identifiee,
et sans importance : c'est une instance de test.

> **Lecon, la deuxieme fois.** Le meme piege qu'avec le compte
> `001AW00001ihDOvYAM` : conclure sur un OBJET a partir d'un SEUL
> enregistrement. Quand une ecriture echoue, changer d'enregistrement AVANT de
> changer de champ. C'est une minute de test contre plusieurs jours d'enquete.

### Ce qu'il faut envoyer

Verifie a l'insert :

```
summit__Event_Instance__c   requis, seul champ rempli sur les 1212 existants
summit__Event__c            l'Event porteur de l'instance
summit__Contact__c          optionnel — EVR-033398 existe sans contact
```

| Piege | Detail |
|---|---|
| `Name` | **numero automatique** (`EVR-033367`) : ne jamais l'envoyer |
| `externalId__c` | vide sur les 1212 existants. Le socle s'en sert comme cle d'idempotence : a revoir, ce n'est pas la cle du package |
| RecordType | **aucun** sur cet objet |
| la plupart des champs remplis | des **formules** — ne pas chercher a les ecrire |

### Le lien vers l'evenement change de nom selon l'objet

Piege coute une page morte a chaque fois, sans message :

| Objet | Champ vers l'Event |
|---|---|
| `summit__Summit_Events_Instance__c` | `summit__Event__c` |
| `summit__Summit_Events_Registration__c` | `summit__Event__c` |
| `summit__Summit_Events_Appointment_Type__c` | ⚠ **`summit__Summit_Events__c`** |

### Sequence evenementielle : validee de bout en bout

Le 2026-08-23, sur trois evenements differents :

```
Account 001AW00001ysfnyYAA
  -> PersonContactId 003AW00001AoRJiYAN
  -> Registration a0AAW00000CuXgk2AF
  -> Appointment  a02AW00000OAW4BYAX
```

Les evenements sans atelier au catalogue passent aussi : l'etape est ignoree
proprement au lieu de casser la sequence.

### Idempotence : chercher sur les liaisons, pas sur externalId__c

La cle metier d'une inscription est **personne + date**. L'e-mail seul ne suffit
pas : la meme personne peut legitimement s'inscrire a plusieurs dates du meme
evenement.

Le socle cherchait cette paire dans `externalId__c`, une chaine qu'il fabriquait
lui-meme. Or ce champ est **vide sur les 1212 inscriptions de l'org** : le
package ne l'alimente pas. Mesure sur un contact reel ayant 3 inscriptions :

| Filtre | Lignes remontees |
|---|---|
| `externalId__c = "<contact>-<instance>"` | **0** ⛔ |
| `summit__Contact__c` seul | 3 |
| `summit__Contact__c` + `summit__Event_Instance__c` (A) | 2 |
| `summit__Contact__c` + `summit__Event_Instance__c` (B) | 0 |

L'ancien filtre etait donc AVEUGLE : une personne deja inscrite par le CRM ou
par le site Summit etait reinscrite en double. Et l'org accepte les doublons —
verifie, le meme contact s'inscrit deux fois de suite sans erreur. Un double-clic
suffisait a compter deux inscrits.

`externalId__c` reste ecrit a la creation, pour tracer ce qui vient de nous.
Il n'est plus la cle.
