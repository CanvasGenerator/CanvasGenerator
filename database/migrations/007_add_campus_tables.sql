-- Migration: Add campuses and page_campuses link tables

CREATE TABLE IF NOT EXISTS campuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_campuses (
    page_name TEXT NOT NULL REFERENCES "Projects"(project_name) ON DELETE CASCADE,
    campus_id TEXT NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
    PRIMARY KEY (page_name, campus_id)
);

-- Seed default campuses
INSERT INTO campuses (id, name, slug) VALUES
('aix', 'Aix-en-Provence', 'aix-en-provence'),
('bordeaux', 'Bordeaux', 'bordeaux'),
('lille', 'Lille', 'lille'),
('lyon', 'Lyon', 'lyon'),
('montpellier', 'Montpellier', 'montpellier'),
('nice', 'Nice', 'nice'),
('paris', 'Paris', 'paris'),
('rennes', 'Rennes', 'rennes'),
('strasbourg', 'Strasbourg', 'strasbourg'),
('toulouse', 'Toulouse', 'toulouse'),
('miami', 'Miami', 'miami'),
('new-york', 'New York', 'new-york'),
('shanghai', 'Shanghai', 'shanghai'),
('santander', 'Santander', 'santander'),
('amsterdam', 'Amsterdam', 'amsterdam')
ON CONFLICT (id) DO NOTHING;
