-- 196_income_events.sql
-- Stage 2, Phase 2: CentOS's local projection of business income.
--
-- WHY THIS EXISTS
-- Today CentOS's finance forecast and planner read `expected_payments`, a VIEW that selects
-- from `contractor_jobs` and `invoices` — tables that belong to Work.WitUS and are leaving
-- when the shared database is split (plans/55-stage2-db-split.md).
--
-- Rather than call Work.WitUS over the network at render time, Work.WitUS PUSHES income
-- events here and CentOS reads a local table. That choice is deliberate: CentOS is
-- offline-first (service worker + IndexedDB queue), so a synchronous cross-app fetch on the
-- planner would break a core page whenever the sibling app is slow or down. It also matches
-- the shape of what exists today — trg_invoice_due_to_task already pushes into a local table.
--
-- COLUMN SHAPE IS DELIBERATE: this mirrors the `expected_payments` view 1:1 so consumers
-- change one table name instead of being rewritten, and so a row from the view and a row
-- from an event are interchangeable during the transition.
--
-- SHARED DB: additive only. Creates one new table. Touches nothing existing. The
-- expected_payments view and both sync triggers stay in place until the projection is
-- proven live (Phase 3) — this migration is safe to apply while both apps are running.

CREATE TABLE IF NOT EXISTS public.income_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Idempotency. The emitter sends a stable id per (source_type, source_id, revision);
  -- redelivery of the same event must not duplicate a row. At-least-once delivery is the
  -- norm for signed webhooks, so this constraint is the thing that makes replay safe.
  event_id          TEXT NOT NULL,

  -- Which app produced this. Lets CentOS keep its own rows (schedules) distinguishable
  -- from Work.WitUS's, and lets a future third emitter join without a schema change.
  source_app        TEXT NOT NULL DEFAULT 'work_witus',

  -- --- mirror of the expected_payments view, column for column ---
  source_type       TEXT NOT NULL CHECK (source_type IN ('job', 'invoice', 'expected_payment', 'schedule')),
  source_id         UUID,
  expected_date     DATE NOT NULL,
  label             TEXT,
  reference_number  TEXT,
  expected_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT,
  start_date        DATE,
  end_date          DATE,
  brand_id          UUID,
  -- --- end mirror ---

  -- Soft-delete rather than DELETE: a cancelled invoice must stop counting toward the
  -- forecast without losing the audit trail of what was once expected.
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per event id per user. ON CONFLICT (user_id, event_id) DO UPDATE gives the
-- receiver last-write-wins semantics for a re-sent event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_events_user_event
  ON public.income_events(user_id, event_id);

-- The forecast and planner both query by user + date window, ordered by date.
CREATE INDEX IF NOT EXISTS idx_income_events_user_date
  ON public.income_events(user_id, expected_date)
  WHERE is_active = TRUE;

ALTER TABLE public.income_events ENABLE ROW LEVEL SECURITY;

-- Owner-only. The receiver writes with the service-role key (it authenticates the SENDER by
-- HMAC, not the user by session), so it bypasses RLS by design; this policy governs reads
-- from the app's normal session client.
DROP POLICY IF EXISTS "income_events_owner" ON public.income_events;
CREATE POLICY "income_events_owner" ON public.income_events
  FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE public.income_events IS
  'CentOS-local projection of business income pushed by Work.WitUS. Replaces reads of the cross-app expected_payments view. See plans/55-stage2-db-split.md Phase 2.';
