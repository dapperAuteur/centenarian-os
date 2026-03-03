-- 083_enhanced_workout_logging.sql
-- Enhanced workout logging: new fields on templates, logs, and exercise rows.
-- Links template/log exercises to the exercise library.

BEGIN;

-- ── 1. workout_logs: purpose, feeling, warm/cool notes ──────────────────
ALTER TABLE workout_logs
  ADD COLUMN purpose          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN overall_feeling  SMALLINT CHECK (overall_feeling BETWEEN 1 AND 5),
  ADD COLUMN warmup_notes     TEXT,
  ADD COLUMN cooldown_notes   TEXT;

-- ── 2. workout_templates: purpose default for logs ──────────────────────
ALTER TABLE workout_templates
  ADD COLUMN purpose JSONB DEFAULT '[]'::jsonb;

-- Relax category CHECK (UI already sends values outside original constraint)
ALTER TABLE workout_templates DROP CONSTRAINT IF EXISTS workout_templates_category_check;

-- ── 3. workout_template_exercises: library link + enhanced fields ────────
ALTER TABLE workout_template_exercises
  ADD COLUMN exercise_id     UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN equipment_id    UUID REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN is_circuit      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_negative     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_isometric    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN to_failure      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_superset     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN superset_group  INT,
  ADD COLUMN is_balance      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_unilateral   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN percent_of_max  NUMERIC(5,2),
  ADD COLUMN rpe             SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  ADD COLUMN tempo           TEXT,
  ADD COLUMN distance_miles  NUMERIC(8,2),
  ADD COLUMN hold_sec        INT,
  ADD COLUMN phase           TEXT CHECK (phase IN ('warmup', 'working', 'cooldown'));

-- ── 4. workout_log_exercises: same + side, feeling, rest_sec ────────────
ALTER TABLE workout_log_exercises
  ADD COLUMN exercise_id     UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN equipment_id    UUID REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN is_circuit      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_negative     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_isometric    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN to_failure      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_superset     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN superset_group  INT,
  ADD COLUMN is_balance      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_unilateral   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN percent_of_max  NUMERIC(5,2),
  ADD COLUMN rpe             SMALLINT CHECK (rpe BETWEEN 1 AND 10),
  ADD COLUMN tempo           TEXT,
  ADD COLUMN distance_miles  NUMERIC(8,2),
  ADD COLUMN hold_sec        INT,
  ADD COLUMN side            TEXT CHECK (side IN ('left', 'right', 'both')),
  ADD COLUMN feeling         SMALLINT CHECK (feeling BETWEEN 1 AND 5),
  ADD COLUMN phase           TEXT CHECK (phase IN ('warmup', 'working', 'cooldown')),
  ADD COLUMN rest_sec        INT DEFAULT 60;

COMMIT;
