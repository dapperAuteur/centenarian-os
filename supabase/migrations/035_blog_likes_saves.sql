-- 035_blog_likes_saves.sql
-- Add like/save counts to blog_posts, create junction tables, toggle RPCs

BEGIN;

-- Denormalized counts on blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count INT NOT NULL DEFAULT 0;

-- blog_likes junction table
CREATE TABLE IF NOT EXISTS public.blog_likes (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_likes_post ON public.blog_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_likes_user ON public.blog_likes(user_id);

ALTER TABLE public.blog_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own likes" ON public.blog_likes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Like counts readable by all"  ON public.blog_likes FOR SELECT USING (true);

-- blog_saves junction table
CREATE TABLE IF NOT EXISTS public.blog_saves (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_saves_post ON public.blog_saves(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_saves_user ON public.blog_saves(user_id);

ALTER TABLE public.blog_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own saves" ON public.blog_saves FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Save counts readable by all"  ON public.blog_saves FOR SELECT USING (true);

-- toggle_blog_like: atomic like/unlike returning { liked, like_count }
CREATE OR REPLACE FUNCTION public.toggle_blog_like(p_post_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_liked   BOOLEAN;
  v_count   INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM blog_likes WHERE user_id = v_user_id AND post_id = p_post_id) THEN
    DELETE FROM blog_likes WHERE user_id = v_user_id AND post_id = p_post_id;
    UPDATE blog_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = p_post_id;
    v_liked := false;
  ELSE
    INSERT INTO blog_likes(user_id, post_id) VALUES (v_user_id, p_post_id);
    UPDATE blog_posts SET like_count = like_count + 1 WHERE id = p_post_id;
    v_liked := true;
  END IF;

  SELECT like_count INTO v_count FROM blog_posts WHERE id = p_post_id;
  RETURN json_build_object('liked', v_liked, 'like_count', v_count);
END;
$$;

-- toggle_blog_save: atomic save/unsave returning { saved, save_count }
CREATE OR REPLACE FUNCTION public.toggle_blog_save(p_post_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_saved   BOOLEAN;
  v_count   INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM blog_saves WHERE user_id = v_user_id AND post_id = p_post_id) THEN
    DELETE FROM blog_saves WHERE user_id = v_user_id AND post_id = p_post_id;
    UPDATE blog_posts SET save_count = GREATEST(0, save_count - 1) WHERE id = p_post_id;
    v_saved := false;
  ELSE
    INSERT INTO blog_saves(user_id, post_id) VALUES (v_user_id, p_post_id);
    UPDATE blog_posts SET save_count = save_count + 1 WHERE id = p_post_id;
    v_saved := true;
  END IF;

  SELECT save_count INTO v_count FROM blog_posts WHERE id = p_post_id;
  RETURN json_build_object('saved', v_saved, 'save_count', v_count);
END;
$$;

COMMIT;
