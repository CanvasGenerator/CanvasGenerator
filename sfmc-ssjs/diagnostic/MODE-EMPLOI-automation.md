# Test Automation Studio — mode d'emploi

Objectif : savoir si le **descripteur Salesforce** existe quand le code s'exécute sous
l'identité d'un utilisateur, au lieu d'une CloudPage publique.

Lecture seule côté Salesforce. La seule écriture est la DE de diagnostic.

---

## 1. Créer la Data Extension

**Nom / clé externe :** `LPB_Diag_SF_Read`
(les deux identiques — c'est cette clé que le script appelle)

| Colonne | Type | Longueur | Clé primaire | Requis |
|---|---|---|---|---|
| `RowId` | Text | 50 | ✅ | ✅ |
| `RunId` | Text | 40 | | |
| `Ordre` | Number | | | |
| `Etape` | Text | 100 | | |
| `Objet` | Text | 100 | | |
| `Colonnes` | Text | 200 | | |
| `Statut` | Text | 20 | | |
| `NbLignes` | Number | | | |
| `Echantillon` | Text | 500 | | |
| `Erreur` | Text | 500 | | |
| `Verdict` | Text | 4000 | | |
| `DateExecution` | Date | | | |

⚠ Les noms de colonnes SFMC sont **sensibles à la casse** : les recopier tels quels.
Non sendable. Le dossier n'a pas d'importance.

## 2. Créer la Script Activity

Automation Studio → **Activities** → Script → nouvelle activité.

Nom : `SCR_Diag_SF_Read`
Contenu : **tout** le fichier `A-COLLER-automation-diagnostic.ssjs`, tel quel.

C'est un bloc `<script runat="server">` unique — une Script Activity n'en accepte
qu'un, d'où la fusion du cœur de sonde et de son enveloppe dans ce fichier.

## 3. Créer l'automation

Une automation, un seul step, contenant cette Script Activity.
Déclencheur : aucun (lancement manuel via **Run Once**).

## 4. Lancer, puis lire

Après le run, la DE contient ~30 lignes. La ligne `99 · SYNTHESE` porte le verdict.

Tri utile : `Ordre` croissant. La **première** ligne en `ERREUR` désigne la cause,
les suivantes n'en sont que la conséquence.

---

## Interpréter le résultat

| Ligne `99 · SYNTHESE` | Cause | Conséquence |
|---|---|---|
| Verdict `OK` ou `PARTIEL` | Le blocage vient du **contexte page** | Aucune configuration ne fera lire Salesforce depuis une CloudPage publique. Deux voies restent : une automation qui remplit une DE lue par la page, ou l'appel REST direct depuis le SSJS de la page. |
| `FONCTION PRESENTE / APPEL REFUSE` (même erreur qu'en CloudPage) | La **configuration MC Connect** de la BU | Le runtime n'est pas en cause. Ticket admin : rattacher l'utilisateur Marketing Cloud Connect à cette Business Unit. Une fois fait, le socle fonctionne sans modification. |
| `FONCTIONS ABSENTES` | Improbable ici | Contredirait la CloudPage, qui voit `Platform.Function.RetrieveSalesforceObjects` en `clrmethodinfo`. À signaler tel quel. |

## Nettoyage

Les trois objets créés (DE, Script Activity, automation) sont purement diagnostiques
et se suppriment sans effet de bord une fois la réponse obtenue.
