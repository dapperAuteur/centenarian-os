-- 146_workout_suggestions.sql
-- Extends admin_notifications to support workout edit suggestions from users.
-- Additive change — drops and re-adds the CHECK constraint with the new type.

BEGIN;

ALTER TABLE public.admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_type_check;

ALTER TABLE public.admin_notifications
  ADD CONSTRAINT admin_notifications_type_check
  CHECK (type IN ('new_exercise', 'new_equipment', 'workout_suggestion'));

COMMIT;
