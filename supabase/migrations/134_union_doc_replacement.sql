-- Migration 134: Add replaces_document_id to union_rag_submissions
-- Allows users to submit replacement files for shared documents.
-- Admin approval replaces the original document's chunks with the new content.

ALTER TABLE public.union_rag_submissions
  ADD COLUMN IF NOT EXISTS replaces_document_id UUID
    REFERENCES public.union_documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.union_rag_submissions.replaces_document_id IS
  'When set, this submission is a replacement request for an existing shared document. '
  'Upon admin approval, the original document is updated with new content.';
