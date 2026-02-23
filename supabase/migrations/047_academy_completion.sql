-- 047_academy_completion.sql
-- Course reviews with denormalized avg_rating, and trial_period_days.

BEGIN;

-- 1. Course Reviews table
CREATE TABLE IF NOT EXISTS public.course_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, student_id)
);

-- 2. Denormalized columns on courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating   NUMERIC(3,2) NOT NULL DEFAULT 0;

-- 3. Trigger to keep review_count + avg_rating in sync
CREATE OR REPLACE FUNCTION public.update_course_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.courses
  SET
    review_count = (SELECT COUNT(*) FROM public.course_reviews WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)),
    avg_rating   = (SELECT COALESCE(AVG(rating), 0) FROM public.course_reviews WHERE course_id = COALESCE(NEW.course_id, OLD.course_id))
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_rating_trigger ON public.course_reviews;
CREATE TRIGGER course_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_course_rating();

-- 4. RLS for reviews
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON public.course_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON public.course_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "reviews_update" ON public.course_reviews FOR UPDATE TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "reviews_delete" ON public.course_reviews FOR DELETE TO authenticated USING (auth.uid() = student_id);

-- 5. Trial period days on courses
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS trial_period_days INT NOT NULL DEFAULT 0;

COMMIT;
