-- File: supabase/migrations/009_focus_analytics.sql

-- Add tags column to focus_sessions for categorization
ALTER TABLE focus_sessions 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add template reference
ALTER TABLE focus_sessions 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES session_templates(id) ON DELETE SET NULL;

-- Add completion quality self-rating (1-5)
ALTER TABLE focus_sessions 
ADD COLUMN IF NOT EXISTS quality_rating INT CHECK (quality_rating BETWEEN 1 AND 5);

-- Create index for tag-based queries
CREATE INDEX IF NOT EXISTS idx_focus_sessions_tags ON focus_sessions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_template ON focus_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_quality ON focus_sessions(quality_rating);

-- Add updated_at column if missing
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger to auto-update updated_at
CREATE OR REPLACE TRIGGER update_focus_sessions_updated_at 
BEFORE UPDATE ON focus_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create materialized view for fast analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS focus_session_analytics AS
SELECT 
  user_id,
  DATE(start_time) as session_date,
  COUNT(*) as total_sessions,
  SUM(CASE WHEN pomodoro_mode THEN 1 ELSE 0 END) as pomodoro_sessions,
  SUM(CASE WHEN NOT pomodoro_mode THEN 1 ELSE 0 END) as simple_sessions,
  SUM(duration) as total_duration,
  SUM(COALESCE(net_work_duration, duration)) as total_net_work,
  SUM(revenue) as total_revenue,
  AVG(quality_rating) as avg_quality,
  COUNT(DISTINCT task_id) as unique_tasks,
  COUNT(DISTINCT template_id) as templates_used,
  -- Pomodoro-specific stats
  SUM(CASE WHEN pomodoro_mode THEN jsonb_array_length(COALESCE(work_intervals, '[]'::jsonb)) ELSE 0 END) as total_pomodoros,
  SUM(CASE WHEN pomodoro_mode THEN jsonb_array_length(COALESCE(break_intervals, '[]'::jsonb)) ELSE 0 END) as total_breaks
FROM focus_sessions
WHERE end_time IS NOT NULL
GROUP BY user_id, DATE(start_time);

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_analytics_user_date 
ON focus_session_analytics(user_id, session_date);

-- Function to refresh analytics (call this nightly or on-demand)
CREATE OR REPLACE FUNCTION refresh_focus_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY focus_session_analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON focus_session_analytics TO authenticated;