-- Migration 007: Système FAQ dynamique centralisé
-- Banque globale de FAQs + liaisons école/page + toggle par école

-- 1. Activer pgcrypto si absent (UUID)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Banque globale de questions/réponses
--    Une FAQ est créée une seule fois et peut être partagée entre plusieurs écoles.
CREATE TABLE IF NOT EXISTS faq (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Liaison école × FAQ × type de page
--    Détermine quelles FAQs s'affichent pour quelle école et quel type de page.
--    page_type : 'general' | 'bachelor' | 'master' | 'mba' | 'jpo' | 'prepa' | etc.
--    Contrainte unique : une même FAQ ne peut être liée qu'une fois au couple (school, page_type).
CREATE TABLE IF NOT EXISTS school_page_faq (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   TEXT NOT NULL,
    faq_id      UUID NOT NULL REFERENCES faq(id) ON DELETE CASCADE,
    page_type   TEXT NOT NULL DEFAULT 'general',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, faq_id, page_type)
);

CREATE INDEX IF NOT EXISTS idx_school_page_faq_school  ON school_page_faq (school_id, page_type, sort_order);
CREATE INDEX IF NOT EXISTS idx_school_page_faq_faq     ON school_page_faq (faq_id);

-- 4. Colonne show_faq sur la table Schools
--    Permet d'activer / désactiver complètement le bloc FAQ pour une école.
ALTER TABLE "Schools" ADD COLUMN IF NOT EXISTS show_faq BOOLEAN NOT NULL DEFAULT TRUE;
