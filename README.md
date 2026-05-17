<p align="center">
  <img src="assets/LogoReetain.png" alt="Reetain Logo" width="80" />
</p>

<h1 align="center">🚀 CanvasGenerator — Landing Page Builder</h1>

<p align="center">
  <strong>A no-code, drag-and-drop landing page builder for multi-school ecosystems.</strong><br/>
  Built with <a href="https://grapesjs.com/">GrapesJS</a> · Backed by <a href="https://supabase.com/">Supabase</a> · Deployable on <a href="https://vercel.com/">Vercel</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/GrapesJS-Visual_Editor-4285F4?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PC9zdmc+" alt="GrapesJS" />
  <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Vercel-Deployment-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/SFMC-Integration-0176D3?logo=salesforce&logoColor=white" alt="SFMC" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Environment Variables](#-environment-variables)
- [Running Locally](#-running-locally)
- [Deployment (Vercel)](#-deployment-vercel)
- [API Reference](#-api-reference)
- [Block Library](#-block-library)
- [Schools Configuration](#-schools-configuration)
- [SFMC Integration](#-sfmc-integration)
- [Usage Guide](#-usage-guide)
- [Export Options](#-export-options)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

**CanvasGenerator** is a no-code landing page builder developed at [Reetain Consulting](https://reetain.com/) as an internal tool to streamline landing page creation for a multi-school ecosystem. It allows marketing teams to visually design, customize, and deploy branded landing pages — without writing any code.

Each school (EFAP, BRASSART, ICART, etc.) has its own branded identity (colors, blocks, templates) while sharing a common infrastructure. Pages are persisted in **Supabase** and can optionally be synced to **Salesforce Marketing Cloud (SFMC)** Content Builder for email/CloudPages publishing.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🎨 **Visual Drag & Drop Editor** | Powered by GrapesJS — drag blocks onto the canvas and edit in real time |
| 🏫 **Multi-School Support** | Each school has its own brand colors, default blocks, and components |
| 🧱 **Pre-built Block Library** | 20+ ready-to-use blocks: hero, headers, footers, forms, carousels, CTAs, etc. |
| 💾 **Cloud Persistence** | Projects saved to Supabase (PostgreSQL) with upsert logic |
| ☁️ **SFMC Sync** | Auto-sync landing pages to Salesforce Marketing Cloud Content Builder |
| 📱 **Responsive Preview** | Switch between Desktop, Tablet (600px), and Mobile (375px) viewports |
| 📦 **Multi-format Export** | Export as standalone HTML, JSON (GrapesJS project data), or production ZIP |
| 🧩 **Custom Components** | Save entire page layouts as reusable components per school |
| 🎯 **Brand Variables** | CSS custom properties (`--brand-primary`, `--brand-secondary`) auto-injected |
| 🗂️ **Project Management** | Create, open, save, and preview projects from a centralized dashboard |
| 👋 **Welcome Guide** | Built-in onboarding modal for first-time users |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                     │
│  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ School       │  │ GrapesJS │  │ Export / Preview   │  │
│  │ Selector     │→ │ Builder  │→ │ (HTML/JSON/ZIP)    │  │
│  └──────────────┘  └──────────┘  └───────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────┐
│                  Node.js Server (server.js)              │
│          or Vercel Serverless Functions (api/)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │ /api/save│  │/api/     │  │/api/     │  │/preview │  │
│  │          │  │projects  │  │schools   │  │/:name   │  │
│  └─────┬────┘  └─────┬────┘  └──────────┘  └─────────┘  │
│        │             │                                   │
│   ┌────▼─────────────▼────┐    ┌───────────────────┐     │
│   │      Supabase         │    │   SFMC Content     │     │
│   │   (PostgreSQL DB)     │    │   Builder (REST)   │     │
│   └───────────────────────┘    └───────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML/CSS/JS + [GrapesJS](https://grapesjs.com/) visual editor |
| **Backend** | Node.js HTTP server (`server.js`) / Vercel Serverless Functions |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL via REST API) |
| **CRM Sync** | Salesforce Marketing Cloud REST API (OAuth2 client credentials) |
| **Styling** | Custom CSS (`builder.css`) + Google Fonts (Inter) |
| **Icons** | Font Awesome 6 |
| **Export** | JSZip + FileSaver.js |
| **Deployment** | Vercel (with `vercel.json` rewrites & headers) |

---

## 📁 Project Structure

```
CanvasGenerator/
├── api/                        # Vercel serverless functions
│   ├── save.js                 #   POST /api/save — save project to Supabase + SFMC
│   ├── preview.js              #   GET  /preview/:name — render saved page
│   ├── projects.js             #   GET  /api/projects — list all projects
│   ├── project.js              #   GET  /api/project/:name — get single project
│   ├── project/
│   │   └── [name].js           #   Dynamic route handler
│   ├── schools.js              #   GET  /api/schools — list schools
│   ├── school.js               #   GET  /api/school/:id — get school config
│   ├── school/
│   │   └── [id].js             #   Dynamic route handler
│   └── log.js                  #   Logging utility
│
├── assets/                     # Static assets
│   ├── LogoReetain.png         #   App logo / favicon
│   ├── block-thumbnails/       #   26 SVG thumbnails for block previews
│   ├── *.jpg / *.png / *.webp  #   Demo images (campus, testimonials, logos)
│   └── temoignage-video.mp4    #   Sample testimonial video
│
├── blocks/                     # GrapesJS block definitions (modular)
│   ├── index.js                #   Block registry — imports & registers all blocks
│   ├── headers.js              #   Shared header utilities
│   ├── hero/                   #   Hero section block
│   ├── header-efap/            #   EFAP-branded header
│   ├── header-brassart/        #   BRASSART-branded header
│   ├── footer-efap/            #   EFAP-branded footer
│   ├── footer-brassart/        #   BRASSART-branded footer
│   ├── form-sfmc/              #   SFMC lead capture form
│   ├── form-salesforce-core/   #   Salesforce Core Web-to-Lead form
│   ├── carousel/               #   Image carousel
│   ├── Carrousel-Campus/       #   Campus showcase carousel
│   ├── carrousel-temoignages/  #   Testimonials carousel
│   ├── horizontal-menu/        #   Horizontal navigation menu
│   ├── programme-list/         #   Programme listing block
│   ├── programme-editorial/    #   Editorial programme block
│   ├── trois-raisons/          #   "3 reasons" section
│   ├── chiffres-cles/          #   Key figures / statistics
│   ├── bande-rose/             #   Pink accent banner (Brassart)
│   ├── cta-button/             #   Call-to-action button
│   ├── rich-text/              #   Rich text block
│   ├── two-column/             #   Two-column layout
│   ├── image-caption/          #   Image with caption
│   ├── spacer/                 #   Vertical spacer
│   ├── icart/                  #   ICART-specific blocks
│   └── basics/                 #   Basic building blocks
│
├── css/
│   └── builder.css             # Full editor UI stylesheet (~33KB)
│
├── js/
│   ├── app.js                  # Main application — editor init, UI, project mgmt
│   ├── export.js               # Export module (HTML, JSON, ZIP)
│   └── storage.js              # Local storage auto-save metadata
│
├── lib/                        # Shared server-side libraries
│   ├── supabase.js             #   Supabase REST client wrapper
│   ├── sfmc.js                 #   SFMC Content Builder integration (OAuth2 + CRUD)
│   └── schools.js              #   Schools JSON reader utility
│
├── projects/                   # Legacy local project storage (deprecated)
│
├── index.html                  # Builder editor page (GrapesJS canvas)
├── school-selector.html        # Dashboard / school selection page
├── schools.json                # Schools configuration (id, name, colors, blocks)
├── server.js                   # Local development HTTP server
├── package.json                # Node.js dependencies (dotenv, mongodb)
├── vercel.json                 # Vercel deployment config (rewrites, CSP headers)
├── .env                        # Environment variables (⚠️ not committed)
└── .gitignore                  # Git ignore rules
```

---

## 📌 Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- A **Supabase** project with the following table:

### Supabase Database Schema

#### `Projects` table

| Column | Type | Notes |
|---|---|---|
| `project_name` | `text` | **Primary key** — used for upsert |
| `html` | `text` | Full rendered HTML of the page |
| `css` | `text` | Extracted CSS styles |
| `project_data` | `text` | Serialized GrapesJS project JSON |
| `created_at` | `timestamptz` | Auto-set on insert (`now()`) |

#### `components` table

| Column | Type | Notes |
|---|---|---|
| `id` | `int8` | Auto-incrementing primary key |
| `school_id` | `text` | Foreign key to school identifier |
| `name` | `text` | Display name of the component |
| `category` | `text` | Block category label |
| `content` | `text` | HTML+CSS content string |

---

## ⚡ Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Elmelssezahira/CanvasGenerator.git
cd CanvasGenerator

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Then edit .env with your credentials (see below)

# 4. Start the local server
node server.js
```

The app will be available at **http://localhost:8000/**

---

## 🔐 Environment Variables

Create a `.env` file at the project root:

```env
# ── Required ──────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# ── Optional: SFMC Integration ────────────────────────────
SFMC_SUBDOMAIN=mc6abc123def456
SFMC_CLIENT_ID=your_client_id
SFMC_CLIENT_SECRET=your_client_secret
SFMC_ACCOUNT_ID=123456789                 # Business Unit MID
SFMC_CATEGORY_NAME=Landing Pages          # Content Builder folder name
SFMC_CATEGORY_ID=                         # Or use numeric folder ID directly
SFMC_ASSET_TYPE_ID=220                    # 220 = code snippet (default)
SFMC_ASSET_TYPE_NAME=webpage

# ── Optional: Server ──────────────────────────────────────
PORT=8000
```

> ⚠️ **Important:** The `.env` file is listed in `.gitignore` and must never be committed.

---

## 🖥 Running Locally

```bash
# Start the development server
node server.js
```

```
✅ Serveur lancé sur http://localhost:8000/
🔗 Supabase URL: https://your-project.supabase.co
📚 Dashboard: http://localhost:8000/
🔨 Builder direct: http://localhost:8000/?school=efap
```

| URL | Page |
|---|---|
| `http://localhost:8000/` | School Selector Dashboard |
| `http://localhost:8000/?school=efap` | Builder for EFAP |
| `http://localhost:8000/?school=brassart` | Builder for BRASSART |
| `http://localhost:8000/?school=icart` | Builder for ICART |
| `http://localhost:8000/?school=master` | Master Template Editor |
| `http://localhost:8000/preview/<project_name>` | Live Preview of a saved project |

---

## 🚢 Deployment (Vercel)

The project is configured for **Vercel** deployment out of the box.

### 1. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 2. Set Environment Variables

In the Vercel dashboard, add `SUPABASE_URL`, `SUPABASE_KEY`, and any optional SFMC variables.

### 3. Configuration (`vercel.json`)

The `vercel.json` configures:
- **CSP Headers** — `frame-ancestors` allowing embedding in Salesforce Marketing Cloud (`*.exacttarget.com`, `*.marketingcloudapps.com`)
- **URL Rewrites** — Maps clean URLs to serverless functions:
  - `/preview/:name` → `/api/preview?name=:name`
  - `/api/school/:id` → `/api/school?id=:id`
  - `/api/project/:name` → `/api/project?name=:name`

---

## 📡 API Reference

### Schools

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schools` | List all configured schools |
| `GET` | `/api/school/:id` | Get a single school configuration |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects (name + created_at) |
| `GET` | `/api/project/:name` | Get full project data by name |
| `POST` | `/api/save` | Save/upsert a project |

#### `POST /api/save` — Request Body

```json
{
  "projectName": "school-efap__ma-landing-page",
  "html": "<section>...</section>",
  "css": ".hero { ... }",
  "projectData": { /* GrapesJS project JSON */ }
}
```

#### `POST /api/save` — Response

```json
{
  "message": "Project saved!",
  "projectName": "school-efap__ma-landing-page",
  "sfmc": {
    "skipped": false,
    "action": "created",
    "id": 12345,
    "name": "ma-landing-page"
  }
}
```

### Components

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/components/:school_id` | Get custom components for a school |
| `POST` | `/api/components` | Save a new custom component |

### Preview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/preview/:projectName` | Render the saved project as a standalone HTML page |

> The preview endpoint injects brand CSS variables (`--brand-primary`, `--brand-secondary`) based on the school prefix in the project name.

---

## 🧱 Block Library

The builder ships with **20+ pre-built, responsive blocks** organized by category:

### Essential Blocks
| Block | ID | Description |
|---|---|---|
| Hero Section | `hero` | Full-width hero with gradient overlay, title, subtitle, and dual CTAs |
| Two Column | `two-column` | Side-by-side layout |
| Rich Text | `rich-text` | Editable text block |
| CTA Button | `cta-button` | Styled call-to-action button |
| Image + Caption | `image-caption` | Image with descriptive text |
| Spacer | `spacer` | Vertical spacing element |

### EFAP Components
| Block | ID |
|---|---|
| Header EFAP | `header-efap` |
| Footer EFAP | `footer-efap` |

### BRASSART Components
| Block | ID |
|---|---|
| Header BRASSART | `header-brassart` |
| Footer BRASSART | `footer-brassart` |
| Bande Rose | `bande-rose` |
| Trois Raisons | `trois-raisons` |
| Programme Éditorial | `programme-editorial` |

### Shared Blocks
| Block | ID |
|---|---|
| Horizontal Menu | `horizontal-menu` |
| Programme List | `programme-list` |
| Chiffres Clés | `chiffres-cles` |
| Formulaire SFMC | `form-sfmc` |
| Formulaire Salesforce Core | `form-salesforce-core` |
| Carousel | `carousel` |
| Carrousel Témoignages | `carrousel-temoignages` |
| Carrousel Campus | `Carrousel-Campus` |

### Adding a New Block

1. Create a new directory under `blocks/`:
   ```
   blocks/my-block/
   └── index.js
   ```

2. Export a default function:
   ```js
   export default function(editor, categories) {
       editor.BlockManager.add('my-block', {
           label: 'My Block',
           category: categories.ESSENTIAL,
           content: `<section>...</section><style>...</style>`,
       });
   }
   ```

3. Import and register in `blocks/index.js`:
   ```js
   import myBlock from './my-block/index.js';
   // Add to the array in registerBlocks()
   ```

4. *(Optional)* Add an SVG thumbnail in `assets/block-thumbnails/my-block.svg` and reference it in `BLOCK_THUMBNAILS` in `js/app.js`.

---

## 🏫 Schools Configuration

Schools are defined in `schools.json`:

```json
[
  {
    "id": "efap",
    "name": "EFAP",
    "fullName": "École Française des Attachés de Presse",
    "description": "Communication, Relations Presse & Médias",
    "color": "#d9d0c1",
    "secondaryColor": "#1a1a1a",
    "colorLight": "rgba(217,208,193,0.2)",
    "emoji": "📰",
    "defaultBlocks": [
      "header-efap", "hero", "horizontal-menu",
      "programme-list", "form-sfmc", "chiffres-cles",
      "cta-button", "footer-efap"
    ]
  }
]
```

| Field | Description |
|---|---|
| `id` | Unique identifier (used in URL params and project name prefixes) |
| `name` | Short display name |
| `fullName` | Full institutional name |
| `description` | Brief description shown on the dashboard |
| `color` | Primary brand color (hex) — injected as `--brand-primary` |
| `secondaryColor` | Secondary brand color (hex) — injected as `--brand-secondary` |
| `colorLight` | Light variant for UI accents |
| `emoji` | Emoji icon for the dashboard card |
| `defaultBlocks` | Array of block IDs loaded when creating a new project |

### Adding a New School

1. Add a new entry to `schools.json`
2. *(Optional)* Create school-specific blocks under `blocks/`
3. *(Optional)* Add header/footer blocks with the school's branding
4. The school will automatically appear on the dashboard

---

## ☁️ SFMC Integration

When SFMC environment variables are configured, every project save triggers an automatic sync to **Salesforce Marketing Cloud Content Builder**.

### How it Works

1. On `POST /api/save`, after saving to Supabase, the server calls `syncProjectToSfmc()`
2. The SFMC module authenticates via **OAuth2 client credentials** flow
3. It searches for an existing asset by `customerKey` (derived from the project name)
4. If found → **PATCH** (update). If not → **POST** (create)
5. The asset is stored in the configured Content Builder folder

### Asset Mapping

| Field | Value |
|---|---|
| `name` | Project name (without school prefix) |
| `customerKey` | Slugified project name |
| `assetType` | Code Snippet (ID: 220) or custom |
| `content` | Full rendered HTML |
| `category` | Resolved folder by name or ID |

### Required SFMC Permissions

Your Installed Package must have:
- **Channels → Web** (Read, Write)
- **Assets → Documents and Images** (Read, Write)

---

## 📖 Usage Guide

### 1. Select a School
Navigate to the dashboard (`/`) and click on a school card to enter the builder.

### 2. Create a New Project
Click **New** in the toolbar → enter a project name → the default template for the selected school loads.

### 3. Build Your Page
- **Drag blocks** from the left sidebar onto the canvas
- **Click any element** to edit text, images, and styles
- **Use the right sidebar** to adjust CSS properties and HTML traits
- **Switch devices** (Desktop / Tablet / Mobile) in the toolbar

### 4. Save & Preview
- Click **Save Project** to persist to Supabase (+ SFMC if configured)
- Click **Preview** to open the rendered page in a new tab

### 5. Manage Projects
- Click **Open** to load a previously saved project
- Use **File ▼** to export in different formats

---

## 📦 Export Options

| Format | Description | Use Case |
|---|---|---|
| **HTML** | Single-file with inline `<style>` | Quick sharing, email integration |
| **JSON** | GrapesJS project data | Backup, re-import into the builder |
| **ZIP** | `index.html` + `style.css` + `project.json` | Production deployment, handoff |

---

## 🤝 Contributing

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add new block"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a **Pull Request**

### Code Conventions

- Block definitions follow the modular pattern in `blocks/`
- Server-side shared code goes in `lib/`
- Vercel serverless functions go in `api/`
- Use CSS custom properties (`--brand-*`) for brand-dependent styles
- Keep blocks responsive (include `@media` queries)

---

## 📄 License

This project is developed internally at **Reetain Consulting** as part of a PFE (Projet de Fin d'Études).

---

<p align="center">
  Made with ❤️ by <strong>Zahira El Melsse</strong> at <strong>Reetain Consulting</strong>
</p>
