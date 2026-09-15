# Traduction : une page par langue

Ce document décrit le modèle de traduction **actuel**. Il remplace, pour toute
nouvelle page, le modèle « un projet, plusieurs variantes de langue » décrit dans
[TRANSLATION_FIELDS.md](TRANSLATION_FIELDS.md) et la migration
`008_add_language_variants.sql`, qui restent en place pour les pages déjà traduites.

---

## 1. Le modèle

**Une langue = une page autonome.**

Dupliquer une page vers une langue crée une **page à part entière** : son contenu,
ses blocs, ses formulaires, son SEO, son URL. Une fois créée, elle est modifiable
indépendamment de sa source — on peut y ajouter un bloc, remplacer un formulaire,
changer un titre, sans que la page d'origine en soit affectée.

C'est ce qui distingue ce modèle du précédent : les variantes de langue
(`page_variants`) partageaient **une seule structure** et n'échangeaient que le
texte, ce qui interdisait par construction d'avoir un formulaire anglais différent
du formulaire français.

### Liaison des pages sœurs

Les pages d'un même groupe de langues sont reliées par deux colonnes de la table
`pages`, posées par la migration `006_add_translation_fields.sql` :

| Colonne | Page d'origine | Page traduite |
|---|---|---|
| `is_original_language` | `true` | `false` |
| `page_group_id` | `null` | id de la page d'origine |

La **racine du groupe** est toujours la page d'origine : traduire une traduction
rattache la nouvelle page à l'origine, jamais à l'intermédiaire
(`resolveTranslationSourcePageId` dans `api/content.js`).

Aucune nouvelle migration n'est nécessaire. Si la migration 006 n'a pas été
appliquée, `insertPageWithLanguageLink` réessaie sans ces colonnes : le lien de
langue est perdu, mais la page est créée — perdre le lien est acceptable, perdre
la page ne l'est pas.

---

## 2. Pourquoi le style ne peut pas casser

C'est la contrainte n°1 de la fonctionnalité, et elle est garantie par la
mécanique, pas par la prudence :

1. **Le markup ne part jamais chez le LLM.** `lib/translate.js` extrait avec
   cheerio les seuls nœuds texte et attributs traduisibles (`placeholder`, `alt`,
   `title`, `aria-label`) et réinjecte les traductions dans les mêmes nœuds.
   Aucune balise, classe, `id` ou `style` n'est transmis ni régénéré.
2. **On traduit le `projectData`, pas le HTML.** La duplication traduit le texte du
   `projectData` GrapesJS, le recharge dans l'éditeur, et c'est **GrapesJS** qui
   régénère le HTML : mêmes composants, mêmes classes, même CSS.
3. **Le CSS est copié à l'identique**, jamais recalculé.

C'est exactement le mécanisme du switch de langue à variantes, déjà en production,
mais enregistré sous une nouvelle identité.

---

## 3. Le flux de duplication

`duplicatePageToLanguage()` dans `js/app.js` :

| Étape | Ce qui se passe |
|---|---|
| 1 | Chargement de la source via `/api/project/<nom>` (`projectData` + CSS + properties) |
| 2 | **Traduction du titre** — c'est lui qui donne le slug de l'URL. Fait en premier : appel très court, inutile de traduire la page entière si l'utilisateur annule à l'étape 3 |
| 3 | Si le nom est déjà pris → l'utilisateur choisit (page à côté / remplacer / annuler). **Jamais d'écrasement silencieux** : la page cible peut contenir des modifications manuelles |
| 4 | Traduction du texte de la page + du SEO (`translateProjectDataAndSeo`) |
| 5 | Header, footer, logos `-en` (`localizeBrandInProjectData`) et **formulaires** (`localizeFormLangInProjectData`) basculés dans la langue cible |
| 6 | `POST /api/save` avec `language`, `is_original_language: false` et `source_project_name` |
| 7 | L'éditeur pointe désormais sur la page traduite (identité réécrite dans `tabStore`) |

La page est créée en **brouillon**. Elle n'est donc pas servie publiquement, et le
sélecteur de langue de la page d'origine ne la proposera qu'une fois publiée.

### Deux points volontairement non hérités

- **La balise canonique** est vidée. Recopiée telle quelle, la page EN déclarerait
  la page FR comme version canonique et ne serait jamais indexée.
- **Le nom du projet porte un suffixe de langue** (`…__EN`). C'est une sécurité,
  pas une convention d'affichage : sans lui, un titre dont la traduction est
  identique à l'original (« Open Day » → « Open Day ») produirait le même nom que
  la source, et `/api/save` (`on_conflict=project_name`) **écraserait** la page
  d'origine.

Le `schemaLd` (JSON-LD), lui, est copié tel quel : le traduire reviendrait à faire
réécrire du JSON par le LLM, avec un risque de corruption disproportionné.

---

## 4. Les URL

La langue est **toujours** dans l'URL, y compris le français :

```
/fr/portes-ouvertes
/en/open-day
```

Le slug est **dérivé du titre traduit** (`buildUniquePageSlug`), d'où `/en/open-day`
et non `/en/portes-ouvertes`.

Le chemin est **calculé, jamais stocké** (`buildPublicPagePath`) : toutes les pages
françaises déjà en base basculent donc sur `/fr/<slug>` sans migration ni
recréation. Et `resolvePublicPageByHostPath` continue de résoudre les chemins
**sans préfixe** (`/portes-ouvertes` → FR), pour ne casser aucun lien déjà diffusé.

