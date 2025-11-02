-- Migration: Audit and clean up unused database functions
-- Removes redundant functions and consolidates similar ones
-- Date: 2025-01-27

-- ============================================================================
-- IDENTIFY UNUSED FUNCTIONS
-- ============================================================================

-- Note: This is a conservative cleanup
-- Only remove functions that are clearly redundant or deprecated
-- Functions used by application code or triggers should be kept

-- ============================================================================
-- DROP REDUNDANT FUNCTIONS
-- ============================================================================

-- Drop old get_user_reading_stats if it exists and is replaced by analytics views
-- (We're replacing this with materialized view queries, but keep the function for now
-- as some code may still use it)

-- Drop old get_user_usage_stats without proper search_path if it exists
DROP FUNCTION IF EXISTS get_user_usage_stats(UUID, TIMESTAMPTZ) CASCADE;

-- Keep the main get_user_usage_stats with proper security
-- Already fixed in migration 012

-- ============================================================================
-- CONSOLIDATE SIMILAR FUNCTIONS
-- ============================================================================

-- Function already has proper search_path from migration 012
-- No consolidation needed at this time

-- ============================================================================
-- UPDATE FUNCTION SECURITY SETTINGS
-- ============================================================================

-- Ensure all remaining functions have proper security
-- Most were fixed in migration 012, but verify key functions

-- Update reset_monthly_ocr_counters (already fixed in migration 026)
-- Update get_pomodoro_stats_by_book (already has SECURITY DEFINER)
-- Update other analytics functions (already have proper settings)

-- ============================================================================
-- ADD MISSING GRANTS IF NEEDED
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION refresh_all_analytics_views() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_analytics_view(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_partition(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_user_partitions() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_embedding_query_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_book_embeddings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_book_embeddings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_stats(UUID) TO authenticated;

-- ============================================================================
-- VERIFY FUNCTION SECURITY
-- ============================================================================

-- Create a function to list all SECURITY DEFINER functions
-- This helps identify functions that need review
DO $$
DECLARE
  func_record RECORD;
BEGIN
  RAISE NOTICE '=== Functions with SECURITY DEFINER ===';
  FOR func_record IN
    SELECT 
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.prosecdef = TRUE -- SECURITY DEFINER
    ORDER BY n.nspname, p.proname
  LOOP
    RAISE NOTICE '%.% (%)', func_record.schema_name, func_record.function_name, func_record.arguments;
  END LOOP;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION cleanup_user_data IS 
  'GDPR compliance function to delete all user data. Drops user partition for efficient cleanup.';

COMMENT ON FUNCTION refresh_all_analytics_views IS 
  'Refreshes all analytics materialized views. Schedule to run daily for best performance.';

COMMENT ON FUNCTION increment_embedding_query_count IS 
  'Tracks embedding usage for cost monitoring and optimization.';

