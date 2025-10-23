-- supabase/migrations/009_add_session_tags.sql

-- Add tags column to focus_sessions
ALTER TABLE focus_sessions 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for tag filtering
CREATE INDEX IF NOT EXISTS idx_focus_sessions_tags ON focus_sessions USING GIN (tags);

-- Add comment
COMMENT ON COLUMN focus_sessions.tags IS 'Array of tags for categorizing sessions (e.g., deep-work, meeting, admin)';