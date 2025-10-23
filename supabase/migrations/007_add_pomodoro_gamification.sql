-- Migration: Add Pomodoro Gamification System
-- Description: Adds achievements and streak tracking for Pomodoro sessions

-- Create pomodoro_achievements table
CREATE TABLE IF NOT EXISTS pomodoro_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(user_id, achievement_type)
);

-- Create pomodoro_streaks table
CREATE TABLE IF NOT EXISTS pomodoro_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_session_date DATE,
  weekly_goal INT DEFAULT 15,
  weekly_progress INT DEFAULT 0,
  week_start_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pomodoro_achievements_user_id ON pomodoro_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_achievements_type ON pomodoro_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_pomodoro_achievements_unlocked_at ON pomodoro_achievements(unlocked_at);

CREATE INDEX IF NOT EXISTS idx_pomodoro_streaks_user_id ON pomodoro_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_streaks_last_session ON pomodoro_streaks(last_session_date);

-- Enable RLS
ALTER TABLE pomodoro_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pomodoro_achievements
CREATE POLICY "Users can view their own achievements" ON pomodoro_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" ON pomodoro_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements" ON pomodoro_achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for pomodoro_streaks
CREATE POLICY "Users can view their own streaks" ON pomodoro_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks" ON pomodoro_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks" ON pomodoro_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to check and unlock achievements
CREATE OR REPLACE FUNCTION check_pomodoro_achievements(
  p_user_id UUID,
  p_session_data JSONB
) RETURNS TABLE(
  achievement_type VARCHAR(50),
  unlocked BOOLEAN,
  metadata JSONB
) AS $$
DECLARE
  session_count INT;
  total_sessions INT;
  daily_sessions INT;
  document_sessions INT;
  current_hour INT;
  is_early_bird BOOLEAN;
  is_night_owl BOOLEAN;
  streak_days INT;
  week_start DATE;
  week_progress INT;
