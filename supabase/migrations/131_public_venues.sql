-- 131_public_venues.sql
-- 1. Adds UNIQUE constraint on help_articles(title, app) so seed upserts work correctly.
-- 2. Creates public_venues — a community-contributed, globally readable venue library.
-- 3. Creates venue_change_requests — pending edits/deletes submitted by users for admin approval.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

-- ─── 1. Help articles unique constraint ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'help_articles_title_app_key'
      AND conrelid = 'public.help_articles'::regclass
  ) THEN
    ALTER TABLE public.help_articles
      ADD CONSTRAINT help_articles_title_app_key UNIQUE (title, app);
  END IF;
END $$;

-- ─── 2. Public venues library ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.public_venues (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  address        TEXT,
  city           TEXT,
  state          TEXT,
  country        TEXT        NOT NULL DEFAULT 'US',
  lat            NUMERIC,
  lng            NUMERIC,
  venue_type     TEXT,       -- stage, studio, arena, theater, amphitheater, convention_center, etc.
  capacity       INT,
  notes          TEXT,
  knowledge_base JSONB       NOT NULL DEFAULT '{}',
  schematics_url TEXT,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- All authenticated users can read active venues
ALTER TABLE public.public_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active venues"
  ON public.public_venues FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated users can add venues"
  ON public.public_venues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- No direct UPDATE or DELETE — must go through venue_change_requests + admin approval

-- ─── 3. Venue change requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_change_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         UUID        REFERENCES public.public_venues(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type     TEXT        NOT NULL CHECK (request_type IN ('edit', 'delete')),
  proposed_changes JSONB,      -- new field values for 'edit'; NULL for 'delete'
  reason           TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  admin_note       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.venue_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users can read their own venue change requests"
  ON public.venue_change_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Any authenticated user can submit a request
CREATE POLICY "Authenticated users can submit venue change requests"
  ON public.venue_change_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role (admin API) handles status updates — bypasses RLS

COMMIT;
