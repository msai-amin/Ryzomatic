-- Migration: Fix get_achievement_progress type mismatch
-- Description: Changes INT to BIGINT to match PostgreSQL COUNT() return type
-- Issue: "Returned type bigint does not match expected type integer in column 2"

-- Drop and recreate the function with correct types
DROP FUNCTION IF EXISTS get_achievement_progress(UUID);

CREATE OR REPLACE FUNCTION get_achievement_progress(p_user_id UUID)
RETURNS TABLE(
  achievement_type VARCHAR(50),
  current_progress BIGINT,      -- Changed from INT to BIGINT
  target_progress BIGINT,        -- Changed from INT to BIGINT
  is_unlocked BOOLEAN,
  progress_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH progress_data AS (
    SELECT 
      'first_steps'::VARCHAR(50) as achievement_type,
      LEAST(COUNT(*), 1) as current_progress,
      1::BIGINT as target_progress
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id AND completed = true
    
    UNION ALL
    
    SELECT 
      'consistent_reader'::VARCHAR(50),
      LEAST(COUNT(*), 3),
      3::BIGINT
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id 
      AND completed = true 
      AND DATE(started_at) = CURRENT_DATE
    
    UNION ALL
    
    SELECT 
      'speed_reader'::VARCHAR(50),
      LEAST(COUNT(*), 50),
      50::BIGINT
    FROM pomodoro_sessions 
    WHERE user_id = p_user_id AND completed = true
    
    UNION ALL
    
    SELECT 
      'century_club'::VARCHAR(50),
      LEAST(COUNT(*), 100),
      100::BIGINT
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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_achievement_progress(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_achievement_progress IS 'Returns progress towards all achievements for a user (fixed BIGINT types)';

