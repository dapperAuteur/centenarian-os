-- Update workout_feedback difficulty CHECK constraint to use clearer labels
-- 'easier' → 'too-easy', 'harder' → 'too-hard'

-- Drop old constraint first so updates don't violate it
ALTER TABLE workout_feedback DROP CONSTRAINT IF EXISTS workout_feedback_difficulty_check;

-- Update existing rows
UPDATE workout_feedback SET difficulty = 'too-easy' WHERE difficulty = 'easier';
UPDATE workout_feedback SET difficulty = 'too-hard' WHERE difficulty = 'harder';

-- Add new constraint
ALTER TABLE workout_feedback ADD CONSTRAINT workout_feedback_difficulty_check
  CHECK (difficulty IN ('too-easy', 'just-right', 'too-hard'));
