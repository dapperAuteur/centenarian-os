-- 096_course_glossary.sql
-- Glossary terms per course with optional lesson context and rich text definitions

CREATE TABLE course_glossary_terms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  term TEXT NOT NULL,
  phonetic TEXT,
  definition TEXT,
  definition_format TEXT NOT NULL DEFAULT 'markdown'
    CHECK (definition_format IN ('markdown', 'tiptap')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, term)
);

CREATE INDEX idx_glossary_course ON course_glossary_terms (course_id, sort_order);
CREATE INDEX idx_glossary_lesson ON course_glossary_terms (lesson_id) WHERE lesson_id IS NOT NULL;

ALTER TABLE course_glossary_terms ENABLE ROW LEVEL SECURITY;
