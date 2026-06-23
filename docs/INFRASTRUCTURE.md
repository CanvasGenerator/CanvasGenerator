# Infrastructure

CanvasGenerator is moving from a school-specific landing builder to a multi-entity content platform.

## Deployment Shape

The current production target is Vercel, with a limit of 12 Serverless Functions per deployment. Keep files under `api/` for real API entrypoints only.

Current API functions:

```text
api/router.js   Main dispatcher for Vercel rewrites
api/schools.js  School/entity management compatibility endpoint
api/content.js  Scalable content model endpoint
```

Shared code must live outside `api/`, mainly in `lib/`, to avoid being counted as a Serverless Function.

```text
lib/api-shared.js
lib/supabase.js
lib/sfmc.js
lib/schools.js
```

## Domain Model

The future model is:

```text
organizations
  entities
    workspaces
    folders
      pages
        page_versions
        page_drafts
        page_locks
assets
activity_logs
```

Legacy compatibility remains:

```text
Schools
Projects
components
Forms
chat_history
```

Do not encode business hierarchy in `project_name` for new features. Use IDs and relationships.

## API Conventions

`api/router.js` should stay thin:

1. Set CORS/options.
2. Resolve `pathname`.
3. Delegate to domain modules.
4. Keep legacy routes until migration is complete.

Domain modules expose a handler:

```js
async function handleContentRoute(req, res, pathname) {}
```

This keeps Vercel function count low while preserving domain boundaries.

## Content Save Strategy

New page content should be stored in:

```text
pages          Metadata, status, SEO, current version pointer
page_versions Immutable version snapshots: html, css, project_data
page_drafts   User-specific intermediate work
```

Do not store every page state directly in `pages`.

During transition, saves are dual-written:

```text
Projects        Legacy compatibility
page_versions   New canonical version history
```

The dual-write is best-effort. A failure in the structured model must not block the legacy builder until the migration is complete.

## Async Integrations

SFMC sync should be treated as an integration pipeline, not as the canonical content store.

Recommended future tables:

```text
integration_jobs
integration_targets
```

The app may publish to Supabase, SFMC, both, or neither depending on workflow. The canonical editorial state should remain in the database.

Current implementation prepares this through `integration_jobs`: publishing a page creates a pending `sfmc/publish_page` job. Processing that job is intentionally left to a future worker or integration service.

## VPS Readiness

For a future VPS deployment:

- Keep `server.js` as the local/VPS HTTP entrypoint.
- Keep `api/*` modules framework-light so they can be reused by `server.js`.
- Keep environment config in `.env`.
- Add a process manager later, for example PM2 or systemd.
- Put static assets behind Nginx or object storage when uploads become dynamic.
