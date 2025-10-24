-- supabase/migrations/011_add_pomodoro_breaks.sql

-- Add break tracking columns to focus_sessions
ALTER TABLE focus_sessions
ADD COLUMN IF NOT EXISTS pomodoro_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS work_intervals JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS break_intervals JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS net_work_duration INT;

-- Add comments
COMMENT ON COLUMN focus_sessions.pomodoro_mode IS 'Whether session was started in Pomodoro mode';
COMMENT ON COLUMN focus_sessions.work_intervals IS 'Array of work periods: [{start, end, duration}]';
COMMENT ON COLUMN focus_sessions.break_intervals IS 'Array of break periods: [{start, end, duration}]';
COMMENT ON COLUMN focus_sessions.net_work_duration IS 'Total work time excluding breaks (seconds)';

-- Create index for pomodoro queries
CREATE INDEX IF NOT EXISTS idx_focus_sessions_pomodoro ON focus_sessions(pomodoro_mode) WHERE pomodoro_mode = true;