-- 042_help_rag.sql
-- Adds in-app help article storage for the Academy RAG system.
-- Each row is a chunk of the tutorial docs, embedded via Gemini text-embedding-004 (768-dim).

BEGIN;

-- pgvector is already enabled from 039_lms_schema.sql

CREATE TABLE IF NOT EXISTS public.help_articles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'all'
                CHECK (role IN ('student', 'teacher', 'admin', 'all')),
  embedding   vector(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: all authenticated users can read articles relevant to their role
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read help articles"
  ON public.help_articles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert/update help articles"
  ON public.help_articles FOR ALL
  USING (false); -- service role bypasses RLS

-- Similarity search function
CREATE OR REPLACE FUNCTION match_help_articles(
  query_embedding vector(768),
  match_count     INT     DEFAULT 5,
  role_filter     TEXT    DEFAULT NULL
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
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMIT;
