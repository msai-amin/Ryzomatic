-- Migration: Add Reading Goals Tracking
-- Enables users to set and track reading goals with streaks
-- Also adds archived_at column for archive system
-- Date: 2025-01-27

-- ============================================================================
-- ARCHIVE SYSTEM
-- ============================================================================

-- Add archived_at column to user_books for soft delete
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_books_archived ON user_books(user_id, archived_at DESC) 
WHERE archived_at IS NOT NULL;

-- ============================================================================
-- READING GOALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reading_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Goal configuration
  goal_type TEXT NOT NULL CHECK (goal_type IN 
    ('books_read', 'pages_read', 'minutes_studied', 'notes_created', 'sessions_completed')),
  target_value INTEGER NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
  
  -- Progress tracking
  current_value INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  
  -- Time window
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Status
  completed BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate active goals
  UNIQUE(user_id, goal_type, period, start_date)
);

-- Indexes for performance
CREATE INDEX idx_reading_goals_user_active ON reading_goals(user_id, period, completed)
WHERE completed = FALSE;

CREATE INDEX idx_reading_goals_last_activity ON reading_goals(user_id, last_activity_date)
WHERE completed = FALSE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE reading_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reading_goals
CREATE POLICY "Users can read own goals" ON reading_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals" ON reading_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON reading_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON reading_goals
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER FUNCTIONS FOR GOAL UPDATES
-- ============================================================================

-- Function to update reading goals based on user activity
CREATE OR REPLACE FUNCTION update_reading_goals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  activity_date DATE := CURRENT_DATE;
BEGIN
  -- Handle user_books table updates
  IF TG_TABLE_NAME = 'user_books' AND TG_OP = 'UPDATE' THEN
    -- Update books_read goal when progress reaches 100%
    IF NEW.reading_progress >= 100 AND OLD.reading_progress < 100 THEN
      UPDATE public.reading_goals 
      SET 
        current_value = current_value + 1,
        last_activity_date = activity_date,
        updated_at = NOW()
      WHERE user_id = NEW.user_id 
        AND goal_type = 'books_read'
        AND completed = FALSE
        AND (end_date IS NULL OR end_date >= activity_date);
    END IF;
    
    -- Update pages_read goal based on page advancement
    IF NEW.last_read_page IS NOT NULL AND OLD.last_read_page IS NOT NULL 
       AND NEW.last_read_page > OLD.last_read_page THEN
      UPDATE public.reading_goals 
      SET 
        current_value = current_value + (NEW.last_read_page - OLD.last_read_page),
        last_activity_date = activity_date,
        updated_at = NOW()
      WHERE user_id = NEW.user_id 
        AND goal_type = 'pages_read'
        AND completed = FALSE
        AND (end_date IS NULL OR end_date >= activity_date);
    END IF;
  END IF;
  
  -- Handle user_notes table inserts
  IF TG_TABLE_NAME = 'user_notes' AND TG_OP = 'INSERT' THEN
    UPDATE public.reading_goals 
    SET 
      current_value = current_value + 1,
      last_activity_date = activity_date,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND goal_type = 'notes_created'
      AND completed = FALSE
      AND (end_date IS NULL OR end_date >= activity_date);
  END IF;
  
  -- Handle pomodoro_sessions table updates
  IF TG_TABLE_NAME = 'pomodoro_sessions' AND TG_OP = 'UPDATE' THEN
    -- Update sessions_completed goal when a work session is completed
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL 
       AND NEW.mode = 'work' AND NEW.completed = TRUE THEN
      UPDATE public.reading_goals 
      SET 
        current_value = current_value + 1,
        last_activity_date = activity_date,
        updated_at = NOW()
      WHERE user_id = NEW.user_id 
        AND goal_type = 'sessions_completed'
        AND completed = FALSE
        AND (end_date IS NULL OR end_date >= activity_date);
      
      -- Update minutes_studied goal based on session duration
      IF NEW.duration_seconds IS NOT NULL AND NEW.duration_seconds > 0 THEN
        UPDATE public.reading_goals 
        SET 
          current_value = current_value + (NEW.duration_seconds / 60), -- Convert to minutes
          last_activity_date = activity_date,
          updated_at = NOW()
        WHERE user_id = NEW.user_id 
          AND goal_type = 'minutes_studied'
          AND completed = FALSE
          AND (end_date IS NULL OR end_date >= activity_date);
      END IF;
    END IF;
  END IF;
  
  -- Always return NEW for UPDATE/INSERT triggers
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- For DELETE operations
  RETURN OLD;
