-- Migration: Fix Smart Collections Function
-- Fixes ambiguous column reference and adds archived book exclusion
-- Date: 2025-01-27

-- ============================================================================
-- FIX SMART COLLECTION FUNCTIONS
-- ============================================================================

-- Function to get books matching a smart filter
CREATE OR REPLACE FUNCTION get_smart_collection_books(
  collection_id_param UUID
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  reading_progress DECIMAL,
  last_read_at TIMESTAMPTZ,
  notes_count INTEGER,
  pomodoro_sessions_count INTEGER,
  is_favorite BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  filter_json JSONB;
  progress_min DECIMAL;
  progress_max DECIMAL;
  uploaded_after TIMESTAMP;
  last_read_before TIMESTAMP;
  has_notes BOOLEAN;
BEGIN
  -- Get the smart filter for this collection
  SELECT smart_filter INTO filter_json
  FROM public.user_collections uc
  WHERE uc.id = collection_id_param
    AND uc.is_smart = TRUE;
  
  IF filter_json IS NULL THEN
    RAISE EXCEPTION 'Collection not found or not a smart collection';
  END IF;
  
  -- Build query based on filter criteria
  -- Initialize temp variables
  progress_min := (filter_json->>'progress_min')::DECIMAL;
  progress_max := (filter_json->>'progress_max')::DECIMAL;
  uploaded_after := (filter_json->>'uploaded_after')::TIMESTAMP;
  last_read_before := (filter_json->>'last_read_before')::TIMESTAMP;
  has_notes := (filter_json->>'has_notes')::BOOLEAN;
  
  -- Return filtered books (exclude archived books)
  RETURN QUERY
  SELECT 
    ub.id,
    ub.user_id,
    ub.title,
    ub.file_name,
    ub.file_type,
    ub.reading_progress,
    ub.last_read_at,
    ub.notes_count,
    ub.pomodoro_sessions_count,
    ub.is_favorite,
    ub.created_at
  FROM public.user_books ub
  WHERE ub.user_id = (SELECT uc_inner.user_id FROM public.user_collections uc_inner WHERE uc_inner.id = collection_id_param)
    AND ub.archived_at IS NULL
    AND (progress_min IS NULL OR ub.reading_progress >= progress_min)
    AND (progress_max IS NULL OR ub.reading_progress <= progress_max)
    AND (uploaded_after IS NULL OR ub.created_at >= uploaded_after)
    AND (last_read_before IS NULL OR ub.last_read_at < last_read_before OR ub.last_read_at IS NULL)
    AND (has_notes IS NULL OR (has_notes = TRUE AND ub.notes_count > 0))
  ORDER BY ub.last_read_at DESC NULLS LAST, ub.created_at DESC;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_smart_collection_books IS 
  'Returns books matching the smart filter criteria for a collection. Excludes archived books.';

