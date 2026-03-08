-- 109_union_contract_rag.sql
-- Union Contract RAG: document storage, chunking, and vector embeddings
-- for union contracts, bylaws, rate sheets, and work rules.

BEGIN;

-- ── 1. union_documents table ────────────────────────────────────────────
CREATE TABLE union_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  union_local TEXT,
  doc_url     TEXT,
  doc_type    TEXT NOT NULL CHECK (doc_type IN ('contract', 'bylaws', 'rate_sheet', 'rules', 'other')),
  is_shared   BOOLEAN DEFAULT false,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_msg   TEXT,
  page_count  INT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE union_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY union_documents_owner ON union_documents
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY union_documents_shared_read ON union_documents
  FOR SELECT USING (is_shared = true AND status = 'ready');

-- ── 2. union_document_chunks table ──────────────────────────────────────
CREATE TABLE union_document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES union_documents(id) ON DELETE CASCADE,
  chunk_text    TEXT NOT NULL,
  chunk_index   INT NOT NULL,
  embedding     vector(768),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE union_document_chunks ENABLE ROW LEVEL SECURITY;

-- Owner can see their own chunks
CREATE POLICY union_chunks_owner ON union_document_chunks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM union_documents WHERE id = document_id AND user_id = auth.uid())
  );

-- Shared chunks readable
CREATE POLICY union_chunks_shared_read ON union_document_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM union_documents WHERE id = document_id AND is_shared = true AND status = 'ready')
  );

-- ── 3. Similarity search function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION match_union_chunks(
  query_embedding vector(768),
  match_count INT DEFAULT 5,
  union_filter TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
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
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.chunk_text,
    c.chunk_index,
    d.name AS doc_name,
    d.union_local,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM union_document_chunks c
  JOIN union_documents d ON d.id = c.document_id
  WHERE d.status = 'ready'
    AND c.embedding IS NOT NULL
    AND (d.user_id = p_user_id OR d.is_shared = true)
    AND (union_filter IS NULL OR d.union_local = union_filter)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── 4. Indexes ──────────────────────────────────────────────────────────
CREATE INDEX idx_union_documents_user ON union_documents(user_id);
CREATE INDEX idx_union_documents_shared ON union_documents(is_shared) WHERE is_shared = true;
CREATE INDEX idx_union_chunks_document ON union_document_chunks(document_id);
CREATE INDEX idx_union_chunks_embedding ON union_document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

COMMIT;
