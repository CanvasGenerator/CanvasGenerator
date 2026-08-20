# Diagnostic — lecture Salesforce Core depuis SSJS

Répond à **une seule question** : les Platform Functions SSJS de cette Business Unit
voient-elles l'org Salesforce Core, et jusqu'où ?

**Lecture seule.** Aucun `CreateSalesforceObject` / `UpdateSalesforceObject` ici.
La seule écriture possible est la DE de diagnostic, et seulement en mode Automation.

## Mode d'emploi — CloudPage

1. Web Studio → **CloudPages** → une Landing Page vierge (collection au choix).
2. Ouvrir le bloc de contenu en **vue HTML / code** (pas l'éditeur WYSIWYG).
3. Coller **tout** `A-COLLER-cloudpage-diagnostic.ssjs`.
4. **Publier** la page.
5. Ouvrir **l'URL publiée** — pas l'aperçu Page Builder.

> ⚠ L'aperçu Page Builder n'exécute pas toujours le SSJS. Un aperçu vide ne prouve
> rien : c'est précisément le piège qui fait conclure à tort « le SSJS ne marche pas ».
> Seule l'URL publiée fait foi.

## Lire le résultat

La page sort un tableau (une ligne par sonde) et un **verdict** :

| Verdict | Ce que ça veut dire | Suite |
|---|---|---|
| `FONCTIONS ABSENTES` | `RetrieveSalesforceObjects` est `undefined` sous ses **deux** formes. | Marketing Cloud Connect n'est pas provisionné sur la BU. |
| `FONCTION PRESENTE / APPEL REFUSE` | La fonction existe, mais chaque appel échoue. | Lire l'erreur exacte, remontée telle quelle. `Unable to retrieve security descriptor for this frame` = refus de **contexte**, pas panne de connexion. |
| `KO CONNEXION` | Les fonctions répondent mais aucun objet n'est lisible. | La connexion à l'org ou les droits de l'utilisateur MC Connect sont à reprendre. |

### ⚠ Piège Jint — ne jamais tester `typeof x === "function"`

Jint expose les membres .NET sous **ses propres** types : `clr`, `clrmethodinfo`,
`clrfunction`. Les Platform Functions de SFMC en font partie.

```
Platform.Function.RetrieveSalesforceObjects   →  typeof = clrmethodinfo
Script.Util.WSProxy                           →  typeof = clr
```

Exiger `"function"` revient donc à déclarer **toutes** les Platform Functions
absentes. C'est l'erreur de la v3 : elle a conclu que MC Connect n'était pas
provisionné alors que la fonction répondait présente — et, pire, son garde-fou
l'empêchait de seulement tenter l'appel.

Le seul verdict d'absence fiable est `undefined`. Et la règle qui en découle :
**on appelle, puis on rapporte l'erreur réelle** — on ne pré-teste pas.
| `CONNEXION OK / MÉTADONNÉES KO` | L'org répond, mais ni `EntityParticle` ni `PicklistValueInfo` ne sont exposés. | La lecture directe du value set est impossible → DE de référence alimentée par une Automation. |
| `PARTIEL` | Les métadonnées répondent, aucun value set ne remonte. | Les 4 noms d'API de champ sont à revérifier côté org (`SocleConfig.PICKLISTS.fields`). |
| `OK` | Les value sets sont lisibles directement. | `SocleRead.getPicklist()` tient tel quel — rien à synchroniser. |

Les 4 étages de la sonde suivent l'ordre de dépendance, donc la **première** ligne
en erreur désigne la cause ; les suivantes n'en sont que la conséquence.

| Étage | Sonde | Ce qu'il isole |
|---|---|---|
| −1 | MID de la BU + horodatage | **dans quelle Business Unit** la page a réellement tourné |
| 0 | `typeof` des Platform Functions | leur **existence** dans le runtime (≠ leur bon fonctionnement) |
| 1 | `Organization`, `User` | la connexion Marketing Cloud Connect elle-même |
| 2 | `EntityDefinition`, `EntityParticle` | l'exposition des objets de **métadonnées** |
| 3 | `PicklistValueInfo` × 4 champs | les value sets Pays / Niveau / Indicatif / Vous êtes |
| 4 | PTAT, LearningProgram, AcademicTerm, SchoolCampus, Summit | les **noms d'API** des référentiels métier |

L'étage −1 existe parce que **deux publications dans deux BU différentes rendent
exactement le même tableau** : sans le MID, un résultat négatif ne prouve pas dans
quelle BU il a été obtenu. La page doit se nommer elle-même.

L'étage 0 teste `RetrieveSalesforceObjects` sous ses **deux** formes possibles
(globale et `Platform.Function.*`), et les sondes appellent celle qui répond. Conclure
« MC Connect absent » alors qu'il ne manquait qu'un préfixe coûterait des semaines.
`Script.Util.WSProxy` est sondé pour comparaison — il répond toujours, donc il ne
compte **pas** dans le verdict : c'est le témoin qui prouve que le SSJS tourne.

L'étage 3 essaie **deux chemins** par picklist : le `DurableId` résolu via
`EntityParticle` (chemin nominal de `SocleRead.getPicklist`) et le repli
`"Objet.Champ"` accepté tel quel par beaucoup d'orgs. Savoir lequel des deux
répond est une information utile — pas un échec.

## Fichiers

| Fichier | Rôle |
|---|---|
| `probe-sf-read.ssjs` | Le cœur : déclare `SfProbe.run()`. Aucune sortie. |
| `test-read-cloudpage.ssjs` | Enveloppe CloudPage — rend un tableau HTML. |
| `test-read-automation.ssjs` | Enveloppe Automation — écrit dans la DE `LPB_Diag_SF_Read`. |
| `A-COLLER-cloudpage-diagnostic.ssjs` | **Généré** = `probe` + `cloudpage`, en un seul copier-coller. |

Le découpage sonde / enveloppe est volontaire : la **même** liste de sondes tourne
aux deux endroits, donc un écart de résultat entre CloudPage et Automation désigne
le runtime, jamais le code.

### Régénérer le fichier à coller

Après toute modification de `probe-sf-read.ssjs` ou `test-read-cloudpage.ssjs` :

```bash
cd sfmc-ssjs/diagnostic && cat probe-sf-read.ssjs test-read-cloudpage.ssjs > A-COLLER-cloudpage-diagnostic.ssjs
```

⚠ Ne jamais écrire la séquence `</` + `script>` dans un commentaire de ces
fichiers : elle refermerait le bloc SSJS au rendu de la page.

## Résultat du 2026-08-16 — RECETTE EDH (MID 536010339)

Publiée sur `https://cloud.groupe-edh.net/test-forms`, la sonde a rendu son tableau
en **16 ms** : le SSJS s'exécute donc parfaitement sur une CloudPage publiée, et les
deux blocs partagent bien leur scope.

Les 18 sondes sont en erreur, toutes avec le **même** message Jint :

```
{"message":"Object expected: RetrieveSalesforceObjects", "jintException":"Jint.Native.JsException…"}
```

⛔ **Cette lecture était fausse, et elle a coûté trois versions.** Elle est conservée
ici parce que l'erreur est instructive.

`Object expected: <nom>` signale bien un identifiant non défini — mais seulement celui
de la forme **globale**. La fonction existe sous `Platform.Function.RetrieveSalesforceObjects`,
et la v3 ne l'a pas vue parce qu'elle testait `typeof x === "function"` (voir le piège
Jint plus haut). Conclusion corrigée à la v4 : **Marketing Cloud Connect est bien
provisionné.**

Leçon retenue, et câblée dans la v4 : **on appelle, puis on rapporte l'erreur réelle.**
Un pré-test peut se tromper sur ce qu'il mesure ; un appel, non.

### Incident v2 — la sonde tuée par ce qu'elle sondait

La v2 a rendu une page **entièrement muette**, sur cette seule ligne :

```
System.InvalidOperationException: Unable to retrieve security descriptor for this frame.
```

Cause : `Platform.Function.TreatAsContent("%%member_id%%")`, ajouté pour lire le MID,
lève une exception **hôte** .NET sur une CloudPage. Elle était pourtant dans un
`try/catch` — mais le bloc `catch` la sérialisait pour l'afficher, et *cette
sérialisation levait à son tour*, hors de toute protection. Une seule fonction
toxique a donc emporté les 26 autres sondes.

D'où la règle de conception de la v3, à ne pas défaire :

- `runSafe()` **ne lève jamais** ; chaque étape est isolée derrière `pousser()`.
- `str()` a trois filets successifs et ne peut pas lever, même sur un objet dont
  la simple lecture d'une propriété déclenche une exception.
- `trace()` journalise les étapes **atteintes** : si la page meurt malgré tout,
  la dernière entrée nomme le coupable.
- `TreatAsContent` est conservé, mais **testé en dernier** — savoir qu'il est
  interdit ici est une information ; le laisser tout emporter n'en est pas une.

Un diagnostic qui fait confiance à ce qu'il diagnostique n'est pas un diagnostic.

### État au 2026-08-16 (v4) — le vrai symptôme

| Sonde | Résultat |
|---|---|
| `Platform.Function.RetrieveSalesforceObjects` | **existe** — `typeof = clrmethodinfo` |
| `Script.Util.WSProxy` | **existe** — `typeof = clr` |
| `RetrieveSalesforceObjects` (global) | `undefined` — normal, la fonction vit sous `Platform.Function` |
| Tout appel à `RetrieveSalesforceObjects` | ⛔ `Unable to retrieve security descriptor for this frame` |
| `Platform.Function.AttributeValue("memberid")` | ⛔ **même erreur** |
| `Platform.Function.Now()` | ✅ |
| `Platform.Function.TreatAsContent()` | ✅ (mais `%%member_id%%` ne se résout pas) |

La ligne de partage est nette : les fonctions dépendant d'un **contexte d'exécution**
sont refusées, celles qui n'en dépendent pas passent. MC Connect n'est donc pas en
cause — c'est l'identité sous laquelle la page s'exécute.

Deux hypothèses restaient, et la sonde `0bis` de la v5 les départage en un run :

| | Hypothèse | Signature | Conséquence |
|---|---|---|---|
| **H1** | La page n'a **aucune** identité d'exécution | `0bis` échoue avec la même erreur | Une CloudPage publique ne lira **jamais** Salesforce ici → Automation Studio + DE |
| **H2** | La page a une identité, mais l'utilisateur MC Connect n'est pas rattaché à cette BU | `0bis` répond `Status=OK` | Le correctif est côté rattachement MC Connect, pas côté architecture |

`0bis` appelle `Script.Util.WSProxy.retrieve("DataExtension", …)` : un appel
**authentifié SFMC qui ne passe pas par MC Connect**. C'est le seul point où les deux
hypothèses divergent observablement.

---

## ✅ CONCLUSION — run Automation Studio du 2026-08-16

**H1 est écartée. La cause est H2 : la configuration Marketing Cloud Connect de la BU.**

L'automation (`LPB_Diag_SF_Read`, run `b30ed507`) rend un résultat **identique** à la
CloudPage, ligne pour ligne :

| Sonde | CloudPage | Automation |
|---|---|---|
| `Platform.Function.RetrieveSalesforceObjects` | `clrmethodinfo` | `clrmethodinfo` |
| `Platform.Function.CreateSalesforceObject` | `clrmethodinfo` | `clrmethodinfo` |
| `0bis` · WSProxy → DataExtension | ✅ 237 lignes | ✅ 238 lignes |
| Tout appel Salesforce | ⛔ security descriptor | ⛔ **security descriptor** |
| Bilan | 5 OK / 22 erreur | 5 OK / 22 erreur |

Un runtime porteur d'identité utilisateur échoue donc exactement comme une page
publique anonyme. **Le runtime n'est pas en cause** — ni la page, ni l'automation.

### Ce que ça règle

- Le débat « CloudPage ou Automation ? » est **sans objet** : les deux sont bloqués
  par la même cause. Les alternatives 1, 2, 3 et 4 du cadrage initial tombent
  ensemble.
- Marketing Cloud Connect est **installé** (les fonctions répondent `clrmethodinfo`)
  mais l'utilisateur MC Connect n'est **pas rattaché à cette Business Unit** : aucun
  descripteur Salesforce n'est émis, quel que soit l'appelant.

### Suite

1. **Ticket admin SFMC/Salesforce** — rattacher l'utilisateur Marketing Cloud Connect
   à la BU RECETTE EDH. Une fois fait, le socle fonctionne **sans modification** :
   `SocleRead.getPicklist()` et la cascade programme sont déjà écrits pour ça.
2. **Repli si le ticket n'aboutit pas** — appel REST direct vers Salesforce depuis le
   SSJS (`Script.Util.HttpRequest` + Connected App), qui ne dépend pas de MC Connect.
   C'est le design d'origine de l'artefact (§ Authentification). Prérequis non
   couvert côté dev : une Connected App et un utilisateur d'intégration sur l'org.

### Nettoyage

`LPB_Diag_SF_Read`, la Script Activity et l'automation sont purement diagnostiques et
se suppriment sans effet de bord. Les garder tant que le ticket admin n'est pas soldé
permet de rejouer le test en une minute après correction.

Conséquence directe : la question « où fait-on tourner le SSJS, page ou Automation ? »
était mal posée — le SSJS de la page marche. C'est la lecture Salesforce qui n'existe
pas, à aucun endroit du compte.

## Repli — mode Automation

Si la CloudPage ne rend rien du tout (page blanche, ou code SSJS affiché en clair),
c'est le **runtime de la page** qui est en cause, pas Salesforce. Pour trancher,
la même sonde tourne dans Automation Studio, qui est un runtime fiable :

1. Créer la DE `LPB_Diag_SF_Read` — colonnes : `RowId` (Text 50, **PK**), `RunId`
   (Text 40), `Ordre` (Number), `Etape` (Text 100), `Objet` (Text 100), `Colonnes`
   (Text 200), `Statut` (Text 20), `NbLignes` (Number), `Echantillon` (Text 500),
   `Erreur` (Text 500), `Verdict` (Text 900), `DateExecution` (Date).
2. Script Activity = `probe-sf-read.ssjs` + `test-read-automation.ssjs` concaténés
   (une Script Activity ne prend qu'un seul bloc).
3. Lancer l'automation, puis lire la DE — la ligne `99 · SYNTHESE` porte le verdict.
