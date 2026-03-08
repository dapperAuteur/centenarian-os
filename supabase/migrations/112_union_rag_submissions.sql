-- 112_union_rag_submissions.sql
-- Phase 9: Union RAG Community Submissions
-- Users submit union documents for admin review before inclusion in shared RAG corpus.

BEGIN;

CREATE TABLE union_rag_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  union_local     TEXT,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('contract', 'bylaws', 'rate_sheet', 'rules', 'other')),
  description     TEXT,
  coverage_dates  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'live')),
  admin_notes     TEXT,
  document_id     UUID REFERENCES union_documents(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE union_rag_submissions ENABLE ROW LEVEL SECURITY;

-- Owner can read their own submissions
CREATE POLICY rag_submissions_owner ON union_rag_submissions
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_rag_submissions_user ON union_rag_submissions(user_id);
CREATE INDEX idx_rag_submissions_status ON union_rag_submissions(status);

COMMIT;
