-- 107_job_replacement_requests.sql
-- Job sharing / replacement finding: request flow for covering posted jobs.

BEGIN;

-- ── 1. job_replacement_requests table ──────────────────────────────────
CREATE TABLE job_replacement_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES contractor_jobs(id) ON DELETE CASCADE,
  poster_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','withdrawn')),
  message         TEXT,
  poster_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, requester_id)
);

CREATE INDEX idx_replacement_req_job ON job_replacement_requests (job_id);
CREATE INDEX idx_replacement_req_poster ON job_replacement_requests (poster_id, status);
CREATE INDEX idx_replacement_req_requester ON job_replacement_requests (requester_id, status);

ALTER TABLE job_replacement_requests ENABLE ROW LEVEL SECURITY;

-- Poster can see all requests for their jobs
CREATE POLICY replacement_req_poster ON job_replacement_requests
  FOR ALL USING (poster_id = auth.uid());

-- Requester can see/manage their own requests
CREATE POLICY replacement_req_requester ON job_replacement_requests
  FOR ALL USING (requester_id = auth.uid());

-- ── 2. Add share_contacts flag to contractor_jobs ──────────────────────
-- When true, contacts (POC/coordinator) are visible to accepted replacement
ALTER TABLE contractor_jobs ADD COLUMN IF NOT EXISTS share_contacts BOOLEAN NOT NULL DEFAULT false;

COMMIT;
