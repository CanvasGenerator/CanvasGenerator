# Passation — formulaires EDH et socle Salesforce Core

État au **31/08/2026**, branche `dev-forms`. Rédigé pour reprendre le travail
sans relire l'historique.

---

## 1. Les cinq pièges qui coûtent le plus de temps

À lire en premier. Chacun a fait perdre des heures, et chacun se manifeste par
un symptôme qui désigne la mauvaise cause.

### 1.1 Le JS des blocs NE TOURNE PAS sur une page publiée

Les blocs `blocks/forms/**` attachent leur logique via `editor.on('component:mount')`
— **builder uniquement**. Sur une page publiée, le seul JavaScript présent est
celui **émis par le socle** (`picklist-handler.ssjs`, assemblé par AMPscript pour
contourner le stripping des `<script>` par l'API SFMC).

Conséquence : toute logique d'exécution (validation, soumission, confirmation,
remplissage des champs cachés) doit vivre **dans le socle**. J'ai construit la
validation puis l'envoi côté blocs — les deux étaient inertes en production.

`envoi-socle.js` et `champs-requis.js` subsistent : ils font vivre l'aperçu du
builder, rien de plus.

### 1.2 AMPscript n'a pas de try/catch

Une écriture refusée par Salesforce **remplace la page entière**. Pas d'erreur,
pas de message : la réponse devient `The page content contains errors and cannot
be processed.`

Trois corollaires :
- une **valeur de picklist inventée** tue la page. Toujours relever le value set
  avant d'écrire (`LPB_TST_Sonde_Picklist`) ;
- l'**absence** du marqueur `<!-- socle ecriture: -->` dans une réponse est un
  échec, jamais un imprévu ;
- la **bissection** est la seule méthode de diagnostic, et le journal
  `LPB_Log_Soumissions` en est l'instrument : **la dernière ligne d'un RunId
  désigne l'étape fautive**.

### 1.3 `SOCLE_INLINE` — pourquoi un correctif « ne prend pas »

Avec l'inlining (défaut), la page publiée porte une **copie figée** du socle.
Redéployer les Content Blocks ne touche **aucune page déjà publiée** — jamais.

J'ai cru à un cache pendant une soirée entière : trois correctifs successifs
déployés, testés sur une page qui exécutait le code d'avant, même symptôme à
chaque fois.

**`.env` porte désormais `SOCLE_INLINE=false`** : les pages appellent les blocs
par clé, un déploiement s'applique aussitôt. Le conteneur Docker lit `.env` au
démarrage — `docker compose up -d --force-recreate` après toute modification.

> Avant la Prod, décider : `true` rend la page autonome (aucune dépendance à
> Content Builder), `false` la rend corrigeable sans republication.

### 1.4 Accent grave dans un commentaire = module cassé

Un `` `mot` `` dans un commentaire **à l'intérieur d'un template literal** ferme
la chaîne. Le builder rend alors une page blanche, et l'erreur désigne le mot
**suivant**, jamais la cause. Fait trois fois.

`node --check` ne le voit pas (il analyse ces fichiers comme du CommonJS).
`sfmc-ssjs/test/test-modules.js` importe réellement les 79 modules et l'attrape.

### 1.5 Deux référentiels de niveau d'études

| `Account.Academic_Level_List__c` | `LearningProgram.Academic_Level_List__c` |
|---|---|
| `BAC+5 et +` | `Bac+5/+` |
| `BAC obtenu ou Prépa` | `Bac obtenu` |

Le formulaire envoie le premier, les programmes portent le second. Une
comparaison littérale ne matche que `Terminale`. Table `NIVEAU_EQUIV`, recopiée
en **trois endroits** faute de source commune entre AMPscript, le navigateur et
le builder : `blocks/forms/shared/programme-config.js`,
`sfmc-ssjs/socle/picklist-handler.ssjs`, et la sonde `LPB_TST_Sonde_Niveaux`.

Confrontée à l'org le 31/08 : **13 ↔ 13, correspondance complète.**

---

## 2. Architecture

```
builder (GrapesJS)                    page publiée (CloudPage)
─────────────────────                 ────────────────────────
blocks/forms/**                       %%[ SET @LPB_ECOLE / @LPB_TYPE_FORM
  construit le HTML                        / @LPB_TYPE_EVT ]%%
  logique = aperçu seulement          %%=ContentBlockByKey("LPB_Form_Handler_AG")=%%
                                      %%=ContentBlockByKey("LPB_Picklist_Handler_AG")=%%
lib/sfmc.js buildAssetPayload()
  ├─ lib/ecole-page.js : pose le préambule
  └─ lib/socle-inliner.js : inline si SOCLE_INLINE ≠ false
```

**Le préambule AMPscript est dans le HTML de la page**, pas dans un bloc : il ne
change qu'à la republication. Il est posé deux fois, de façon idempotente — par
le bloc (`socleReadSnippet`) et par `ecole-page.js` à la publication, ce dernier
réparant les pages antérieures.

Un Content Block **partage la portée AMPscript** de la page qui l'inclut : c'est
ce qui permet au préambule de fonctionner. Une variable posée *après* l'include
arriverait trop tard.

### Les deux socles

| Bloc | Fichier | Rôle |
|---|---|---|
| `LPB_Picklist_Handler_AG` | `sfmc-ssjs/socle/picklist-handler.ampscript` | **Lecture** : listes, cascade, dates, soumission, confirmation |
| `LPB_Form_Handler_AG` | `sfmc-ssjs/socle/handler-form.ampscript` | **Écriture** : n'agit que si `submitted` contient `true` |

Le JS navigateur vit dans `picklist-handler.ssjs`, dernier bloc `<script>`, et
est recopié dans le `.ampscript` par `scripts/sync-cascade-js.js`. **Ne jamais
éditer la copie** : éditer le `.ssjs` puis lancer le script.

