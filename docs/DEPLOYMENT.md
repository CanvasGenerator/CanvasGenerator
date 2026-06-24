# Deployment

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:8000
```

## Checks

```bash
npm run check
```

This validates the syntax of the main API and browser modules.

## Supabase

Use the anon key for public reads, but configure a server-only service role key for backend writes and migrations:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code. Keep it only in `.env`, Vercel environment variables, or VPS secrets.

Run the SQL migration:

```text
database/scalable-schema.sql
```

Then migrate legacy projects when ready:

```http
POST /api/content/migrate/legacy
```

The legacy tables still used by the current app are:

```text
Projects
components
Forms
chat_history
Schools
```

The scalable model tables are:

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

## Vercel

`vercel.json` rewrites all API calls through:

```text
/api/router
```

Keep the number of files under `api/` below the Serverless Functions limit.

Current count: 3.

## VPS Future

The same code can be deployed to a VPS through:

```bash
npm start
```

Recommended future setup:

```text
Nginx -> Node server.js -> Supabase/SFMC/Gemini
```

Use Nginx for TLS, gzip, caching static assets, and reverse proxy.
