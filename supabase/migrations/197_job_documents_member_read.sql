-- 197_job_documents_member_read.sql
-- Target: the Supabase project Work.WitUS production uses (shared with CentenarianOS as of 2026-10-06). Supabase-only; never run against the Neon Phase 3 instance.
-- Job documents: only people on the job can read shared documents, and
-- documents can only be attached to a job the uploader is on (plan 14.5).
--
-- WHY
-- 105_contractor_jobs.sql created:
--   job_documents_shared_read  FOR SELECT USING (is_shared = true)
--     -> any signed-in user could read every shared document on every job
--        through PostgREST, not just people on that job.
--   job_documents_owner        FOR ALL USING (user_id = auth.uid())   (no WITH CHECK)
--     -> the USING clause doubles as the write check, so a user could insert a
--        document (or move their own document) onto ANY job_id, including jobs
--        they are not on. Combined with a shared flag, that plants a document
--        in a stranger's job.
--
-- NEW RULES
--   * The uploader can read, update and delete their own documents.
--   * Inserting or updating a document requires being on its job, so
--     job_id cannot point at someone else's job.
--   * A shared document is readable by members of that job only: the job
--     owner (contractor_jobs.user_id), its lister (contractor_jobs.lister_id),
--     or crew with an accepted assignment (contractor_job_assignments.status
--     = 'accepted'). Private documents stay with the uploader; the role does
--     not widen this. Mirrors lib/contractor/job-documents.ts and
--     lib/contractor/job-access.ts.
--
-- Membership is checked by a SECURITY DEFINER helper because listers and crew
-- cannot SELECT the contractor_jobs row under its own RLS (only the owner and
-- public jobs), so an inline EXISTS would wrongly fail for them.
--
-- Policy and function changes only; no columns or data change. Additive and
-- idempotent: safe to re-run. Not applied automatically.
--
-- ROLLBACK (restores the old, too-broad behaviour; do not run unless needed):
--   DROP POLICY IF EXISTS job_documents_member_shared_read ON public.job_documents;
--   DROP POLICY IF EXISTS job_documents_uploader_select ON public.job_documents;
--   DROP POLICY IF EXISTS job_documents_uploader_insert ON public.job_documents;
--   DROP POLICY IF EXISTS job_documents_uploader_update ON public.job_documents;
--   DROP POLICY IF EXISTS job_documents_uploader_delete ON public.job_documents;
--   CREATE POLICY job_documents_owner ON public.job_documents
--     FOR ALL USING (user_id = auth.uid());
--   CREATE POLICY job_documents_shared_read ON public.job_documents
--     FOR SELECT USING (is_shared = true);
--   DROP FUNCTION IF EXISTS public.is_contractor_job_member(uuid);
--   NOTIFY pgrst, 'reload schema';

BEGIN;

-- ── 1. Membership helper ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_contractor_job_member(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.contractor_jobs j
      WHERE j.id = p_job_id
        AND (j.user_id = auth.uid() OR j.lister_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.contractor_job_assignments a
      WHERE a.job_id = p_job_id
        AND a.assigned_to = auth.uid()
        AND a.status = 'accepted'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_contractor_job_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_contractor_job_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_contractor_job_member(uuid) TO authenticated;

-- ── 2. Replace the policies ──────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.job_documents') IS NULL THEN
    RAISE NOTICE 'job_documents does not exist; skipping policy changes';
    RETURN;
  END IF;

  -- Old, too-broad policies.
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'job_documents'
               AND policyname = 'job_documents_shared_read') THEN
    DROP POLICY job_documents_shared_read ON public.job_documents;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'job_documents'
               AND policyname = 'job_documents_owner') THEN
    DROP POLICY job_documents_owner ON public.job_documents;
  END IF;

  -- Uploader: read own.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'job_documents'
                   AND policyname = 'job_documents_uploader_select') THEN
    CREATE POLICY job_documents_uploader_select ON public.job_documents
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Uploader: insert only onto a job they are on.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'job_documents'
                   AND policyname = 'job_documents_uploader_insert') THEN
    CREATE POLICY job_documents_uploader_insert ON public.job_documents
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND public.is_contractor_job_member(job_id));
  END IF;

  -- Uploader: update own, and the row must stay on a job they are on.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'job_documents'
                   AND policyname = 'job_documents_uploader_update') THEN
    CREATE POLICY job_documents_uploader_update ON public.job_documents
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid() AND public.is_contractor_job_member(job_id));
  END IF;

  -- Uploader: delete own.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'job_documents'
                   AND policyname = 'job_documents_uploader_delete') THEN
    CREATE POLICY job_documents_uploader_delete ON public.job_documents
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Shared documents: members of that job only.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'job_documents'
                   AND policyname = 'job_documents_member_shared_read') THEN
    CREATE POLICY job_documents_member_shared_read ON public.job_documents
      FOR SELECT TO authenticated
      USING (is_shared = true AND public.is_contractor_job_member(job_id));
  END IF;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
