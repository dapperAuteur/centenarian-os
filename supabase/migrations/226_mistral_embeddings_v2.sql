-- 226_mistral_embeddings_v2.sql
-- Work.WitUS embeddings move from Gemini gemini-embedding-001 (768 dimensions) to Mistral
-- mistral-embed (1024 dimensions), the move Learn.WitUS made in its migrations 0076 and 0079.
-- APPLIED BY HAND in the Supabase SQL editor (docs/05-operations.md section 9), then
-- `NOTIFY pgrst, 'reload schema';` so PostgREST sees the new columns and functions.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).
--
-- ADDITIVE ONLY, because this database is shared with CentenarianOS:
--   - help_articles holds CentenarianOS's rows (app = 'centenarian') too. CentenarianOS still writes
--     the legacy `embedding` vector(768) column and reads it through match_help_articles. Neither is
--     touched here.
--   - The new `embedding_v2` vector(1024) columns, their hnsw indexes and the *_v2 functions are new
--     objects; only Work.WitUS code uses them.
--   - The legacy `embedding` columns, their indexes and match_help_articles / match_union_chunks stay
--     until a later cleanup migration (after CentenarianOS has moved off them, or after the Neon
--     cutover). Work.WitUS stops writing union_document_chunks.embedding with this change.
--
-- SAFE TO RUN TWICE: IF NOT EXISTS on columns and indexes, CREATE OR REPLACE on functions with an
-- unchanged signature, and REVOKE / GRANT are idempotent.
--
-- The hnsw indexes are built on mostly NULL columns; rows are filled by /admin/sync (Knowledge Sync
-- for help articles, Re-embed Union Documents for union chunks).

BEGIN;

-- 1. Columns ------------------------------------------------------------------------------------
ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(1024);

ALTER TABLE public.union_document_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(1024);

-- 2. Indexes (cosine, the operator the functions order by) ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_help_articles_embedding_v2
  ON public.help_articles USING hnsw (embedding_v2 vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_union_chunks_embedding_v2
  ON public.union_document_chunks USING hnsw (embedding_v2 vector_cosine_ops);

-- 3. match_help_articles_v2: match_help_articles (migrations 130, 156) on embedding_v2 ------------
CREATE OR REPLACE FUNCTION public.match_help_articles_v2(
  query_embedding vector(1024),
  match_count     INT  DEFAULT 5,
  role_filter     TEXT DEFAULT NULL,
  app_filter      TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, title TEXT, content TEXT, role TEXT, similarity FLOAT)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    h.id,
    h.title,
    h.content,
    h.role,
    1 - (h.embedding_v2 <=> query_embedding) AS similarity
  FROM public.help_articles h
  WHERE
    h.embedding_v2 IS NOT NULL
    AND (role_filter IS NULL OR h.role IN (role_filter, 'all'))
    AND (app_filter IS NULL OR h.app = app_filter)
  ORDER BY h.embedding_v2 <=> query_embedding
  LIMIT match_count;
$$;

-- 4. match_union_chunks_v2: match_union_chunks (migration 109) on embedding_v2 -------------------
CREATE OR REPLACE FUNCTION public.match_union_chunks_v2(
  query_embedding vector(1024),
  match_count     INT  DEFAULT 5,
  union_filter    TEXT DEFAULT NULL,
  p_user_id       UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  chunk_index INT,
  doc_name TEXT,
  union_local TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.document_id,
    c.chunk_text,
    c.chunk_index,
    d.name AS doc_name,
    d.union_local,
    1 - (c.embedding_v2 <=> query_embedding) AS similarity
  FROM public.union_document_chunks c
  JOIN public.union_documents d ON d.id = c.document_id
  WHERE d.status = 'ready'
    AND c.embedding_v2 IS NOT NULL
    AND (d.user_id = p_user_id OR d.is_shared = true)
    AND (union_filter IS NULL OR d.union_local = union_filter)
  ORDER BY c.embedding_v2 <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Only the server calls these (service role, /api/help/chat and /api/contractor/union/chat).
--    match_union_chunks_v2 takes the user id as an argument, so it must not be callable by anon or
--    authenticated clients through PostgREST.
REVOKE ALL ON FUNCTION public.match_help_articles_v2(vector, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_union_chunks_v2(vector, INT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_help_articles_v2(vector, INT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_union_chunks_v2(vector, INT, TEXT, UUID) TO service_role;

COMMIT;

-- Checks (read-only; run after the COMMIT):
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE column_name = 'embedding_v2' AND table_name IN ('help_articles', 'union_document_chunks');
--   SELECT indexname FROM pg_indexes WHERE indexname LIKE '%embedding_v2%';
--   SELECT proname FROM pg_proc WHERE proname IN ('match_help_articles_v2', 'match_union_chunks_v2');
--   SELECT app, count(*) AS rows, count(embedding_v2) AS v2 FROM public.help_articles GROUP BY app;
--   SELECT count(*) AS rows, count(embedding_v2) AS v2 FROM public.union_document_chunks;
