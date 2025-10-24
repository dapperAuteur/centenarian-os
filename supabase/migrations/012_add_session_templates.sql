-- supabase/migrations/012_add_session_templates.sql

-- Session templates for quick starts
CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  notes_template TEXT,
  icon TEXT DEFAULT '⚡',
  use_pomodoro BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT session_templates_duration_check CHECK (duration_minutes > 0 AND duration_minutes <= 480)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_templates_user ON session_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_created ON session_templates(created_at DESC);

-- RLS
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their templates" ON session_templates
  FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_session_templates_updated_at 
  BEFORE UPDATE ON session_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE session_templates IS 'User-defined quick start templates for focus sessions';
COMMENT ON COLUMN session_templates.name IS 'Template name (e.g., "Deep Work", "Client Call")';
COMMENT ON COLUMN session_templates.icon IS 'Emoji icon for visual identification';
COMMENT ON COLUMN session_templates.use_pomodoro IS 'Whether to start in Pomodoro mode';