-- 078: Admin-managed course categories for the Academy
-- These are suggested category labels when creating/editing a course.

CREATE TABLE IF NOT EXISTS academy_course_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults (union of previous hardcoded lists)
INSERT INTO academy_course_categories (name, sort_order) VALUES
  ('Platform Guide', 0),
  ('Health & Longevity', 1),
  ('Fitness', 2),
  ('Nutrition', 3),
  ('Finance', 4),
  ('Travel', 5),
  ('Mindset', 6),
  ('Technology', 7),
  ('Recovery', 8),
  ('Sleep', 9),
  ('Other', 10)
ON CONFLICT (name) DO NOTHING;
