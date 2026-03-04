-- Add difficulty level to user exercises (matches system_exercises)
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT NULL
  CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));
