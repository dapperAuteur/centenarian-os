-- 082_exercise_library.sql
-- Exercise Library: user-managed exercise categories + exercise definitions with media.

BEGIN;

-- ── 1. Exercise Categories (user-managed, seeded on first API access) ──
CREATE TABLE exercise_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_exercise_categories_user ON exercise_categories (user_id);

ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY exercise_categories_owner ON exercise_categories
  FOR ALL USING (user_id = auth.uid());

-- ── 2. Exercises ────────────────────────────────────────────────────────
CREATE TABLE exercises (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category_id        UUID REFERENCES exercise_categories(id) ON DELETE SET NULL,
  instructions       TEXT,
  form_cues          TEXT,
  video_url          TEXT,
  media_url          TEXT,
  media_public_id    TEXT,
  audio_url          TEXT,
  audio_public_id    TEXT,
  primary_muscles    TEXT[],
  default_sets       INT,
  default_reps       INT,
  default_weight_lbs NUMERIC(6,1),
  default_duration_sec INT,
  default_rest_sec   INT DEFAULT 60,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  use_count          INT NOT NULL DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_user ON exercises (user_id);
CREATE INDEX idx_exercises_user_category ON exercises (user_id, category_id);
CREATE INDEX idx_exercises_user_active ON exercises (user_id, is_active);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY exercises_owner ON exercises
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER update_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Exercise-Equipment junction ──────────────────────────────────────
CREATE TABLE exercise_equipment (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id  UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  notes        TEXT,
  UNIQUE (exercise_id, equipment_id)
);

CREATE INDEX idx_exercise_equipment_exercise ON exercise_equipment (exercise_id);
CREATE INDEX idx_exercise_equipment_equipment ON exercise_equipment (equipment_id);

-- ── 4. Extend activity_links for 'exercise' type ───────────────────────
ALTER TABLE activity_links DROP CONSTRAINT activity_links_source_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_source_type_check
  CHECK (source_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session','exercise'
  ));

ALTER TABLE activity_links DROP CONSTRAINT activity_links_target_type_check;
ALTER TABLE activity_links ADD CONSTRAINT activity_links_target_type_check
  CHECK (target_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session','exercise'
  ));

-- ── 5. Extend entity_life_categories for 'exercise' type ───────────────
ALTER TABLE entity_life_categories DROP CONSTRAINT entity_life_categories_entity_type_check;
ALTER TABLE entity_life_categories ADD CONSTRAINT entity_life_categories_entity_type_check
  CHECK (entity_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session','exercise'
  ));

COMMIT;