Déploiement :
```bash
SFMC_ACCOUNT_ID=536010339 SFMC_SYNC_ENABLED=true \
  node scripts/deploy-socle-blocks.js --push --mid=536010339
```
`--mid` obligatoire : `.env` porte l'entreprise parente (536009308), la BU de
travail est **RECETTE EDH (536010339)**.

---

## 3. Ce que le socle écrit

| # | Objet | Opération |
|---|---|---|
| 1 | **Account** (Person Account) | create si e-mail inconnu, sinon *fill-if-blank* |
| 2 | **Contact** | update `LastName` / `FirstName` seulement |
| 3 | **ContactPointEmail** | create si absent |
| 4 | **ContactPointPhone** | create si absent |
| 5 | **ContactPointConsent** | **create systématique**, un par canal coché — l'objet est CREATE-ONLY |
| 6a | **CampaignMember** + **Interaction__c** | brochure et candidature **seulement** |
| 6b | **summit Registration** + **Appointments** | JPO, atelier, stage, immersion |

Les 40 campagnes du contrat couvrent brochure × candidature × 10 écoles × FR/Intl.
**Aucune campagne événement** : une inscription est tracée par sa Summit
Registration. Le journal dit `CAMP:sans-objet(...)` — et non `inactive`, réservé
au cas où la ligne existe avec `Actif=false`.

