-- Migration: Create materialized views for analytics and reporting
-- Provides pre-aggregated data for dashboard queries and reduces query load
-- Date: 2025-01-27

-- ============================================================================
-- USER BOOKS ANALYTICS VIEW
-- ============================================================================

-- Daily statistics for user book uploads and reading activity
CREATE MATERIALIZED VIEW IF NOT EXISTS user_books_daily_stats AS
SELECT 
  user_id,
  DATE(created_at) as upload_date,
  COUNT(*) as total_books,
  COUNT(*) FILTER (WHERE file_type = 'pdf') as pdf_books,
  COUNT(*) FILTER (WHERE file_type = 'text') as text_books,
  SUM(file_size_bytes) as total_size_bytes,
  AVG(reading_progress) as avg_reading_progress,
  COUNT(*) FILTER (WHERE is_favorite = TRUE) as favorite_books,
  COUNT(*) FILTER (WHERE notes_count > 0) as books_with_notes,
  COUNT(*) FILTER (WHERE total_pomodoro_sessions > 0) as books_with_sessions
FROM user_books
GROUP BY user_id, DATE(created_at);

CREATE UNIQUE INDEX ON user_books_daily_stats(user_id, upload_date);

-- ============================================================================
-- READING STATS VIEW
-- ============================================================================

-- Weekly reading statistics aggregated by user
CREATE MATERIALIZED VIEW IF NOT EXISTS reading_stats_weekly AS
SELECT 
  ub.user_id,
  DATE_TRUNC('week', ub.last_read_at) as week_start,
  COUNT(*) FILTER (WHERE ub.last_read_at IS NOT NULL) as books_read,
  COALESCE(SUM(ub.reading_progress) / 100, 0) as total_progress,
  COALESCE(AVG(ub.reading_progress), 0) as avg_progress_per_book,
  COALESCE(SUM(ub.last_read_page), 0) as total_pages_read,
  COALESCE(AVG(ps.duration_seconds), 0) as avg_session_duration_seconds,
  COALESCE(SUM(ps.total_pomodoro_time_seconds), 0) as total_study_time_seconds
FROM user_books ub
LEFT JOIN (
  SELECT 
    book_id,
    SUM(duration_seconds) as total_pomodoro_time_seconds,
    AVG(duration_seconds) as duration_seconds
  FROM pomodoro_sessions
  WHERE ended_at IS NOT NULL AND completed = TRUE
  GROUP BY book_id
) ps ON ub.id = ps.book_id
WHERE ub.last_read_at >= NOW() - INTERVAL '12 weeks'
GROUP BY ub.user_id, DATE_TRUNC('week', ub.last_read_at);

CREATE UNIQUE INDEX ON reading_stats_weekly(user_id, week_start DESC);

-- ============================================================================
-- POMODORO STATS VIEW
-- ============================================================================

-- Daily Pomodoro session statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS pomodoro_stats_daily AS
SELECT 
  ps.user_id,
  DATE(ps.started_at) as session_date,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE ps.mode = 'work') as work_sessions,
  COUNT(*) FILTER (WHERE ps.mode IN ('shortBreak', 'longBreak')) as break_sessions,
  COUNT(*) FILTER (WHERE ps.completed = TRUE) as completed_sessions,
  COALESCE(SUM(ps.duration_seconds) FILTER (WHERE ps.mode = 'work'), 0) as total_work_seconds,
  COALESCE(AVG(ps.duration_seconds) FILTER (WHERE ps.mode = 'work'), 0) as avg_work_duration_seconds,
  COUNT(DISTINCT ps.book_id) as unique_books_studied
FROM pomodoro_sessions ps
WHERE ps.started_at >= NOW() - INTERVAL '90 days'
GROUP BY ps.user_id, DATE(ps.started_at);

CREATE UNIQUE INDEX ON pomodoro_stats_daily(user_id, session_date DESC);

-- ============================================================================
-- USER ACTIVITY SUMMARY VIEW
-- ============================================================================

-- Comprehensive user activity overview for dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_summary AS
SELECT 
  p.id as user_id,
  p.tier,
  
  -- Books statistics
  COALESCE((SELECT COUNT(*) FROM user_books WHERE user_id = p.id), 0) as total_books,
  COALESCE((SELECT COUNT(*) FROM user_books WHERE user_id = p.id AND is_favorite = TRUE), 0) as favorite_books,
  COALESCE((SELECT COUNT(*) FROM user_books WHERE user_id = p.id AND notes_count > 0), 0) as books_with_notes,
  
  -- Notes statistics
  COALESCE((SELECT COUNT(*) FROM user_notes WHERE user_id = p.id), 0) as total_notes,
  COALESCE((SELECT COUNT(*) FROM user_notes WHERE user_id = p.id AND created_at > NOW() - INTERVAL '7 days'), 0) as notes_last_7_days,
  
  -- Pomodoro statistics
  COALESCE((SELECT COUNT(*) FROM pomodoro_sessions WHERE user_id = p.id AND ended_at IS NOT NULL), 0) as total_pomodoro_sessions,
  COALESCE((SELECT SUM(duration_seconds) FROM pomodoro_sessions WHERE user_id = p.id AND ended_at IS NOT NULL AND mode = 'work'), 0) as total_study_seconds,
  COALESCE((SELECT COUNT(*) FROM pomodoro_sessions WHERE user_id = p.id AND started_at > NOW() - INTERVAL '7 days' AND ended_at IS NOT NULL), 0) as sessions_last_7_days,
  
  -- Collection statistics
  COALESCE((SELECT COUNT(*) FROM user_collections WHERE user_id = p.id), 0) as total_collections,
  COALESCE((SELECT COUNT(*) FROM book_tags WHERE user_id = p.id), 0) as total_tags,
  
  -- Recent activity timestamp
  GREATEST(
    (SELECT MAX(created_at) FROM user_books WHERE user_id = p.id),
    (SELECT MAX(created_at) FROM user_notes WHERE user_id = p.id),
    (SELECT MAX(started_at) FROM pomodoro_sessions WHERE user_id = p.id)
  ) as last_activity_at
  
