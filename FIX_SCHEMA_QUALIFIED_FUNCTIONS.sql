-- Fix: Explicitly qualify all function names with 'public.' schema prefix
-- This ensures we're recreating the exact functions the linter is checking
-- Run this in Supabase SQL Editor after running DIAGNOSE_FUNCTION_SEARCH_PATH.sql

-- =============================================================================
-- Fix the 5 functions that the linter is still flagging
-- =============================================================================

-- Drop existing functions with their exact signatures to avoid conflicts
DROP FUNCTION IF EXISTS public.search_annotations(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_book_highlights(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_perform_vision_extraction(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_annotation_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.mark_page_highlights_orphaned() CASCADE;

-- Now recreate with explicit public. schema qualification and SET search_path

-- 1. Fix search_annotations
CREATE OR REPLACE FUNCTION public.search_annotations(user_uuid UUID, q TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  book_id UUID,
  page_number INT,
  content TEXT,
  position_x NUMERIC,
  position_y NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- 2. Fix get_annotation_stats
CREATE OR REPLACE FUNCTION public.get_annotation_stats(user_uuid UUID)
RETURNS TABLE (
  total_annotations BIGINT,
  books_with_annotations BIGINT,
  recent_annotations BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(*) as total_annotations,
    COUNT(DISTINCT an.book_id) as books_with_annotations,
    COUNT(*) FILTER (WHERE an.created_at > NOW() - INTERVAL '30 days') as recent_annotations
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid;
$$;

-- 3. Fix get_book_highlights
CREATE OR REPLACE FUNCTION public.get_book_highlights(user_uuid UUID, book_uuid UUID)
RETURNS TABLE (
  id UUID,
  page_number INT,
  content TEXT,
  color VARCHAR(20),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.page_number, h.content, h.color, h.created_at
  FROM public.highlights h
  WHERE h.book_id = book_uuid
    AND EXISTS (
      SELECT 1 FROM public.user_books ub 
      WHERE ub.id = book_uuid AND ub.user_id = user_uuid
    )
  ORDER BY h.page_number, h.created_at;
END;
$$;

-- 4. Fix can_perform_vision_extraction
CREATE OR REPLACE FUNCTION public.can_perform_vision_extraction(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  monthly_count BIGINT;
  tier_limit INT;
BEGIN
  -- Get user's tier and current monthly count
  SELECT 
    COALESCE((metadata->>'tier')::INT, 0),
    COUNT(*)
  INTO tier_limit, monthly_count
  FROM public.profiles p
  LEFT JOIN public.vision_usage vu ON vu.user_id = user_uuid 
    AND DATE_TRUNC('month', vu.extraction_date) = DATE_TRUNC('month', CURRENT_DATE)
  WHERE p.id = user_uuid
  GROUP BY p.metadata;
  
  -- Tier limits: 0=free (50/month), 1=basic (200/month), 2=pro (unlimited)
  IF tier_limit >= 2 THEN
    RETURN TRUE; -- Pro tier has unlimited
  END IF;
  
  RETURN monthly_count < COALESCE(
    CASE tier_limit
      WHEN 0 THEN 50
      WHEN 1 THEN 200
      ELSE 50
    END,
    50
  );
END;
$$;

-- 5. Fix mark_page_highlights_orphaned
CREATE OR REPLACE FUNCTION public.mark_page_highlights_orphaned()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.highlights
  SET is_orphaned = true
  WHERE book_id NOT IN (SELECT id FROM public.user_books);
END;
$$;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.search_annotations(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_annotation_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_book_highlights(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_perform_vision_extraction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_page_highlights_orphaned() TO authenticated;

-- =============================================================================
-- Add Comments
-- =============================================================================

COMMENT ON FUNCTION public.search_annotations(UUID, TEXT) IS 'Searches user annotations with optional query filter. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.get_annotation_stats(UUID) IS 'Gets annotation statistics for a user. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.get_book_highlights(UUID, UUID) IS 'Retrieves highlights for a specific book. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.can_perform_vision_extraction(UUID) IS 'Checks if user can perform vision extraction based on tier and monthly usage. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.mark_page_highlights_orphaned() IS 'Marks highlights as orphaned when their parent book is deleted. Security: SET search_path prevents injection attacks.';

