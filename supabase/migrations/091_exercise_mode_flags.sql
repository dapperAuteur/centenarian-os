-- migration: 091_exercise_mode_flags.sql
-- Add is_bodyweight, is_timed, per_side flags to exercise row tables
-- and default-value counterparts to the exercises library.

-- workout_template_exercises
ALTER TABLE workout_template_exercises
  ADD COLUMN is_bodyweight BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_timed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN per_side BOOLEAN NOT NULL DEFAULT false;

-- workout_log_exercises
ALTER TABLE workout_log_exercises
  ADD COLUMN is_bodyweight BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_timed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN per_side BOOLEAN NOT NULL DEFAULT false;

-- exercises (library defaults)
ALTER TABLE exercises
  ADD COLUMN is_bodyweight_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_timed_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN per_side_default BOOLEAN NOT NULL DEFAULT false;
