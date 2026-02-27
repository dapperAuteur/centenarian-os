-- 062_assignment_scopes.sql
-- Allow assignments to be scoped to course, module, or lesson.

BEGIN;

-- 1. Add module_id FK
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL;

-- 2. Add scope column
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'course'
    CHECK (scope IN ('course', 'module', 'lesson'));

-- 3. Backfill: existing assignments with lesson_id → scope='lesson'
UPDATE public.assignments SET scope = 'lesson' WHERE lesson_id IS NOT NULL;

-- 4. Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON public.assignments (module_id);
CREATE INDEX IF NOT EXISTS idx_assignments_scope ON public.assignments (course_id, scope);

COMMIT;
