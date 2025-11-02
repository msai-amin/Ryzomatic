-- Migration: Add Smart Collections
-- Enables auto-organizing collections with dynamic filters
-- Date: 2025-01-27

-- ============================================================================
-- SMART COLLECTIONS INFRASTRUCTURE
-- ============================================================================

-- Add smart collection columns to user_collections
ALTER TABLE user_collections 
ADD COLUMN IF NOT EXISTS is_smart BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS smart_filter JSONB DEFAULT '{}';

-- Index for smart collections
CREATE INDEX IF NOT EXISTS idx_user_collections_smart ON user_collections(user_id) 
WHERE is_smart = TRUE;

-- ============================================================================
-- SYSTEM-DEFINED SMART COLLECTIONS
-- ============================================================================

-- Create smart collections for all existing users
-- Note: These are automatically created for new users via trigger

-- In Progress: Books with 0.01% to 99.99% reading progress
INSERT INTO user_collections (user_id, name, description, is_smart, smart_filter, color, icon, display_order)
SELECT DISTINCT 
  user_id,
  'In Progress' as name,
  'Books you are currently reading' as description,
  TRUE as is_smart,
  '{"progress_min": 0.01, "progress_max": 99.99}'::jsonb as smart_filter,
  '#F59E0B' as color,
  'book-open' as icon,
  1 as display_order
FROM user_books
WHERE NOT EXISTS (
  SELECT 1 FROM user_collections 
  WHERE user_id = user_books.user_id 
  AND name = 'In Progress'
)
ON CONFLICT DO NOTHING;

-- Recently Added: Books added in the last 30 days
INSERT INTO user_collections (user_id, name, description, is_smart, smart_filter, color, icon, display_order)
SELECT DISTINCT 
  user_id,
  'Recently Added' as name,
  'Books added in the last 30 days' as description,
  TRUE as is_smart,
  jsonb_build_object('uploaded_after', (NOW() - INTERVAL '30 days')::text) as smart_filter,
  '#3B82F6' as color,
  'calendar' as icon,
  2 as display_order
FROM user_books
WHERE NOT EXISTS (
  SELECT 1 FROM user_collections 
  WHERE user_id = user_books.user_id 
  AND name = 'Recently Added'
)
ON CONFLICT DO NOTHING;

-- Needs Review: Books not read in 90 days
INSERT INTO user_collections (user_id, name, description, is_smart, smart_filter, color, icon, display_order)
SELECT DISTINCT 
  user_id,
  'Needs Review' as name,
  'Books not read in the last 90 days' as description,
  TRUE as is_smart,
  jsonb_build_object('last_read_before', (NOW() - INTERVAL '90 days')::text) as smart_filter,
  '#EF4444' as color,
  'alert-circle' as icon,
  3 as display_order
FROM user_books
WHERE NOT EXISTS (
  SELECT 1 FROM user_collections 
  WHERE user_id = user_books.user_id 
  AND name = 'Needs Review'
)
ON CONFLICT DO NOTHING;

-- Completed: Books at 100% reading progress
INSERT INTO user_collections (user_id, name, description, is_smart, smart_filter, color, icon, display_order)
SELECT DISTINCT 
  user_id,
  'Completed' as name,
  'Books you have finished reading' as description,
  TRUE as is_smart,
  '{"progress_min": 100, "progress_max": 100}'::jsonb as smart_filter,
  '#10B981' as color,
  'check-circle' as icon,
  4 as display_order
FROM user_books
WHERE NOT EXISTS (
  SELECT 1 FROM user_collections 
  WHERE user_id = user_books.user_id 
  AND name = 'Completed'
)
ON CONFLICT DO NOTHING;

-- Unread: Books with 0% progress
INSERT INTO user_collections (user_id, name, description, is_smart, smart_filter, color, icon, display_order)
SELECT DISTINCT 
  user_id,
  'Unread' as name,
  'Books you have not started' as description,
  TRUE as is_smart,
  '{"progress_min": 0, "progress_max": 0}'::jsonb as smart_filter,
  '#6B7280' as color,
  'book-marked' as icon,
  5 as display_order
FROM user_books
WHERE NOT EXISTS (
  SELECT 1 FROM user_collections 
  WHERE user_id = user_books.user_id 
  AND name = 'Unread'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
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
  FROM public.user_collections
  WHERE id = collection_id_param
    AND is_smart = TRUE;
  
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
  
  -- Return filtered books
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
  WHERE ub.user_id = (SELECT user_id FROM public.user_collections WHERE id = collection_id_param)
    AND (progress_min IS NULL OR ub.reading_progress >= progress_min)
    AND (progress_max IS NULL OR ub.reading_progress <= progress_max)
    AND (uploaded_after IS NULL OR ub.created_at >= uploaded_after)
    AND (last_read_before IS NULL OR ub.last_read_at < last_read_before OR ub.last_read_at IS NULL)
    AND (has_notes IS NULL OR (has_notes = TRUE AND ub.notes_count > 0))
  ORDER BY ub.last_read_at DESC NULLS LAST, ub.created_at DESC;
END;
$$;

-- Function to count books in a smart collection
CREATE OR REPLACE FUNCTION count_smart_collection_books(
  collection_id_param UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  filter_json JSONB;
  book_count INTEGER;
BEGIN
  -- Get count using the same logic as get_smart_collection_books
  SELECT COUNT(*)::INTEGER INTO book_count
  FROM get_smart_collection_books(collection_id_param);
  
  RETURN COALESCE(book_count, 0);
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN user_collections.is_smart IS 
  'Whether this is a smart collection (auto-organized) or regular collection';

COMMENT ON COLUMN user_collections.smart_filter IS 
  'JSONB filter criteria for smart collections. Supported fields: progress_min, progress_max, uploaded_after, last_read_before, has_notes, has_sessions';

COMMENT ON FUNCTION get_smart_collection_books IS 
  'Returns books matching the smart filter criteria for a collection';

COMMENT ON FUNCTION count_smart_collection_books IS 
  'Returns the count of books in a smart collection';

