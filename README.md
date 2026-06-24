# 🚀 Landing Page Generator — CMS Multi-École

> Plateforme de création et gestion de landing pages pour un réseau d'écoles supérieures (EFAP, Brassart, ICART, etc.), avec intégration Salesforce Marketing Cloud (SFMC) et intelligence artificielle.

![Version](https://img.shields.io/badge/version-2.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E)
![SFMC](https://img.shields.io/badge/SFMC-Content%20Builder-0176D3)

---

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture technique](#architecture-technique)
- [Prérequis & Installation](#prérequis--installation)
- [Configuration](#configuration)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités implémentées](#fonctionnalités-implémentées)
- [Flux de sauvegarde des pages](#flux-de-sauvegarde-des-pages)
- [API Reference](#api-reference)
- [Base de données — Schéma](#base-de-données--schéma)
- [Intégration SFMC](#intégration-sfmc)
- [Intelligence artificielle](#intelligence-artificielle)
- [Dashboard CMS](#dashboard-cms)
- [Éditeur de pages](#éditeur-de-pages)
- [Gestion des écoles](#gestion-des-écoles)

---

## Vue d'ensemble

Le **Landing Page Generator** est un CMS headless conçu pour les consultants marketing du groupe Reetain. Il permet de :

- Créer des landing pages via un éditeur **drag-and-drop** (GrapesJS)
- Gérer le contenu pour **plusieurs écoles** depuis un dashboard centralisé
- Publier automatiquement vers **Salesforce Marketing Cloud (SFMC)**
- Optimiser le **référencement (SEO)** de chaque page
- Générer des **formulaires SFMC** connectés à des Data Extensions
- Utiliser l'**IA (Gemini)** pour la génération de contenu et la traduction

---

## Architecture technique

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                    │
│                                                          │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  school-selector │    │   pages-dashboard.html    │  │
│  │    .html         │    │  (CMS Dashboard)          │  │
│  └──────────────────┘    └───────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          index.html (GrapesJS Editor)            │   │
│  │  js/app.js · js/ai-assistant.js · js/form-...   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP (fetch API)
┌─────────────────────────▼───────────────────────────────┐
│                  BACKEND (server.js)                     │
│              Node.js HTTP natif — Port 8000              │
│                                                          │
│  Routes API :                                            │
│  /api/save        /api/pages       /api/schools          │
│  /api/components  /api/forms       /api/content/*        │
│  /api/ai/*        /api/sfmc/*      /sitemap.xml          │
│  /preview/:name                                          │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ api/content │  │ api/schools │  │   lib/sfmc.js   │  │
│  │    .js      │  │    .js      │  │  (SFMC Client)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  lib/minifier.js │  │  lib/image-optimizer.js      │  │
│  └──────────────────┘  └──────────────────────────────┘  │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
┌────────────▼──────────┐  ┌────────────▼──────────────┐
│  Supabase (PostgreSQL) │  │  Salesforce Marketing     │
│                        │  │  Cloud (Content Builder)  │
│  • Projects (legacy)   │  │                           │
│  • pages               │  │  • Landing pages          │
│  • page_versions       │  │  • Code snippets          │
│  • entities/folders    │  │  • Data Extensions        │
│  • Schools             │  │  • Formulaires (SFMC)     │
│  • components          │  │                           │
│  • integration_jobs    │  │                           │
│  • Forms               │  │                           │
│  • chat_history        │  │                           │
└────────────────────────┘  └───────────────────────────┘
```

---

## Prérequis & Installation

### Prérequis

- **Node.js** >= 18.x
- **npm** >= 9.x
- Compte **Supabase** avec les tables créées
- Compte **Salesforce Marketing Cloud** (SFMC) avec un Installed Package (API)
- Clé API **Google Gemini** (pour l'IA)

### Installation

```bash
# 1. Cloner le dépôt
git clone <repo-url>
cd LandingPageGenerator

# 2. Installer les dépendances (minimales — le projet utilise essentiellement vanilla JS)
npm install

# 3. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos credentials (voir section Configuration)

# 4. Initialiser la base de données Supabase
# Exécuter database/scalable-schema.sql dans l'éditeur SQL Supabase
# Exécuter database/migrations/*.sql dans l'ordre numérique

# 5. Démarrer le serveur
node server.js
# ou en mode dev avec auto-reload :
npm run dev
```

Le serveur démarre sur **http://localhost:8000**

---

## Configuration

Copiez `.env.example` en `.env` et remplissez les valeurs :

```env
# ── Supabase ──────────────────────────────────────────────────────────
SUPABASE_URL=https://VOTRE-PROJECT-ID.supabase.co
SUPABASE_KEY=votre-clé-publique-anon
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key   # Requis pour les opérations admin

# ── Salesforce Marketing Cloud (SFMC) ─────────────────────────────────
SFMC_SUBDOMAIN=mc6xxxxxxxxxxxxx                    # Sous-domaine de votre BU SFMC
SFMC_CLIENT_ID=votre-client-id                     # ID de votre Installed Package
SFMC_CLIENT_SECRET=votre-client-secret             # Secret de votre Installed Package
SFMC_ACCOUNT_ID=123456789                          # MID de votre Business Unit
SFMC_CATEGORY_NAME=PFE_Landing_Pages               # Nom du dossier racine dans Content Builder
SFMC_ASSET_TYPE_ID=220                             # 220 = Code Snippet, 205 = Webpage
SFMC_ASSET_TYPE_NAME=webpage
SFMC_DE_CATEGORY_ID=12345                          # ID du dossier Data Extensions dans SFMC

# ── IA Gemini ─────────────────────────────────────────────────────────
GEMINI_API_KEY=votre-clé-gemini                    # Pour l'assistant IA
GEMINI_API_KEY_TRANSLATION=votre-clé-gemini-2      # Pour la traduction (peut être la même)

# ── Serveur ───────────────────────────────────────────────────────────
PORT=8000
```

> **Note SFMC** : Si `SFMC_CLIENT_ID` / `SFMC_CLIENT_SECRET` / `SFMC_SUBDOMAIN` sont absents, la synchronisation SFMC est automatiquement ignorée (`skipped`) sans bloquer l'application.

---

## Structure du projet

```
LandingPageGenerator/
│
├── server.js                   # Point d'entrée — serveur HTTP + toutes les routes API
│
├── index.html                  # Éditeur GrapesJS (builder de pages)
├── pages-dashboard.html        # Dashboard CMS (liste, gestion des pages)
├── school-selector.html        # Page de sélection d'école
│
├── js/
│   ├── app.js                  # Logique principale de l'éditeur (1600+ lignes)
│   ├── ai-assistant.js         # Assistant IA (Gemini) dans le panneau latéral
│   ├── form-generator.js       # Générateur de formulaires SFMC/Salesforce Core
│   ├── export.js               # Export HTML/ZIP
│   └── storage.js              # Gestion du localStorage GrapesJS
│
├── css/
│   ├── builder.css             # Styles de l'éditeur et du dashboard (design system)
│   └── form-generator.css      # Styles du générateur de formulaires
│
├── api/
│   ├── content.js              # Routes /api/content/* — schéma structuré (pages, versions)
│   ├── schools.js              # Routes /api/schools/* — gestion des écoles
│   └── router.js               # Routeur API partagé
│
├── lib/
│   ├── sfmc.js                 # Client SFMC (Auth, Content Builder, Data Extensions)
│   ├── api-shared.js           # Utilitaires partagés (supabaseRequest, slugify…)
│   ├── supabase.js             # Client Supabase (côté API)
│   ├── minifier.js             # Minification HTML/CSS avant envoi SFMC
│   ├── image-optimizer.js      # Optimisation et hébergement d'images sur SFMC
│   └── schools.js              # Utilitaires écoles
│
├── blocks/                     # Blocs GrapesJS par école et par type
│   ├── registry.js             # Registre de tous les blocs disponibles
│   ├── index.js                # Point d'entrée des blocs
│   ├── headers.js              # Blocs d'en-têtes
│   ├── hero/                   # Bloc Hero
│   ├── header-brassart/        # Header spécifique Brassart
│   ├── header-efap/            # Header spécifique EFAP
│   ├── footer-brassart/        # Footer spécifique Brassart
│   ├── footer-efap/            # Footer spécifique EFAP
│   ├── form-sfmc/              # Formulaire SFMC
│   ├── form-salesforce-core/   # Formulaire Salesforce Core (CRM)
│   ├── carousel/               # Carrousel d'images
│   ├── rich-text/              # Texte enrichi
│   ├── cta-button/             # Bouton d'appel à l'action
│   ├── two-column/             # Mise en page deux colonnes
│   ├── programme-list/         # Liste de programmes
│   └── ...                     # (et autres blocs métier)
│
├── database/
│   ├── scalable-schema.sql     # Schéma complet de la base de données
│   └── migrations/
│       ├── 002_add_integration_jobs.sql
│       ├── 003_add_page_toggle.sql
│       └── 004_add_translation_groups.sql
│
├── assets/
│   ├── LogoReetain.png
│   └── block-thumbnails/       # Miniatures des blocs GrapesJS
│
├── schools.json                # Configuration de base des écoles (fallback)
├── .env                        # Variables d'environnement (ne pas committer)
├── .env.example                # Template de configuration
├── vercel.json                 # Configuration de déploiement Vercel
└── package.json
```

---

## Fonctionnalités implémentées

### ✅ 1. Sauvegarde des composants (Supabase uniquement)

Lorsqu'un consultant enregistre un composant réutilisable depuis l'éditeur, il est sauvegardé **uniquement dans Supabase** (table `components`), sans envoi vers SFMC.

- **Endpoint** : `POST /api/components`
- **Lecture** : `GET /api/components/:schoolId`
- Les composants apparaissent ensuite automatiquement dans la **bibliothèque de blocs** de l'éditeur, sous la catégorie de l'école correspondante
- La synchronisation SFMC est **explicitement désactivée** pour les composants (`sfmcResult = { skipped: true, action: 'disabled' }`)

---

### ✅ 2. Architecture Original / Post-traitement HTML (async SFMC)

Deux versions du HTML sont conservées et le traitement est **non-bloquant** :

| Version | Où | Contenu |
|---|---|---|
| **Brute (Original)** | `Projects.project_data` | JSON GrapesJS complet |
| **Optimisée** | `Projects.html` + `page_versions.html` | HTML complet avec SEO, minifié |

**Flux asynchrone** :
1. L'utilisateur sauvegarde → réponse immédiate après écriture Supabase
2. La synchronisation SFMC est mise en file d'attente dans `integration_jobs`
3. Un worker traite les jobs en arrière-plan (minification + envoi SFMC)
4. L'utilisateur peut continuer à travailler sans attendre

**Optimisations appliquées avant envoi SFMC** :
- Injection des balises SEO (`<title>`, `<meta description>`, `<meta keywords>`, `<link canonical>`, JSON-LD)
- Minification HTML/CSS (suppression commentaires, espaces superflus)
- Open Graph tags générés automatiquement

---

### ✅ 3. Images optimisées & hébergées sur SFMC

Les images intégrées dans les pages sont traitées automatiquement en post-publication :

1. **Extraction** : détection des balises `<img src="...">` dans le HTML
2. **Upload** : envoi vers la **SFMC Media Library** via l'API Content Builder
3. **Compression** : réduction du poids de l'image avant upload
4. **Mise à jour** : les URLs dans le HTML sont remplacées par les URLs SFMC hébergées
5. **Traçabilité** : les assets créés sont enregistrés dans la table `assets` de Supabase

Tout ce processus s'effectue via un `integration_job` de type `optimize_images`, déclenché automatiquement après la publication.

---

### ✅ 4. Minification du code HTML/CSS

Avant tout envoi vers SFMC, le code HTML et CSS est minifié par `lib/minifier.js` :

- Suppression des commentaires HTML
- Suppression des espaces et retours à la ligne superflus
- Minification des attributs redondants
- Minification du CSS inline (propriétés, sélecteurs)

La minification est **transparente** : l'éditeur et l'aperçu utilisent toujours la version lisible. Seul SFMC reçoit le code minifié.

---

### ✅ 5. Bouton Configuration SEO depuis le Dashboard

Depuis la liste des pages dans `pages-dashboard.html`, un bouton **🔍 SEO** permet de modifier les métadonnées SEO sans ouvrir l'éditeur.

**Fonctionnalités de la modale SEO** :
- Champs : Titre SEO, Méta-description, Mots-clés, URL canonique
- **Compteurs de caractères** avec indicateurs visuels (rouge/orange/vert) basés sur les bonnes pratiques :
  - Titre : 50–60 caractères
  - Description : 120–160 caractères
- **Aperçu Google SERP** simulé en temps réel (affichage tel que vu sur Google)
- **File d'attente** : les modifications sont synchronisées avec SFMC via `integration_jobs` (évite les conflits si plusieurs modifications rapides)

**Routes utilisées** :
- `PATCH /api/pages/:pageId/seo` → pages structurées
- `PATCH /api/project/:projectName/seo` → pages legacy

---

### ✅ 6. URL personnalisée par école

Chaque école dispose de son propre domaine pour les landing pages. L'URL publique est construite automatiquement :

```
{base_url_école}/{slug_page}

Exemple : https://lp.brassart.fr/journee-portes-ouvertes-2025
```

- Le `base_url` est configuré dans la fiche de l'école (`Schools.base_url` / `entities.base_url`)
- Le slug est généré automatiquement depuis le titre de la page (`slugify(title)`)
- L'URL publique est affichée dans le dashboard avec un bouton **📋 Copier**
- Un aperçu de l'URL est visible lors de la création/édition des pages

**Helper** : `buildPublicUrl(entityBaseUrl, pageSlug)` dans `server.js`
**Route** : `GET /api/pages/:pageId/url`

---

### ✅ 7. Pages source et traductions

Lorsqu'une page est traduite en plusieurs langues, toutes les versions sont **regroupées** dans le dashboard.

**Structure** :
```
📄 Journée Portes Ouvertes [FR] ← Source
   ├── 🌐 Open Day [EN]          ← Traduction
   └── 🌐 Jornada Puertas [ES]  ← Traduction
```

**Fonctionnalités** :
- Identification claire de la **page source** (`is_source_page = true`) et des traductions (`source_page_id`)
- Badges de langue colorés (🇫🇷 FR, 🇬🇧 EN, 🇪🇸 ES…)
- Navigation rapide entre les versions linguistiques depuis le dashboard
- La traduction AI (Gemini) crée automatiquement une version liée

**Migration DB** :
```sql
ALTER TABLE pages ADD COLUMN source_page_id uuid REFERENCES pages(id) ON DELETE SET NULL;
ALTER TABLE pages ADD COLUMN is_source_page boolean DEFAULT false;
```

**Routes** :
- `POST /api/pages/:pageId/link-translation` → lier une traduction à sa source

---

### ✅ 8. Score SEO en direct dans l'éditeur

Pendant la construction d'une page, un **widget de score SEO** s'affiche en temps réel dans le panneau "Propriétés" de l'éditeur.

**Calcul du score (0–100)** :

| Critère | Points | Description |
|---|---|---|
| Titre SEO rempli | +20 | Entre 50 et 60 caractères |
| Méta-description | +20 | Entre 120 et 160 caractères |
| Mots-clés | +15 | Au moins 3 mots-clés définis |
| H1 unique | +15 | Un seul `<h1>` dans la page |
| Images avec `alt` | +15 | Toutes les images ont un texte alternatif |
| URL canonique | +15 | URL canonique définie |

**Affichage** :
- Cercle de progression SVG animé (🔴 rouge < 40, 🟠 orange 40–70, 🟢 vert > 70)
- Liste de **conseils contextuels** pour améliorer le score
- Mise à jour en temps réel à chaque modification de l'éditeur ou des propriétés

---

### ✅ 9. Activer / Désactiver une page + Redirection

Un administrateur peut activer ou désactiver une page publiée à tout moment depuis le dashboard.

**Comportement** :
- **Page active** 🟢 : visible sur le domaine de l'école, synchronisée sur SFMC
- **Page désactivée** 🔴 : 
  - Redirige les visiteurs vers une URL de secours définie par l'admin
  - SFMC est mis à jour avec une page de redirection HTML (sans interruption du trafic)
  - Le contenu est conservé et peut être réactivé à tout moment

**Colonnes DB ajoutées** :
```sql
ALTER TABLE pages ADD COLUMN is_active boolean DEFAULT true;
ALTER TABLE pages ADD COLUMN redirect_url text;
```

**Routes** :
- `PATCH /api/pages/:pageId/toggle` → active/désactive + définit `redirect_url`

**Impact SFMC** : lors de la désactivation, un `integration_job` crée une page de redirection AMPscript dans Content Builder.

---

### ✅ 10. Sitemap XML automatique

Un fichier sitemap est généré et mis à jour automatiquement, accessible à l'URL `/sitemap.xml`.

**Contenu du sitemap** :
- Toutes les pages avec `status = 'published'` ET `is_active = true`
- Regroupées par école (toutes les écoles du réseau)
- URLs publiques calculées depuis `entities.base_url` + `pages.slug`

**Format** :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://lp.brassart.fr/journee-portes-ouvertes</loc>
    <lastmod>2025-05-20</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  ...
</urlset>
```

**Performances** : le sitemap est **mis en cache 15 minutes** en mémoire pour éviter les appels Supabase répétés.

**Route** : `GET /sitemap.xml` (Content-Type: `application/xml`)

---

### ✅ Fonctionnalité Bonus — Gestion des écoles (CRUD complet)

Interface d'administration complète pour gérer les écoles du réseau :

- **Ajouter** une école avec : nom, description, contact, base URL, couleurs de marque, emoji
- **Modifier** toutes les informations d'une école
- **Supprimer** une école avec transfert obligatoire de ses pages vers une autre école cible
- Création automatique des structures liées : `entities`, `workspaces`, `folders`
- Traçabilité du transfert dans `metadata.lifecycle`

---

## Flux de sauvegarde des pages

```
[Clic "Sauvegarder" dans l'éditeur]
          │
          ▼
[js/app.js — Collecte]
  • collectProperties()     → Titre, SEO title, description, keywords, canonical, schéma JSON-LD
  • editor.getHtml()        → HTML brut du <body>
  • editor.getCss()         → CSS GrapesJS
  • editor.getProjectData() → JSON complet du projet (composants + structure)
  • Nom du projet           → "school-{id}__{titre}__{LANG}"
          │
          ▼ POST /api/save
          │
[server.js — Traitement]
  │
  ├─ ÉTAPE 1 : buildStoredHtml()
  │   Construit un HTML complet :
  │   <head> : charset, viewport, title SEO, meta description,
  │            meta keywords, canonical, JSON-LD, <style>CSS</style>
  │   <body> : HTML GrapesJS
  │
  ├─ ÉTAPE 2 : Supabase — table "Projects" (upsert)
  │   Stocke : project_name, html (complet), css, project_data, properties
  │   → Réponse rapide possible dès ici (non-bloquant pour l'utilisateur)
  │
  ├─ ÉTAPE 3 : syncLegacyProjectToContent() → api/content.js
  │   Crée/met à jour dans le schéma structuré :
  │   organizations → entities → folders → pages → page_versions
  │   Chaque sauvegarde = nouvelle version numérotée (version_number++)
  │   pages.current_version_id → pointe vers la nouvelle version
  │
  └─ ÉTAPE 4 : integration_job créé dans Supabase (async)
      target: 'sfmc', action: 'publish_page', status: 'pending'
      Un worker traite ensuite :
        1. Minification HTML/CSS
        2. Optimisation images (upload SFMC Media Library)
        3. Envoi vers SFMC Content Builder (PATCH/POST)
        4. Mise à jour du job : status: 'done'
          │
          ▼
[Réponse JSON au client]
{ message: 'Project saved!', projectName, sfmc: { action, id }, content: { pageId, versionId } }
```

### Deux modèles de stockage coexistants

| Modèle | Table Supabase | Usage |
|---|---|---|
| **Legacy** | `Projects` | Accès rapide, compatibilité ascendante |
| **Structuré** | `pages` + `page_versions` | Versioning, workflow, SEO séparé, traductions |

---

## API Reference

### Pages

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/pages` | Liste toutes les pages (dashboard) |
| `GET` | `/api/project/:name` | Récupère un projet par nom |
| `POST` | `/api/save` | Sauvegarde un projet (upsert) |
| `POST` | `/api/pages/duplicate` | Duplique une page |
| `POST` | `/api/pages/delete` | Supprime / archive une page |
| `PATCH` | `/api/pages/:id/seo` | Met à jour les données SEO |
| `PATCH` | `/api/pages/:id/toggle` | Active / désactive une page |
| `GET` | `/api/pages/:id/url` | Retourne l'URL publique calculée |
| `POST` | `/api/pages/:id/link-translation` | Lie une traduction à sa source |
| `GET` | `/preview/:projectName` | Aperçu HTML d'une page |
| `GET` | `/sitemap.xml` | Sitemap XML de toutes les pages publiées |

### Contenu structuré (schéma avancé)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/organizations` | Liste les organisations |
| `GET` | `/api/entities` | Liste les entités (écoles) |
| `POST` | `/api/entities` | Crée/met à jour une entité |
| `GET` | `/api/folders` | Liste les dossiers |
| `POST` | `/api/folders` | Crée un dossier |
| `GET` | `/api/content/pages/:id` | Détails d'une page + versions |
| `POST` | `/api/content/pages/:id/versions` | Crée une nouvelle version |
| `POST` | `/api/content/pages/:id/restore` | Restaure une version antérieure |
| `POST` | `/api/content/pages/:id/move` | Déplace une page dans un dossier |
| `POST` | `/api/content/pages/:id/status` | Change le statut (draft→review→published) |
| `GET` | `/api/activity` | Journal d'activité |

### Écoles

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/schools` | Liste toutes les écoles |
| `GET` | `/api/school/:id` | Détails d'une école |
| `POST` | `/api/schools` | Crée une école |
| `PUT` | `/api/school/:id` | Met à jour une école |
| `DELETE` | `/api/school/:id` | Supprime une école (avec transfert) |

### Composants

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/components` | Sauvegarde un composant réutilisable |
| `GET` | `/api/components/:schoolId` | Liste les composants d'une école |

### Formulaires

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/forms/save-to-supabase` | Sauvegarde un formulaire |
| `GET` | `/api/forms/:schoolId` | Liste les formulaires d'une école |
| `DELETE` | `/api/forms/:id` | Supprime un formulaire |

### SFMC

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/sfmc/create-data-extension` | Crée une Data Extension SFMC |
| `POST` | `/api/sfmc/create-form-asset` | Crée un asset formulaire dans Content Builder |

### Intelligence artificielle

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/ai/generate` | Génère du contenu avec Gemini |
| `GET` | `/api/ai/history` | Historique des conversations |
| `POST` | `/api/ai/translate` | Traduit une page HTML vers une autre langue |

---

## Base de données — Schéma

### Tables principales

```sql
-- Organisation racine (groupe Reetain)
organizations (id, name, slug, metadata, created_at, updated_at)

-- Écoles / entités du réseau
entities (id, organization_id, name, slug, type, description,
          contact, base_url, brand, metadata, deleted, created_at)

-- Dossiers de classement des pages
folders (id, entity_id, parent_id, name, slug, sort_order, metadata)

-- Pages landing
pages (id, entity_id, folder_id, title, slug, language, status,
       current_version_id, seo, metadata,
       is_active, redirect_url,            ← toggle activer/désactiver
       source_page_id, is_source_page,     ← groupage traductions
       published_at, created_at, updated_at)

-- Versions historiques de chaque page
page_versions (id, page_id, version_number, html, css,
               project_data, created_by, change_summary, metadata)

-- Jobs d'intégration asynchrones (SFMC, optimisations)
integration_jobs (id, entity_id, page_id, page_version_id,
                  target, action, status, payload, result,
                  error, attempts, scheduled_at, processed_at)

-- Référentiel des écoles (config visuelle)
"Schools" (id, name, full_name, description, contact,
           base_url, color, secondary_color, color_light,
           emoji, default_blocks, deleted)

-- Projets legacy (compatibilité)
"Projects" (project_name, html, css, project_data, properties, created_at)

-- Composants réutilisables par école
components (id, school_id, name, category, content, properties, created_at)

-- Formulaires SFMC
"Forms" (id, school_id, name, html, css, ampscript,
         data_extension_name, created_at)

-- Historique des conversations IA
chat_history (id, sender, message, school_id, project_id, created_at)

-- Assets médias
assets (id, organization_id, entity_id, page_id, type, name, url, metadata)
```

### Workflow des statuts de page

```
draft → review → approved → published → archived
  ↓                                        ↓
  └──────────────→ deleted ←───────────────┘
                  (corbeille)
```

---

## Intégration SFMC

### Organisation des assets dans Content Builder

```
[SFMC_CATEGORY_NAME] (ex: PFE_Landing_Pages)
├── pages/
│   ├── efap/
│   │   ├── journee-portes-ouvertes    ← Landing page (Webpage asset)
│   │   └── open-day-2025
│   ├── brassart/
│   │   └── ...
│   └── icart/
│       └── ...
├── forms/
│   ├── efap/
│   │   └── formulaire-inscription     ← Formulaire (Code Snippet)
│   └── ...
└── blocks/
    ├── efap/
    │   └── mon-composant              ← Composant réutilisable
    └── ...
```

### Authentification SFMC

L'authentification utilise **OAuth 2.0 Client Credentials** :

```
POST https://{SFMC_SUBDOMAIN}.auth.marketingcloudapis.com/v2/token
{
  "grant_type": "client_credentials",
  "client_id": "...",
  "client_secret": "...",
  "account_id": "..."
}
```

Le token est **mis en cache** jusqu'à 60 secondes avant expiration.

### Gestion des conflits (Upsert)

Chaque asset est identifié par un `customerKey` unique :
- Pages : `slugify(titre_sans_préfixe_école)`
- Formulaires : `form-{schoolId}-{nom}`
- Composants : `comp-{schoolId}-{nom}`

Si l'asset existe → `PATCH` (mise à jour). Sinon → `POST` (création).

---

## Intelligence artificielle

### Assistant IA (Gemini 2.5 Flash)

Accessible depuis le panneau latéral de l'éditeur. L'assistant est **contextualisé par école** :

- Connaît le nom et le domaine métier de l'école active
- Génère des titres, accroches, et textes de CTA adaptés au secteur
- Conseille sur l'organisation du contenu
- Sauvegarde l'historique des conversations dans Supabase (`chat_history`)
- **Ne génère jamais de code HTML** — uniquement du texte à copier-coller

### Traduction automatique (Gemini 2.5 Flash)

Traduit le contenu HTML d'une page vers une autre langue :

- Préserve **intégralement** la structure HTML (balises, attributs, classes, IDs)
- Traduit uniquement le **texte visible**
- Adapte les formulations au contexte linguistique (pas de traduction mot à mot)
- Crée automatiquement une nouvelle version de page liée à la source

**Langues supportées** : FR, EN, ES, DE, IT, PT, et toutes les langues supportées par Gemini.

---

## Dashboard CMS

Accessible à `/pages-dashboard.html`, le dashboard offre une vue centralisée de toutes les landing pages.

### Fonctionnalités

| Fonction | Description |
|---|---|
| 📋 **Liste des pages** | Tableau avec titre, école, langue, statut, dernière mise à jour |
| 🔍 **Recherche** | Filtrage en temps réel par titre, nom de projet, titre SEO |
| 🏫 **Filtre par école** | Affichage des pages d'une école spécifique |
| 📊 **Filtre par statut** | Draft, En revue, Validé, Publié, Archivé |
| 📁 **Navigation latérale** | Organisation par école et par dossier |
| 📄 **Dupliquer** | Duplique une page avec son contenu et ses données SEO |
| 🗑️ **Corbeille** | Suppression douce — les pages sont récupérables |
| ⏱️ **Historique des versions** | Voir et restaurer les versions précédentes |
| 🚦 **Workflow statut** | Draft → En revue → Validé → Publié |
| 📁 **Déplacer** | Réorganiser les pages dans les dossiers |
| 🔍 **Config SEO** | Modifier le SEO d'une page sans ouvrir l'éditeur |
| 🟢🔴 **Toggle actif** | Activer / désactiver une page publiée |
| 🌐 **URL publique** | Afficher et copier l'URL finale de la page |
| 🗺️ **Traductions** | Voir toutes les versions linguistiques d'une page |

### Statistiques en temps réel

En haut du dashboard, quatre métriques sont affichées :
- **Nombre total de pages**
- **Écoles actives** (avec au moins une page)
- **Brouillons en cours**
- **Dernière activité** (date de la modification la plus récente)

---

## Éditeur de pages

L'éditeur est basé sur **[GrapesJS](https://grapesjs.com/)**, enrichi de nombreuses fonctionnalités métier.

### Panneaux disponibles

| Panneau | Description |
|---|---|
| 🧱 **Blocs** | Bibliothèque de composants drag-and-drop (filtrée par école) |
| 🎨 **Styles** | Éditeur CSS visuel |
| 📐 **Calques** | Arborescence des composants de la page |
| ⚙️ **Propriétés** | Titre, SEO, score SEO, langue |
| 📝 **Formulaires** | Liste des formulaires SFMC de l'école |
| 🤖 **IA** | Assistant de contenu Gemini |

### Blocs disponibles (par catégorie)

**Communs** : Hero, Rich Text, Two Column, CTA Button, Image Caption, Spacer, Programme List, Programme Editorial, Trois Raisons, Chiffres Clés, Horizontal Menu, Bande Rose, Carrousel, Carrousel Témoignages, Carrousel Campus

**EFAP** : Header EFAP, Footer EFAP

**Brassart** : Header Brassart, Footer Brassart

**Formulaires** : Form SFMC, Form Salesforce Core (CRM)

**Composants personnalisés** : chargés depuis Supabase par école

### Responsive design

L'éditeur propose 3 modes d'affichage :
- 🖥️ **Desktop** (par défaut)
- 📱 **Tablette** (600px)
- 📱 **Mobile** (375px)

---

## Gestion des écoles

Chaque école est une **entité** du réseau Reetain avec sa propre identité visuelle et configuration.

### Propriétés d'une école

| Propriété | Description | Exemple |
|---|---|---|
| `id` | Identifiant unique (slug) | `brassart` |
| `name` | Nom court | `Brassart` |
| `fullName` | Nom complet | `École Brassart` |
| `color` | Couleur primaire (CSS) | `#e91e63` |
| `secondaryColor` | Couleur secondaire | `#1a1a1a` |
| `baseUrl` | Domaine des landing pages | `https://lp.brassart.fr` |
| `contact` | Contact référent | `marketing@brassart.fr` |
| `emoji` | Icône représentative | `🎨` |
| `defaultBlocks` | Blocs chargés par défaut | `["header-brassart", "hero"]` |

### Variables CSS de marque

Les couleurs de l'école sont injectées automatiquement dans l'éditeur et dans les pages générées :

```css
:root {
  --brand-primary: #e91e63;
  --brand-secondary: #1a1a1a;
  --brand-primary-rgb: 233, 30, 99;
}
```

---

## Déploiement

### Local (développement)

```bash
node server.js
# ou
npm run dev   # avec nodemon (si installé)
```

### Vercel (production)

Le fichier `vercel.json` configure le déploiement :

```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/server.js" }]
}
```

```bash
vercel --prod
```

> **Note** : En environnement Vercel (serverless), le worker de traitement des `integration_jobs` utilise des **Vercel Cron Jobs** configurés séparément.

---

## Contribution

### Conventions de nommage

**Projets (nom interne)** :
```
school-{schoolId}__{titre-de-la-page}__{LANGUE}
Exemple : school-brassart__journee-portes-ouvertes__FR
```

**Composants** :
```
{schoolId}_{nom-du-composant}
Exemple : brassart_bandeau-inscription
```

**CustomerKey SFMC** :
```
slugify(titre-sans-préfixe-école)
Exemple : journee-portes-ouvertes
```

### Équipe de développement

| Fonctionnalité | Développeur |
|---|---|
| Architecture générale & SFMC | Zahira |
| Sauvegarde composants (Supabase only) | Zahira |
| SEO config & injection HTML | Zahira |
| Gestion des écoles (CRUD) | Mouad |
| Pages source & traductions | Nada |
| Dashboard CMS (UI) | Équipe |

---

## Licence

Projet académique — PFE (Projet de Fin d'Études) — Réseau Reetain  
© 2025 — Usage interne uniquement
