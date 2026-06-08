-- 190_course_lesson_slugs.sql
-- Human-readable URLs for academy courses and lessons.
-- Adds a `slug` to courses (unique per teacher) and to lessons (unique per course),
-- enabling /academy/{teacher-username}/{course-slug}/lesson/{lesson-slug}.
--
-- SHARED DB: additive only. No drops/renames. Backfill of existing rows is done in
-- application code (scripts/backfill-academy-slugs.mjs) so it matches the runtime
-- slug rules; this migration only adds the columns + uniqueness guards.

BEGIN;

-- ─── Course slugs ────────────────────────────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Unique per teacher so two teachers can each own e.g. 'better-vice-club'.
-- Partial index: rows without a slug yet (pre-backfill) don't trip the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS courses_teacher_slug_uniq
  ON public.courses (teacher_id, slug)
  WHERE slug IS NOT NULL;

-- ─── Lesson slugs ────────────────────────────────────────────────────────────
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Unique per course.
CREATE UNIQUE INDEX IF NOT EXISTS lessons_course_slug_uniq
  ON public.lessons (course_id, slug)
  WHERE slug IS NOT NULL;

COMMIT;
