-- supabase/migrations/015_add_session_type.sql

-- Add session_type column to focus_sessions
ALTER TABLE focus_sessions
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'focus' CHECK (session_type IN ('focus', 'work'));

-- Add comment
COMMENT ON COLUMN focus_sessions.session_type IS 'Focus = quality+goals tracking, Work = time+revenue only';

-- Create index
CREATE INDEX IF NOT EXISTS idx_focus_sessions_type ON focus_sessions(session_type);

-- Update analytics views to separate focus vs work
DROP VIEW IF EXISTS daily_aggregates;

CREATE VIEW daily_aggregates AS
SELECT
  user_id,
  DATE(start_time) as date,
  -- Focus sessions (quality + goals)
  COUNT(*) FILTER (WHERE session_type = 'focus' AND end_time IS NOT NULL) as focus_count,
  COALESCE(SUM(duration) FILTER (WHERE session_type = 'focus' AND end_time IS NOT NULL), 0) as focus_minutes,
  COALESCE(AVG(quality_rating) FILTER (WHERE session_type = 'focus' AND quality_rating IS NOT NULL), 0) as avg_focus_quality,
  -- Work sessions (time + revenue)
  COUNT(*) FILTER (WHERE session_type = 'work' AND end_time IS NOT NULL) as work_count,
  COALESCE(SUM(duration) FILTER (WHERE session_type = 'work' AND end_time IS NOT NULL), 0) as work_minutes,
  COALESCE(SUM(revenue) FILTER (WHERE session_type = 'work' AND revenue IS NOT NULL), 0) as work_revenue,
  -- Combined
  COUNT(*) FILTER (WHERE end_time IS NOT NULL) as total_sessions,
  COALESCE(SUM(duration) FILTER (WHERE end_time IS NOT NULL), 0) as total_minutes
FROM focus_sessions
GROUP BY user_id, DATE(start_time);