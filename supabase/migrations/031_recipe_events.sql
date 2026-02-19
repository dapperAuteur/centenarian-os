-- 031_recipe_events.sql
-- Analytics event log for recipes + helper RPCs for view tracking,
-- like/save toggling, and slug-based recipe lookup.

BEGIN;

CREATE TABLE IF NOT EXISTS public.recipe_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL
                CHECK (event_type IN (
                  'view',
                  'share_copy', 'share_email', 'share_linkedin',
                  'blocked_visit'
                )),
  session_id  TEXT,          -- random UUID generated client-side per browser tab
  referrer    TEXT,          -- document.referrer passed from client
  country     TEXT,          -- from CF-IPCountry or x-vercel-ip-country request header
  user_id     UUID,          -- nullable: set if reader is logged in
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_events_recipe_type ON public.recipe_events(recipe_id, event_type);
CREATE INDEX IF NOT EXISTS idx_recipe_events_created     ON public.recipe_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_events_recipe_time ON public.recipe_events(recipe_id, created_at DESC);

ALTER TABLE public.recipe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert recipe events"
  ON public.recipe_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Authors can read their recipe events"
  ON public.recipe_events FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    recipe_id IN (SELECT id FROM public.recipes WHERE user_id = auth.uid())
  );

-- -------------------------------------------------------------------------
-- RPC: log_recipe_event
-- Inserts an analytics event and atomically increments view_count on 'view'.
-- SECURITY DEFINER avoids recursive RLS check on recipe_events INSERT.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_recipe_event(
  p_recipe_id   UUID,
  p_event_type  TEXT,
  p_session_id  TEXT    DEFAULT NULL,
  p_referrer    TEXT    DEFAULT NULL,
  p_country     TEXT    DEFAULT NULL,
  p_user_id     UUID    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO recipe_events(recipe_id, event_type, session_id, referrer, country, user_id)
  VALUES (p_recipe_id, p_event_type, p_session_id, p_referrer, p_country, p_user_id);

  IF p_event_type = 'view' THEN
    UPDATE recipes SET view_count = view_count + 1 WHERE id = p_recipe_id;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------
-- RPC: get_recipe_id_by_slug
-- Returns recipe UUID for a given (user_id, slug) regardless of visibility.
-- Used server-side to log blocked_visit events when a restricted recipe is
-- accessed. Returns NULL if the recipe does not exist at all.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_recipe_id_by_slug(
  p_user_id UUID,
  p_slug    TEXT
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM recipes
  WHERE user_id = p_user_id AND slug = p_slug
  LIMIT 1;
$$;

-- -------------------------------------------------------------------------
-- RPC: toggle_recipe_like
-- Atomically like or unlike a recipe for the calling user.
-- Returns JSON: { liked: bool, like_count: int }
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_recipe_like(p_recipe_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_liked     BOOLEAN;
  v_count     INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM recipe_likes WHERE user_id = v_user_id AND recipe_id = p_recipe_id) THEN
    DELETE FROM recipe_likes WHERE user_id = v_user_id AND recipe_id = p_recipe_id;
    UPDATE recipes SET like_count = GREATEST(0, like_count - 1) WHERE id = p_recipe_id
      RETURNING like_count INTO v_count;
    v_liked := FALSE;
  ELSE
    INSERT INTO recipe_likes(user_id, recipe_id) VALUES (v_user_id, p_recipe_id)
      ON CONFLICT DO NOTHING;
    UPDATE recipes SET like_count = like_count + 1 WHERE id = p_recipe_id
      RETURNING like_count INTO v_count;
    v_liked := TRUE;
  END IF;

  RETURN jsonb_build_object('liked', v_liked, 'like_count', v_count);
END;
$$;

-- -------------------------------------------------------------------------
-- RPC: toggle_recipe_save
-- Atomically save or unsave a recipe for the calling user.
-- Returns JSON: { saved: bool, save_count: int }
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_recipe_save(p_recipe_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_saved     BOOLEAN;
  v_count     INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM recipe_saves WHERE user_id = v_user_id AND recipe_id = p_recipe_id) THEN
    DELETE FROM recipe_saves WHERE user_id = v_user_id AND recipe_id = p_recipe_id;
    UPDATE recipes SET save_count = GREATEST(0, save_count - 1) WHERE id = p_recipe_id
      RETURNING save_count INTO v_count;
    v_saved := FALSE;
  ELSE
    INSERT INTO recipe_saves(user_id, recipe_id) VALUES (v_user_id, p_recipe_id)
      ON CONFLICT DO NOTHING;
    UPDATE recipes SET save_count = save_count + 1 WHERE id = p_recipe_id
      RETURNING save_count INTO v_count;
    v_saved := TRUE;
  END IF;

  RETURN jsonb_build_object('saved', v_saved, 'save_count', v_count);
END;
$$;

COMMIT;
