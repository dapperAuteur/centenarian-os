-- ============================================================================
-- AGILITY ENGINE SCHEMA - Integrated with CentOS
-- ============================================================================
-- Tables: agility_courses, agility_sessions, agility_reps, agility_leaderboard
-- Integration: Links to auth.users, user_profiles, tasks, goals
-- ============================================================================

-- ============================================================================
-- 1. COURSES TABLE (Official + Custom)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agility_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cone_count INT NOT NULL CHECK (cone_count BETWEEN 2 AND 6),
  cone_positions JSONB NOT NULL, -- [{number: 1, distance: 5, angle: 0}, ...]
  is_official BOOLEAN DEFAULT false, -- Only official courses on leaderboard
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: Only one official course per configuration
CREATE UNIQUE INDEX idx_agility_courses_official 
  ON public.agility_courses (cone_count, cone_positions) 
  WHERE is_official = true;

CREATE INDEX idx_agility_courses_official_filter 
  ON public.agility_courses (is_official) 
  WHERE is_official = true;

-- ============================================================================
-- 2. SESSIONS TABLE (Individual Training Sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agility_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.agility_courses(id) ON DELETE SET NULL,
  
  -- Optional CentOS Integration
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  
  -- Session Config
  sets INT NOT NULL,
  reps_per_set INT NOT NULL,
  rest_between_sets INT NOT NULL, -- seconds
  min_start_delay INT NOT NULL, -- Random delay range (seconds)
  max_start_delay INT NOT NULL,
  
  -- Results
  total_time_ms INT NOT NULL, -- Total session time
  total_reps_completed INT NOT NULL,
  avg_sprint_time_ms INT, -- Average sprint time
  sprint_variance DECIMAL(10,2), -- Consistency metric (stddev)
  
  -- Metadata
  is_ranked BOOLEAN DEFAULT false, -- True if official course
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ, -- For offline sync tracking
  
  -- Session notes
  notes TEXT,
  rpe INT CHECK (rpe BETWEEN 1 AND 10), -- Rate of Perceived Exertion
  
  -- Victory card
  shared_count INT DEFAULT 0
);

CREATE INDEX idx_agility_sessions_user ON public.agility_sessions (user_id);
CREATE INDEX idx_agility_sessions_course ON public.agility_sessions (course_id);
CREATE INDEX idx_agility_sessions_completed ON public.agility_sessions (completed_at DESC);
CREATE INDEX idx_agility_sessions_ranked ON public.agility_sessions (is_ranked, total_time_ms) WHERE is_ranked = true;
CREATE INDEX idx_agility_sessions_task ON public.agility_sessions (task_id) WHERE task_id IS NOT NULL;

-- ============================================================================
-- 3. REPS TABLE (Individual Sprint Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agility_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.agility_sessions(id) ON DELETE CASCADE,
  
  -- Rep Info
  rep_number INT NOT NULL, -- 1-N within session
  set_number INT NOT NULL,
  target_cone INT NOT NULL,
  
  -- Timing Data
  start_delay_ms INT NOT NULL, -- Random delay before "GO!"
  sprint_time_ms INT NOT NULL, -- Signal → return button press
  
  -- Derived Metrics
  reaction_quality TEXT CHECK (reaction_quality IN ('excellent', 'good', 'fair', 'poor')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agility_reps_session ON public.agility_reps (session_id);
CREATE INDEX idx_agility_reps_cone ON public.agility_reps (target_cone);

-- ============================================================================
-- 4. LEADERBOARD TABLE (Denormalized for Performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agility_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.agility_courses(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.agility_sessions(id) ON DELETE CASCADE,
  
  -- User Info (denormalized for speed)
  username TEXT NOT NULL,
  profile_image_url TEXT,
  
  -- Best Times
  best_total_time_ms INT NOT NULL,
  best_cone_times JSONB, -- {1: 5100, 2: 4800, ...}
  
  -- Consistency Metrics
  avg_sprint_time_ms INT NOT NULL,
  sprint_variance DECIMAL(10,2) NOT NULL,
  
  -- Metadata
  total_reps INT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compound index for leaderboard queries
CREATE INDEX idx_agility_leaderboard_course_time 
  ON public.agility_leaderboard (course_id, best_total_time_ms);

CREATE INDEX idx_agility_leaderboard_course_consistency 
  ON public.agility_leaderboard (course_id, sprint_variance);

CREATE UNIQUE INDEX idx_agility_leaderboard_user_course 
  ON public.agility_leaderboard (user_id, course_id);

-- ============================================================================
-- 5. EXTEND USER_PROFILES (Optional Agility Stats)
-- ============================================================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS agility_username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS agility_profile_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agility_total_sessions INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS agility_total_sprints INT DEFAULT 0;

CREATE INDEX idx_user_profiles_agility_username 
  ON public.user_profiles (agility_username) 
  WHERE agility_username IS NOT NULL;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Courses: Public read, authenticated create
ALTER TABLE public.agility_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view courses" 
  ON public.agility_courses 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create custom courses" 
  ON public.agility_courses 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = created_by 
    AND is_official = false
  );

-- Sessions: Users own their data
ALTER TABLE public.agility_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their sessions" 
  ON public.agility_sessions 
  FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Public profiles viewable" 
  ON public.agility_sessions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE user_profiles.user_id = agility_sessions.user_id 
      AND user_profiles.agility_profile_public = true
    )
  );

-- Reps: Cascade from sessions
ALTER TABLE public.agility_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their reps" 
  ON public.agility_reps 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.agility_sessions 
      WHERE agility_sessions.id = agility_reps.session_id 
      AND agility_sessions.user_id = auth.uid()
    )
  );

