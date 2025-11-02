-- Supplementary Migration: Fix Remaining Search Path Warnings
-- This migration addresses any remaining function search path warnings
-- that may persist after migration 012
-- Date: 2025-01-27

-- Drop any remaining old function signatures that might not have been caught
-- by the previous migration

-- Drop all possible signatures of get_user_usage_stats
DROP FUNCTION IF EXISTS get_user_usage_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_usage_stats(uuid, timestamptz) CASCADE;

-- Drop any other function signatures that might exist
DROP FUNCTION IF EXISTS search_annotations(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_annotation_stats(uuid) CASCADE;

-- Recreate the functions with proper security settings
CREATE OR REPLACE FUNCTION search_annotations(user_uuid uuid, q text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  book_id uuid,
  page_number int,
  content text,
  position_x numeric,
  position_y numeric,
  created_at timestamptz
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT 
    an.id,
    an.book_id,
    an.page_number,
    an.content,
    an.position_x,
    an.position_y,
    an.created_at
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid
    AND (q IS NULL OR an.content ILIKE '%' || q || '%')
  ORDER BY an.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_annotation_stats(user_uuid uuid)
RETURNS TABLE (
  total_annotations bigint,
  books_with_annotations bigint,
  recent_annotations bigint
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT
    COUNT(*) as total_annotations,
    COUNT(DISTINCT book_id) as books_with_annotations,
    COUNT(*) FILTER (WHERE an.created_at > NOW() - INTERVAL '7 days') as recent_annotations
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION get_user_usage_stats(user_uuid uuid)
RETURNS TABLE (
  total_actions bigint,
  total_credits_used bigint,
  actions_this_month bigint,
  credits_used_this_month bigint,
  most_used_action text
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT
    COUNT(*) as total_actions,
    COALESCE(SUM(credits_used), 0) as total_credits_used,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as actions_this_month,
    COALESCE(SUM(credits_used) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())), 0) as credits_used_this_month,
    (SELECT action_type FROM public.usage_records WHERE user_id = user_uuid GROUP BY action_type ORDER BY COUNT(*) DESC LIMIT 1) as most_used_action
  FROM public.usage_records
  WHERE user_id = user_uuid;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_annotations(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_annotation_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_stats(uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION search_annotations(uuid, text) IS 'Searches user annotations with optional query filter and security search_path protection';
COMMENT ON FUNCTION get_annotation_stats(uuid) IS 'Gets annotation statistics for a user with security search_path protection';
COMMENT ON FUNCTION get_user_usage_stats(uuid) IS 'Gets user usage statistics with security search_path protection';
