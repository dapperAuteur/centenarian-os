-- 019_add_focus_sessions.sql
-- Add session_type column to focus_sessions
ALTER TABLE focus_sessions
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'focus' 
CHECK (session_type IN ('focus', 'work'));

-- Add comment
COMMENT ON COLUMN focus_sessions.session_type IS 'Focus = quality+goals tracking, Work = time+revenue only';

-- Create index
CREATE INDEX IF NOT EXISTS idx_focus_sessions_type ON focus_sessions(session_type);

-- Update existing sessions to default 'focus'
UPDATE focus_sessions 
SET session_type = 'focus' 
WHERE session_type IS NULL;