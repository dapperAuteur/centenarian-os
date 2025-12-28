-- 018_fix_leaderboard_trigger.sql
-- Fix leaderboard trigger to handle usernames properly
CREATE OR REPLACE FUNCTION public.update_agility_leaderboard()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_profile_image TEXT;
  v_best_cone_times JSONB;
BEGIN
  IF NEW.is_ranked = false THEN
    RETURN NEW;
  END IF;

  -- Get user info with fallback for anonymous
  IF NEW.user_id IS NULL THEN
    v_username := 'Anonymous';
    v_profile_image := NULL;
  ELSE
    SELECT 
      COALESCE(agility_username, 'user_' || substring(user_id::text, 1, 8)),
      profile_image_url
    INTO v_username, v_profile_image
    FROM public.user_profiles
    WHERE user_id = NEW.user_id;
    
    -- If no profile exists, create one
    IF v_username IS NULL THEN
      v_username := 'user_' || substring(NEW.user_id::text, 1, 8);
      INSERT INTO public.user_profiles (user_id, agility_username, agility_profile_public)
      VALUES (NEW.user_id, v_username, false)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

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
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET 
      agility_total_sessions = COALESCE(agility_total_sessions, 0) + 1,
      agility_total_sprints = COALESCE(agility_total_sprints, 0) + NEW.total_reps_completed
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
