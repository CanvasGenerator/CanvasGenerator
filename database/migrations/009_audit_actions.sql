-- ============================================================================
--  010 — Suivi « modifié par » étendu + journal d'activité pour l'admin
-- ============================================================================
--  Deux besoins distincts :
--
--   1. « Modifié par » sur CHAQUE objet éditable — FAQ, composants/blocs,
--      paramètres d'école (couleurs, codes GTM). Dénormalisé sur la table de
--      l'objet pour que la liste s'affiche sans jointure.
--
--   2. Journal d'activité complet dans `activity_logs`, réservé à une section
--      ADMIN. La table existe déjà mais son `actor_id` attend un UUID : nos
--      utilisateurs viennent de SFMC et n'en ont pas. D'où deux colonnes texte.
--
--  Idempotent : `if not exists` partout, rejouable sans risque.
-- ============================================================================

-- ── 1. Journal d'activité (admin) ───────────────────────────────────────────
alter table public.activity_logs
  add column if not exists actor_name  text,
  add column if not exists actor_email text;

-- Le journal se lit toujours du plus récent au plus ancien, et filtré par type
-- d'action ou par école.
create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);
create index if not exists activity_logs_action_idx
  on public.activity_logs (action);


-- ── 2. FAQ ──────────────────────────────────────────────────────────────────
-- `updated_at` existe déjà sur cette table.
alter table public.faq
  add column if not exists updated_by_name  text,
  add column if not exists updated_by_email text;


-- ── 3. Composants / blocs personnalisés ─────────────────────────────────────
-- ⚠ Cette table n'a QUE `created_at` : on ajoute aussi `updated_at`, sinon on
-- ne peut pas afficher de date de dernière modification.
-- Nom en majuscule → guillemets obligatoires en SQL.
alter table public."Component"
  add column if not exists updated_at       timestamptz,
  add column if not exists updated_by_name  text,
  add column if not exists updated_by_email text;


-- ── 4. Écoles : couleurs, paramètres, codes GTM ─────────────────────────────
-- Les codes GTM vivent dans custom_head_code / custom_body_code, donc toute
-- modification de GTM est une modification d'école.
-- Là aussi, aucune colonne de date de modification n'existait.
alter table public."Schools"
  add column if not exists updated_at       timestamptz,
  add column if not exists updated_by_name  text,
  add column if not exists updated_by_email text;


-- ── 5. Formulaires (adjacent, même besoin) ──────────────────────────────────
alter table public."Forms"
  add column if not exists updated_at       timestamptz,
  add column if not exists updated_by_name  text,
  add column if not exists updated_by_email text;


-- Rappel : `pages.updated_by_name/email` et `page_versions.created_by_name`
-- ont déjà été ajoutés à la main lors de l'étape précédente.
