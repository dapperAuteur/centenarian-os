-- Migration 119: Equipment multi-media gallery
-- Supports multiple images, videos, and audio files per equipment item

CREATE TABLE IF NOT EXISTS equipment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  public_id TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  title TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_media_equipment ON equipment_media(equipment_id);
CREATE INDEX idx_equipment_media_user ON equipment_media(user_id);

-- RLS
ALTER TABLE equipment_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own equipment media"
  ON equipment_media FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
