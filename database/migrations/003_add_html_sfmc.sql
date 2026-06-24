-- Add html_sfmc to Projects (legacy table)
ALTER TABLE "Projects" ADD COLUMN IF NOT EXISTS html_sfmc text;

-- Add html_sfmc to page_versions (structured table)
ALTER TABLE page_versions ADD COLUMN IF NOT EXISTS html_sfmc text;
