-- File: supabase/migrations/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Supabase Auth creates this)
-- We'll reference auth.users(id)

-- Roadmaps (top level)
CREATE TABLE roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL')),
  target_year INT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'deferred')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  activity TEXT NOT NULL,
  description TEXT,
  tag TEXT NOT NULL,
  priority INT CHECK (priority IN (1, 2, 3)),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tasks_date ON tasks(date);
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX idx_milestones_goal ON milestones(goal_id);
CREATE INDEX idx_goals_roadmap ON goals(roadmap_id);

-- Row Level Security (RLS)
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can CRUD their roadmaps" ON roadmaps
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their goals" ON goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM roadmaps 
      WHERE roadmaps.id = goals.roadmap_id 
      AND roadmaps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD their milestones" ON milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM goals
      JOIN roadmaps ON roadmaps.id = goals.roadmap_id
      WHERE goals.id = milestones.goal_id
      AND roadmaps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD their tasks" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM milestones
      JOIN goals ON goals.id = milestones.goal_id
      JOIN roadmaps ON roadmaps.id = goals.roadmap_id
      WHERE milestones.id = tasks.milestone_id
      AND roadmaps.user_id = auth.uid()
    )
  );

-- Nutrition tables (Module 2)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ncv_score TEXT CHECK (ncv_score IN ('Green', 'Yellow', 'Red')),
  calories_per_100g DECIMAL,
  protein_per_100g DECIMAL,
  carbs_per_100g DECIMAL,
  fat_per_100g DECIMAL,
  cost_per_unit DECIMAL,
  unit TEXT,
  notes TEXT,
  usda_fdc_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  ncv_score TEXT,
  total_cost DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE protocol_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL,
  unit TEXT NOT NULL
);

-- Daily logs (Module 3 - the integration point)
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  energy_rating INT CHECK (energy_rating BETWEEN 1 AND 5),
  biggest_win TEXT,
  biggest_challenge TEXT,
  pain_intensity INT CHECK (pain_intensity BETWEEN 1 AND 10),
  pain_locations JSONB,
  pain_sensations JSONB,
  pain_activities JSONB,
  pain_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INT, -- seconds
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for nutrition and logs
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their ingredients" ON ingredients
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their protocols" ON protocols
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their daily logs" ON daily_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their focus sessions" ON focus_sessions
  FOR ALL USING (auth.uid() = user_id);