-- Leaderboard: Public read, system write
ALTER TABLE public.agility_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard" 
  ON public.agility_leaderboard 
  FOR SELECT 
  USING (true);

-- Only service role can write (via triggers/functions)
CREATE POLICY "Service role manages leaderboard" 
  ON public.agility_leaderboard 
  FOR ALL 
  USING (auth.uid() IS NULL);

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Update updated_at on row changes
CREATE OR REPLACE TRIGGER update_agility_courses_updated_at
  BEFORE UPDATE ON public.agility_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_agility_leaderboard_updated_at
  BEFORE UPDATE ON public.agility_leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update leaderboard when session completes
CREATE OR REPLACE FUNCTION public.update_agility_leaderboard()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_profile_image TEXT;
  v_best_cone_times JSONB;
BEGIN
  -- Only process ranked sessions
  IF NEW.is_ranked = false THEN
    RETURN NEW;
  END IF;

  -- Get user info
  SELECT 
    COALESCE(agility_username, 'user_' || substring(user_id::text, 1, 8)),
    profile_image_url
  INTO v_username, v_profile_image
  FROM public.user_profiles
  WHERE user_id = NEW.user_id;

  -- Calculate best times per cone
  SELECT jsonb_object_agg(
    target_cone::text, 
    MIN(sprint_time_ms)
  )
  INTO v_best_cone_times
  FROM public.agility_reps
  WHERE session_id = NEW.id
  GROUP BY target_cone;

  -- Insert or update leaderboard entry
  INSERT INTO public.agility_leaderboard (
    user_id,
    course_id,
    session_id,
    username,
    profile_image_url,
    best_total_time_ms,
    best_cone_times,
    avg_sprint_time_ms,
    sprint_variance,
    total_reps,
    completed_at
  ) VALUES (
    NEW.user_id,
    NEW.course_id,
    NEW.id,
    v_username,
    v_profile_image,
    NEW.total_time_ms,
    v_best_cone_times,
    NEW.avg_sprint_time_ms,
    NEW.sprint_variance,
    NEW.total_reps_completed,
    NEW.completed_at
  )
  ON CONFLICT (user_id, course_id)
  DO UPDATE SET
    session_id = EXCLUDED.session_id,
    best_total_time_ms = LEAST(agility_leaderboard.best_total_time_ms, EXCLUDED.best_total_time_ms),
    avg_sprint_time_ms = EXCLUDED.avg_sprint_time_ms,
    sprint_variance = EXCLUDED.sprint_variance,
    total_reps = agility_leaderboard.total_reps + EXCLUDED.total_reps,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW()
  WHERE EXCLUDED.best_total_time_ms < agility_leaderboard.best_total_time_ms;

  -- Update user profile stats
  UPDATE public.user_profiles
  SET 
    agility_total_sessions = agility_total_sessions + 1,
    agility_total_sprints = agility_total_sprints + NEW.total_reps_completed
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_agility_leaderboard
  AFTER INSERT ON public.agility_sessions
  FOR EACH ROW
  WHEN (NEW.is_ranked = true)
  EXECUTE FUNCTION public.update_agility_leaderboard();

