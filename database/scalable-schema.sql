create extension if not exists "pgcrypto";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null default 'entity',
  description text not null default '',
  contact text not null default '',
  base_url text not null default '',
  brand jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  name text not null,
  slug text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, slug)
);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  parent_id uuid references folders(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, parent_id, slug)
);

create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  title text not null,
  slug text not null,
  language text not null default 'FR',
  status text not null default 'draft',
  current_version_id uuid,
  seo jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, folder_id, slug, language)
);

create table if not exists page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  version_number integer not null,
  html text not null default '',
  css text not null default '',
  project_data jsonb not null default '{}'::jsonb,
  created_by uuid,
  change_summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (page_id, version_number)
);

alter table pages
  drop constraint if exists pages_current_version_id_fkey,
  add constraint pages_current_version_id_fkey
  foreign key (current_version_id) references page_versions(id) on delete set null;

create table if not exists page_drafts (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  user_id uuid not null,
  html text not null default '',
  css text not null default '',
  project_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (page_id, user_id)
);

create table if not exists page_locks (
  page_id uuid primary key references pages(id) on delete cascade,
  user_id uuid not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  page_id uuid references pages(id) on delete set null,
  type text not null default 'file',
  name text not null,
  url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  page_id uuid references pages(id) on delete set null,
  actor_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists "Schools" (
  id text primary key,
  name text not null,
  full_name text,
  description text,
  contact text,
  base_url text,
  color text,
  secondary_color text,
  color_light text,
  emoji text,
  default_blocks jsonb default '[]'::jsonb,
  deleted boolean default false
);

create index if not exists idx_entities_organization on entities(organization_id);
create index if not exists idx_folders_entity_parent on folders(entity_id, parent_id);
create index if not exists idx_pages_entity_folder on pages(entity_id, folder_id);
create index if not exists idx_page_versions_page on page_versions(page_id, version_number desc);
create index if not exists idx_page_drafts_page_user on page_drafts(page_id, user_id);
create index if not exists idx_activity_logs_scope on activity_logs(organization_id, entity_id, page_id, created_at desc);
