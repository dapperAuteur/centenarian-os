-- supabase/migrations/089_admin_notifications.sql
-- Stores in-app notifications for the admin when users add new exercises or equipment.
-- Admin can promote items to shared libraries or dismiss them.

CREATE TABLE admin_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT        NOT NULL CHECK (type IN ('new_exercise', 'new_equipment')),
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT,
  entity_name  TEXT        NOT NULL,
  entity_id    UUID        NOT NULL,
  entity_meta  JSONB       NOT NULL DEFAULT '{}',
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  promoted     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No user-facing RLS — only readable/writable via service role (admin API routes)
-- (No ALTER TABLE … ENABLE ROW LEVEL SECURITY means default-deny for anon/authenticated)
-- Service role bypasses RLS entirely, so the admin routes work fine.

CREATE INDEX admin_notifications_type_idx     ON admin_notifications (type);
CREATE INDEX admin_notifications_is_read_idx  ON admin_notifications (is_read);
CREATE INDEX admin_notifications_created_idx  ON admin_notifications (created_at DESC);
