-- 192_academy_lead_funnel.sql
-- Academy lead funnel: track lead-magnet downloads and optional (consented) email
-- captures, and link a visitor's anonymous session to their user once they sign up, so
-- downloads and emails can be correlated with enrollment to improve conversion.
-- Additive only (shared DB): CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DROP POLICY IF EXISTS before CREATE POLICY so re-runs are safe.

CREATE TABLE IF NOT EXISTS public.lead_download_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  document_key  TEXT NOT NULL,
  document_title TEXT,
  session_id    TEXT,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_dl_course  ON public.lead_download_events (course_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lead_dl_session ON public.lead_download_events (session_id);

CREATE TABLE IF NOT EXISTS public.lead_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  source_document TEXT,
  course_id       UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  session_id      TEXT,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consented       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_emails_session ON public.lead_emails (session_id);
-- one row per (email, source document) so repeated submits do not pile up
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_emails_email_doc
  ON public.lead_emails (lower(email), COALESCE(source_document, ''));

-- Link the anonymous lead session to the user once they have an account.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lead_session_id TEXT;

-- RLS: reads are admin-only (analytics). Writes happen through the service-role client
-- in the API routes, which bypasses RLS, so anonymous visitors can be tracked without a
-- public insert policy.
ALTER TABLE public.lead_download_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_emails          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads lead downloads" ON public.lead_download_events;
CREATE POLICY "admin reads lead downloads" ON public.lead_download_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "admin reads lead emails" ON public.lead_emails;
CREATE POLICY "admin reads lead emails" ON public.lead_emails
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
