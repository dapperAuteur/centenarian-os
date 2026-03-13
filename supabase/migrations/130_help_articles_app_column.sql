-- 130_help_articles_app_column.sql
-- Adds an `app` discriminator to help_articles so contractor-os and centenarian-os
-- can share the same pgvector table but serve different documentation datasets.
-- Also widens the `role` CHECK constraint to include 'contractor' and 'lister'.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

-- 1. Widen role CHECK to include contractor roles
--    (existing constraint only allowed: student, teacher, admin, all)
ALTER TABLE public.help_articles
  DROP CONSTRAINT IF EXISTS help_articles_role_check;

ALTER TABLE public.help_articles
  ADD CONSTRAINT help_articles_role_check
    CHECK (role IN ('student', 'teacher', 'admin', 'contractor', 'lister', 'all'));

-- 2. Add app discriminator column
--    Default 'centenarian' ensures all existing rows are unaffected.
ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'centenarian';

-- 3. Index for fast app-filtered lookups
CREATE INDEX IF NOT EXISTS idx_help_articles_app ON public.help_articles(app);

-- 4. Update match_help_articles RPC to accept optional app_filter
CREATE OR REPLACE FUNCTION match_help_articles(
  query_embedding vector(768),
  match_count     INT     DEFAULT 5,
  role_filter     TEXT    DEFAULT NULL,
  app_filter      TEXT    DEFAULT NULL
)
RETURNS TABLE (id UUID, title TEXT, content TEXT, role TEXT, similarity FLOAT)
LANGUAGE SQL STABLE AS $$
  SELECT
    id,
    title,
    content,
    role,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.help_articles
  WHERE
    embedding IS NOT NULL
    AND (role_filter IS NULL OR role IN (role_filter, 'all'))
    AND (app_filter IS NULL OR app = app_filter)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMIT;