L'unicité est garantie par la contrainte `unique (entity_id, folder_id, slug,
language)` : deux langues peuvent porter le même slug, deux pages d'une même langue
non (le slug reçoit alors un suffixe).

---

## 5. Le sélecteur de langue du header

`lib/lang-switch.js` transforme chaque `.hdr-lang` en **vrai lien** vers la page
sœur : sur la page FR il pointe vers `/en/…`, sur la page EN vers `/fr/…`. Il ajoute
aussi les balises `<link rel="alternate" hreflang>` et un `x-default` vers la langue
d'origine.

**L'injection se fait au moment de servir la page, jamais à l'enregistrement.**
C'est le point technique qui compte : à l'enregistrement de la page FR, la page EN
n'existe pas encore (le lien serait vide), et un lien gravé deviendrait faux dès
qu'un slug change. Calculé au service, il est toujours juste et ne demande aucun
ré-enregistrement.

Points d'application :

| Route | Fichier | Cible du lien |
|---|---|---|
| Page publique | `api/router.js`, `server.js` | URL publique de la page sœur (publiée et active uniquement) |
| `/preview/<projet>` | `api/router.js`, `server.js` | Aperçu de la page sœur, pour tester la bascule **avant** publication |

Le style est préservé : l'élément et sa classe sont conservés (un `<div
class="hdr-lang">` devient un `<a class="hdr-lang">`, donc le CSS des blocs
continue de matcher à l'identique) ; seul le soulignement par défaut des liens est
neutralisé en inline, car `blocks/headers.js` ne déclare pas `text-decoration`.

**S'il n'existe aucune page sœur publiée, le HTML est renvoyé inchangé** : le bouton
reste inerte, ce qui vaut mieux qu'un lien mort dans un header.

---

## 6. Les formulaires

Les blocs formulaire du projet sont **déjà bilingues** : chacun existe en version
française et anglaise dans la palette, et `data-lang` sur le `<form>` pilote le
dictionnaire `TRANS`, le texte RGPD, la liste des programmes, les messages de
validation et la valeur `LanguePreferee` envoyée au CRM
(`blocks/forms/shared/*`).

À la duplication, `localizeFormLangInProjectData` bascule donc `data-lang` **en même
temps** que les libellés sont traduits. Sans cela, on obtiendrait un formulaire
hybride : libellés anglais, runtime français, et un lead qui part avec
`LanguePreferee=fr`.

Ce qui n'est **pas** touché :

- `NomFormulaire`, `TypeFormulaire` et les champs de tracking cachés : la page
  traduite écrit donc dans **la même Data Extension** que la source. La collecte
  n'est pas séparée par langue.
- Les blocs formulaire de la palette : la personne responsable reste libre de
  supprimer le bloc et d'insérer le formulaire « … Anglais » canonique.

---

## 7. Coexistence avec le modèle à variantes

Les deux modèles cohabitent, et le sélecteur de langue de l'éditeur s'adapte à la
page ouverte :

| Page ouverte | Comportement du switch |
|---|---|
| Possède déjà une **variante** dans une langue non originale | Inchangé : charge ou crée une variante dans la même page |
| Sinon (modèle « une page par langue ») | La page sœur existe → elle est **ouverte** ; elle n'existe pas → duplication proposée |

La détection est faite par `pageUsesLanguageVariants()` dans `js/app.js`. Aucune
page existante ne change de comportement.

Côté rendu, `getBilingualHtmlForProject` renvoie déjà `null` en dessous de deux
variantes : les pages du nouveau modèle n'utilisent donc jamais le script de
bascule base64 de `lib/bilingual.js`, qui reste réservé aux anciennes pages.

### Dans le dashboard CMS

L'onglet « Pages par traduction » et son compteur reposent sur `variantLanguages`,
qui ne connaît que `page_variants`. `listMigratedDashboardPages` y ajoute donc les
langues du **groupe de pages**, calculées en mémoire depuis la liste déjà chargée
(aucune requête supplémentaire).

Seule la **racine** du groupe annonce les langues de ses sœurs. Sinon chaque page
du groupe compterait comme une entrée multilingue distincte et le même groupe
serait listé deux fois. Une duplication vers l'anglais incrémente donc le compteur
de **1**, exactement comme le faisait une variante.

Le type « Original / Traduite » vient lui aussi du modèle structuré
(`pages.is_original_language`), et non de la table `Projects` : cette dernière
repasse à `true` à chaque enregistrement normal, puisque le builder n'envoie le
drapeau qu'à la duplication. Une page traduite serait sinon repassée en
« Original » dès sa première modification à la main.

---

## 8. Limites connues

- **Publication SFMC.** L'injection du sélecteur de langue a lieu dans les routes
  servies par le builder. La page poussée vers SFMC ne la reçoit pas : sur une
  CloudPage, le bouton de langue reste inerte. Câbler le sélecteur dans le pipeline
  SFMC (avec les URL publiques absolues) est un lot à part.
- **Domaine école.** La route publique ne résout une page que si `entities.base_url`
  correspond à l'hôte de la requête. Sans `base_url` configuré, `/fr/<slug>` ne sert
  rien — le dashboard affiche alors « Domaine école à configurer ».
- **Source non migrée.** Si la page source n'existe pas encore côté structuré
  (projet legacy jamais réenregistré), le lien de langue ne peut pas être posé : la
  page traduite est créée, mais sans page sœur déclarée. Un simple réenregistrement
  de la source règle le cas.
- **Collecte de formulaires commune** aux langues (voir §6).