END;
$$;

-- Create triggers on relevant tables
CREATE TRIGGER trigger_update_goals_on_books
AFTER UPDATE ON user_books
FOR EACH ROW
WHEN (
  NEW.reading_progress IS DISTINCT FROM OLD.reading_progress 
  OR NEW.last_read_page IS DISTINCT FROM OLD.last_read_page
)
EXECUTE FUNCTION update_reading_goals();

CREATE TRIGGER trigger_update_goals_on_notes
AFTER INSERT ON user_notes
FOR EACH ROW
EXECUTE FUNCTION update_reading_goals();

CREATE TRIGGER trigger_update_goals_on_pomodoro
AFTER UPDATE ON pomodoro_sessions
FOR EACH ROW
WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL)
EXECUTE FUNCTION update_reading_goals();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to manually update goal progress
CREATE OR REPLACE FUNCTION increment_goal_progress(
  goal_id_param UUID,
  increment_by INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.reading_goals 
  SET 
    current_value = current_value + increment_by,
    last_activity_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = goal_id_param
    AND completed = FALSE;
END;
$$;

-- Function to check and update streaks
CREATE OR REPLACE FUNCTION check_and_update_streaks(
  user_id_param UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  goal_record RECORD;
  today DATE := CURRENT_DATE;
  days_diff INTEGER;
BEGIN
  -- Loop through all active goals for the user
  FOR goal_record IN
    SELECT id, streak_days, last_activity_date
    FROM public.reading_goals
    WHERE user_id = user_id_param
      AND completed = FALSE
      AND last_activity_date IS NOT NULL
  LOOP
    days_diff := today - goal_record.last_activity_date;
    
    -- If last activity was yesterday, increment streak
    IF days_diff = 1 THEN
      UPDATE public.reading_goals 
      SET streak_days = streak_days + 1
      WHERE id = goal_record.id;
    -- If streak is broken (gap > 1 day), reset it
    ELSIF days_diff > 1 AND goal_record.streak_days > 0 THEN
      UPDATE public.reading_goals 
      SET streak_days = 0
      WHERE id = goal_record.id;
    END IF;
  END LOOP;
END;
$$;

-- Function to get user's active goals
CREATE OR REPLACE FUNCTION get_active_goals(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  goal_type TEXT,
  target_value INTEGER,
  current_value INTEGER,
  period TEXT,
  streak_days INTEGER,
  last_activity_date DATE,
  start_date DATE,
  end_date DATE,
  completed BOOLEAN,
  progress_percentage DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    id,
    goal_type,
    target_value,
    current_value,
    period,
    streak_days,
    last_activity_date,
    start_date,
    end_date,
    completed,
    CASE 
      WHEN target_value > 0 THEN (current_value::DECIMAL / target_value::DECIMAL) * 100
      ELSE 0
    END as progress_percentage
  FROM public.reading_goals
  WHERE user_id = user_id_param
    AND completed = FALSE
  ORDER BY created_at DESC;
$$;

-- Function to check if goals are completed
CREATE OR REPLACE FUNCTION mark_completed_goals(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.reading_goals
  SET 
    completed = TRUE,
    updated_at = NOW()
  WHERE user_id = user_id_param
    AND completed = FALSE
    AND current_value >= target_value;
END;
$$;

-- Trigger for updated_at on reading_goals
CREATE TRIGGER update_reading_goals_updated_at
BEFORE UPDATE ON reading_goals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reading_goals IS 
  'User reading goals for tracking progress and maintaining streaks';

COMMENT ON COLUMN reading_goals.goal_type IS 
  'Type of goal: books_read, pages_read, minutes_studied, notes_created, sessions_completed';

COMMENT ON COLUMN reading_goals.period IS 
  'Time period for the goal: daily, weekly, monthly, yearly';

COMMENT ON COLUMN reading_goals.streak_days IS 
  'Number of consecutive days with activity for this goal';

COMMENT ON FUNCTION update_reading_goals() IS 
  'Trigger function to automatically update goals based on user activity';

COMMENT ON FUNCTION increment_goal_progress IS 
  'Manually increment progress for a specific goal';

COMMENT ON FUNCTION check_and_update_streaks IS 
  'Check and update streak counters for all user goals';

COMMENT ON FUNCTION get_active_goals IS 
  'Returns all active goals for a user with progress percentage';

COMMENT ON FUNCTION mark_completed_goals IS 
  'Mark goals as completed when target is reached';

