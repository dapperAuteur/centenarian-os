-- 139_media_relationships.sql
-- Hierarchical linking between media items:
--   episodes → show, songs → album, works → artist, sequels, adaptations

BEGIN;

CREATE TABLE IF NOT EXISTS public.media_relationships (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id         UUID        NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  child_id          UUID        NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  relationship_type TEXT        NOT NULL CHECK (relationship_type IN (
    'episode_of', 'season_of', 'track_on', 'created_by',
    'sequel_to', 'adaptation_of', 'related'
  )),
  sort_order        INT         DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (parent_id != child_id),
  UNIQUE (parent_id, child_id, relationship_type)
);

CREATE INDEX idx_media_rel_parent ON public.media_relationships(parent_id);
CREATE INDEX idx_media_rel_child  ON public.media_relationships(child_id);

ALTER TABLE public.media_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_relationships_owner"
  ON public.media_relationships
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
