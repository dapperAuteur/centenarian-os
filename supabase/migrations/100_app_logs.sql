-- Migration 100: App logs table for structured server-side logging.
-- No RLS — service role only (admin dashboard reads).

CREATE TABLE app_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  level        TEXT        NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  source       TEXT        NOT NULL,
  module       TEXT,
  message      TEXT        NOT NULL,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_reviewed  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX app_logs_level_idx      ON app_logs (level);
CREATE INDEX app_logs_source_idx     ON app_logs (source);
CREATE INDEX app_logs_module_idx     ON app_logs (module);
CREATE INDEX app_logs_created_idx    ON app_logs (created_at DESC);
CREATE INDEX app_logs_unreviewed_idx ON app_logs (is_reviewed) WHERE is_reviewed = FALSE AND level IN ('warn', 'error');
