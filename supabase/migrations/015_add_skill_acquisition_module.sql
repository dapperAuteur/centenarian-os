-- supabase/migrations/015_add_skill_acquisition_module.sql
--
-- This migration adds the tables for the "Skill Acquisition" module,
-- including support for AI Gem Personas and a Flashcard system.

BEGIN;

-- 1. Create gem_personas table
-- This table stores the system prompts for different AI "Gems"
CREATE TABLE IF NOT EXISTS public.gem_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.gem_personas IS 'Stores user-defined AI personas (Gems) with their system prompts.';
COMMENT ON COLUMN public.gem_personas.system_prompt IS 'The full system instruction prompt that defines the Gem''s behavior.';

-- RLS for gem_personas
ALTER TABLE public.gem_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own gem_personas"
  ON public.gem_personas FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_gem_personas_updated_at
  BEFORE UPDATE ON public.gem_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Create language_coach_sessions table
-- This table stores the chat history for each Gem session
CREATE TABLE IF NOT EXISTS public.language_coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gem_persona_id UUID REFERENCES public.gem_personas(id) ON DELETE SET NULL,
  messages JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.language_coach_sessions IS 'Stores the chat history for conversations with AI Gems.';
COMMENT ON COLUMN public.language_coach_sessions.messages IS 'An array of chat messages: [{ "role": "user/model", "content": "..." }]';

-- RLS for language_coach_sessions
ALTER TABLE public.language_coach_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own chat sessions"
  ON public.language_coach_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_language_coach_sessions_updated_at
  BEFORE UPDATE ON public.language_coach_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Create flashcard_sets table
-- This table stores sets of flashcards, optionally linked to a Goal
CREATE TABLE IF NOT EXISTS public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  language TEXT,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.flashcard_sets IS 'Groups of flashcards, e.g., "Spanish Verbs Set 1".';
COMMENT ON COLUMN public.flashcard_sets.goal_id IS 'Optional foreign key linking this set to a specific goal in the Planner module.';

-- RLS for flashcard_sets
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own flashcard sets"
  ON public.flashcard_sets FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_flashcard_sets_updated_at
  BEFORE UPDATE ON public.flashcard_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. Create flashcards table
-- This table stores the individual flashcards
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.flashcards IS 'Individual flashcards, each belonging to a set.';

-- RLS for flashcards
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own flashcards"
  ON public.flashcards FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for flashcards
CREATE INDEX IF NOT EXISTS idx_flashcards_set_id ON public.flashcards(set_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);


-- 5. Create flashcard_analytics table
-- This table tracks user performance for spaced repetition
CREATE TABLE IF NOT EXISTS public.flashcard_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new'::text NOT NULL CHECK (status IN ('new', 'strong', 'shaky', 'weak')),
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  review_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  incorrect_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT flashcard_analytics_user_card_unique UNIQUE (user_id, card_id)
);
COMMENT ON TABLE public.flashcard_analytics IS 'Tracks spaced repetition performance for each card.';
COMMENT ON COLUMN public.flashcard_analytics.status IS 'The user''s current mastery of the card.';
COMMENT ON COLUMN public.flashcard_analytics.next_review_at IS 'The timestamp when this card should appear for review again.';
COMMENT ON CONSTRAINT flashcard_analytics_user_card_unique ON public.flashcard_analytics IS 'Ensures only one analytics entry exists per user per card.';

-- RLS for flashcard_analytics
ALTER TABLE public.flashcard_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own card analytics"
  ON public.flashcard_analytics FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_flashcard_analytics_updated_at
  BEFORE UPDATE ON public.flashcard_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for flashcard_analytics
CREATE INDEX IF NOT EXISTS idx_flashcard_analytics_card_id ON public.flashcard_analytics(card_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_analytics_user_id ON public.flashcard_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_analytics_next_review ON public.flashcard_analytics(user_id, next_review_at);


COMMIT;
