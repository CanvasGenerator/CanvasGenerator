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
`Formulaire de Candidature` est refuse par l'org — sans consequence : le tableau
des formulaires ne prevoit ce champ cache QUE pour le telechargement de
brochure. Le socle ne l'envoie donc que dans ce cas, avec `Demande de doc`,
la valeur de l'org correspondant au libelle « telechargement » du cadrage.

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

### Candidature : partir des PTAT, pas des programmes

Le cadrage de la candidature part des **sessions de candidature** (PTAT) et en
deduit les programmes. Le socle faisait l'inverse.

Le filtrage progressif de la cascade (Specialite restreint Rythme, qui restreint
Langue) elimine les COMBINAISONS impossibles entre champs. Il ne peut PAS
ecarter un programme qui n'a AUCUNE session ouverte : ce n'est pas une condition
entre champs, c'est une propriete du programme.

Mesure sur EFAP, avant / apres :

| Formulaire | Programmes exposes | Dont sans session |
|---|---|---|
| brochure | 172 | 49 |
| **candidature** | **123** | **0** |

Un candidat pouvait donc choisir une combinaison valide en apparence, puis
trouver Rentree vide et Programme vide — une impasse sans explication.

La restriction ne s'applique qu'a la candidature : la brochure doit montrer tout
le catalogue, on y demande une documentation, pas une session ouverte. Les 10
campus restent presents dans les deux cas.

Effet de bord positif : les PTAT sont lus UNE fois au lieu de deux.

### Regles de blocage candidature : actives

`IndividualApplication` existe (123 champs, 285 candidatures). Trois des quatre
noms venus du cadrage sont bons :

| Nom du cadrage | Realite |
|---|---|
| `ContactId` | ✅ |
| `ProgramTermApplnTimelineId` | ✅ |
| `Status` | ✅ |
| `AcademicYear__c` | ⛔ **n'existe pas sur cet objet** |

L'annee vit sur le **PTAT** (`PTAT-0000013 - ... - 2026`). Le critere « meme
annee » etait donc redondant : un PTAT est deja propre a une annee. Champ
supprime, pas remplace.

Verifie sur l'org : un contact ayant une candidature sur un PTAT est bloque
(R1), un e-mail inconnu passe. La lecture ne tue pas la page, ce qui autorise
`@REGLES_ACTIVES = "true"`.

#### Ou vit le refus : PAS dans Status

Le value set de `Status`, releve le 2026-08-24, ne contient QUE des etapes
d'avancement, et aucune valeur de refus — ni active ni inactive :

> Application in Progress · Application Submitted · Application Fee Paid ·
> Initial Application Review · Interview & Jury Scheduling · Interview & Jury
> Scheduled · Secondary Application Review · Application Complete ·
> Withdrawn / Abandoned

Le refus vit dans **`FinalDecision__c`**, value set « Jury Recommendation » :

> Admitted · **Rejected** · Absent_Interview · Pending · Enrolled

Comparaison **exacte** en minuscules, pas en sous-chaine : le value set est
ferme et court.

| Cas | Verdict | Regle |
|---|---|---|
| `FinalDecision__c = Rejected` | bloque | R2, decision defavorable |
| `Status = Withdrawn / Abandoned` | **autorise** | le candidat a renonce, il peut revenir |
| candidature en cours | bloque | R1 |
| `Admitted` | bloque | R1 — message imparfait, decision correcte |
| `Absent_Interview` | bloque | R1 — un constat d'absence n'est pas une decision |

`FinalDecision__c` est vide sur les 285 candidatures de la recette : les
branches ont donc ete verifiees en simulation, la lecture du champ l'ayant ete
sur les donnees reelles.

> ⚠ Deux remarques a remonter au CRM. Les donnees portent des valeurs de
> `Status` DESACTIVEES dans le value set (`Processing`, vu sur des candidatures
> existantes) : value set remanie sans reprise. Et l'exception « abandon ne
> bloque pas » est une decision METIER prise faute d'arbitrage — a confirmer.

### Le champ `Name` : requis ici, interdit la

Deux objets voisins, deux regles OPPOSEES sur le meme nom de champ. Verifie le
2026-08-26 :

| Objet | `Name` | Consequence |
|---|---|---|
| `ContactPointEmail` / `ContactPointPhone` | calcule par Salesforce depuis l'adresse | **l'envoyer fait echouer l'insert**, meme avec la bonne valeur |
| `ContactPointConsent` | requis | **l'omettre fait echouer l'insert** |

