-- 194_course_claim_verification.sql
-- Teacher claim-verification: a teacher can list claims in a course that need a source,
-- add the verified source, and mark each claim confirmed. Lets a teacher (or a prospective
-- teacher) vet a course's science before agreeing to teach it.
--
-- Additive only. Shared DB safe (CREATE TABLE IF NOT EXISTS). RLS scoped to the course owner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.course_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  in_text     TEXT,             -- e.g. "(Author et al., 2020)"
  apa         TEXT,             -- full APA reference
  doi         TEXT,
  url         TEXT,             -- link to read the source
  pdf_url     TEXT,             -- hosted open-access PDF, if any
  verified    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_claims (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id    UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  claim_text   TEXT NOT NULL,
  location     TEXT,            -- human label of where the claim appears (module / lesson)
  status       TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('unconfirmed','confirmed','dropped')),
  source_id    UUID REFERENCES public.course_sources(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_course_claims_course  ON public.course_claims (course_id, status);
CREATE INDEX IF NOT EXISTS idx_course_sources_course ON public.course_sources (course_id);

ALTER TABLE public.course_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_claims  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manages course sources" ON public.course_sources;
CREATE POLICY "owner manages course sources" ON public.course_sources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()));

DROP POLICY IF EXISTS "owner manages course claims" ON public.course_claims;
CREATE POLICY "owner manages course claims" ON public.course_claims FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()));

COMMIT;
