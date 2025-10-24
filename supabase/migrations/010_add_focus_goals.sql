-- supabase/migrations/010_add_focus_goals.sql

-- Add focus time goals to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS daily_focus_goal_minutes INT DEFAULT 120,
ADD COLUMN IF NOT EXISTS weekly_focus_goal_minutes INT DEFAULT 840;

-- Add constraints (reasonable limits)
ALTER TABLE user_profiles 
ADD CONSTRAINT daily_focus_goal_check CHECK (daily_focus_goal_minutes >= 0 AND daily_focus_goal_minutes <= 1440),
ADD CONSTRAINT weekly_focus_goal_check CHECK (weekly_focus_goal_minutes >= 0 AND weekly_focus_goal_minutes <= 10080);

-- Add comments
COMMENT ON COLUMN user_profiles.daily_focus_goal_minutes IS 'Daily focus time goal in minutes (default 2 hours)';
COMMENT ON COLUMN user_profiles.weekly_focus_goal_minutes IS 'Weekly focus time goal in minutes (default 14 hours)';

-- Update existing users with defaults if NULL
UPDATE user_profiles 
SET daily_focus_goal_minutes = 120 
WHERE daily_focus_goal_minutes IS NULL;

UPDATE user_profiles 
SET weekly_focus_goal_minutes = 840 
WHERE weekly_focus_goal_minutes IS NULL;