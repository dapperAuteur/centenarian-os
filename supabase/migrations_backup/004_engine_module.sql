-- File: supabase/migrations/004_engine_module.sql

-- Focus sessions (already exists in nutrition schema, but adding if missing)
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily logs (central integration document)
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  
  -- Debrief
  energy_rating INT CHECK (energy_rating BETWEEN 1 AND 5),
  biggest_win TEXT,
  biggest_challenge TEXT,
  
  -- Pain tracking
  pain_intensity INT CHECK (pain_intensity BETWEEN 1 AND 10),
  pain_locations TEXT[],
  pain_sensations TEXT[],
  pain_activities TEXT[],
  pain_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_focus_sessions_user ON focus_sessions(user_id);
CREATE INDEX idx_focus_sessions_task ON focus_sessions(task_id);
CREATE INDEX idx_focus_sessions_start ON focus_sessions(start_time);
CREATE INDEX idx_daily_logs_user ON daily_logs(user_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(date);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their focus sessions" ON focus_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their daily logs" ON daily_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_daily_logs_updated_at BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();