-- supabase/migrations/185_course_visibility_flags.sql
-- Adds two independent "featured" axes plus an app-tutorial grouping flag
-- so the academy catalog can pin courses to the top and tuck product-tutorial
-- courses into a collapsible section.
--
-- - is_featured / featured_order: admin-controlled, drives the Featured
--   strip at the top of /academy.
-- - teacher_is_featured / teacher_featured_order: teacher-controlled per
--   their own course, drives the featured strip on the teacher profile
--   page at /academy/teachers/[username].
-- - is_app_tutorial: admin-controlled, marks the course as a "Learn the
--   App" guide so it groups under a collapsible section instead of the
--   main subject-matter grid. A course can be both featured and an app
--   tutorial — it then appears in both the Featured strip and the Learn
--   the App section.
--
-- All columns default to false / 0 so existing rows behave as today.
-- Per the shared-DB rule, this migration is purely additive.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS is_app_tutorial BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS featured_order INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS teacher_is_featured BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS teacher_featured_order INT DEFAULT 0 NOT NULL;

-- Partial indexes — only the rows where the flag is true are interesting,
-- and that's the small minority of the table in practice.
CREATE INDEX IF NOT EXISTS idx_courses_is_featured
  ON public.courses(featured_order, created_at DESC)
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_courses_is_app_tutorial
  ON public.courses(created_at DESC)
  WHERE is_app_tutorial = true;

CREATE INDEX IF NOT EXISTS idx_courses_teacher_is_featured
  ON public.courses(teacher_id, teacher_featured_order, created_at DESC)
  WHERE teacher_is_featured = true;

COMMENT ON COLUMN public.courses.is_featured IS 'Admin-only. Pins this course to the Featured strip at the top of /academy.';
COMMENT ON COLUMN public.courses.is_app_tutorial IS 'Admin-only. Groups this course under the collapsible "Learn the App" section on /academy.';
COMMENT ON COLUMN public.courses.featured_order IS 'Admin-set ordering within the /academy Featured strip. Lower numbers appear first; ties broken by created_at desc.';
COMMENT ON COLUMN public.courses.teacher_is_featured IS 'Teacher-controlled per their own course. Pins this course to the featured strip on /academy/teachers/[username].';
COMMENT ON COLUMN public.courses.teacher_featured_order IS 'Teacher-set ordering within their profile featured strip. Lower numbers appear first; ties broken by created_at desc.';
