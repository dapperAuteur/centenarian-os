-- 142_audio_attachments.sql
-- Polymorphic audio attachments for any entity (same pattern as activity_links).

BEGIN;

CREATE TABLE IF NOT EXISTS audio_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'blog_post', 'recipe', 'daily_log', 'focus_session',
    'task', 'workout_log', 'equipment', 'trip'
  )),
  entity_id       UUID NOT NULL,
  audio_url       TEXT NOT NULL,
  audio_public_id TEXT,
  label           TEXT,
  duration_sec    INTEGER,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audio_attachments_entity
  ON audio_attachments (user_id, entity_type, entity_id);

ALTER TABLE audio_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY audio_attachments_owner ON audio_attachments
  FOR ALL USING (user_id = auth.uid());

COMMIT;
