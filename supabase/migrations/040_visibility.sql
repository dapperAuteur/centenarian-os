-- 040_visibility.sql
-- Adds granular visibility controls to courses and live sessions:
--   public    = anyone (including unauthenticated users)
--   members   = logged-in app members only
--   scheduled = becomes public at published_at timestamp

BEGIN;

-- ─── Courses: add visibility + scheduled publish date ─────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS visibility   TEXT        NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'members', 'scheduled')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill: published courses default to 'public'
UPDATE public.courses SET visibility = 'public' WHERE is_published = true;

-- ─── Live sessions: replace boolean is_public with visibility ─────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS visibility   TEXT        NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'members', 'scheduled')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill from existing is_public flag
UPDATE public.live_sessions
  SET visibility = CASE WHEN is_public THEN 'public' ELSE 'members' END;

-- ─── RLS: update live_sessions policies to use visibility ─────────────────────
DROP POLICY IF EXISTS "Public live sessions are readable" ON public.live_sessions;
DROP POLICY IF EXISTS "Enrolled students see course live sessions" ON public.live_sessions;

-- Public = anyone can read
CREATE POLICY "Public live sessions readable by all"
  ON public.live_sessions FOR SELECT
  USING (
    visibility = 'public'
    OR (visibility = 'scheduled' AND published_at IS NOT NULL AND published_at <= NOW())
  );

-- Members = authenticated users only
CREATE POLICY "Members-only live sessions readable by authenticated"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (visibility = 'members');

-- ─── RLS: update course policies to respect visibility ────────────────────────
DROP POLICY IF EXISTS "Published courses are publicly readable" ON public.courses;

CREATE POLICY "Published courses readable based on visibility"
  ON public.courses FOR SELECT
  USING (
    is_published = true
    AND (
      visibility = 'public'
      OR (visibility = 'scheduled' AND published_at IS NOT NULL AND published_at <= NOW())
    )
  );

CREATE POLICY "Members-only published courses readable by authenticated"
  ON public.courses FOR SELECT TO authenticated
  USING (is_published = true AND visibility = 'members');

COMMIT;
