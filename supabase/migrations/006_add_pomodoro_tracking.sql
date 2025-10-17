-- Migration: Add Pomodoro Time Tracking System
-- Tracks individual Pomodoro sessions and aggregates time statistics per document

-- Create pomodoro_sessions table for detailed session tracking
CREATE TABLE pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Session timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ, -- NULL if session is still active
  duration_seconds INTEGER, -- Calculated when ended_at is set
  
  -- Session metadata
  mode TEXT NOT NULL CHECK (mode IN ('work', 'shortBreak', 'longBreak')),
  completed BOOLEAN DEFAULT false, -- True if session finished normally (not abandoned)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Pomodoro aggregate fields to user_books
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS total_pomodoro_time_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_pomodoro_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_pomodoro_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
CREATE INDEX idx_pomodoro_sessions_book_id ON pomodoro_sessions(book_id);
CREATE INDEX idx_pomodoro_sessions_started_at ON pomodoro_sessions(started_at DESC);
CREATE INDEX idx_pomodoro_sessions_user_book ON pomodoro_sessions(user_id, book_id);
CREATE INDEX idx_pomodoro_sessions_active ON pomodoro_sessions(user_id) WHERE ended_at IS NULL;

-- Row Level Security
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pomodoro_sessions
CREATE POLICY "Users can read own pomodoro sessions" ON pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pomodoro sessions" ON pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pomodoro sessions" ON pomodoro_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pomodoro sessions" ON pomodoro_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update user_books totals when session ends
CREATE OR REPLACE FUNCTION update_book_pomodoro_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if session is being marked as ended (not on creation)
  IF NEW.ended_at IS NOT NULL AND (OLD.ended_at IS NULL OR OLD.ended_at IS DISTINCT FROM NEW.ended_at) THEN
    -- Calculate duration if not set
    IF NEW.duration_seconds IS NULL THEN
      NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
    END IF;
    
    -- Update book totals only for work sessions
    IF NEW.mode = 'work' AND NEW.completed = true THEN
      UPDATE user_books
      SET 
        total_pomodoro_time_seconds = COALESCE(total_pomodoro_time_seconds, 0) + NEW.duration_seconds,
        total_pomodoro_sessions = COALESCE(total_pomodoro_sessions, 0) + 1,
        last_pomodoro_at = NEW.ended_at,
        updated_at = NOW()
      WHERE id = NEW.book_id AND user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_book_pomodoro_totals
  BEFORE UPDATE ON pomodoro_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_book_pomodoro_totals();

-- Trigger for updated_at on pomodoro_sessions
CREATE TRIGGER update_pomodoro_sessions_updated_at 
  BEFORE UPDATE ON pomodoro_sessions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get Pomodoro stats for a specific book
