-- 128_job_document_categories.sql
-- Add category, title, description, and metadata columns to job_documents
-- for tracking incidents, best practices, scan history, etc.

ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS doc_category TEXT;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Allow url to be nullable (for text-only notes/incidents)
ALTER TABLE job_documents ALTER COLUMN url DROP NOT NULL;

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_job_documents_category ON job_documents (job_id, doc_category);
