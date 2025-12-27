-- supabase/migrations/016_recurring_tasks.sql

-- Create recurring tasks table
CREATE TABLE recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  activity TEXT NOT NULL,
  description TEXT,
  tag TEXT NOT NULL,
  priority INT CHECK (priority IN (1, 2, 3)),
  time TIME NOT NULL,
  pattern JSONB NOT NULL, -- { type, interval, daysOfWeek, dayOfMonth, endDate }
  is_active BOOLEAN DEFAULT TRUE,
  last_generated_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_tasks_user ON recurring_tasks(user_id);
CREATE INDEX idx_recurring_tasks_milestone ON recurring_tasks(milestone_id);
CREATE INDEX idx_recurring_tasks_active ON recurring_tasks(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their recurring tasks" ON recurring_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM milestones
      JOIN goals ON goals.id = milestones.goal_id
      JOIN roadmaps ON roadmaps.id = goals.roadmap_id
      WHERE milestones.id = recurring_tasks.milestone_id
      AND roadmaps.user_id = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_recurring_tasks_updated_at BEFORE UPDATE ON recurring_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate tasks from recurring pattern
CREATE OR REPLACE FUNCTION generate_recurring_tasks(
  p_recurring_task_id UUID,
  p_target_date DATE
) RETURNS VOID AS $$
DECLARE
  v_recurring recurring_tasks;
  v_should_create BOOLEAN;
BEGIN
  SELECT * INTO v_recurring FROM recurring_tasks WHERE id = p_recurring_task_id;
  
  IF NOT FOUND OR NOT v_recurring.is_active THEN
    RETURN;
  END IF;
  
  -- Check if already generated for this date
  IF v_recurring.last_generated_date >= p_target_date THEN
    RETURN;
  END IF;
  
  v_should_create := FALSE;
  
  -- Check pattern
  IF v_recurring.pattern->>'type' = 'daily' THEN
    v_should_create := TRUE;
  ELSIF v_recurring.pattern->>'type' = 'weekly' THEN
    -- Check if day of week matches
    IF (v_recurring.pattern->'daysOfWeek')::jsonb ? EXTRACT(DOW FROM p_target_date)::TEXT THEN
      v_should_create := TRUE;
    END IF;
  ELSIF v_recurring.pattern->>'type' = 'biweekly' THEN
    -- Check if 14 days since last generated
    IF v_recurring.last_generated_date IS NULL 
       OR p_target_date - v_recurring.last_generated_date >= 14 THEN
      v_should_create := TRUE;
    END IF;
  ELSIF v_recurring.pattern->>'type' = 'monthly' THEN
    -- Check if day of month matches
    IF EXTRACT(DAY FROM p_target_date) = (v_recurring.pattern->>'dayOfMonth')::INT THEN
      v_should_create := TRUE;
    END IF;
  ELSIF v_recurring.pattern->>'type' = 'custom' THEN
    -- Check custom interval
    IF v_recurring.last_generated_date IS NULL 
       OR p_target_date - v_recurring.last_generated_date >= (v_recurring.pattern->>'interval')::INT THEN
      v_should_create := TRUE;
    END IF;
  END IF;
  
  IF v_should_create THEN
    INSERT INTO tasks (
      milestone_id,
      date,
      time,
      activity,
      description,
      tag,
      priority,
      completed
    ) VALUES (
      v_recurring.milestone_id,
      p_target_date,
      v_recurring.time,
      v_recurring.activity,
      v_recurring.description,
      v_recurring.tag,
      v_recurring.priority,
      FALSE
    );
    
    UPDATE recurring_tasks 
    SET last_generated_date = p_target_date 
    WHERE id = p_recurring_task_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;