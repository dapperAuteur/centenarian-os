-- 197_work_schedule_events.sql
-- Stage 2, Phase 2b: CentOS's local projection of contractor job SCHEDULE.
--
-- Phase 2 (migration 196) moved income off the cross-app `expected_payments` view. This does the
-- same for the other half of the coupling: `/api/planner/work-feed` and
-- `/api/planner/availability` still read `contractor_jobs` and `contractor_job_assignments`
-- DIRECTLY. Those are Work.WitUS tables, and they are the last thing keeping CentOS attached to
-- them (plans/55-stage2-db-split.md).
--
-- WHY A SECOND EVENT TYPE RATHER THAN REUSING income_events:
-- income answers "money is expected on date X". This answers "I am occupied on date X, for this
-- client, at this venue". Different questions, different fields, different lifecycle — a job is
-- scheduled long before it is invoiced, and a cancelled job vanishes from the calendar while its
-- invoice may still be owed. Folding them together would have made both worse.
--
-- COLUMN SHAPE mirrors exactly what the two consuming routes select today, so they change a table
-- name rather than being rewritten.
--
-- SHARED DB: additive only. One new table. Touches nothing existing. Safe to apply while both
-- apps are running; the direct reads stay as a fallback until the projection is proven.

CREATE TABLE IF NOT EXISTS public.work_schedule_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stable per source record: `job:<uuid>` for a job the user owns, `assignment:<uuid>` for one
  -- they were assigned. Upsert key, so at-least-once redelivery is a no-op.
  event_id       TEXT NOT NULL,
  source_app     TEXT NOT NULL DEFAULT 'work_witus',

  -- 'own' = the user's own job, 'assigned' = assigned to them by a lister. work-feed returns
  -- these as two separate lists and labels them differently, so the distinction has to survive.
  source         TEXT NOT NULL DEFAULT 'own' CHECK (source IN ('own', 'assigned')),
  assigner_name  TEXT,

  -- --- mirror of what work-feed and availability select from contractor_jobs ---
  job_id         UUID,
  job_number     TEXT,
  client_name    TEXT,
  event_name     TEXT,
  location_name  TEXT,
  status         TEXT,
  start_date     DATE,
  end_date       DATE,
  is_multi_day   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Non-contiguous multi-day jobs list their exact dates here; both consumers pass it through.
  scheduled_dates JSONB,
  pay_rate       NUMERIC(12,2),
  rate_type      TEXT,
  brand_id       UUID,
  notes          TEXT,
  -- --- end mirror ---

  -- Both routes exclude cancelled and paid jobs. The emitter sets this false for those, so the
  -- filter lives in the data instead of being re-implemented in every consumer.
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wse_user_event
  ON public.work_schedule_events(user_id, event_id);

-- Both consumers query by user over a date window. start_date leads because every query filters
-- on it; end_date is checked in the same row.
CREATE INDEX IF NOT EXISTS idx_wse_user_dates
  ON public.work_schedule_events(user_id, start_date, end_date)
  WHERE is_active = TRUE;

ALTER TABLE public.work_schedule_events ENABLE ROW LEVEL SECURITY;

-- Owner-only for session reads. The receiver writes with the service-role key because it
-- authenticates the sending APP by HMAC, not a user session.
DROP POLICY IF EXISTS "work_schedule_events_owner" ON public.work_schedule_events;
CREATE POLICY "work_schedule_events_owner" ON public.work_schedule_events
  FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE public.work_schedule_events IS
  'CentOS-local projection of contractor job schedule pushed by Work.WitUS. Replaces direct reads of contractor_jobs / contractor_job_assignments. See plans/55-stage2-db-split.md Phase 2b.';
