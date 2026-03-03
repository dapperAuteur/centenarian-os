-- Migration 085: Workout Feedback
-- Stores post-workout feedback from users (mood, difficulty, instruction preference)
-- Adapted from the Nomad Longevity OS feedback form (originally MongoDB-based).

CREATE TABLE public.workout_feedback (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workout_log_id         UUID REFERENCES public.workout_logs(id) ON DELETE SET NULL,
  activity_category      TEXT NOT NULL CHECK (activity_category IN ('AM', 'PM', 'WORKOUT_HOTEL', 'WORKOUT_GYM', 'friction', 'general')),
  activity_duration      TEXT CHECK (activity_duration IN ('5', '15', '30', '45', '60')),
  friction_scenario_index SMALLINT,
  mood_before            SMALLINT CHECK (mood_before BETWEEN 1 AND 5),
  mood_after             SMALLINT CHECK (mood_after BETWEEN 1 AND 5),
  difficulty             TEXT CHECK (difficulty IN ('easier', 'just-right', 'harder')),
  instruction_preference TEXT CHECK (instruction_preference IN ('text-is-fine', 'need-images', 'need-video')),
  feedback               TEXT,
  email                  TEXT,
  protocol_version       TEXT DEFAULT '1.1',
  status                 TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'responded', 'closed')),
  ip_address             TEXT,
  user_agent             TEXT,
  admin_notes            TEXT,
  submitted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_workout_feedback_user_id ON public.workout_feedback (user_id);
CREATE INDEX idx_workout_feedback_status ON public.workout_feedback (status);
CREATE INDEX idx_workout_feedback_submitted_at ON public.workout_feedback (submitted_at DESC);
CREATE INDEX idx_workout_feedback_category ON public.workout_feedback (activity_category);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_workout_feedback_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workout_feedback_updated_at
  BEFORE UPDATE ON public.workout_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_workout_feedback_updated_at();

-- RLS
ALTER TABLE public.workout_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback (user_id = auth.uid())
CREATE POLICY "Users can insert their own feedback"
  ON public.workout_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON public.workout_feedback FOR SELECT
  USING (user_id = auth.uid());
