-- 094_course_prerequisites.sql
-- Course prerequisites, recommendations, and teacher overrides

-- Prerequisites: courses that should/must be completed before enrollment
CREATE TABLE course_prerequisites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enforcement TEXT NOT NULL DEFAULT 'recommended' CHECK (enforcement IN ('required', 'recommended')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, prerequisite_course_id),
  CHECK (course_id != prerequisite_course_id)
);

-- Recommendations: courses suggested before or after the current course
CREATE TABLE course_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  recommended_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'after' CHECK (direction IN ('before', 'after')),
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, recommended_course_id),
  CHECK (course_id != recommended_course_id)
);

-- Overrides: teacher can waive prerequisites for specific students
CREATE TABLE prerequisite_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, user_id)
);
