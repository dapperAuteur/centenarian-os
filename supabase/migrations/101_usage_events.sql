-- Migration 101: Usage events for module/feature analytics.
-- user_type classified at insert time for fast filtering.
-- No RLS — service role only (admin dashboard reads).

CREATE TABLE usage_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_type         TEXT        NOT NULL DEFAULT 'real' CHECK (user_type IN ('admin', 'demo', 'tutorial', 'real')),
  subscription_type TEXT,       -- free/monthly/lifetime/teacher/invited — snapshot at event time
  module            TEXT        NOT NULL,
  action            TEXT        NOT NULL,
  detail            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_user_type_idx ON usage_events (user_type);
CREATE INDEX usage_events_module_idx    ON usage_events (module);
CREATE INDEX usage_events_action_idx    ON usage_events (action);
CREATE INDEX usage_events_created_idx   ON usage_events (created_at DESC);
CREATE INDEX usage_events_sub_type_idx  ON usage_events (subscription_type);
