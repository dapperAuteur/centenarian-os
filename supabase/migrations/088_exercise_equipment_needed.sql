-- supabase/migrations/088_exercise_equipment_needed.sql
-- Adds equipment_needed level to personal exercises for consistent filtering
-- with the system exercise library.

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS equipment_needed TEXT DEFAULT NULL
    CHECK (equipment_needed IS NULL OR equipment_needed IN ('none', 'minimal', 'gym'));

COMMENT ON COLUMN exercises.equipment_needed IS
  'null = unspecified (treated as no-equipment in filters), none = bodyweight only, minimal = dumbbells/bands/kettlebell/pull-up bar, gym = barbell/cable/machines';
