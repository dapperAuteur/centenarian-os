-- supabase/migrations/187_module_lesson_draft_mode.sql
-- Adds module-level and lesson-level draft / publish state so teachers can
-- finish authoring without exposing half-built content to students.
--
-- Courses already have is_published + visibility (migrations 040, 185); this
-- migration brings the same pattern one level deeper so individual modules
-- and lessons within a published course can be held back.
--
-- All defaults are TRUE so existing rows stay visible — nothing disappears
-- on apply. Per the shared-DB rule in CLAUDE.md, this migration is purely
-- additive (ADD COLUMN IF NOT EXISTS) and safe for the other apps on this
-- database.

ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE NOT NULL;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE NOT NULL;

-- Partial indexes — drafts are the small minority and that's the set the
-- teacher dashboard wants to surface quickly ("show me my unpublished work").
CREATE INDEX IF NOT EXISTS idx_course_modules_drafts
  ON public.course_modules(course_id, "order")
  WHERE is_published = false;

CREATE INDEX IF NOT EXISTS idx_lessons_drafts
  ON public.lessons(module_id, "order")
  WHERE is_published = false;

COMMENT ON COLUMN public.course_modules.is_published IS
  'When false, this module (and all its lessons) is hidden from students. Owners + admins always see it. Defaults true so existing modules stay visible after migration.';

COMMENT ON COLUMN public.lessons.is_published IS
  'When false, this lesson is hidden from students. Owners + admins always see it. Defaults true so existing lessons stay visible after migration.';
