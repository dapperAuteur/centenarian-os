ALTER TABLE roadmaps ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE goals ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE milestones ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

-- Index for filtering
CREATE INDEX idx_roadmaps_status ON roadmaps(status);
CREATE INDEX idx_goals_status ON goals(status);