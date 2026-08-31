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

Trois comportements à ne pas confondre :
- **progressif** — les champs après le niveau n'apparaissent qu'une fois le
  précédent renseigné. EFAP en est exempté (`progressif=false`) ;
- **une seule valeur** — champ **masqué mais renseigné**, la valeur part au CRM ;
- **ordre par école** — IFA Paris demande la langue avant la spécialité.

> ⚠ La chaîne de **filtrage** est codée en dur (campus → niveau → spécialité →
> rythme → langue) et **ne suit pas `OrdreChamps`**. Chez IFA Paris, les
> spécialités ne sont donc pas restreintes par la langue choisie. Non corrigé.

> ⚠ `appliquerOrdre` exige que tous les champs partagent le même parent DOM ; sur
> nos formulaires chacun a son propre `.cnd-field`. **`OrdreChamps` n'a donc
> aucun effet.** Non corrigé.

Le programme vient des **programmes**, pas des PTAT : un programme sans PTAT
apparaît, et la liste ne dépend plus d'une rentrée choisie. Le PTAT est déduit à
la fin.

### Configuration par école — 3 DE

| DE | Rôle |
|---|---|
| `LPB_Config_Formulaires` | un axe par champ : `jamais` / `toujours` / `niveau` + seuil |
| `LPB_Config_Conditions` | conditions **croisées**, `Champ=Valeur;Champ=Valeur` |
| `LPB_Mapping_Niveaux` | ordinaux : Terminale 1 · Bac+1 2 · Bac+2 3 · **Bac+3 4** · Bac+4 5 · Bac+5 6 |

Deux règles y sont exprimées :
- **CREAD brochure** — spécialité si `Campus=CREAD LYON` **et** `VousEtes=Career Change`
- **BRASSART rythme** — `Speciality=Art Direction`, cumulé au seuil bac+3

> Sémantique choisie par moi, à confirmer : conditions vraies ⇒ champ proposé.

### Événements

- Dates filtrées **par campus**, fenêtre « prochaine date + 15 jours ».
  **Sans campus choisi, aucune date.**
- Sous-événements : **seuls les obligatoires**, en cases à cocher, **strictement
  liés à leur instance**. Un atelier sans instance n'est proposé nulle part.
- Types envoyés : `JPO`, `Atelier_Decouverte`, `Stage`, `Immersion`.
  **En recette, seules les JPO ont des dates.**

### Soumission

`method="post"`, `novalidate` retiré : **le navigateur** exige les champs
affichés. Le socle pose et retire `required` **en même temps** qu'il montre ou
masque un champ — un `required` sur un champ masqué bloquerait la soumission sans
rien afficher.

Le socle intercepte, poste en `fetch`, lit le bilan, remplace le formulaire par
un écran de succès (message par famille). Le POST natif reste le repli.

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
| Import des blocs | 79 modules **réellement importés** (accent grave) |
| Inliner (8) | le préambule survit à la publication |
| Cascade navigateur (35) | filtrage, conditions, `required`, référentiels |
| Sous-événements (9) | obligatoires seuls, liés à leur instance |
| Champs requis (9) | tout champ affiché, jamais un masqué |
| Envoi au socle (8) | lecture du bilan, page morte = échec |
| Confirmation (16) | message par famille, `submitted` unique, opt-in |

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
- [ ] `OrdreChamps` sans effet, et chaîne de filtrage indépendante de l'ordre
      (§4) — visible seulement chez IFA Paris
- [ ] `Interaction__c` non créée sur les formulaires événement : effet de bord du
      bloc campagne, pas une décision. **Statu quo validé** le 31/08
- [ ] Sémantique des conditions croisées à confirmer
- [ ] `NIVEAU_EQUIV` : table officielle attendue du responsable data
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

Si ça échoue : lire la **dernière ligne du RunId** dans `LPB_Log_Soumissions`.
Son silence dit que l'écriture n'a pas démarré ; sa position dit où elle est
morte.

### Conventions

- **Français** partout — code, commentaires, commits. Pas d'accent dans
  l'AMPscript et le SSJS (l'API SFMC les malmène) ; accents autorisés en JS et
  dans les `.md`.
- **Demander avant de commiter** : proposer, attendre le feu vert.
- **Aucun changement côté CRM** : tout se règle depuis notre code.
- La qualité des données de recette n'est pas un sujet.