BEGIN
  -- Get current time
  current_hour := EXTRACT(HOUR FROM NOW());
  is_early_bird := current_hour < 8;
  is_night_owl := current_hour > 22;
  
  -- Get session counts
  SELECT COUNT(*) INTO total_sessions
  FROM pomodoro_sessions 
  WHERE user_id = p_user_id AND completed = true;
  
  SELECT COUNT(*) INTO daily_sessions
  FROM pomodoro_sessions 
  WHERE user_id = p_user_id 
    AND completed = true 
    AND DATE(started_at) = CURRENT_DATE;
  
  SELECT COUNT(*) INTO document_sessions
  FROM pomodoro_sessions 
  WHERE user_id = p_user_id 
    AND book_id = (p_session_data->>'bookId')::UUID
    AND completed = true;
  
  -- Get current streak
  SELECT current_streak INTO streak_days
  FROM pomodoro_streaks 
  WHERE user_id = p_user_id;
  
  -- Get weekly progress
  week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  SELECT weekly_progress INTO week_progress
  FROM pomodoro_streaks 
  WHERE user_id = p_user_id AND week_start_date = week_start;
  
  -- Check achievements and return results
  RETURN QUERY
  WITH achievement_checks AS (
    SELECT 
      'first_steps'::VARCHAR(50) as achievement_type,
      (total_sessions = 1) as unlocked,
      jsonb_build_object('total_sessions', total_sessions) as metadata
    WHERE total_sessions = 1
    
    UNION ALL
    
    SELECT 
      'consistent_reader'::VARCHAR(50),
      (daily_sessions >= 3),
      jsonb_build_object('daily_sessions', daily_sessions, 'target', 3)
    WHERE daily_sessions >= 3
    
    UNION ALL
    
    SELECT 
      'marathon'::VARCHAR(50),
      (document_sessions >= 10),
      jsonb_build_object('document_sessions', document_sessions, 'target', 10)
    WHERE document_sessions >= 10
    
    UNION ALL
    
    SELECT 
      'streak_master'::VARCHAR(50),
      (COALESCE(streak_days, 0) >= 7),
      jsonb_build_object('current_streak', COALESCE(streak_days, 0), 'target', 7)
    WHERE COALESCE(streak_days, 0) >= 7
    
    UNION ALL
    
    SELECT 
      'early_bird'::VARCHAR(50),
      is_early_bird,
      jsonb_build_object('hour', current_hour, 'is_early_bird', is_early_bird)
    WHERE is_early_bird
    
    UNION ALL
    
    SELECT 
      'night_owl'::VARCHAR(50),
      is_night_owl,
      jsonb_build_object('hour', current_hour, 'is_night_owl', is_night_owl)
    WHERE is_night_owl
    
    UNION ALL
    
    SELECT 
      'focus_champion'::VARCHAR(50),
      (document_sessions > 0 AND document_sessions % 4 = 0),
      jsonb_build_object('document_sessions', document_sessions, 'cycle_complete', true)
    WHERE document_sessions > 0 AND document_sessions % 4 = 0
    
    UNION ALL
    
    SELECT 
      'speed_reader'::VARCHAR(50),
      (total_sessions >= 50),
      jsonb_build_object('total_sessions', total_sessions, 'target', 50)
    WHERE total_sessions >= 50
    
    UNION ALL
    
    SELECT 
      'century_club'::VARCHAR(50),
      (total_sessions >= 100),
      jsonb_build_object('total_sessions', total_sessions, 'target', 100)
    WHERE total_sessions >= 100
  )
  SELECT 
    ac.achievement_type,
    ac.unlocked,
    ac.metadata
  FROM achievement_checks ac
  WHERE ac.unlocked = true
    AND NOT EXISTS (
      SELECT 1 FROM pomodoro_achievements pa 
      WHERE pa.user_id = p_user_id 
        AND pa.achievement_type = ac.achievement_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update streak tracking
CREATE OR REPLACE FUNCTION update_pomodoro_streak(
  p_user_id UUID,
  p_session_date DATE DEFAULT CURRENT_DATE
) RETURNS VOID AS $$
DECLARE
  last_session_date DATE;
  current_streak INT;
  longest_streak INT;
  week_start DATE;
  week_progress INT;
BEGIN
  -- Get current streak data
  SELECT 
    COALESCE(last_session_date, '1900-01-01'::DATE),
    COALESCE(current_streak, 0),
    COALESCE(longest_streak, 0)
  INTO last_session_date, current_streak, longest_streak
  FROM pomodoro_streaks 
  WHERE user_id = p_user_id;
  
  -- Calculate week start
  week_start := DATE_TRUNC('week', p_session_date)::DATE;
  
  -- Get current week progress
  SELECT COALESCE(weekly_progress, 0)
  INTO week_progress
  FROM pomodoro_streaks 
  WHERE user_id = p_user_id AND week_start_date = week_start;
  
  -- Update or insert streak data
  INSERT INTO pomodoro_streaks (
    user_id, 
    current_streak, 
    longest_streak, 
    last_session_date,
    weekly_goal,
    weekly_progress,
    week_start_date,
    updated_at
  ) VALUES (
    p_user_id,
    CASE 
      WHEN p_session_date = last_session_date THEN current_streak  -- Same day, no change
      WHEN p_session_date = last_session_date + INTERVAL '1 day' THEN current_streak + 1  -- Next day, increment
      ELSE 1  -- Gap in days, reset to 1
    END,
    GREATEST(
      longest_streak,
      CASE 
        WHEN p_session_date = last_session_date THEN current_streak
        WHEN p_session_date = last_session_date + INTERVAL '1 day' THEN current_streak + 1
        ELSE 1
      END
    ),
    p_session_date,
    15, -- Default weekly goal
    week_progress + 1,
    week_start,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    last_session_date = EXCLUDED.last_session_date,
    weekly_progress = EXCLUDED.weekly_progress,
    week_start_date = EXCLUDED.week_start_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's achievements
CREATE OR REPLACE FUNCTION get_user_achievements(p_user_id UUID)
RETURNS TABLE(
  achievement_type VARCHAR(50),
  unlocked_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.achievement_type,
    pa.unlocked_at,
    pa.metadata
  FROM pomodoro_achievements pa
  WHERE pa.user_id = p_user_id
  ORDER BY pa.unlocked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's streak info
CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
RETURNS TABLE(
  current_streak INT,
  longest_streak INT,
  last_session_date DATE,
  weekly_goal INT,
  weekly_progress INT,
  week_start_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ps.current_streak, 0),
    COALESCE(ps.longest_streak, 0),
    ps.last_session_date,
    COALESCE(ps.weekly_goal, 15),
    COALESCE(ps.weekly_progress, 0),
    ps.week_start_date
  FROM pomodoro_streaks ps
  WHERE ps.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get achievement progress
CREATE OR REPLACE FUNCTION get_achievement_progress(p_user_id UUID)
RETURNS TABLE(
  achievement_type VARCHAR(50),
  current_progress INT,
  target_progress INT,
  is_unlocked BOOLEAN,
  progress_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH progress_data AS (
    SELECT 
      'first_steps'::VARCHAR(50) as achievement_type,
      LEAST(COUNT(*), 1) as current_progress,
      1 as target_progress
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id AND completed = true
    
    UNION ALL
    
    SELECT 
      'consistent_reader'::VARCHAR(50),
      LEAST(COUNT(*), 3),
      3
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id 
      AND completed = true 
      AND DATE(started_at) = CURRENT_DATE
    
    UNION ALL
    
    SELECT 
      'speed_reader'::VARCHAR(50),
      LEAST(COUNT(*), 50),
      50
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id AND completed = true
    
    UNION ALL
    
    SELECT 
      'century_club'::VARCHAR(50),
      LEAST(COUNT(*), 100),
      100
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id AND completed = true
  )
  SELECT 
    pd.achievement_type,
    pd.current_progress,
    pd.target_progress,
    COALESCE(pa.achievement_type IS NOT NULL, false) as is_unlocked,
    ROUND((pd.current_progress::NUMERIC / pd.target_progress::NUMERIC) * 100, 2) as progress_percentage
  FROM progress_data pd
  LEFT JOIN pomodoro_achievements pa ON pa.user_id = p_user_id AND pa.achievement_type = pd.achievement_type
  ORDER BY pd.achievement_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_pomodoro_achievements(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_pomodoro_streak(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_achievements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_achievement_progress(UUID) TO authenticated;

-- Add comments
COMMENT ON TABLE pomodoro_achievements IS 'Tracks unlocked achievements for Pomodoro sessions';
COMMENT ON TABLE pomodoro_streaks IS 'Tracks daily streaks and weekly goals for Pomodoro sessions';
COMMENT ON FUNCTION check_pomodoro_achievements IS 'Checks and returns newly unlocked achievements for a user';
COMMENT ON FUNCTION update_pomodoro_streak IS 'Updates streak tracking when a session is completed';
COMMENT ON FUNCTION get_user_achievements IS 'Returns all achievements for a user';
COMMENT ON FUNCTION get_user_streak IS 'Returns current streak information for a user';
COMMENT ON FUNCTION get_achievement_progress IS 'Returns progress towards all achievements for a user';
