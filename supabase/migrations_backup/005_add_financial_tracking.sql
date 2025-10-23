-- Add financial fields to all planning entities
ALTER TABLE roadmaps ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE roadmaps ADD COLUMN actual_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE roadmaps ADD COLUMN revenue DECIMAL(10,2) DEFAULT 0;

ALTER TABLE goals ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE goals ADD COLUMN actual_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE goals ADD COLUMN revenue DECIMAL(10,2) DEFAULT 0;

ALTER TABLE milestones ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE milestones ADD COLUMN actual_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE milestones ADD COLUMN revenue DECIMAL(10,2) DEFAULT 0;

ALTER TABLE tasks ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN actual_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN revenue DECIMAL(10,2) DEFAULT 0;

-- Add financial fields to Engine module
ALTER TABLE focus_sessions ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE focus_sessions ADD COLUMN revenue DECIMAL(10,2) DEFAULT 0;

ALTER TABLE daily_logs ADD COLUMN total_spent DECIMAL(10,2) DEFAULT 0;
ALTER TABLE daily_logs ADD COLUMN total_earned DECIMAL(10,2) DEFAULT 0;

-- Add indexes for financial queries
CREATE INDEX idx_tasks_financial ON tasks(actual_cost, revenue);
CREATE INDEX idx_daily_logs_financial ON daily_logs(date, total_spent, total_earned);