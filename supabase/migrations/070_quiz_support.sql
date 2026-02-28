-- 070_quiz_support.sql
-- Add quiz lesson type + quiz content storage + quiz scoring to lesson progress

BEGIN;

-- 1. Extend lesson_type CHECK to include 'quiz'
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_lesson_type_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_lesson_type_check
  CHECK (lesson_type IN ('video', 'text', 'audio', 'slides', 'quiz'));

-- 2. Add quiz_content JSONB to lessons
-- Schema: { questions: [{ id, questionText, questionType, options: [{ id, text }],
--            correctOptionId, explanation, citation? }],
--           passingScore: number, attemptsAllowed: number }
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS quiz_content JSONB;

-- 3. Add quiz scoring columns to lesson_progress
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS quiz_score NUMERIC(5,2);
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS quiz_answers JSONB;

COMMIT;
