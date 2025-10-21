-- Add status and archived_at columns to all tables
ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE goals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- Update goals status enum to include 'archived'
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE goals ADD CONSTRAINT goals_status_check CHECK (status IN ('active', 'completed', 'deferred', 'archived'));

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- Update milestones status enum to include 'archived'
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_status_check;
ALTER TABLE milestones ADD CONSTRAINT milestones_status_check CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'archived'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Update all existing rows to have status = 'active'
UPDATE roadmaps SET status = 'active' WHERE status IS NULL;
UPDATE tasks SET status = 'active' WHERE status IS NULL;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_roadmaps_status ON roadmaps(status);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);