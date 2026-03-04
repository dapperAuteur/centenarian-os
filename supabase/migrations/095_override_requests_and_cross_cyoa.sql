-- 095_override_requests_and_cross_cyoa.sql
-- Student override requests, teacher questionnaires, cross-course CYOA, AI recommendations cache

-- Override request table: students request prerequisite overrides from teachers
CREATE TABLE prerequisite_override_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  answers JSONB DEFAULT '{}',
  reason TEXT,
  teacher_response TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one pending request per student per course
CREATE UNIQUE INDEX idx_one_pending_per_student
  ON prerequisite_override_requests(course_id, student_id) WHERE status = 'pending';

CREATE INDEX idx_override_requests_course ON prerequisite_override_requests(course_id);
CREATE INDEX idx_override_requests_student ON prerequisite_override_requests(student_id);

-- New course columns
ALTER TABLE courses ADD COLUMN IF NOT EXISTS override_questions JSONB DEFAULT '[]';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS allow_cross_course_cyoa BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_recommendations JSONB;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_recommendations_at TIMESTAMPTZ;

-- Cross-course semantic match: finds similar lessons across all published courses that opted in
CREATE OR REPLACE FUNCTION public.match_lessons_global(
  query_embedding vector(768),
  exclude_lesson_id UUID,
  exclude_course_id UUID,
  match_count INT DEFAULT 3
)
RETURNS TABLE (id UUID, title TEXT, course_id UUID, course_title TEXT, is_free_preview BOOLEAN, similarity FLOAT)
LANGUAGE SQL STABLE AS $$
  SELECT l.id, l.title, c.id AS course_id, c.title AS course_title, l.is_free_preview,
         1 - (le.embedding <=> query_embedding) AS similarity
  FROM public.lesson_embeddings le
  JOIN public.lessons l ON l.id = le.lesson_id
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.course_id <> exclude_course_id
    AND l.id <> exclude_lesson_id
    AND c.is_published = true
    AND c.allow_cross_course_cyoa = true
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
$$;
