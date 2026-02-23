-- Migration 046: Course likes and saves

-- Users can like (public count) or save (private bookmark) courses
CREATE TABLE IF NOT EXISTS public.course_likes (
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.course_saves (
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

-- Denormalised like count on courses (maintained by trigger)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

-- Trigger function to keep like_count in sync
CREATE OR REPLACE FUNCTION public.update_course_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET like_count = like_count + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.course_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_likes_count_trigger ON public.course_likes;
CREATE TRIGGER course_likes_count_trigger
  AFTER INSERT OR DELETE ON public.course_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_course_like_count();

-- RLS: likes are public (anyone can see the count), only owner can insert/delete
ALTER TABLE public.course_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_likes_select" ON public.course_likes FOR SELECT USING (true);
CREATE POLICY "course_likes_insert" ON public.course_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "course_likes_delete" ON public.course_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS: saves are private — only the owner can see and manage their own saves
ALTER TABLE public.course_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_saves_select" ON public.course_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "course_saves_insert" ON public.course_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "course_saves_delete" ON public.course_saves FOR DELETE USING (auth.uid() = user_id);
