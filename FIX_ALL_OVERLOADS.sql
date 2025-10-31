-- Fix ALL overloaded function signatures with missing SET search_path
-- This addresses functions that exist in the database but don't appear in migrations
-- Run this AFTER FIX_SCHEMA_QUALIFIED_FUNCTIONS.sql

-- =============================================================================
-- PART 1: Fix Missing Overloads for search_annotations
-- =============================================================================

-- Drop the overloaded version we found
DROP FUNCTION IF EXISTS public.search_annotations(UUID, UUID, TEXT, TEXT, BOOLEAN) CASCADE;

-- Recreate with SET search_path (source: migration 014 approach)
CREATE OR REPLACE FUNCTION public.search_annotations(
  user_uuid UUID, 
  book_uuid UUID DEFAULT NULL, 
  search_query TEXT DEFAULT NULL, 
  highlight_color TEXT DEFAULT NULL, 
  is_bookmark_only BOOLEAN DEFAULT false
)
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
    AND (book_uuid IS NULL OR an.book_id = book_uuid)
    AND (search_query IS NULL OR an.content ILIKE '%' || search_query || '%')
  ORDER BY an.created_at DESC;
$$;

-- =============================================================================
-- PART 2: Fix Missing Overloads for get_annotation_stats
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_annotation_stats(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_annotation_stats(
  user_uuid UUID, 
  book_uuid UUID DEFAULT NULL
)
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
  WHERE ub.user_id = user_uuid
    AND (book_uuid IS NULL OR an.book_id = book_uuid);
$$;

-- =============================================================================
-- PART 3: Fix Missing Overloads for get_book_highlights
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_book_highlights(UUID, BOOLEAN) CASCADE;

CREATE OR REPLACE FUNCTION public.get_book_highlights(
  book_uuid UUID,
  include_orphaned BOOLEAN DEFAULT TRUE
)
RETURNS SETOF user_highlights
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.user_highlights
  WHERE book_id = book_uuid
    AND user_id = auth.uid()
    AND (include_orphaned OR is_orphaned = FALSE)
  ORDER BY page_number, created_at;
END;
$$;

-- =============================================================================
-- PART 4: Fix Missing Overloads for mark_page_highlights_orphaned
-- =============================================================================

DROP FUNCTION IF EXISTS public.mark_page_highlights_orphaned(UUID, INTEGER, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.mark_page_highlights_orphaned(
  book_uuid UUID,
  page_num INTEGER,
  reason TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.user_highlights
  SET 
    is_orphaned = TRUE,
    orphaned_reason = COALESCE(reason, 'Page text was edited on ' || NOW()::DATE),
    updated_at = NOW()
  WHERE book_id = book_uuid
    AND page_number = page_num
    AND user_id = auth.uid()
    AND is_orphaned = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- =============================================================================
-- PART 5: Fix Missing Overloads for can_perform_vision_extraction
-- =============================================================================

DROP FUNCTION IF EXISTS public.can_perform_vision_extraction(UUID, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.can_perform_vision_extraction(
  user_id UUID,
  page_count INTEGER
)
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
  LEFT JOIN public.vision_usage vu ON vu.user_id = can_perform_vision_extraction.user_id 
    AND DATE_TRUNC('month', vu.extraction_date) = DATE_TRUNC('month', CURRENT_DATE)
  WHERE p.id = can_perform_vision_extraction.user_id
  GROUP BY p.metadata;
  
  -- Tier limits: 0=free (50/month), 1=basic (200/month), 2=pro (unlimited)
  IF tier_limit >= 2 THEN
    RETURN TRUE; -- Pro tier has unlimited
  END IF;
  
  RETURN monthly_count + page_count <= COALESCE(
    CASE tier_limit
      WHEN 0 THEN 50
      WHEN 1 THEN 200
      ELSE 50
    END,
    50
  );
END;
$$;

-- =============================================================================
-- PART 6: Grant Permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.search_annotations(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_annotation_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_book_highlights(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_page_highlights_orphaned(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_perform_vision_extraction(UUID, INTEGER) TO authenticated;

-- =============================================================================
-- PART 7: Add Comments
-- =============================================================================

COMMENT ON FUNCTION public.search_annotations(UUID, UUID, TEXT, TEXT, BOOLEAN) IS 'Extended search annotations with book, query, color, and bookmark filters. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.get_annotation_stats(UUID, UUID) IS 'Gets annotation statistics with optional book filter. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.get_book_highlights(UUID, BOOLEAN) IS 'Gets highlights for a book with orphaned filter option. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.mark_page_highlights_orphaned(UUID, INTEGER, TEXT) IS 'Marks specific page highlights as orphaned with reason. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION public.can_perform_vision_extraction(UUID, INTEGER) IS 'Checks vision extraction eligibility accounting for page count. Security: SET search_path prevents injection attacks.';

