-- 149_job_notes_events_multiuser.sql
-- Job notes (per-user, private/public), contractor events, and multi-user time entry fix.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- 1. job_notes table
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES contractor_jobs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

-- Owner has full CRUD on own notes
CREATE POLICY job_notes_owner ON job_notes
  FOR ALL USING (user_id = auth.uid());

-- Assigned workers can read public notes
CREATE POLICY job_notes_public_assigned ON job_notes
  FOR SELECT USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM contractor_job_assignments
      WHERE job_id = job_notes.job_id
        AND assigned_to = auth.uid()
        AND status = 'accepted'
    )
  );

-- Job owner can read public notes from others
CREATE POLICY job_notes_public_job_owner ON job_notes
  FOR SELECT USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM contractor_jobs
      WHERE id = job_notes.job_id
        AND user_id = auth.uid()
    )
  );

-- Lister can read public notes
CREATE POLICY job_notes_public_lister ON job_notes
  FOR SELECT USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM contractor_jobs
      WHERE id = job_notes.job_id
        AND lister_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_job_notes_job ON job_notes (job_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_user ON job_notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_notes_public ON job_notes (job_id) WHERE is_public = true;

-- updated_at trigger
CREATE TRIGGER set_job_notes_updated_at
  BEFORE UPDATE ON job_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════
-- 2. contractor_events table
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contractor_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  client_id               UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  client_name             TEXT,
  location_id             UUID REFERENCES contact_locations(id) ON DELETE SET NULL,
  location_name           TEXT,
  poc_contact_id          UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  poc_name                TEXT,
  poc_phone               TEXT,
  crew_coordinator_id     UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  crew_coordinator_name   TEXT,
  crew_coordinator_phone  TEXT,
  start_date              DATE,
  end_date                DATE,
  union_local             TEXT,
  department              TEXT,
  brand_id                UUID,
  pay_rate                NUMERIC(10,2),
  ot_rate                 NUMERIC(10,2),
  dt_rate                 NUMERIC(10,2),
  rate_type               TEXT DEFAULT 'hourly' CHECK (rate_type IN ('hourly','daily','flat')),
  benefits_eligible       BOOLEAN NOT NULL DEFAULT false,
  travel_benefits         JSONB NOT NULL DEFAULT '{}',
  notes                   TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contractor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY contractor_events_owner ON contractor_events
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_contractor_events_user ON contractor_events (user_id, start_date DESC);

-- updated_at trigger
CREATE TRIGGER set_contractor_events_updated_at
  BEFORE UPDATE ON contractor_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════
-- 3. Add event_id FK on contractor_jobs
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE contractor_jobs ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES contractor_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_jobs_event ON contractor_jobs (event_id) WHERE event_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Fix job_time_entries unique index for multi-user
--    Old: (job_id, work_date) — blocks multiple workers on same date
--    New: (job_id, user_id, work_date) — matches existing upsert onConflict
-- ══════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_job_time_entries_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_time_entries_unique ON job_time_entries (job_id, user_id, work_date);

COMMIT;
