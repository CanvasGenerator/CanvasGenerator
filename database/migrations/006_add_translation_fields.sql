-- Add translation fields to pages table
-- is_original_language: boolean indicating if this page is in its original language
-- page_group_id: UUID reference to the original page for translated pages

ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_original_language boolean NOT NULL DEFAULT true;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_group_id uuid REFERENCES pages(id) ON DELETE SET NULL;

-- Create index for faster lookups by page_group_id
CREATE INDEX IF NOT EXISTS pages_page_group_id_idx ON pages(page_group_id);
CREATE INDEX IF NOT EXISTS pages_is_original_language_idx ON pages(is_original_language);