**Jamais écrits** : `Scoring__c`, `SMSLocale__c`, `WhatsAppLocale__c`,
`Academic_Level_Historical__c`, `Opt_In/Out_Date__c`, `SourceCreation__c` en
update, tout `AcademicInterest.*` / `IndividualApplication.*`, et
`CreationSourceDate__c` (l'org le refuse — le refus tue la page).

### Champs qui bloquent, mesurés

- **`Account.CreationSourceDetail__c` vide ⇒ ContactPointConsent refusé.** Il
  n'était écrit que dans la branche « prospect déjà connu » : tout premier
  formulaire perdait donc sa preuve RGPD. Corrigé.
- **`AcquisitionSubChannel__c`** : 12 valeurs, toutes des régies publicitaires.
  La CloudPage envoie `Direct` → page tuée. **`AcquisitionChannel__c`** : 15
  valeurs, sans `Autre`, `Referrals` ni `Paid Social`. Les deux sont désormais
  rapprochés du value set, et ce qui n'a pas d'équivalent n'est pas écrit
  (`CANAL:ignore(...)` au journal).
- `LastMarketingContactPointType__c` accepte `Form` / `SMS`, pas le type de
  formulaire.
- `Now()` brut est refusé sur un champ date → `FormatDate(Now(), "yyyy-MM-dd HH:mm:ss")`.

---

## 4. Règles métier implémentées

### Cascade programme (§6)

`campus → niveau → spécialité → rythme → langue → rentrée`, chaque liste
restreinte par les précédentes. La **spécialité** est sur les 6 formulaires ;
rythme, langue et rentrée sur la **candidature seule**.

> Le fichier « Champs visibles » appelle la spécialité **« Programme
> souhaité »**. Même champ, autre nom — voir §Champs visibles.

Trois comportements à ne pas confondre :
- **progressif** — les champs après le niveau n'apparaissent qu'une fois le
  précédent renseigné. EFAP en est exempté (`progressif=false`) ;
- **une seule valeur** — champ **masqué mais renseigné**, la valeur part au CRM ;
- **ordre par école** — IFA Paris demande la langue avant la spécialité.

> ⚠ La chaîne de **filtrage** reste codée en dur (campus → niveau → spécialité →
> rythme → langue) et **ne suit pas `OrdreChamps`**. Chez IFA Paris, les
> spécialités ne sont donc pas restreintes par la langue choisie. **Non corrigé**
> — c'est l'ordre d'AFFICHAGE qui l'a été, pas l'ordre de filtrage.

> ✅ **`OrdreChamps` fonctionne depuis le 31/08.** Il n'avait effectivement aucun
> effet : `appliquerOrdre` exigeait que tous les porteurs partagent le même
> parent DOM et s'alignait sur celui du premier trouvé — le campus, dans son
> `.cnd-row` à deux colonnes. Spécialité, rythme, langue et rentrée, enfants
> directs du `<form>`, étaient donc écartés ; il ne restait qu'un porteur et la
> fonction sortait. On **reordonne désormais par section**, et `NOM_DOM`
> reconnaît enfin `StudyLevel` — sans quoi le niveau restait hors du
> reordonnancement. Vérifié en recette : IFA Paris rend bien
> `Language, Speciality, Rhythm, Rentree`.

Le programme vient des **programmes**, pas des PTAT : un programme sans PTAT
apparaît, et la liste ne dépend plus d'une rentrée choisie. Le PTAT est déduit à
la fin.

### Configuration par école — 4 DE

| DE | Rôle |
|---|---|
| `LPB_Config_Formulaires` | un axe par champ : `jamais` / `toujours` / `niveau` + seuil |
| `LPB_Config_Champs_Ecole` | **campus**, et **spécialité hors candidature** (colonne `ProgrammeVisible`, nom repris du fichier) |
| `LPB_Config_Conditions` | conditions **croisées**, `Champ=Valeur;Champ=Valeur` |
| `LPB_Mapping_Niveaux` | ordinaux : Terminale 1 · Bac+1 2 · Bac+2 3 · **Bac+3 4** · Bac+4 5 · Bac+5 6 |

> ⚠ `LPB_Config_Champs_Ecole` est lue par `LookupRows` **sans filet** : une DE
> absente tue la page. Elle doit exister en Prod **avant** d'y déployer le socle.

Les deux conditions croisées (CREAD brochure, BRASSART rythme) sont
**désactivées depuis le 31/08** (`Actif=false`, conservées telles quelles) :
« Champs visibles des formulaires.xlsx » ne porte plus aucun champ de cascade
hors candidature, et donne les quatre à toutes les écoles sur la candidature,
sans restriction de spécialité ni de niveau.

### Affichage des picklists — retours client du 02/09

Trois retours « Toutes les écoles » sur `Vous êtes` et `Niveau d'études`. Tous
les trois sont traités **à l'affichage**, dans le JS du socle
(`picklist-handler.ssjs`, bloc « RÈGLES D'AFFICHAGE ») :

| Retour | Où | Effet |
|---|---|---|
| Supprimer `Jury` | table `MASQUE` | la valeur n'est plus **proposée** ; elle reste dans le value set et sert côté CRM |
| `Étudiant dans une école du groupe` → `Étudiant <marque>` | table `MARQUE` | libellé seul ; `<marque>` = `LPB_Mapping_Ecoles.Libelle` |
| Ordre `Vous êtes` puis `Niveau d'études` | table `RANG` | tri par rang métier, le value set n'en propose aucun |

> ⚠ **Aucune valeur n'est écrite en dur.** Le value set Salesforce reste la
> seule source : une règle qui ne retrouve pas sa valeur dans ce que le CRM a
> renvoyé ne fait rien, et une valeur **inconnue** de la table `RANG` reste
> affichée (rang 500, avant `Autres`) au lieu de disparaître en silence.
> La `value` postée au socle d'écriture n'est jamais touchée — même contrat que
> le dictionnaire de traduction.

Ordre demandé pour le niveau d'études : collège, seconde, première, terminale,
bac obtenu, bac+1 → bac+5, **CAP**, **BEP**, autre. CAP et BEP **ne sont pas
dans le value set** de l'org : leur rang est posé pour qu'un ajout côté CRM
suffise, sans rouvrir le socle. Tant qu'ils n'y sont pas, ils n'affichent rien.

`RANG.StudyLevel` est **indépendant** de `option.ordre` (DE
`LPB_Mapping_Niveaux`), lu par `ordreNiveauChoisi()` : ce dernier est un
**seuil** métier (« spécialité à partir de bac+3 ») sur une échelle qui ne
couvre que 6 niveaux. S'en servir pour l'affichage mettrait collège, seconde,
première, bac obtenu et autres à égalité sur 0.

Nouvelle dépendance : le socle lit `LPB_Mapping_Ecoles.Libelle`. Libellé vide =
le libellé Salesforce d'origine est conservé — dégradé, pas cassé, et
`npm run dump:socle` le signale désormais en ATTENTION.

Tests : `sfmc-ssjs/test/test-cascade.js`, section « Règles d'affichage »
(8 cas, sur les valeurs réelles des value sets de l'org).

### Casse des libellés — retour client du 02/09

« Ne rien écrire en lettres majuscules (ex : les campus doivent être en
minuscule). » Le CRM stocke ses valeurs en capitales — `EFAP PARIS`,
`BRASSART AIX-EN-PROVENCE`, `COLLÈGE`, `BAC+1` — et elles arrivaient telles
quelles dans les listes déroulantes.

Traité **à l'affichage**, dans `casseLisible()` (`picklist-handler.ssjs`), le
seul endroit qui écrit le texte d'une option : `libelleAffiche()` pour tous les
`<select>` (campus, pays, indicatif, niveau, « vous êtes », spécialité,
programme, rentrée), plus les libellés d'ateliers et de dates d'événement.

> ⚠ La `value` de l'option **ne bouge pas** : c'est la valeur Salesforce
> d'origine, celle que le socle d'écriture attend. Même contrat que le
> dictionnaire de traduction, et les tests vérifient les deux moitiés.

Deux natures de libellés, donc deux casses — la même coupure que dans
`trier()` :

| Nature | Champs | Résultat |
|---|---|---|
| Noms propres | `Campus` · `Country` · `Indicatif` | une majuscule par mot — `EFAP PARIS` → `Efap Paris` |
| Phrases | tout le reste | la première lettre seule — `BAC OBTENU OU PRÉPA` → `Bac obtenu ou prépa` |

Une majuscule par mot appliquée partout donnerait `Bac Obtenu Ou Prépa` : un
titre anglais, pas une phrase française.

Trois garde-fous, parce qu'une règle appliquée bêtement abîme autant qu'elle
répare :

- **un mot qui porte déjà une minuscule n'est pas touché** — `Bac obtenu`,
  `Aix-en-Provence` ont été écrits à la main ;
- **sigles et codes gardent leurs capitales** — table `SIGLES` (BEP, CAP, MBA,
  BTS…), et une ou deux lettres sont un code, jamais un mot : `Lille A1` est un
  vrai nom de programme, `Lille a1` serait un identifiant abîmé ;
- **les particules redescendent** quand elles n'ouvrent pas le libellé, sinon
  `Aix-En-Provence` et `Bac obtenu OU prépa`. Elles passent **avant** le test
  des codes : `en`, `d`, `ou` tiennent en deux lettres.

Côté générateur, `MasterTemplate/Components/NosCampus` forçait aussi les
capitales sur les noms de campus (`.toUpperCase()`) : le nom part désormais tel
qu'il est saisi. Aucun autre bloc ne transforme une valeur récupérée — les
`text-transform: uppercase` restants sont du **design** (titres, boutons,
libellés de champs) et n'ont pas été touchés.

Tests : `sfmc-ssjs/test/test-cascade.js`, section « Casse des libellés »
(5 cas : campus composé, pays, phrase, sigles et codes, libellé déjà correct).
Après toute retouche : `node scripts/sync-cascade-js.js`, le JS de cascade
vivant en double dans le `.ampscript`.

### Indicatif et téléphone — retours client du 02/09

**Indicatifs par ordre alphabétique.** Le tri portait sur le nombre. Il porte
désormais sur le nom de **pays**, extrait des parenthèses du libellé.

> ⚠ Le libellé du value set commence par le chiffre — `+34 (Espagne)`. Trier ce
> libellé tel quel reproduit l'ancien tri numérique, et la liste **semble**
> triée. C'est pourquoi `cleDeTri()` existe, et pourquoi deux tests
> l'attaquent avec des indicatifs dont les deux tris divergent.

**Longueur du numéro selon l'indicatif.** Nouvelle DE `LPB_Mapping_Indicatifs` :

| Colonne | Rôle |
|---|---|
| `Indicatif` | clé — la **valeur** du value set, `33` et non `+33` |
| `Pays` | lisibilité pour le métier, et reprise dans le message d'erreur |
| `NbMin` · `NbMax` | nombre de chiffres du numéro national, sans l'indicatif et **sans le 0 de tête** |
| `Actif` | `false` désactive la ligne — un pays douteux se neutralise sans la supprimer |

Amorce : `sfmc-ssjs/socle/LPB_Mapping_Indicatifs.csv`, **13 pays seulement**,
ceux dont la longueur est certaine. Les 188 autres restent **permissifs** — le
contrôle générique 7-14 s'applique.

> ⚠⚠ **La DE doit exister AVANT de déployer le socle.** `LookupRows` sur une DE
> absente tue la page, et il n'existe aucun test d'existence préalable en
> AMPscript. Même piège que `LPB_Config_Champs_Ecole` (§1.3 du même document).
> `npm run dump:socle` sort désormais en **BLOQUANT** si elle manque : le
> lancer avant tout déploiement.

Deux règles qui protègent les candidats, et qui sont testées comme telles :

- **Pays absent de la DE = on ne bloque pas.** Ne pas connaître la longueur d'un
  pays ne doit pas fermer la porte à ses candidats. Même doctrine que le
  handler d'écriture : « un candidat légitime bloqué par erreur est un lead
  perdu, sans trace et sans recours ».
- **Le 0 de tête est retiré avant de compter.** Sans cela, `06 12 34 56 78`
  ferait 10 chiffres contre 9 attendus, et le contrôle refuserait exactement la
  saisie la plus courante en France. L'indicatif retapé dans le champ
  (`+33 6 12…`) est également toléré — le socle d'écriture le retire déjà.

**Pourquoi la validation vit dans le socle et non dans les blocs.** Les six
formulaires portent chacun une `validatePhone`, et toutes les six sont
**inertes en page publiée** (§1.1). Y ajouter la règle n'aurait amélioré que
l'aperçu du builder. Le socle intercepte `submit`, refuse d'envoyer et affiche
le message dans l'encart déjà utilisé par les règles de blocage candidature.

Tests : `sfmc-ssjs/test/test-telephone.js` (7 cas, sur la fonction réelle
extraite du socle) et 3 cas d'ordre alphabétique dans `test-cascade.js`.

**Reste à faire côté SFMC** : rechercher un indicatif en tapant `+34` ou `ES`
n'est **pas** livré — un `<select>` natif ne cherche que sur le début du texte,
il faut le remplacer par un champ de saisie filtrant. Les libellés s'y prêtent
(`+34 (Espagne)` : « 34 » et « ES » matchent tous deux), la donnée est prête.

### Événements

- Dates filtrées **par campus**, fenêtre « prochaine date + 15 jours ».
  **Sans campus choisi, aucune date.**
- Sous-événements : **seuls les obligatoires**, en cases à cocher, **strictement
  liés à leur instance**. Un atelier sans instance n'est proposé nulle part.
- Types envoyés : `JPO`, `Atelier_Decouverte`, `Stage`, `Immersion`.
  **En recette, seules les JPO ont des dates.**

### Largeur du niveau d'études quand le campus est masqué — 04/09

IFA Paris, École Bleue, MoPA et 3WA ne proposent aucun campus. Campus et niveau
d'études partagent une rangée à deux colonnes : masquer le campus laissait le
niveau **à mi-largeur**, seul contre la marge.

Le socle masquait déjà le champ — ce n'était pas là que ça se jouait. La
**cellule** de grille qui enveloppe le porteur (`.cnd-col`, `.brf-col`,
`.imf-col`) reste un élément de grille et continue d'occuper sa colonne. Un
porteur invisible dans une cellule bien vivante.

`ajusterRangee()` (`picklist-handler.ssjs`) est donc appelée **après** chaque
masquage : la cellule devenue vide se retire, et celle qui reste seule prend
`grid-column: 1 / -1`.

Trois précautions, et chacune répare un piège du gabarit :

| | |
|---|---|
| Le `display` de la **rangée** n'est jamais touché | c'est le gabarit qui décide si la ligne existe — sa requête `@media` la repasse à une colonne sur mobile |
| Le geste est **inerte hors d'une grille** | la précandidature n'a pas de cellule intermédiaire (son `.pc-field` est enfant direct du `.pc-row`), JPO / atelier / stage n'ont pas de rangée |
| Une cellule n'est jugée que sur l'état de **ses champs** | se relire soi-même condamnerait une cellule masquée à ne plus jamais revenir, alors que la cascade repasse à chaque `change` |

> ⚠ **Le harnais de test a dû changer pour couvrir ça.** Il ne modélisait
> aucune cellule intermédiaire : le porteur était enfant direct de sa section.
> Sur ce gabarit-là, masquer le porteur retire bien la colonne — le défaut était
> donc **structurellement invisible** en test, et un cas écrit sans la cellule
> aurait passé avant comme après le correctif. Une ligne de layout accepte
> désormais un quatrième membre, le nom de la cellule, et un deuxième membre à
> `2` pour un champ **présent et visible au départ** (campus, niveau — leur
> `.cnd-field` ne porte aucune classe `hidden`).

Côté blocs, les deux règles CSS équivalentes ont été ajoutées à la brochure et à
l'immersion ; la candidature les portait déjà. Sans elles l'aperçu du builder
montrerait un formulaire que personne ne verra en ligne.

Tests : `test-cascade.js`, section « Largeur du niveau d'études » (6 cas, dont
3 tombent sans le correctif).

### Soumission

`method="post"`, `novalidate` retiré : **le navigateur** exige les champs
affichés. Le socle pose et retire `required` **en même temps** qu'il montre ou
masque un champ — un `required` sur un champ masqué bloquerait la soumission sans
rien afficher.

Le socle intercepte, poste en `fetch`, lit le bilan, et **ajoute un encart de
message au-dessus du bouton**. Le POST natif reste le repli.

### L'encart de message — retour client du 03/09

**Le formulaire ne disparaît plus.** Jusqu'au 03/09, une confirmation masquait la
zone de formulaire, les titres et toute la fratrie de la carte, puis ouvrait
l'écran `.xxx-success`. Désormais **rien n'est masqué** : le formulaire reste
affiché avec ses valeurs, le bouton redevient cliquable, et un renvoi refait le
même POST.

Un encart unique, `[data-socle="message"]`, posé avant `.xxx-submit-wrap`, avec
quatre tons :

| Ton | Couleur | Cas |
|---|---|---|
| `succes` | vert | écriture faite — message par famille |
| `r1` | orange | candidature déjà en cours sur ce programme |
| `r2` | rouge | décision défavorable rendue |
| `erreur` | rouge | refus de saisie (longueur de numéro) |

Un seul élément, réécrit à chaque tentative : deux encarts distincts finiraient
empilés dès qu'un visiteur confirme puis retombe sur un blocage.

> L'écran `.xxx-success` **n'est plus jamais ouvert**. Il reste dans le HTML
> publié, à son `display:none` d'origine — c'est ce qui rend le correctif
> applicable **sans republier les pages en ligne**, seul le bloc socle est à
> redéployer.

### Règles de blocage candidature — la portée, 04/09

**L'identité d'une candidature est e-mail × programme**, et le lien entre les
deux est le PTAT : e-mail → `Account.PersonEmail` → `PersonContactId`,
programme → `PTAT_Id`. `IndividualApplication` se lit sur
`ContactId` + `ProgramTermApplnTimelineId`. Le PTAT porte déjà l'année
scolaire : **il n'y a pas de critère « même année » à ajouter**, il serait
redondant.

**Le bug corrigé.** Le garde d'entrée de l'ÉTAPE 0 exigeait
`NOT Empty(@ptatId)`. Or `PTAT_Id` est rempli par le **navigateur**, au terme de
la cascade, et reste vide dès que celle-ci ne réduit pas à un seul programme —
deux états que ses propres tests consacrent comme normaux. R1 et R2 étaient donc
sautées **en silence**, la candidature s'écrivait, et le visiteur lisait le
vert. C'est de là que venait « tout est vert ».

Le terme est retiré. La règle tourne désormais toujours, et c'est sa **portée**
qui s'adapte :

| Portée | Quand | Ce qu'elle vérifie |
|---|---|---|
| `ptat` | le PTAT est résolu | contact × PTAT — le blocage reste propre à **un** programme, changer de programme reste permis |
| `personne` | le PTAT est absent | contact seul. Plus sévère, mais **uniquement là où le programme est inconnu** — l'alternative était de ne rien contrôler |

Deux requêtes et non une : l'arité de `RetrieveSalesforceObjects` est figée à
l'écriture, et passer un `@ptatId` vide chercherait « le PTAT vide », donc zéro
ligne — exactement la panne qu'on répare.

**La décision vit dans `FinalDecision__c`, pas dans `Status`.** Mesuré sur les
321 candidatures de la recette : `FinalDecision__c` (vide) 304 · Admitted 9 ·
Rejected 7 · Pending 1. `Status` : Processing 211 · Initial Application Review
75 · … et **`Rejected` n'existe pas** dans son value set. Le refus est donc
cherché **dans les deux champs**, en comparaison exacte minuscules.

`FinalDecision__c` étant vide sur 95 % des dossiers réels, « statut vide » ne
veut **pas** dire « pas de candidature ». Le métier a tranché : dès qu'une
candidature existe, on bloque. Seul `Rejected` change le message.

| Trouvé | Sortie |
|---|---|
| aucune ligne | **vert**, la soumission s'écrit |
| ≥ 1 ligne, pas Rejected (vide compris) | **orange** (`r1`) |
| ≥ 1 ligne Rejected | **rouge** (`r2`) |

Un blocage = **aucune écriture CRM**. Le formulaire, lui, reste affiché avec ses
valeurs et le bouton redevient cliquable (cf. l'encart de message ci-dessus).

**Les issues qui laissent passer sont journalisées elles aussi**, et c'est le
vrai apport du 04/09 : `REGLES:email-inconnu(portee=…)`,
`REGLES:aucune-candidature(ptat=…,portee=…)`, plus deux lignes dans
`LPB_Log_Soumissions` (`21 - candidature libre`, `21 - aucun compte`). Sans
elles, « pourquoi celui-là est passé ? » n'a aucune réponse — le journal ne
distinguait pas « la règle n'a rien trouvé » de « la règle n'a pas tourné », et
les deux se corrigent à l'opposé l'une de l'autre.

> ⚠ **Piège de recette.** Le socle ne crée **jamais** d'`IndividualApplication`
> (au contrat) : soumettre deux fois le formulaire ne produira donc jamais
> d'orange. Il faut des e-mails déjà candidats en base —
> `jana.garcia.uat1245@edh-uat.fr` (Rejected → rouge) et
> `project+demoedhdamien@season-ed.com` (Processing → orange), tous deux sur le
> **même PTAT `10LAW00000GMzdJ2AT`** : même page, mêmes sélections, seul
> l'e-mail change.

Tests : `test-regles-blocage.js` (16 cas, sur le texte du socle d'écriture —
AMPscript ne s'exécute que dans SFMC).

### CTA « Télécharger la documentation » — DE `CTA_demande_documentation`, 04/09

La DE existe, elle est renseignée, et elle porte **le lien, le libellé ET les
couleurs** : chaque école a sa charte, et le métier doit pouvoir en changer sans
redéploiement. Rien n'est écrit en dur, pas même le texte du bouton.

```
ecole  ·  niveau_etudes  ·  cursus  ·  titre_CTA_doc
       ·  couleur_fond_CTA_doc  ·  couleur_police_CTA_doc  ·  url_documentation
```

Le socle de lecture publie les lignes **de l'école** dans `SOCLE_DATA.ctaDoc` ;
la sélection finale se fait dans le navigateur — niveau et cursus ne sont connus
qu'après remplissage, et l'architecture évite les allers-retours serveur.
`niveau_etudes` et `cursus` sont en Text(4000) et acceptent plusieurs valeurs
séparées par « ; » : c'est le `contient()` de la cascade, réutilisé tel quel.
Une colonne de critère **vide** ne contraint rien ; on garde la ligne
correspondante **la plus précise**, la première gagnant à précision égale.

> ⚠ **La lecture est derrière un drapeau** (`@CTA_DOC_ACTIF`). `LookupRows` sur
> une DE absente **tue la page** : c'est la seule sortie de secours si la DE
> manque dans une BU. Même piège que `LPB_Mapping_Indicatifs`.

**Deux lectures et non une.** Relevé sur la DE de recette le 04/09, 102 lignes :
la colonne `ecole` porte le **libellé commercial**, pas la clé — `EFAP`,
`IFA Paris`, `ECOLE BLEUE`, `3W Academy`, `MoPA`. Six écoles s'en tirent parce
que clé et libellé ne diffèrent que par la casse, à laquelle SFMC est
insensible ; quatre non. On tente la clé, puis le libellé.

**Écart de référentiel.** Le formulaire poste la valeur du value set
`Account.Academic_Level_List__c` (`BAC obtenu ou Prépa`, `BAC+1`, …) ; la DE,
saisie à la main, écrit `Bac+1` et `BAC`. On compare donc en **majuscules sans
accent**, ce qui règle casse et accents, plus une **équivalence explicite**
`BAC` ↔ `Bac obtenu` ↔ `BAC obtenu ou Prépa` — le métier a confirmé que le
« BAC » de la DE désigne le bac obtenu. C'est un pansement : la correction
durable est d'aligner la DE sur le value set.

Le bouton est un `<a>`, `target="_blank"` + `rel="noopener noreferrer"`
(l'attribut `download` est ignoré en cross-origin), et **seulement sur une vraie
URL http(s)**. Couleurs de la DE, repli noir/blanc si vides ou mal saisies —
cas réel : IFA Paris « Seconde » porte `#FFFFF`, cinq chiffres. **Aucun libellé
en dur** : une ligne sans titre ne rend pas de bouton. Sans DE, sans ligne ou
sans correspondance : pas de bouton, et la confirmation s'affiche seule.

Le panneau `?socleDebug=1` porte une ligne **« CTA documentation (DE) »** : à 0
alors que l'école est connue, la DE ne répond pas.

> ⚠ **À corriger dans la DE, mesuré le 04/09.** Aucune ligne n'est sans
> critère : chaque école énumère ses niveaux, il n'y a donc **pas de ligne par
> défaut**, et un niveau absent ne rend aucun bouton. Trois trous en découlent,
> et tous se rebouchent dans la DE :
> - **EFAP écrit `Bac+5`** là où le value set dit `BAC+5 et +` — les neuf autres
>   écoles écrivent bien `BAC+5 et +`. Un visiteur EFAP de ce niveau n'a pas de
>   bouton. Aucune équivalence n'est posée pour ce cas : elle masquerait une
>   faute de saisie isolée au lieu de la faire corriger ;
> - `BAC+6` et `Autres` existent dans le value set et dans aucune ligne ;
> - CREAD porte deux lignes `Reconversion Professionnelle`, qui n'est pas un
>   niveau mais un profil. Elles sont inertes.

Tests : `test-confirmation.js`, section « CTA Télécharger la documentation »
(18 cas).

### CTA « Télécharger la brochure » — retour client du 03/09

Sur la famille `brochure`, un bouton s'ajoute sous la confirmation. Il n'apparaît
**que** si une URL est disponible : un CTA vers une brochure absente serait pire
que pas de CTA.

⚠ **Ce contrat-là est resté un REPLI.** La DE `brochures` n'a jamais été créée ;
c'est `CTA_demande_documentation` (section précédente) qui sert réellement le
bouton, et `montrerSucces` l'essaie en premier. Le bloc ci-dessous reste en
place parce que son contrat est plus large (campus, programme) et qu'il ne coûte
rien tant que personne ne publie `SOCLE_DATA.brochures` — il s'allumerait sans
retouche.

```js
SOCLE_DATA.brochures = [
  { url: "https://...", libelle: "...",     // libellé facultatif
    programme: "...", specialite: "...",    // critères, tous facultatifs
    campus: "...",    niveau: "..." },
]
```

Une ligne ne retient **que les critères qu'elle renseigne** : sans aucun critère
elle est la brochure par défaut de l'école, avec `programme` elle ne sert que ce
programme. Le socle garde la ligne correspondante **la plus précise** — celle qui
contraint le plus de critères — ce qui laisse cohabiter un défaut et des
brochures par programme **sans ordre imposé dans la DE**. À précision égale, la
première ligne gagne.

Cette forme est volontairement plus large que le besoin connu : on ne sait pas
encore si la DE sera par école, par programme ou par campus, et les trois se
décrivent ainsi sans toucher au socle.

Les critères se comparent aux champs `Programme`, `Speciality`, `Campus`,
`StudyLevel` du formulaire, en minuscules. Le lien s'ouvre dans un nouvel onglet
(`target="_blank"` + `rel="noopener noreferrer"`) : l'attribut `download` est
ignoré en cross-origin, et le PDF est hébergé ailleurs que la CloudPage.

Deux pièges déjà rencontrés :
- **`submitted` posté deux fois** (champ caché + ajout du script) →
  `RequestParameter` rend `"true,true"`, l'égalité échoue, **toute l'écriture est
  sautée**. Corrigé des deux côtés : le script ne duplique plus, et le handler
  teste la *présence* de `true`.
- **`HasOptedInEmail/SMS/WhatsApp/Phone`** sont déduits de la case RGPD par le
  socle. La conversion était côté blocs : **aucun consentement n'était
  enregistré** alors que le visiteur avait coché.

---

## 5. Tracking

La CloudPage d'affichage (code hors dépôt, dans CloudPages) lit l'URL, en déduit
le canal, lit Axeptio, et publie tout dans `window.tracking_params`. Elle ne
remplit **pas** les champs cachés — c'était `populateHiddenFields()`, côté blocs.
Le socle les recopie désormais (`client_id` → `clientId` ; `utm_campus` relu dans
l'URL, car la page expose `campus`, qui est le campus **présélectionné**).

Sur un compte **neuf**, seuls `UTMSource__c` et `ClientID__c` étaient écrits ; le
reste ne l'était que sur la branche « déjà connu ». Corrigé, sauf
`DateConsentementCookies__c` — champ date, aucune valeur réelle d'Axeptio à
valider, et un format refusé tue la page.

**Défaut hors de notre portée** — la table d'attribution de la CloudPage est
lacunaire :

| utm_source / utm_medium | canal |
|---|---|
| `facebook` / `paid_social` | Paid Social / FACEBOOK-ADS ✓ |
| **`google` / `cpc`** | **Autre / Autre** |
| `instagram`, `linkedin` / `paid_social` | Autre / Autre |
| `newsletter` / `email` | Autre / Autre |

`google/cpc` est le couple payant le plus courant. Essayé aussi `paid_search`,
`sea`, `ppc`, `google-ads` : aucun. À faire compléter par qui détient la
CloudPage. Et ses libellés (`Autre`, `Referrals`, `Paid Social`) ne figurent pas
dans les picklists de l'org.

---

## 6. Sondes SFMC (dossier `LPBuilder`, BU RECETTE)

Toutes en `?contentkey=<clé>` sur `cloud.groupe-edh.net/mini-blocks-recette`.
Cette page **n'est pas mise en cache**, contrairement à `landingpage` — c'est là
qu'il faut tester.

| Clé | Usage |
|---|---|
| `LPB_TST_Sonde_Compte` | **`&acc=001…`** — toutes les valeurs des 8 objets écrits |
| `LPB_TST_Sonde_Parcours` | `&email=` — quels objets existent, dans l'ordre |
| `LPB_TST_Sonde_Valeurs` | `&o=&f=&w=&wv=` — lecture générique |
| `LPB_TST_Sonde_Picklist` | `&o=&f=` — **value set** (à faire avant toute écriture) |
| `LPB_TST_Sonde_Diff` | `&a=&b=&f=` — deux enregistrements côte à côte |
| `LPB_TST_Sonde_Niveaux` | confronte les deux référentiels de niveau |
| `LPB_TST_Sonde_Ecriture` | `&o=&id=&f=&val=` — écrit un champ |
| `LPB_TST_Sonde_CPC` | bissection du consentement, champ par champ |
| `LPB_TST_Socle_Runner` | joue une soumission complète depuis l'URL |

Le MCP SFMC **n'expose aucun outil de suppression** : tout objet créé se nettoie
à la main.

---

## 7. Tests

```bash
node sfmc-ssjs/test/run.js
```

| Étape | Ce qu'elle garde |
|---|---|
| Synchro du JS de cascade | la copie `.ampscript` est à jour |
| Lint AMPscript | 7 familles, dont les variables non déclarées |
| Import des blocs | 80 modules **réellement importés** (accent grave) |
| Inliner (8) | le préambule survit à la publication |
| Cascade navigateur (80) | filtrage, conditions, `required`, référentiels, largeur de cellule |
| Longueur du téléphone (11) | la règle par indicatif, sur la fonction réelle |
| Recherche d'indicatif (9) | trouver `+34` ou `ES` dans 201 pays |
| Sous-événements (15) | obligatoires seuls, liés à leur instance |
| Champs requis (9) | tout champ affiché, jamais un masqué |
| Envoi au socle (8) | lecture du bilan, page morte = échec |
| Confirmation (61) | message par famille, `submitted` unique, opt-in, les deux CTA |
| Règles de blocage (16) | portée, ordre des branches, égalité des messages |

Les cas marqués `[REGRESSION]` ont réellement cassé. Vérifier qu'un nouveau test
**échoue sans le correctif** — j'ai écrit un test qui passait avant correction
parce qu'il composait les fonctions dans le bon ordre, alors que le bug était
dans leur enchaînement réel.

---

## 8. Reste à faire

### Bloquant avant Prod
- [ ] **`@LOG_ACTIF = "true"`** dans `handler-form.ampscript` → `false`
- [ ] **Trancher `SOCLE_INLINE`** : autonomie (true) ou corrigeabilité (false)
- [ ] **Activer les 40 campagnes** (`Actif=true` dans `LPB_Mapping_Campagnes`)
- [ ] **Ménage** des comptes et objets de test (voir §9)
- [ ] **Secret client en dur** dans les Script Activities SFMC
  `SCR_OptOut_PATCH` / `SCR_OptOut_PATCH_CRM` — vérifié absent de ce dépôt

### Fonctionnel à trancher
- [ ] Chaîne de **filtrage** indépendante de `OrdreChamps` (§4) — visible
      seulement chez IFA Paris. L'ordre d'affichage, lui, est corrigé
- [ ] `Interaction__c` non créée sur les formulaires événement : effet de bord du
      bloc campagne, pas une décision. **Statu quo validé** le 31/08
- [ ] Sémantique des conditions croisées à confirmer
- [ ] `NIVEAU_EQUIV` : table officielle attendue du responsable data
- [ ] **Aligner `CTA_demande_documentation` sur le value set** : `Bac+5` d'EFAP,
      `BAC` des neuf écoles, `BAC+6` et `Autres` absents, `Reconversion
      Professionnelle` chez CREAD. Le socle pose une équivalence pour `BAC`
      seulement — le reste est une correction de données
- [ ] Chaîne de **filtrage** de la portée `personne` : elle bloque sur
      n'importe quel programme. Elle disparaît d'elle-même le jour où la cascade
      résout toujours un PTAT, ou si le critère passe du PTAT au **programme**
      (demande le nom d'API du champ programme sur `ProgramTermApplnTimeline` —
      qu'on ne devine pas, un nom faux tuant la page)
- [ ] École Bleue : spécialité active partout **sauf** brochure — sans
      justification dans la config
- [ ] CREAD hors brochure : spécialité `jamais`, notée « pro ? » donc incertaine
- [ ] `[v1]` de la preuve de consentement, écrit en dur — **abandonné**, aucune
      demande client
- [ ] Atelier et stage : **aucune instance en recette**, à faire créer côté CRM
- [ ] Table d'attribution de la CloudPage à compléter (§5)
- [ ] Mails post-soumission (MC) non câblés ; aucune redirection prévue

### Contexte bloqué
- **MC Connect n'est pas rattaché à RECETTE EDH** : toute lecture SSJS de
  Salesforce échoue (`Unable to retrieve security descriptor for this frame`).
  AMPscript, lui, fonctionne. Ticket admin, pas un sujet de code.

---

## 9. Objets de test créés (à nettoyer)

Tous en `@example-edh.test`, sauf ceux de l'utilisateur. Filtrer sur le domaine.

`prog.souhaite.31aout` · `spec.inventee.31aout` · `g[1-5].31aout` ·
`sonde.*` · `test.*` · `neuf.correctif*` · `parcours.jpo.31aout` ·
`libelle.*.31aout` · `tracking.jpo.31aout` · `diag.*.31aout` · `dbl.[ab].31aout` ·
`pick[0-3].31aout` · `pilote*.cand.31aout` · `cache.[ab].31aout` ·
`track.complet.31aout` · `final.cand.31aout`

Côté utilisateur : `efap.broch@test.com`, `efap.broch2@test.com`,
`broch.local@gmail.com`, `candidature@efap.com`, `efap.candidature2@efap.com`,
`jpo.local@efap.com`.

Plus les DE `LPB_Log_Soumissions` (626 lignes) et `LPB_Dico_Traductions`
(415 lignes, 279 traduites), et une douzaine de blocs `LPB_TST_*`.

---

## 10. Commits du 30–31/08

```
76f7425 publication: cesser d inliner le socle pendant les tests
471d576 socle: ne jamais ecrire une valeur de picklist inventee
9503e1c socle: ne plus poster « submitted » deux fois — l ecriture etait sautee
61dbba4 socle: ancrer la lecture du bilan sur le commentaire HTML
98d0c08 socle: dire quand une page ne porte pas le socle d ecriture
86c3665 socle: confirmation sans rechargement, et tracking enfin transmis
7e12293 socle: distinguer une campagne absente d une campagne desactivee
7e40a9e forms: reparer les blocs casses par un accent grave, et l empecher
7f8c129 forms: soumettre en POST natif, valide par le navigateur
6905d7c forms: brancher l ecriture CRM, et lier les ateliers a leur date
018187a forms: prelude masque, dates en bas, champs requis, programmes d abord
52385fe publication: cesser de jeter le prelude AMPscript a l inlining
bde08f4 forms: poser le type de formulaire et d evenement sur la page
b8f9fbd forms: faire enfin dependre la specialite du niveau d etudes
```

---

## 11. Prochaine action

**Republier une page** (`Formulaire_CANDIDATURE_EFAP` par exemple) : c'est le
passage d'une page figée à une page qui appelle les blocs. Puis soumettre et
vérifier avec `LPB_TST_Sonde_Compte&acc=…`.

Attendu : écran de succès sans rechargement, compte + points de contact +
4 consentements + CampaignMember + Interaction, et le tracking rempli.

### Champs visibles — alignement du 31/08

Source : **« Champs visibles des formulaires.xlsx »**. Le sens du fichier est
dans les **couleurs de remplissage**, pas dans le texte : vert = affiché,
gris = non affiché, vert clair = progressif.

> ⚠ **La ligne « Programme souhaité » désigne le champ `Speciality`.** Ce n'est
> pas un champ de plus. J'ai d'abord construit un vrai champ « programme » —
> erreur, annulée.

| Champ | Règle du fichier | Était |
|---|---|---|
| Mon profil (`VousEtes`) | brochure + JPO | aussi sur atelier |
| Pays de résidence (`Country`) | brochure seule | aussi sur candidature |
| Campus | masqué pour IFA Paris, École Bleue, MoPA, 3WA | toujours affiché |
| Spécialité **hors candidature** | BRASSART, IFA Paris, MoPA | EFAP, ICART, École Bleue et CREAD aussi, avec des seuils de niveau |
| Spécialité **sur candidature** | les 10 écoles | 4 écoles à `jamais`, ICART à bac+3 |
| Rythme, langue | candidature, les 10 écoles | 5 à 7 écoles à `jamais`, seuils divers |
| Progressif sauf EFAP | — | déjà conforme |
| Ordre IFA Paris (langue avant spécialité) | — | **configuré mais sans effet** — corrigé (§4) |

**`Account.Speciality__c` n'était pas écrit.** Le `<select Speciality>` était
affiché sur les six formulaires et sa valeur partait nulle part. Le handler
l'écrit désormais, après vérification contre l'org (`SPEC:ignore(...)` si la
valeur n'existe pas — une picklist inventée tue la page).

**Campus masqué ⇒ plus aucune date** sur un formulaire événement, les dates
étant filtrées par campus. Le socle **pose** donc la valeur quand il n'y en a
qu'une, et avertit en console quand il y en a plusieurs.

Sonde dédiée : `LPB_TST_Sonde_Config` — `&ecole=&form=` relève la config
publiée pour n'importe quel couple école × formulaire, socle d'écriture inclus.


### Conventions

- **Français** partout — code, commentaires, commits. Pas d'accent dans
  l'AMPscript et le SSJS (l'API SFMC les malmène) ; accents autorisés en JS et
  dans les `.md`.
- **Demander avant de commiter** : proposer, attendre le feu vert.
- **Aucun changement côté CRM** : tout se règle depuis notre code.
- La qualité des données de recette n'est pas un sujet.
