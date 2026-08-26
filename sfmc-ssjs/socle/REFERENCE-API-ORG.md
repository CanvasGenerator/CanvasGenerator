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
   droits generaux. Coherent avec la nature de l'objet, un consentement etant
   une trace datee et non un etat rectifiable.

   ⚠ Trou fonctionnel a arbitrer : une personne desabonnee qui re-consent via
   un formulaire ne voit pas son consentement remis a jour. Le socle journalise
   `CPC:<canal>-existant-non-modifiable` pour que ce soit visible. Deux issues
   cote CRM : ouvrir l'update, ou publier la regle de deduplication qui
   autorise un second enregistrement.

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
    prospect connu  : CPC:Email-existant-non-modifiable CPC:Email
                      CPC:SMS-existant-non-modifiable CPC:SMS CM:existant
                      INTERACTION:creee-Interaction__c

Le membre de campagne n'est pas duplique, l'interaction l'est a chaque
soumission — c'est l'arbitrage « chaque interaction compte ».
