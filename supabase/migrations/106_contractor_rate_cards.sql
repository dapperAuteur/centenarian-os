-- 106_contractor_rate_cards.sql
-- Reusable rate card presets for contractor jobs.
-- Stores union/department rates, benefit templates, and travel benefit defaults.

BEGIN;

CREATE TABLE contractor_rate_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  union_local     TEXT,
  department      TEXT,
  rate_type       TEXT NOT NULL DEFAULT 'hourly'
    CHECK (rate_type IN ('hourly','daily','flat')),
  st_rate         NUMERIC(10,2),
  ot_rate         NUMERIC(10,2),
  dt_rate         NUMERIC(10,2),
  benefits        JSONB NOT NULL DEFAULT '[]',
  travel_benefits JSONB NOT NULL DEFAULT '{}',
  notes           TEXT,
  use_count       INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_cards_user ON contractor_rate_cards (user_id);

ALTER TABLE contractor_rate_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY rate_cards_owner ON contractor_rate_cards
  FOR ALL USING (user_id = auth.uid());

-- Add rate_card_id FK to contractor_jobs
ALTER TABLE contractor_jobs
  ADD COLUMN IF NOT EXISTS rate_card_id UUID REFERENCES contractor_rate_cards(id) ON DELETE SET NULL;

COMMIT;
