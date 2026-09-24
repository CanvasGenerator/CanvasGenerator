-- 009 — FAQ multilingue : une base de questions par langue.
--
-- Déjà présent sur la base actuelle (colonnes créées avant ce fichier) :
-- ce script est idempotent et sert à recréer le schéma ailleurs.
--
--   language       langue de la question (FR, EN…). Les pages EN puisent
--                  dans les questions EN de l'école.
--   source_faq_id  question FR dont celle-ci est la traduction. Sert à ne pas
--                  retraduire et à basculer un bloc FAQ FR → EN à la
--                  duplication d'une page. N'impose rien d'autre : une
--                  question EN se modifie ou se supprime sans toucher la FR.

ALTER TABLE faq ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'FR';
ALTER TABLE faq ADD COLUMN IF NOT EXISTS source_faq_id uuid REFERENCES faq(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_faq_language ON faq (language);
CREATE INDEX IF NOT EXISTS idx_faq_source_faq_id ON faq (source_faq_id);
