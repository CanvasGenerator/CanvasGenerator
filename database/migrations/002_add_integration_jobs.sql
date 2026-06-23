alter table pages
  add column if not exists published_at timestamptz;

create table if not exists integration_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  entity_id uuid references entities(id) on delete set null,
  page_id uuid references pages(id) on delete set null,
  page_version_id uuid references page_versions(id) on delete set null,
  target text not null,
  action text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_jobs_status on integration_jobs(status, scheduled_at);
create index if not exists idx_integration_jobs_page on integration_jobs(page_id, created_at desc);