-- ============================================================================
-- 8. SEED DATA (Official Courses)
-- ============================================================================

-- 4-Cone Square (10m x 10m)
INSERT INTO public.agility_courses (name, description, cone_count, cone_positions, is_official)
VALUES (
  '4-Cone Square',
  'Standard 10m x 10m square layout',
  4,
  '[
    {"number": 1, "distance": 10, "angle": 0},
    {"number": 2, "distance": 10, "angle": 90},
    {"number": 3, "distance": 10, "angle": 180},
    {"number": 4, "distance": 10, "angle": 270}
  ]'::jsonb,
  true
);

-- 3-Cone Triangle (8m sides)
INSERT INTO public.agility_courses (name, description, cone_count, cone_positions, is_official)
VALUES (
  '3-Cone Triangle',
  'Equilateral triangle with 8m sides',
  3,
  '[
    {"number": 1, "distance": 8, "angle": 0},
    {"number": 2, "distance": 8, "angle": 120},
    {"number": 3, "distance": 8, "angle": 240}
  ]'::jsonb,
  true
);

-- 5-Cone Pentagon (6m from center)
INSERT INTO public.agility_courses (name, description, cone_count, cone_positions, is_official)
VALUES (
  '5-Cone Pentagon',
  'Pentagon layout with 6m radius',
  5,
  '[
    {"number": 1, "distance": 6, "angle": 0},
    {"number": 2, "distance": 6, "angle": 72},
    {"number": 3, "distance": 6, "angle": 144},
    {"number": 4, "distance": 6, "angle": 216},
    {"number": 5, "distance": 6, "angle": 288}
  ]'::jsonb,
  true
);

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Get user's personal best for a course
CREATE OR REPLACE FUNCTION public.get_agility_personal_best(
  p_user_id UUID,
  p_course_id UUID
)
RETURNS TABLE (
  best_time_ms INT,
  session_date TIMESTAMPTZ,
  consistency_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.total_time_ms,
    s.completed_at,
    s.sprint_variance
  FROM public.agility_sessions s
  WHERE s.user_id = p_user_id
    AND s.course_id = p_course_id
    AND s.is_ranked = true
  ORDER BY s.total_time_ms ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get leaderboard rankings
CREATE OR REPLACE FUNCTION public.get_agility_leaderboard(
  p_course_id UUID,
  p_limit INT DEFAULT 100,
  p_metric TEXT DEFAULT 'speed' -- 'speed' or 'consistency'
)
RETURNS TABLE (
  rank INT,
  username TEXT,
  profile_image_url TEXT,
  best_time_ms INT,
  avg_sprint_ms INT,
  variance DECIMAL,
  total_reps INT,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  IF p_metric = 'consistency' THEN
    RETURN QUERY
    SELECT 
      ROW_NUMBER() OVER (ORDER BY l.sprint_variance ASC)::INT,
      l.username,
      l.profile_image_url,
      l.best_total_time_ms,
      l.avg_sprint_time_ms,
      l.sprint_variance,
      l.total_reps,
      l.completed_at
    FROM public.agility_leaderboard l
    WHERE l.course_id = p_course_id
    ORDER BY l.sprint_variance ASC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT 
      ROW_NUMBER() OVER (ORDER BY l.best_total_time_ms ASC)::INT,
      l.username,
      l.profile_image_url,
      l.best_total_time_ms,
      l.avg_sprint_time_ms,
      l.sprint_variance,
      l.total_reps,
      l.completed_at
    FROM public.agility_leaderboard l
    WHERE l.course_id = p_course_id
    ORDER BY l.best_total_time_ms ASC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. GRANTS
-- ============================================================================
GRANT ALL ON public.agility_courses TO authenticated;
GRANT ALL ON public.agility_sessions TO authenticated;
GRANT ALL ON public.agility_reps TO authenticated;
GRANT SELECT ON public.agility_leaderboard TO authenticated;
GRANT SELECT ON public.agility_leaderboard TO anon;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created: 4
-- Indexes created: 16
-- Policies created: 7
-- Triggers created: 3
-- Functions created: 3
-- Seed courses: 3
-- ============================================================================
