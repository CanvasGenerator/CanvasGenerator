# Translation Fields Implementation

## Overview
Implemented support for tracking page translations with two new fields in the `pages` table:
- `is_original_language` (boolean): Indicates if a page is in its original language (default: true)
- `page_group_id` (UUID): References the original page for translated pages (null for original pages)

## Changes Made

### 1. Database Schema
- Added `is_original_language` column to `pages` table (default: true)
- Added `page_group_id` column to `pages` table (foreign key to pages.id, nullable)
- Created indexes on both columns for performance

**Migration**: `database/migrations/006_add_translation_fields.sql`

### 2. Backend Logic (api/content.js)
Added helper functions and enrichment logic:

#### `findSourcePageForTranslation(projectName, currentLanguage)`
Finds the source page for a translation by:
1. Parsing the legacy project name to extract school ID and title
2. Constructing the source project name (default language 'FR')
3. Looking up the page in the database

#### `updatePageTranslationFields(pageId, isOriginalLanguage, pageGroupId)`
Updates a page with translation metadata:
- If `isOriginalLanguage = true`: sets `page_group_id = null` (no reference)
- If `isOriginalLanguage = false`: sets `page_group_id` to the source page ID

#### `enrichProjectsWithType(projects)`
Enriches project data with translation type:
- Queries the `pages` table to find matching pages
- Adds a `type` field: "Original" or "Traduit"
- Default to "Original" if page not found

#### Updated `migrateLegacyProject(legacyProject, options)`
Enhanced to automatically:
1. Detect if a page is a translation (language != FR)
2. Find the source page if it's a translation
3. Set `is_original_language = false` for translated pages
4. Set `page_group_id` to the source page's ID
5. Update the source page with `is_original_language = true` and `page_group_id = null`

### 3. Frontend Logic (js/app.js)
Modified three translation scenarios to send additional metadata:

#### a) Duplicate/Translate modal (line ~1720)
```javascript
projectData = {
    projectName: newFullName,
    html: finalHtml,
    css: sourceProject.css,
    projectData: sourceProject.project_data,
    isTranslation: true,
    sourceProjectName: fullName,
    originalLanguage: 'FR'
}
```

#### b) Save with language change (line ~1283)
```javascript
projectData = {
    projectName: newFullName,
    html: finalHtml,
    css: editor.getCss(),
    projectData: editor.getProjectData(),
    properties: propsToSave,
    isTranslation: selectedLanguage !== originalLanguage && selectedLanguage !== 'FR',
    sourceProjectName: currentFullName,
    originalLanguage: originalLanguage
}
```

#### c) Save new project with language (line ~1400)
```javascript
projectData = {
    projectName: fullName,
    html: finalHtml,
    css: editor.getCss(),
    projectData: editor.getProjectData(),
    properties: propsToSave,
    isTranslation: lang !== 'FR',
    sourceProjectName: lang !== 'FR' ? `school-${schoolId}__${nameInput}__FR` : undefined,
    originalLanguage: 'FR'
}
```

#### d) Dashboard display
Added a `type` badge to the dashboard that shows:
- **"Original"** (blue badge) for original language pages
- **"Traduit"** (yellow badge) for translated pages

### 4. Server Routes
Updated `/api/save` endpoint in both `server.js` and `api/router.js` to:
1. Extract translation metadata from request body
2. Pass it to `syncLegacyProjectToContent()`

Updated `/api/projects` endpoint in both `server.js` and `api/router.js` to:
1. Fetch projects from the Projects table
2. Enrich each project with `type` from the pages table
3. Return enriched project data to frontend

## Workflow

### When a page is translated:
1. User creates a translation via the duplicate modal or language switcher
2. App.js sends the request with `isTranslation: true` and source project name
3. Server receives the request and forwards metadata
4. `migrateLegacyProject()` automatically:
   - Detects it's a translation
   - Finds the source page
   - Creates the translated page with:
     - `is_original_language = false`
     - `page_group_id = source_page_id`
   - Updates the source page to ensure:
     - `is_original_language = true`
     - `page_group_id = null`

### Result:
- All translations are linked to their source via `page_group_id`
- Original language pages have `page_group_id = null`
- Dashboard shows "Original" or "Traduit" badge for each page
- Easy to query all translations of a page

## Usage Examples

### Get all translations of a page:
```sql
SELECT * FROM pages 
WHERE page_group_id = 'original-page-id';
```

### Get all original language pages for a school:
```sql
SELECT * FROM pages 
WHERE entity_id = 'school-id' 
AND is_original_language = true;
```

### Check if a page is original:
```sql
SELECT * FROM pages 
WHERE id = 'page-id' 
AND is_original_language = true 
AND page_group_id IS NULL;
```

### Get source page of a translation:
```sql
SELECT * FROM pages 
WHERE id = (SELECT page_group_id FROM pages WHERE id = 'translated-page-id');
```

## Migration Steps

1. **Deploy the new code** (backend + frontend)
2. **Run the migration** in Supabase:
   - Execute `database/migrations/006_add_translation_fields.sql`
3. **Test** by creating a new translation:
   - The translated page should display "Traduit" badge in dashboard
   - The translated page should have `is_original_language = false`
   - The source page should have `page_group_id = null`
   - The translated page should have `page_group_id = source_page_id`

## Notes
- Default language is 'FR' (configurable in code)
- Backward compatible: existing pages default to `is_original_language = true` and `page_group_id = null`
- Enrichment of projects happens on every `/api/projects` request for real-time accuracy

