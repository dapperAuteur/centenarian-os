-- Migration 147: Add source tracking to tasks for cross-app sync
-- Enables Work.WitUS triggers to create tasks in CentOS planner
-- Copy this migration to both repos (contractor-os + centenarian-os)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id UUID;

-- Partial index for efficient lookup of synced tasks
CREATE INDEX IF NOT EXISTS idx_tasks_source
  ON tasks(source_type, source_id)
  WHERE source_type IS NOT NULL;

COMMENT ON COLUMN tasks.source_type IS 'Origin of auto-created task: invoice_due, contractor_job, etc.';
COMMENT ON COLUMN tasks.source_id IS 'ID of the source record (e.g., invoice.id)';