CREATE OR REPLACE FUNCTION get_pomodoro_stats_by_book(book_uuid UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_time_seconds BIGINT,
  total_time_minutes DECIMAL,
  total_time_hours DECIMAL,
  average_session_minutes DECIMAL,
  completed_sessions BIGINT,
  work_sessions BIGINT,
  break_sessions BIGINT,
  last_session_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COALESCE(SUM(duration_seconds), 0)::BIGINT as total_time_seconds,
    COALESCE(SUM(duration_seconds), 0)::DECIMAL / 60 as total_time_minutes,
    COALESCE(SUM(duration_seconds), 0)::DECIMAL / 3600 as total_time_hours,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(AVG(duration_seconds), 0)::DECIMAL / 60
      ELSE 0
    END as average_session_minutes,
    COUNT(*) FILTER (WHERE completed = true)::BIGINT as completed_sessions,
    COUNT(*) FILTER (WHERE mode = 'work')::BIGINT as work_sessions,
    COUNT(*) FILTER (WHERE mode IN ('shortBreak', 'longBreak'))::BIGINT as break_sessions,
    MAX(ended_at) as last_session_at
  FROM pomodoro_sessions
  WHERE book_id = book_uuid AND ended_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily Pomodoro stats for a user
CREATE OR REPLACE FUNCTION get_daily_pomodoro_stats(user_uuid UUID, days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  total_sessions BIGINT,
  total_minutes DECIMAL,
  work_sessions BIGINT,
  work_minutes DECIMAL,
  books_studied BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ps.started_at) as date,
    COUNT(*)::BIGINT as total_sessions,
    COALESCE(SUM(ps.duration_seconds), 0)::DECIMAL / 60 as total_minutes,
    COUNT(*) FILTER (WHERE ps.mode = 'work')::BIGINT as work_sessions,
    COALESCE(SUM(ps.duration_seconds) FILTER (WHERE ps.mode = 'work'), 0)::DECIMAL / 60 as work_minutes,
    COUNT(DISTINCT ps.book_id)::BIGINT as books_studied
  FROM pomodoro_sessions ps
  WHERE ps.user_id = user_uuid 
    AND ps.ended_at IS NOT NULL
    AND ps.started_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(ps.started_at)
  ORDER BY DATE(ps.started_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get time-of-day patterns for a user
CREATE OR REPLACE FUNCTION get_time_of_day_patterns(user_uuid UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  hour_of_day INTEGER,
  total_sessions BIGINT,
  total_minutes DECIMAL,
  average_session_minutes DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM ps.started_at)::INTEGER as hour_of_day,
    COUNT(*)::BIGINT as total_sessions,
    COALESCE(SUM(ps.duration_seconds), 0)::DECIMAL / 60 as total_minutes,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(AVG(ps.duration_seconds), 0)::DECIMAL / 60
      ELSE 0
    END as average_session_minutes
  FROM pomodoro_sessions ps
  WHERE ps.user_id = user_uuid 
    AND ps.ended_at IS NOT NULL
    AND ps.mode = 'work'
    AND ps.started_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY EXTRACT(HOUR FROM ps.started_at)
  ORDER BY hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active Pomodoro session for a user
CREATE OR REPLACE FUNCTION get_active_pomodoro_session(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  book_id UUID,
  started_at TIMESTAMPTZ,
  mode TEXT,
  elapsed_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.book_id,
    ps.started_at,
    ps.mode,
    EXTRACT(EPOCH FROM (NOW() - ps.started_at))::INTEGER as elapsed_seconds
  FROM pomodoro_sessions ps
  WHERE ps.user_id = user_uuid 
    AND ps.ended_at IS NULL
  ORDER BY ps.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get weekly summary
CREATE OR REPLACE FUNCTION get_weekly_pomodoro_summary(user_uuid UUID)
RETURNS TABLE (
  week_start DATE,
  total_work_minutes DECIMAL,
  total_sessions BIGINT,
  unique_books BIGINT,
  most_productive_day DATE,
  most_productive_hour INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_data AS (
    SELECT
      DATE_TRUNC('week', ps.started_at)::DATE as week_start,
      COALESCE(SUM(ps.duration_seconds) FILTER (WHERE ps.mode = 'work'), 0)::DECIMAL / 60 as work_minutes,
      COUNT(*) FILTER (WHERE ps.mode = 'work')::BIGINT as sessions,
      COUNT(DISTINCT ps.book_id)::BIGINT as books,
      DATE(ps.started_at) as session_date,
      EXTRACT(HOUR FROM ps.started_at)::INTEGER as session_hour
    FROM pomodoro_sessions ps
    WHERE ps.user_id = user_uuid 
      AND ps.ended_at IS NOT NULL
      AND ps.started_at >= NOW() - INTERVAL '4 weeks'
    GROUP BY DATE_TRUNC('week', ps.started_at), DATE(ps.started_at), EXTRACT(HOUR FROM ps.started_at)
  ),
  daily_totals AS (
    SELECT 
      week_start,
      session_date,
      SUM(work_minutes) as day_minutes
    FROM weekly_data
    GROUP BY week_start, session_date
  ),
  hourly_totals AS (
    SELECT 
      week_start,
      session_hour,
      SUM(work_minutes) as hour_minutes
    FROM weekly_data
    GROUP BY week_start, session_hour
  )
  SELECT DISTINCT
    wd.week_start,
    SUM(wd.work_minutes) OVER (PARTITION BY wd.week_start) as total_work_minutes,
    SUM(wd.sessions) OVER (PARTITION BY wd.week_start) as total_sessions,
    MAX(wd.books) OVER (PARTITION BY wd.week_start) as unique_books,
    (SELECT dt.session_date FROM daily_totals dt 
     WHERE dt.week_start = wd.week_start 
     ORDER BY dt.day_minutes DESC LIMIT 1) as most_productive_day,
    (SELECT ht.session_hour FROM hourly_totals ht 
     WHERE ht.week_start = wd.week_start 
     ORDER BY ht.hour_minutes DESC LIMIT 1) as most_productive_hour
  FROM weekly_data wd
  ORDER BY wd.week_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE pomodoro_sessions IS 'Tracks individual Pomodoro timer sessions for productivity analytics';
COMMENT ON COLUMN pomodoro_sessions.mode IS 'Session type: work (focus), shortBreak, or longBreak';
COMMENT ON COLUMN pomodoro_sessions.completed IS 'True if session finished normally, false if abandoned/interrupted';
COMMENT ON COLUMN user_books.total_pomodoro_time_seconds IS 'Aggregate of all completed work sessions for this book';
COMMENT ON COLUMN user_books.total_pomodoro_sessions IS 'Count of all completed work sessions for this book';

