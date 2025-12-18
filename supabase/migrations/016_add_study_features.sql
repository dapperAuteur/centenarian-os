-- File: supabase/migrations/016_add_study_features.sql
--
-- This migration ADDS the new study features (1-5 rating, SM-2)
-- and CLEANS UP the old 'flashcard_analytics' table from migration 015.
-- It's based on the user's 'flashcard.d.ts' and 'indexeddb.ts' files.

BEGIN;

-- 1. Create the 'study_direction' ENUM type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'study_direction') THEN
        CREATE TYPE public.study_direction AS ENUM ('front_to_back', 'back_to_front');
    END IF;
END$$;


-- 2. Add 'default_study_direction' to 'flashcard_sets'
ALTER TABLE public.flashcard_sets
  ADD COLUMN IF NOT EXISTS default_study_direction public.study_direction DEFAULT 'front_to_back';


-- 3. Add Spaced Repetition (SM-2) columns to 'flashcards' table
-- This replaces the need for 'flashcard_analytics'
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS difficulty FLOAT DEFAULT 2.5 NOT NULL,
  ADD COLUMN IF NOT EXISTS interval INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS repetitions INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS correct_count INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS incorrect_count INT DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.flashcards.difficulty IS 'SM-2 Ease Factor (default 2.5)';
COMMENT ON COLUMN public.flashcards.interval IS 'Days until next review';
COMMENT ON COLUMN public.flashcards.repetitions IS 'Number of correct repetitions in a row';
COMMENT ON COLUMN public.flashcards.next_review_at IS 'When the card is due for review';

-- Add index for due cards
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review_at ON public.flashcards(user_id, next_review_at);


-- 4. Create the 'study_logs' table (from indexeddb.ts)
-- This tracks every single review
CREATE TABLE IF NOT EXISTS public.study_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL, -- A UUID for the study session batch
  card_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  confidence_rating INT NOT NULL CHECK (confidence_rating >= 1 AND confidence_rating <= 5),
  is_correct BOOLEAN NOT NULL,
  study_direction public.study_direction NOT NULL,
  time_seconds FLOAT NOT NULL
);
COMMENT ON TABLE public.study_logs IS 'Tracks every single card review for analytics.';
COMMENT ON COLUMN public.study_logs.session_id IS 'UUID for a single study session batch.';
COMMENT ON COLUMN public.study_logs.confidence_rating IS 'User''s 1-5 confidence rating.';
COMMENT ON COLUMN public.study_logs.time_seconds IS 'Time spent on the card before answering.';

-- RLS for study_logs
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own study logs"
  ON public.study_logs FOR ALL
  USING (auth.uid() = user_id);

-- Indices
CREATE INDEX IF NOT EXISTS idx_study_logs_user_id ON public.study_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_study_logs_session_id ON public.study_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_study_logs_card_id ON public.study_logs(card_id);


-- 5. Clean up the old 'flashcard_analytics' table
-- This drops the table from the faulty '015' migration.
DROP TABLE IF EXISTS public.flashcard_analytics;


COMMIT;
