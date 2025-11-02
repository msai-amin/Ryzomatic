-- Migration: Hide Analytics Views from API
-- Removes materialized views from PostgREST API exposure
-- Date: 2025-01-27
--
-- Note: These views are meant to be accessed via RPC functions or functions
-- for security and to prevent direct API queries. The views themselves have
-- proper RLS, but removing them from API keeps the surface area smaller.

-- ============================================================================
-- REMOVE FROM POSTGREST API
-- ============================================================================

-- Revoke SELECT from anon and authenticated roles on analytics views
-- Users should access these via the refresh functions instead

REVOKE SELECT ON user_books_daily_stats FROM anon, authenticated;
REVOKE SELECT ON reading_stats_weekly FROM anon, authenticated;
REVOKE SELECT ON pomodoro_stats_daily FROM anon, authenticated;
REVOKE SELECT ON user_activity_summary FROM anon, authenticated;

-- ============================================================================
-- GRANT TO SERVICE ROLE
-- ============================================================================

-- Grant access to service role for refresh functions to work
GRANT SELECT ON user_books_daily_stats TO service_role;
GRANT SELECT ON reading_stats_weekly TO service_role;
GRANT SELECT ON pomodoro_stats_daily TO service_role;
GRANT SELECT ON user_activity_summary TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW user_books_daily_stats IS 
  'Daily book upload statistics. Access via refresh_all_analytics_views() or refresh_analytics_view().';

COMMENT ON MATERIALIZED VIEW reading_stats_weekly IS 
  'Weekly reading statistics. Access via refresh_all_analytics_views() or refresh_analytics_view().';

COMMENT ON MATERIALIZED VIEW pomodoro_stats_daily IS 
  'Daily Pomodoro session statistics. Access via refresh_all_analytics_views() or refresh_analytics_view().';

COMMENT ON MATERIALIZED VIEW user_activity_summary IS 
  'User activity overview. Access via refresh_all_analytics_views() or refresh_analytics_view().';