Les deux etaient des bugs du socle : il posait `Name` sur le point de contact
(d'ou ma conclusion erronee « la creation nous est refusee ») et l'omettait sur
le consentement (d'ou l'echec de TOUS les consentements).

### Points de contact : on peut les creer

Un Person Account fraichement cree n'a AUCUN point de contact, et rien ne les
fabrique cote CRM — verifie sur `001AW00001yrTQbYAM`, cree le 23/08 : trois jours
plus tard, toujours zero. Sur un exemple ou ils existent, le point de contact a
ete cree 55 minutes apres son compte : un traitement par lot, pas un flow.

Le socle les cree donc lui-meme quand ils manquent :

```
ContactPointEmail : ParentId + EmailAddress + IsPrimary        (JAMAIS Name)
ContactPointPhone : ParentId + TelephoneNumber + IsPrimary     (JAMAIS Name)
```

Le consentement d'un nouveau prospect est ainsi enregistre comme celui d'un
prospect connu. **Le dernier point bloquant du projet est leve.**

### Champs non inscriptibles, releves par bissection

| Objet | Champ | Comportement |
|---|---|---|
| `ContactPointEmail` | `Name` | calcule — l'envoyer tue la page |
| `CampaignMemberInteraction__c` | `CampaignMemberLink__c` | tue la page ; utiliser `CampaignMemberId__c` |
| `CampaignMemberInteraction__c` | `InteractionDate__c` | tue la page ; la date est posee par Salesforce |
| `ContactPointConsent` | `GDPR_Status__c` | vide sur toute l'org, valeur inconnue — non ecrit |

> Aucun de ces refus ne donne de message. La page est simplement remplacee.
> La seule methode qui fonctionne reste la bissection : un champ a la fois.

### Interaction : un seul champ bloquait tout

`CampaignMemberInteraction__c` historise une soumission repetee, quand l'unicite
Campagne x Person Account interdit un second CampaignMember. Deux problemes.

**Le socle ecrivait un champ inexistant.** Il posait `CampaignMember__c` ; les
vrais champs sont `CampaignMemberId__c` (texte) et `CampaignMemberLink__c`
(lookup). Corrige, et le jeu de champs complete : compte, campagne, date, et les
9 champs de tracking qui existaient deja sur l'objet sans etre alimentes.

> ⚠ **Consequence : la page mourait a chaque retour d'un prospect connu.**
> Une creation refusee remplace la page entiere, et le chemin est atteint des
> qu'un CampaignMember existe deja. Panne totale, pas degradation, et invisible
> en test puisque chaque test creait un prospect neuf.

**Le champ fautif : `CampaignMemberLink__c`.** Apres correction des noms,
l'insert echouait toujours, y compris avec un seul champ texte. J'ai failli
conclure a un blocage d'objet — c'etait faux, et c'aurait ete la troisieme fois.
La bissection le designe sans ambiguite : c'est le SEUL champ dont la presence
fait echouer l'insert, quelles que soient les autres valeurs.

| Jeu de champs | Resultat |
|---|---|
| `Campaign__c` + `PersonAccount__c` | ✅ |
| + `SourceSystem__c` + `Information__c` | ✅ |
| + `CampaignMemberId__c` (texte) | ✅ |
| **+ `CampaignMemberLink__c`** | ⛔ |

Le lien vers le membre passe donc par `CampaignMemberId__c`, en TEXTE.

La paire `Campaign__c` + `PersonAccount__c` suffit a creer, et c'est exactement
ce que portent les 3 interactions preexistantes : aucun autre champ n'y est
rempli.

`@INTERACTION_ACTIVE` reste dans le code, a `"true"`. Il n'est plus un
interrupteur d'attente mais un coupe-circuit : si l'objet se remet a refuser, le
basculer evite de tuer la page a chaque soumission pendant le diagnostic.

#### Ce que la US « Interaction » change pour nous

| Evolution | Impact sur le socle |
|---|---|
| renommage en `Interaction__c` | notre appel casse au renommage |
| 4 record types par canal | il faudra envoyer celui du **Formulaire** |
| `Status__c` restreint | pour un formulaire, seule valeur `Soumis` |
| `Preview__c` (255) et `Context__c` (texte long) | a alimenter |

La US precise que le renommage doit intervenir AVANT le branchement des
connecteurs. Or nous ecrivons deja cet objet : a signaler.

#### Une interaction par soumission — arbitre

Decision du 2026-08-24 : **chaque interaction compte**. Le socle historise donc a
chaque soumission, et non seulement aux repetitions comme le prevoyait le
contrat v4 (etape 3c, « si interaction repetee »).

L'US de generalisation veut « l'historique complet des interactions quel que
soit le canal ». N'ecrire que les repetitions rendait la PREMIERE soumission
invisible : le CampaignMember la porte, mais il ne vit pas dans la meme
chronologie et ne porte pas de canal.

L'ecriture est posee APRES la resolution du CampaignMember, donc valable pour
les deux branches — membre trouve comme membre cree.

Bloc de test : `LPB_TST_Interaction`. Il porte le meme jeu de 16 champs que le
socle, plus deux creations minimales (un champ texte, un picklist) pour
distinguer un refus d'objet d'une valeur refusee. Des que le droit sera accorde,
la variante « jeu complet » doit rendre un Id : il n'y aura plus qu'a basculer
`@INTERACTION_ACTIVE` a `"true"`.

### Ecole__c : un mapping par CAMPUS, pas par ecole

`Account.Ecole__c` est un lookup vers un Account de RecordType `schoolEntity`.
La granularite reelle est le **campus** : sur les 24 comptes deja renseignes,
`Ecole__c` pointe vers « BRASSART PARIS », pas « BRASSART ». Un champ
`Campus__c` existe aussi, mais il est vide partout — non utilise.

Les comptes `schoolEntity` (81) melangent deux natures dans `EntityType__c` :
`Legal Entity` (GROUPE EDH SAS, EFAP LILLE) et `EDH School` (EFAP PARIS,
BRASSART Rennes). Ce sont les `EDH School` qu'il faut viser.

**Pourquoi une DE et pas une resolution par nom.** Le libelle envoye par la
cascade (« EFAP PARIS ») EST le `Name` du compte, et filtrer sur
`Name` + `EntityType__c` fonctionne pour les 10 campus EFAP — y compris
« EFAP LILLE », ou un homonyme `Legal Entity` existe. Mais **trois** comptes
portent le nom « BRASSART PARIS », dont **deux** marques `EDH School` : aucun
filtre ne peut trancher, et ecrire au hasard est pire que ne rien ecrire.

D'ou `LPB_Mapping_Campus`, cle = le libelle COMPLET du campus :

| Colonne | Role |
|---|---|
| `Campus` | cle, le libelle tel que la cascade l'envoie |
| `Ecole` | pour s'y retrouver, non utilise par le code |
| `SchoolAccountId` | l'Id ecrit dans `Ecole__c` |
| `Actif` | `false` = on n'ecrit rien, meme si un Id est present |
| `Commentaire` | tracage des arbitrages |

Comportement verifie le 2026-08-23 : campus mappe -> `Ecole__c` ecrit et relu
correct ; campus marque inactif ou absent de la DE -> compte cree SANS ecole,
degrade mais pas bloquant.

**Les 47 lignes sont renseignees** (releve du 2026-08-24, 10 ecoles actives).
« BRASSART PARIS » a ete arbitre sur `001AW00001r8WLqYAM`, retenu parce qu'il
porte les cursus lies ; l'homonyme `001AW00001hxKshYAE` est ecarte.

| Ecole | Prefixe | Campus | Programmes |
|---|---|---|---|
| BRASSART | `BRASSART` | 15 | 222 |
| EFAP | `EFAP` | 10 | 123 |
| CREAD | `CREAD` | 10 | 53 |
| ICART | `ICART` | 4 | 33 |
| IFA Paris | `IFA` | 1 | 13 |
| ESEC | `ESEC` | 2 | 8 |
| EFJ | `EFJ` | 2 | 6 |
| 3W Academy | `3W` | 1 | 5 |
| Ecole Bleue | `ECOLE BLEUE` | 1 | 5 |
| MOPA | `MOPA` | 1 | 4 |

Un seul prefixe etait faux : l'Ecole Bleue attendait `ECOLE BLEUE`, pas
`BLEUE`. Le socle l'avait signale lui-meme, par son commentaire HTML
« prefixe ne correspond a aucun campusNameFor__c ». C'est la methode a
reappliquer en Prod : activer l'ecole, charger la cascade, lire l'avertissement.

La comparaison se faisant en majuscules, la casse des noms est sans incidence :
`MoPA ARLES`, `3W Academy PARIS` et `BRASSART Rennes` sont correctement
resolus. Verifie a l'ecriture sur ces trois-la.

Sur les 48 campus distincts de l'org, 46 sont couverts. Les deux restants sont
`TESTS` et un doublon de casse — aucune ecole reelle.

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

## Sonde d'etat du CRM - 26 aout 2026

Deux blocs pour relever ce qui bouge dans le CRM sans relire le socle :
`LPB_TST_Sonde_Etat` (lectures groupees + sonde libre objet/champ) et
`LPB_TST_Sonde_Inter_Neuf` (essais d'ecriture sur le nouvel objet).

    ?contentkey=LPB_TST_Sonde_Etat&v=libre&o=<Objet>&f=<Champ1,Champ2>

Si la page survit, l'objet et les champs demandes existent et sont lisibles.
Si elle meurt, au moins un element est absent - retester champ par champ.

### Interaction__c est livre

Le renommage annonce par la US n'est pas un renommage : les DEUX objets
coexistent. `CampaignMemberInteraction__c` garde les donnees, `Interaction__c`
est neuf et vide, et c'est lui qui porte le modele complet.

Ses quatre record types sont actifs :

| DeveloperName | Id                 |
|---------------|--------------------|
| Chatbot       | 012AW00000AxdXRYAZ |
| Form          | 012AW00000AxdXSYAZ |
| SMS           | 012AW00000AxdXTYAZ |
| WhatsApp      | 012AW00000AxdXUYAZ |

Ecriture verifiee sur `Interaction__c`, 8 champs acceptes d'un coup :
`RecordTypeId`, `Campaign__c`, `PersonAccount__c`, `SourceSystem__c`,
`Status__c` = `Submitted`, `Information__c`, `Preview__c`, `Context__c`.
Enregistrements temoins : `a1UAW000005JamT2AS` (minimum, 4 champs) et
`a1UAW000005Japh2AC` (complet, 8 champs).

`Preview__c` et `Context__c` n'existent QUE sur le nouvel objet : les demander
sur l'ancien tue la page. C'est le meilleur marqueur pour distinguer les deux.

`CampaignMemberLink__c` existe sur les deux objets mais reste refuse a
l'ecriture sur les deux. Le socle continue de tracer le membre en texte via
`CampaignMemberId__c`.

### GDPR_Status__c a enfin des valeurs

Relevees dans les donnees : `Marketing active`, `To delete`, `To reactivate`.
Le champ etait ecarte faute de reference - une valeur inexistante est rejetee
en silence. `Marketing active` est desormais utilisable.

`Account.AccountSource` = `Advertisement` (seule valeur presente).
`Account.Nature__c` = `Private` / `Public` : concerne les etablissements,
pas les personnes. Ne pas l'ecrire depuis un formulaire.

### Ce qui n'a pas bouge

Instances d'immersion a venir : toujours 0. Le formulaire immersion reste
non testable.
Campagnes actives : 10 sur les 40 mappees.
Candidatures abandonnees : 0, donc la regle d'abandon reste non eprouvee
(les refusees, elles, sont passees a 5).

## Bascule sur Interaction__c et trois tueurs de la branche « prospect connu »

Le socle ecrit desormais dans `Interaction__c` (record type Form,
`Status__c` = `Submitted`, plus `Preview__c` et `Context__c`), et pose
`GDPR_Status__c` = `Marketing active` a la creation du consentement.
`@OBJET_INTERACTION` ramene a l'ancien objet en un mot.

Jouer une soumission complete sans formulaire :

    ?contentkey=LPB_TST_Socle_Runner&submitted=true&EmailAddress=...

⚠ `submitted` doit valoir `true`, pas `1`.

Le bilan du socle sort en commentaire HTML : le lire dans le source, pas dans
le texte de la page.

### Trois refus qui ne se voyaient jamais sur un prospect neuf

La branche « compte deja connu » n'avait jamais ete parcourue jusqu'au bout.
Elle contenait trois refus en file, chacun masquant le suivant. Un prospect
neuf ne les rencontre pas : c'est pour cela qu'ils ont survecu si longtemps.

1. `Account.LastMarketingContactPointType__c` attend un CANAL. Les seules
   valeurs sur l'org sont `Form` et `SMS` — la nomenclature des record types
   de `Interaction__c`. Le socle y ecrivait `@formType` (`brochure`,
   `candidature`...). Corrige en `Form` ; le type de formulaire reste porte par
   `CreationSourceDetail__c` et par l'interaction.

2. `Now()` BRUT est refuse sur un champ date. AMPscript rend une date
   localisee (`8/26/2026 6:04:17 AM`) ; le connecteur veut
   `yyyy-MM-dd HH:mm:ss`. Mesure avec `LPB_TST_Sonde_Date` : brut refuse,
   `yyyy-MM-dd` accepte, `yyyy-MM-dd HH:mm:ss` accepte. Concernait
   `DateOfLastMarketingContactPoint__c` et `CreationSourceDate__c`.

3. `ContactPointConsent` est CREATE-ONLY pour le connecteur. Aucun update ne
   passe : ni `PrivacyConsentStatus`, ni `Status__c`, ni
   `Legal_Texte_Accepted__c`, ni `CaptureSource`, ni `GDPR_Status__c` — et pas
   seulement sur nos enregistrements, egalement sur un consentement cree par le
   CRM. Le meme bloc accepte un update d'Account : ce n'est ni la sonde ni les
   droits generaux.

   Le socle CREE donc un enregistrement a chaque soumission, sans chercher s'il
   en existe deja un pour ce couple point de contact x canal. La lecture
   prealable a disparu : elle ne servait plus a rien et coutait un appel par
   canal et par soumission.

   Ce n'est pas un contournement mais le bon modele : un consentement est une
   trace datee, pas un etat qu'on rectifie. Une personne desabonnee qui
   re-consent produit une nouvelle trace, la plus recente faisant foi. Le
   `Name` porte l'horodatage pour que les traces successives se distinguent.
   Verifie : deux soumissions d'affilee donnent deux Ids differents par canal.

### Valeurs de picklist relevees ce jour

| Champ | Valeurs presentes |
|---|---|
| `Account.PersonAccountType__c` | Parent, Student, EDH Student, Career Change |
| `Account.Academic_Level_List__c` | Collège, Seconde, Première, Terminale, BAC obtenu ou Prépa, BAC+1 a BAC+5 et +, Autres |
| `Account.IndicatifPick__c` | **`33`**, pas `+33` |
| `Account.LivingCountry__c` | France, Spain, Italy, Morocco... en anglais |
| `Account.LastMarketingContactPointType__c` | Form, SMS |
| `ContactPointConsent.GDPR_Status__c` | Marketing active, To delete, To reactivate |

`IndicatifPick__c` = `33` est une contrainte pour les formulaires du builder :
un `+33` envoye par le champ indicatif tue la page a la creation du compte.

### Deux sondes de plus

`LPB_TST_Sonde_Valeurs` releve les valeurs distinctes reellement presentes
dans un champ (`&o=Objet&f=Champ&max=N`). Filtre sur `champ != ""`, donc
inutilisable sur un champ date — passer par `Sonde_Etat&v=libre` dans ce cas.

`LPB_TST_Sonde_Ecriture` tente UN update sur UN enregistrement
(`&o=&id=&f=&val=`). C'est ce bloc qui a montre que le refus venait de l'objet
et non du champ ni de l'enregistrement.

### Bilan des deux chemins

    prospect neuf   : CP:email-cree CP:phone-cree CPC:Email CPC:SMS CM:cree
                      INTERACTION:creee-Interaction__c
    prospect connu  : CPC:Email CPC:SMS CM:existant
                      INTERACTION:creee-Interaction__c

Le membre de campagne n'est pas duplique. Le consentement et l'interaction le
sont a chaque soumission, et c'est voulu : « chaque interaction compte », et un
consentement est une trace, pas un etat.

## 27 aout 2026 - la donnee du CRM est arrivee, deux refus de plus leves

Le responsable data a livre 5 instances Immersion, 3 candidatures temoins
(2 Rejected, 1 Withdrawn / Abandoned) et 42 types d'atelier sur 14 evenements.
Tout est LISIBLE par le connecteur : verifie un par un avec
`LPB_TST_Sonde_Valeurs`, les 5 instances repondent aux Ids du fichier, les 2
nouvelles candidatures refusees apparaissent parmi 7, et l'evenement Atelier
EFAP 26-27 porte bien ses 3 types.

Cette donnee a permis d'atteindre pour la premiere fois le bout des chemins
evenement, ou deux refus attendaient.

### summit__Status__c est en anglais

Valeurs presentes sur les 1210 inscriptions : `Registered`, `Confirmed`,
`Attended`, `No-Show`, `Started`, `Registered Present`. Le socle ecrivait
`Inscrit`, hors picklist, donc refuse — et le refus tuait la page a chaque
inscription evenement. Corrige en `Registered`.

`actionNameStatus__c` est libre en revanche : les donnees contiennent
`inscrit`, `checkin`, et meme `Test2Ewen`. `Origin` y passe.

### summit__Event__c doit etre pose a la main sur l'inscription

C'est le refus le plus couteux a trouver. Une inscription creee par le
connecteur avec seulement `summit__Event_Instance__c` s'enregistre tres bien,
mais refuse ENSUITE tout creneau d'atelier : le creneau valide le type contre
l'evenement du parent, et la comparaison echoue sur un champ vide. Le package
Summit renseigne `summit__Event__c` par trigger depuis son propre ecran ; il ne
le fait pas pour un insert du connecteur.

La bissection, parce qu'elle a ecarte trois fausses pistes :

| Essai | Resultat |
|---|---|
| notre inscription + type de son propre evenement | refuse |
| notre inscription + type d'un autre evenement | refuse |
| notre inscription sans `summit__Status__c` | refuse |
| ancienne inscription + son type | OK |
| ancienne inscription + un des 42 nouveaux types du CRM | **OK** |

Ce n'etaient donc ni les types crees par le CRM, ni l'instance, ni le statut.
La seule inscription de l'org portant un creneau (`a0AAW00000CuXgk2AF`) avait
`summit__Event__c` rempli ; toutes les notres l'avaient vide.

Le socle resout maintenant l'evenement depuis l'instance avant de creer
l'inscription. Un appel de lecture de plus, mais aucune dependance au
formulaire.

### Etat des 6 formulaires apres ces corrections

    brochure    : CP:email-cree CPC:Email CM:cree INTERACTION:creee-Interaction__c
    candidature : idem, et les 3 scenarios de regle se comportent comme prevu
                  refusee   -> statut=blocked BLOQUE:1candidature(s)
                  abandonnee-> CAND:abandon-ignore puis passage normal
                  sans passe-> creation normale
    JPO         : REG:creee(JPO) APPT:+
    atelier     : REG:creee(Atelier) APPT:+ APPT:+
    immersion   : REG:creee(Immersion)
    stage       : meme chemin que JPO

### Encore une fois le meme piege

`Inscrit` au lieu de `Registered`, comme `brochure` au lieu de `Form` la
veille : une valeur francaise ecrite dans un champ dont la picklist est en
anglais. Et `summit__Event__c` vide, comme `CampaignMember__c` inexistant :
un champ que le socle ne posait pas et dont l'absence ne se voyait qu'au
maillon suivant. La sonde de lecture avant ecriture n'est pas une precaution,
c'est la methode.

## Les 40 campagnes du mapping restent inactives - et ce n'est PAS bloquant

Releve du 27 aout : 10 campagnes actives sur l'org, 4702 inactives. AUCUNE des
10 actives n'appartient a la plage `701AW00001wNcs*` du mapping ; les deux
extremites du mapping, `701AW00001wNcsIYAS` et `701AW00001wNcsxYAC`, sont
lues a `IsActive = false`. Les 40 sont donc toujours desactivees.

⚠ Correction d'une affirmation precedente : je les avais qualifiees de
bloquantes. Elles ne le sont pas. `IsActive` n'interdit PAS la creation d'un
CampaignMember par le connecteur, et le socle ne consulte pas ce champ. Tous
les tests d'ecriture de ces deux jours se sont faits sur des campagnes
inactives, y compris la resolution automatique depuis la DE :

    Marque=efap TypeFormulaire=brochure Country=France sans CampaignId
      -> CAMP:brochure|efap|FR ... CM:cree

    Marque=icart TypeFormulaire=candidature Country=Spain sans CampaignId
      -> CAMP:candidature|icart|Intl ... CM:cree

La colonne `Actif` de `LPB_Mapping_Campagnes` est NOTRE interrupteur, sans
rapport avec `Campaign.IsActive` cote Salesforce. Les 40 lignes y sont a True,
donc le socle resout et rattache normalement.

Ce qui reste vrai : une campagne inactive ne remonte pas dans le reporting
Marketing et n'alimente pas les parcours. L'activation est un sujet
fonctionnel, pas une dependance technique de l'integration.

## 27 aout, fin de journee - tri des listes, et deux refus nouveaux

### Ordre d'affichage

Salesforce rend les valeurs de picklist dans l'ordre du value set, qui n'est ni
alphabetique ni numerique : les 201 indicatifs arrivaient en 509, 256, 379,
240... Le JS de cascade trie desormais avant de remplir le <select> :

  - `Indicatif` : tri NUMERIQUE. Un tri texte mettrait 1 avant 212 mais aussi
    33 apres 212. Resultat : 1, 7, 20, 27, 30, 31, 32, 33, 34, 36...
  - `Country` et `Campus` : tri ALPHABETIQUE avec `localeCompare(..., 'fr')`,
    pour qu'Egypte passe avant Emirats. Resultat : Afghanistan, Afrique du Sud,
    Albanie, Algerie, Allemagne, Andorre, Angleterre...
  - `StudyLevel` : PAS trie, volontairement. Son ordre est pedagogique
    (College, Seconde, Premiere, Terminale...) et l'alphabet le detruirait.

196 pays et 201 indicatifs, valeur en anglais et libelle en francais :
`Spain -> Espagne`, `Morocco -> Maroc`, `33 -> +33 (France)`. C'est la valeur
qui part au CRM, donc `LivingCountry__c` reste bien en anglais.

### BusinessBrandId est devenu refuse sur le consentement

Le champ etait envoye et accepte le matin meme ; l'apres-midi il fait echouer
l'insert, et ce refus tuait la page a CHAQUE soumission des 6 formulaires.

Bissection avec `LPB_TST_Sonde_CPC` : les 8 autres champs passent, l'ajout du
seul `BusinessBrandId` fait echouer, avec EFAP (`1BUAW0000000QNX4A2`) comme
avec BRASSART (`1BUAW0000000QNY4A2`) — deux Ids valides, lus sur l'org — et que
`GDPR_Status__c` soit present ou non. Ce n'est donc ni la valeur ni une
combinaison : c'est le champ.

Pose derriere `@ECRIRE_MARQUE_CONSENT`, a "false", plutot que supprime : le
besoin RGPD reste entier — un opt-in EFAP n'est pas un opt-in BRASSART — et la
cause est un changement d'org, pas une decision de conception. Le jour ou
`LPB_TST_Sonde_CPC` redit que le champ passe, repasser le drapeau a "true"
suffit. Branche "false" verifiee de bout en bout sur un point de contact du
26/08 : statut=success, CPC:Email cree.

### `Legal_Texte_Accepted__c` est REQUIS

Meme bissection : sans lui l'insert echoue, avec lui il passe. `@preuve` vaut au
minimum `[v1]`, donc le socle ne risque rien. A savoir si un jour on est tente
de ne l'ecrire que quand le formulaire fournit un texte.

### ⚠ NON RESOLU : consentement refuse sur les points de contact recents

Apres retrait de `BusinessBrandId`, le socle echoue TOUJOURS a la creation du
consentement. La sonde, elle, passe avec exactement les memes 8 champs. La
seule difference restante est le point de contact vise :

| ContactPointEmail | Cree le | Consentement aujourd'hui |
|---|---|---|
| `9VlAW000000IIT70AO` | 26/08 | OK |
| `9VlAW000000IOtV0AW` | 27/08 02h41 | REFUSE |
| `9VlAW000000Ia530AC` | 27/08 16h01 | REFUSE |
| `9VlAW000000IaBV0A0` | 27/08 16h06 | REFUSE |

Le plus parlant : `9VlAW000000IOtV0AW` a RECU un consentement a 02h41 sans
difficulte, et le refuse a 16h. Ce n'est donc pas un etat fige a la creation,
c'est un changement survenu cote CRM dans la journee.

Ni les champs, ni les valeurs, ni la longueur du `Name` (76 caracteres teste),
ni le tiret cadratin de `@preuve` ne sont en cause : tous verifies un par un.

A faire trancher cote CRM : quelle regle de validation, quel flow ou quelle
regle de doublon a ete deployee le 27/08 sur `ContactPointConsent`. Sans elle
les 6 formulaires sont a l'arret.

## 28 aout 2026 - dictionnaire d'affichage FR -> EN

Les valeurs de picklist du CRM sont en francais. En page anglaise, on affiche
leur equivalent anglais, sans jamais toucher a ce qui part au CRM.

### Ce qui est traduit, et ce qui ne l'est pas

TRADUIT : le texte visible de l'option, uniquement.
JAMAIS TRADUIT : la `value` de l'option. C'est la valeur Salesforce d'origine,
celle que le socle d'ecriture attend. La traduire casserait toutes les
ecritures — et le piege serait silencieux, une valeur hors picklist etant
rejetee sans message.

Mesure sur la page de controle `LPB_TST_Dico_Rendu` :

    lang=en   VousEtes    value "EDH Student"  texte "Student in a Group school"
              StudyLevel  value "Collège"      texte "Middle school"
              Indicatif   value "20"           texte "+20 (Egypt)"

    lang=fr   Country     value "South Africa" texte "Afrique du Sud"

### Pourquoi le JS choisit la langue, et pas le socle

Un Content Block ne prend PAS de parametre : `ContentBlockByKey` n'a aucun
moyen de dire au socle si la page qui l'inclut est francaise ou anglaise. Le
formulaire, lui, le sait — le builder pose `data-lang` selon la variante du
bloc. Le socle publie donc le dictionnaire dans `SOCLE_DATA.traductions`, et
le JS lit `[data-lang]` dans le DOM.

Consequence voulue : UN SEUL bloc socle sert les deux langues.

Le tri suit la meme logique : il porte sur le libelle AFFICHE et dans la locale
de la page. Une liste anglaise triee selon l'alphabet francais serait
desordonnee pour son lecteur (Afghanistan, Afrique du Sud, Albanie devient
Afghanistan, Albania, Algeria).

### La chaine d'alimentation

1. `LPB_TST_Dico_Sync` (bloc CloudPage) lit les value sets Salesforce et insere
   dans `LPB_Dico_Traductions` les libelles absents, l'anglais VIDE. Une liste
   a la fois, pour ne pas depasser le temps d'execution d'une page. Ne modifie
   JAMAIS une ligne existante : une correction manuelle n'est jamais ecrasee.
   A rejouer apres chaque changement de picklist cote CRM.

2. `node scripts/traduire-dico.js --push --mid=536010339` remplit les anglais
   manquants via le meme moteur Gemini que les landing pages. Simulation par
   defaut. `--force` retraduit tout, `--max=N` limite le volume.

3. La DE reste modifiable a la main pour corriger une traduction.

Premiere passe : 415 libelles semes (5 + 13 + 196 + 201), 279 traduits, 136
rendus inchangés par la traduction (France, Portugal... identiques dans les
deux langues) et donc non ecrits.

Campus et programmes sont volontairement hors perimetre : "EFAP PARIS" et
"Bachelor 3e annee" sont des noms propres.

### Deux limites levees en route

`lib/translate.js` n'exportait que `translateHtml`. Le front devait emballer ses
chaines dans des `<div id="tN">` pour atteindre le traducteur. `translateStrings`
est desormais exportee ; le contournement du front reste en place mais rien de
nouveau ne devrait le reprendre.

Le moteur n'avait AUCUN reessai : un lot en erreur faisait perdre les lots deja
traduits. Constate des le premier essai — Gemini a repondu « high demand » sur
415 libelles. Trois tentatives avec attente croissante ont suffi. Les erreurs de
FORME (JSON illisible, longueur incoherente) ne sont pas reessayees.

### ⚠ L'API refuse a la creation ce qu'elle accepte a la mise a jour

`LPB_TST_Dico_Rendu` a ete refuse trois fois en creation (HTTP 400, code 10006)
avec un contenu que la MISE A JOUR du meme asset a ensuite accepte sans broncher.
Contourne en creant l'asset avec un contenu trivial, puis en le mettant a jour.
A savoir pour tout bloc qui melange AMPscript, `<select>` et
`ContentBlockByKey`.

## 28 aout 2026 - l'ecole n'arrivait pas jusqu'au socle en page publiee

Les listes campus et programmes sortaient VIDES sur une landing page publiee.
Tous mes essais de lecture passaient `?Marque=efap` dans l'URL ; je ne l'avais
jamais teste sans.

### La cause

Le socle lit `RequestParameter("SchoolId")` puis `("Marque")`, c'est-a-dire la
QUERY STRING. Or un `<input type="hidden">` n'est PAS un parametre de requete
tant que le formulaire n'est pas soumis : au premier affichage — un GET sans
query string — les deux sont vides.

Le champ cache `Marque` etait vide lui aussi, pour une raison voisine : il est
rempli a l'execution depuis `window.CURRENT_SCHOOL`, une variable qui n'existe
que dans le BUILDER. En page publiee, rien ne le remplit.

Consequence en cascade : pas d'ecole -> pas de prefixe -> `LPB_Mapping_Ecoles`
ne repond pas -> aucun campus, aucun programme. Et cote ecriture, pas de
marque et pas de resolution de campagne.

### La correction

Le builder connait l'ecole au moment ou il construit le bloc
(`registerBlocks` s'execute apres le chargement de l'ecole). On la fige donc
DEUX fois dans le HTML publie :

  - `%%[ SET @LPB_ECOLE = "efap" ]%%` juste avant l'include du socle.
    Un Content Block ne prend pas de parametre, mais il PARTAGE la portee
    AMPscript de la page qui l'inclut : une variable posee avant l'include est
    lisible par le socle. C'est la troisieme source de `@school`.
  - `<input type="hidden" name="Marque" value="efap">`, pour la soumission.

⚠ Ne JAMAIS declarer `@LPB_ECOLE` par un `VAR` dans le socle : `VAR`
reinitialise, et on effacerait la valeur que la page vient de poser. Le lint
porte une liste d'exception dediee pour cette variable-la.

Mesure sur `LPB_TST_Dico_Rendu`, sans aucune query string :

    @LPB_ECOLE = "efap"   ->  ecole lue "efap", 10 campus
    @LPB_ECOLE absente    ->  ecole lue "", 0 campus, 196 pays
                              page VIVANTE, options statiques en repli

Le mode degrade est donc conserve : sans ecole, on n'ecrit rien et on ne casse
rien.

### ⚠ Les pages deja enregistrees gardent l'ancien HTML

Le correctif agit a la CONSTRUCTION du bloc. Une page sauvegardee avant
aujourd'hui porte encore `value=""` et pas de prelude : il faut y reinserer le
bloc formulaire. Piege rencontre en verifiant — la toile du builder restaure le
contenu stocke, et je lisais un bloc ancien en croyant tester le neuf.

## 28 aout 2026 - dates en boutons radio, conferences refiltrees

La regle metier demande des boutons radio pour les dates, la plus proche
presélectionnée, et l'affichage des horaires debut/fin et de l'adresse.

### Ce qui a change

`summit__Instance_End_Time__c` est desormais lu et publie sous `heureFin`. Le
champ existait, le socle ne le lisait pas.

Le JS rend les dates en BOUTONS RADIO quand le formulaire fournit un conteneur
`[data-socle="instances"]`, avec la premiere presélectionnée. Le `<select
name="InstanceId">` reste accepte en repli. Libelle d'une date :

    2026-09-10 · 09:30:00.000Z - 15:30:00.000Z · L'Hôtel, 13 rue des Beaux-Arts, 75006 Paris

### Les conferences etaient figees sur la premiere date

Le filtrage des types d'atelier se faisait cote AMPscript, contre l'instance
presélectionnée. Des que le visiteur changeait de date, la liste restait celle
de la date d'origine — fausse, et sans le moindre signe.

Le socle publie donc maintenant les types de TOUTES les instances de
l'evenement, en emportant leur restriction, et c'est le JS qui filtre. Le socle
ne peut pas savoir quelle date sera choisie ; seul le navigateur le sait.

`summit__Restrict_To_Instance_Title__c` porte l'ID de l'instance malgre son nom.
Vide = atelier propose sur toutes les dates.

Verifie : la date presélectionnée (Tours) n'a aucun atelier ; passer sur la date
dont l'Id correspond a la restriction fait apparaitre les 3, l'obligatoire coche
d'office, et remplit le champ cache `Appointments`.

Le regroupement des cases cochees est refait a CHAQUE rendu : les cases sont
recreees au changement de date, et l'ecouteur pose sur les anciennes disparait
avec elles.

### ⚠ NE JAMAIS emettre un champ Salesforce MULTILIGNE dans SOCLE_DATA

`summit__Description__c` a ete tente puis retire. Ses valeurs contiennent des
retours a la ligne, interdits dans une chaine JS entre apostrophes :
`window.SOCLE_DATA` devenait INDEFINI, tout le socle muet, aucune erreur
visible. Et AMPscript ne permet pas d'ecrire "\n" dans un litteral, donc on ne
peut meme pas les remplacer proprement.

Symptome a reconnaitre : toutes les listes vides alors que la page vit.

### Les horaires de conference : summit__Date_Available_Start__c / _End__c

⚠ J'avais conclu qu'aucun champ ne les portait. FAUX — je n'avais pas essaye
les bons noms. Ils sont sur `summit__Summit_Events_Appointment_Type__c` :

    summit__Date_Available_Start__c    2026-08-29T08:00:00.000Z
    summit__Date_Available_End__c      2026-08-29T09:00:00.000Z

Renseignes sur les 42 types crees par le CRM. Les trois conferences d'un
evenement donnent 08:00-09:00, 09:30-10:30, 12:00-12:30.

Publies sous `debut` et `fin`, affiches a cote du titre, et les ateliers sont
tries PAR HORAIRE — c'est l'ordre du deroule de la journee, celui qu'un
visiteur attend. `summit__Sort_Order__c` ne prend le relais que si les horaires
manquent.

Deux formats a absorber a l'affichage : les creneaux de conference sont des
DATE-HEURES, les horaires d'instance de simples HEURES
(`09:30:00.000Z`, sans `T`). `heureSeule()` gere les deux.

### Campus__c, pas campusNameFor__c

`campusNameFor__c` est vide sur 30 des 34 instances JPO. Le socle filtrait les
instances sur ce champ : consequence mesuree, AUCUNE date des qu'une ecole etait
posee — et en production l'ecole l'est toujours.

Le bon champ est `Campus__c` : un LOOKUP vers un Account de type ecole EDH,
renseigne PARTOUT. Et ses valeurs sont exactement la colonne
`SchoolAccountId` de `LPB_Mapping_Campus`, celle qui sert deja a ecrire
`Ecole__c`. Une seule lecture de DE donne donc les campus de l'ecole, et le
filtre porte sur des Ids — sans ambiguite, contrairement a une comparaison de
noms.

`campusNameFor__c` reste un repli pour les instances sans `Campus__c`. Et comme
il est vide dans le cas general, le NOM du campus affiche dans le libelle d'une
date est lui aussi resolu depuis la DE : sans cela, le visiteur ne saurait pas
ou la date a lieu.

Mesure avant / apres, sur `LPB_TST_Dico_Rendu` :

    ?ecole=efap&TypeEvenement=JPO         0 date  ->  3 dates
    ?ecole=brassart&TypeEvenement=Atelier 0 date  ->  3 dates

Rendu obtenu :

    2026-09-10 · 09:30 - 15:30 · EFAP PARIS · L'Hôtel, 13 rue des Beaux-Arts, 75006 Paris
      Présentation de l'école — 08:00 - 09:00
      Atelier découverte du programme — 09:30 - 10:30 (obligatoire)
      Entretien individuel d'orientation — 12:00 - 12:30
