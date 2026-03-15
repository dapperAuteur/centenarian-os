-- 143_image_attachments.sql
-- Polymorphic image attachments for any entity (same pattern as audio_attachments).

BEGIN;

CREATE TABLE IF NOT EXISTS image_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'blog_post', 'recipe', 'daily_log', 'focus_session',
    'task', 'workout_log', 'equipment', 'trip'
  )),
  entity_id       UUID NOT NULL,
  image_url       TEXT NOT NULL,
  image_public_id TEXT,
  label           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_image_attachments_entity
  ON image_attachments (user_id, entity_type, entity_id);

ALTER TABLE image_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY image_attachments_owner ON image_attachments
  FOR ALL USING (user_id = auth.uid());

COMMIT;
