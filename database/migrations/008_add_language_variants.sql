-- Migration 008 — Variantes de langue (refonte traduction)
--
-- Modèle : 1 landing page = 1 projet (ligne `pages`), N variantes de langue.
-- Chaque variante possède sa propre version courante (page_versions).
-- On ne crée JAMAIS un nouveau projet pour traduire.
--
-- Idempotente : ré-exécutable sans risque.

-- 1) Table des variantes de langue d'une page.
--    Le "current version" dépend de la langue → il vit ICI, pas sur pages.
create table if not exists page_variants (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  language text not null default 'FR',
  -- Version courante affichée pour cette langue.
  current_version_id uuid references page_versions(id) on delete set null,
  -- Version de la langue D'ORIGINE à partir de laquelle cette traduction a été
  -- générée (null pour la variante d'origine). Sert à détecter qu'une traduction
  -- est périmée : source_version_id <> current_version_id de la variante d'origine.
  source_version_id uuid references page_versions(id) on delete set null,
  -- 'up_to_date' | 'outdated' | 'draft'
  status text not null default 'up_to_date',
  -- SEO PROPRE à la langue (title / description / keywords / canonical / schemaLd).
  seo jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, language)
);

create index if not exists idx_page_variants_page on page_variants(page_id);
create index if not exists idx_page_variants_page_lang on page_variants(page_id, language);

-- 2) Rattacher chaque version à sa variante + dénormaliser la langue (pratique
--    pour l'historique par langue). Colonnes ajoutées de façon non destructive.
alter table page_versions add column if not exists page_variant_id uuid references page_variants(id) on delete cascade;
alter table page_versions add column if not exists language text not null default 'FR';

create index if not exists idx_page_versions_variant on page_versions(page_variant_id, version_number desc);
create index if not exists idx_page_versions_page_lang on page_versions(page_id, language, version_number desc);
