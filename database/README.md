# Database

`scalable-schema.sql` defines the future multi-entity content model.

Run it in Supabase SQL Editor before using the new content APIs.

The migration is additive: it does not remove the legacy `Projects`-based workflow.

## Current Priority

1. Keep existing builder working.
2. Write new structured data into `organizations`, `entities`, `folders`, `pages`, and `page_versions`.
3. Migrate dashboards progressively from `Projects` to the structured model.
4. Keep external integrations asynchronous and non-canonical.

## Legacy Migration Flow

After applying `scalable-schema.sql`, migrate existing `Projects` into the structured model:

```http
POST /api/content/migrate/legacy
```

Optional limit:

```http
POST /api/content/migrate/legacy?limit=100
```

The migration maps:

```text
school-efap__my-page__FR
```

to:

```text
organizations: Reetain Holding
entities: EFAP
folders: Legacy Projects
pages: my-page / FR
page_versions: current snapshot from Projects.html/css/project_data
```

The legacy `Projects` row is not deleted. This is intentional: migration is additive and reversible during the transition.

## Dual Write

`/api/save` still writes to the legacy `Projects` table. If the scalable tables exist, it also writes a new `page_versions` snapshot through a best-effort content sync. If the scalable tables are not installed yet, the legacy save still succeeds and the content sync is returned as skipped.
