-- Migration: Add Component table for saving custom built components
CREATE TABLE IF NOT EXISTS "Component" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Custom Components',
    content TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying components by school
CREATE INDEX IF NOT EXISTS "Component_school_id_idx" ON "Component" (school_id);