FROM profiles p;

CREATE UNIQUE INDEX ON user_activity_summary(user_id);

-- ============================================================================
-- REFRESH FUNCTIONS
-- ============================================================================

-- Function to refresh all analytics views
-- Note: Cannot use CONCURRENTLY with views that have NOW() in their definition
CREATE OR REPLACE FUNCTION refresh_all_analytics_views()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW user_books_daily_stats;
  REFRESH MATERIALIZED VIEW reading_stats_weekly;
  REFRESH MATERIALIZED VIEW pomodoro_stats_daily;
  REFRESH MATERIALIZED VIEW user_activity_summary;
  
  RAISE NOTICE 'All analytics views refreshed successfully';
END;
$$;

-- Function to refresh a specific view
-- Note: Cannot use CONCURRENTLY with views that have NOW() in their definition
CREATE OR REPLACE FUNCTION refresh_analytics_view(view_name TEXT)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
BEGIN
  CASE view_name
    WHEN 'user_books_daily_stats' THEN
      REFRESH MATERIALIZED VIEW user_books_daily_stats;
    WHEN 'reading_stats_weekly' THEN
      REFRESH MATERIALIZED VIEW reading_stats_weekly;
    WHEN 'pomodoro_stats_daily' THEN
      REFRESH MATERIALIZED VIEW pomodoro_stats_daily;
    WHEN 'user_activity_summary' THEN
      REFRESH MATERIALIZED VIEW user_activity_summary;
    ELSE
      RAISE EXCEPTION 'Unknown view: %', view_name;
  END CASE;
  
  RAISE NOTICE 'Refreshed analytics view: %', view_name;
END;
$$;

-- ============================================================================
-- AUTOMATIC REFRESH TRIGGERS (OPTIONAL)
-- ============================================================================

-- Trigger function to refresh views when data changes
-- Commented out by default as it can impact performance
-- Uncomment and schedule via pg_cron if needed

/*
CREATE OR REPLACE FUNCTION trigger_refresh_analytics_views()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SET search_path = '' 
AS $$
BEGIN
  -- Schedule refresh via pg_cron or background job
  -- For now, just log that a refresh is needed
  PERFORM pg_notify('analytics_refresh_needed', TG_TABLE_NAME);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER refresh_on_book_change
  AFTER INSERT OR UPDATE OR DELETE ON user_books
  FOR EACH STATEMENT 
  EXECUTE FUNCTION trigger_refresh_analytics_views();

CREATE TRIGGER refresh_on_pomodoro_change
  AFTER INSERT OR UPDATE OR DELETE ON pomodoro_sessions
  FOR EACH STATEMENT 
  EXECUTE FUNCTION trigger_refresh_analytics_views();
*/

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW user_books_daily_stats IS 
  'Daily statistics for book uploads and activity. Refresh weekly or monthly depending on data volume.';

COMMENT ON MATERIALIZED VIEW reading_stats_weekly IS 
  'Weekly reading statistics aggregated by user. Includes progress and study time data.';

COMMENT ON MATERIALIZED VIEW pomodoro_stats_daily IS 
  'Daily Pomodoro session statistics for productivity tracking and insights.';

COMMENT ON MATERIALIZED VIEW user_activity_summary IS 
  'Comprehensive user activity overview for dashboard queries. Refresh daily for best performance.';

COMMENT ON FUNCTION refresh_all_analytics_views IS 
  'Refreshes all analytics materialized views. Schedule to run daily or weekly. Note: Non-concurrent refresh due to NOW() in views.';

COMMENT ON FUNCTION refresh_analytics_view IS 
  'Refreshes a specific analytics view by name. Useful for targeted updates.';

-- ============================================================================
-- INITIAL REFRESH
-- ============================================================================

-- Refresh views immediately to populate with current data
REFRESH MATERIALIZED VIEW user_books_daily_stats;
REFRESH MATERIALIZED VIEW reading_stats_weekly;
REFRESH MATERIALIZED VIEW pomodoro_stats_daily;
REFRESH MATERIALIZED VIEW user_activity_summary;

-- ============================================================================
-- RECOMMENDED SCHEDULING (via pg_cron or application scheduler)
-- ============================================================================

-- user_books_daily_stats: Refresh daily at 2 AM
-- reading_stats_weekly: Refresh weekly on Sunday at 3 AM
-- pomodoro_stats_daily: Refresh daily at 2 AM
-- user_activity_summary: Refresh hourly or when dashboard is accessed

-- Example pg_cron setup (run manually):
-- SELECT cron.schedule('refresh-daily-stats', '0 2 * * *', 'SELECT refresh_analytics_view(''user_books_daily_stats'');');

