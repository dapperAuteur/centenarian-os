-- 217_integration_outbox.sql
-- Outgoing server-to-server events from CentenarianOS to sibling apps (RideWitUS first:
-- envelope.balance, RideWitUS PRD §6.5). A small outbox so a fact that changed in CentenarianOS
-- reaches the sibling even when the sibling is down when the change happens.
--
-- PURPOSE
--   integration_outbox   one row per (receiver, user, event_id): the LATEST payload for that fact.
--                        A newer change to the same fact replaces the payload and sets the row back to
--                        pending, so a sibling only ever receives the current state (receivers keep a
--                        projection, not a ledger). The app writes a row after the user's change, tries
--                        to send it at once, and retries on a backoff (1 min, 5 min, 30 min, 2 h, 12 h)
--                        from the next write or the daily cron /api/cron/integration-outbox. After the
--                        last retry a row is 'failed'. A row the receiver refused with unknown_subject
--                        stays 'pending' (the person has not signed in to the sibling with WitUS yet).
--
--   receiver             which receiver the row goes to, e.g. 'ridewitus.envelope_balance'. The URL and
--                        secret for each receiver come from env vars (lib/integrations/outbox.ts), never
--                        from this table. No secret is stored here.
--
-- WHO CAN READ WHAT
--   Row Level Security is on with NO policies: only the service-role server reads or writes it, like
--   witus_identities. No browser ever needs it.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates one
-- new table with its indexes and trigger, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, the constraints and trigger sit in DO blocks that check
-- first, and ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied, the emitter
-- logs "integration_outbox missing" and sends nothing; no user-facing write fails because of it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.integration_outbox (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver         TEXT NOT NULL,
  event_id         TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  attempts         INT NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_status      INT,
  last_error       TEXT,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_outbox_status_check') THEN
    ALTER TABLE public.integration_outbox
      ADD CONSTRAINT integration_outbox_status_check CHECK (status IN ('pending', 'sent', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_outbox_fact_key') THEN
    ALTER TABLE public.integration_outbox
      ADD CONSTRAINT integration_outbox_fact_key UNIQUE (receiver, user_id, event_id);
  END IF;
END $$;

-- The drain reads "pending and due", oldest first.
CREATE INDEX IF NOT EXISTS idx_integration_outbox_due
  ON public.integration_outbox (next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_integration_outbox_user
  ON public.integration_outbox (user_id, receiver);

ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;

-- updated_at: update_updated_at_column() exists since the early migrations (051 uses it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_integration_outbox_updated_at'
      AND tgrelid = 'public.integration_outbox'::regclass
  ) THEN
    CREATE TRIGGER update_integration_outbox_updated_at
      BEFORE UPDATE ON public.integration_outbox
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.integration_outbox IS
  'Outgoing signed events to sibling apps (lib/integrations/outbox.ts). One row per (receiver, user, event_id) holding the latest payload. Service role only.';
COMMENT ON COLUMN public.integration_outbox.receiver IS
  'Receiver key, e.g. ridewitus.envelope_balance. URL and secret come from env vars, never from this table.';

COMMIT;
