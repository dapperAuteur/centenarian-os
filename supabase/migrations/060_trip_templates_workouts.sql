-- 060_trip_templates_workouts.sql
-- 1. Trip templates: save any trip as a reusable template for one-click re-logging
-- 2. Workout builder: exercises, sets, reps for strength/gym workouts

-- ── Trip templates ──────────────────────────────────────────────────────────
CREATE TABLE trip_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  origin TEXT,
  destination TEXT,
  distance_miles NUMERIC(10,2),
  duration_min INT,
  purpose TEXT,
  trip_category TEXT CHECK (trip_category IN ('travel', 'fitness')),
  tax_category TEXT CHECK (tax_category IN ('personal', 'business', 'medical', 'charitable')),
  notes TEXT,
  use_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON trip_templates (user_id);

ALTER TABLE trip_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY trip_templates_owner ON trip_templates
  FOR ALL USING (user_id = auth.uid());

-- ── Workouts ────────────────────────────────────────────────────────────────
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('strength', 'cardio', 'flexibility', 'hiit', 'other')),
  estimated_duration_min INT,
  use_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON workout_templates (user_id);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_templates_owner ON workout_templates
  FOR ALL USING (user_id = auth.uid());

-- Template exercises (ordered list of exercises per template)
CREATE TABLE workout_template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INT,
  reps INT,
  weight_lbs NUMERIC(6,1),
  duration_sec INT,
  rest_sec INT DEFAULT 60,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX ON workout_template_exercises (template_id);

ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_template_exercises_owner ON workout_template_exercises
  FOR ALL USING (
    template_id IN (SELECT id FROM workout_templates WHERE user_id = auth.uid())
  );

-- Logged workout sessions
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_min INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON workout_logs (user_id, date);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_logs_owner ON workout_logs
  FOR ALL USING (user_id = auth.uid());

-- Logged exercises within a session
CREATE TABLE workout_log_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets_completed INT,
  reps_completed INT,
  weight_lbs NUMERIC(6,1),
  duration_sec INT,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX ON workout_log_exercises (log_id);

ALTER TABLE workout_log_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_log_exercises_owner ON workout_log_exercises
  FOR ALL USING (
    log_id IN (SELECT id FROM workout_logs WHERE user_id = auth.uid())
  );
