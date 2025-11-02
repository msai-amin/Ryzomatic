-- Migration: Archive System Enhancement
-- Adds trash folder, restoration, and auto-cleanup functionality
-- Date: 2025-01-27

-- ============================================================================
-- ARCHIVE COLLECTION
-- ============================================================================

-- Create default Archive collection for all users (if it doesn't exist)
INSERT INTO user_collections (user_id, name, description, is_smart, is_favorite, display_order, color, icon)
SELECT DISTINCT user_id,
  'Archive' as name,
  'Archived books and documents' as description,
  FALSE as is_smart,
  FALSE as is_favorite,
  -1000 as display_order, -- Very low to place at bottom
  '#6B7280' as color,
  'archive' as icon
FROM user_books
WHERE NOT EXISTS (
  SELECT 1 FROM user_collections 
  WHERE user_id = user_books.user_id 
  AND name = 'Archive'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to archive a book (sets archived_at timestamp)
CREATE OR REPLACE FUNCTION archive_book(book_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_books
  SET 
    archived_at = NOW(),
    updated_at = NOW()
  WHERE id = book_id_param
    AND user_id = auth.uid();
END;
$$;

-- Function to restore an archived book
CREATE OR REPLACE FUNCTION restore_book(book_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_books
  SET 
    archived_at = NULL,
    updated_at = NOW()
  WHERE id = book_id_param
    AND user_id = auth.uid();
END;
$$;

-- Function to get archived books
CREATE OR REPLACE FUNCTION get_archived_books(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  archived_at TIMESTAMPTZ,
  reading_progress DECIMAL,
  is_favorite BOOLEAN,
  notes_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    ub.id,
    ub.user_id,
    ub.title,
    ub.file_name,
    ub.file_type,
    ub.archived_at,
    ub.reading_progress,
    ub.is_favorite,
    ub.notes_count
  FROM public.user_books ub
  WHERE ub.user_id = user_id_param
    AND ub.archived_at IS NOT NULL
  ORDER BY ub.archived_at DESC;
$$;

-- Function to permanently delete archived books older than retention period
CREATE OR REPLACE FUNCTION cleanup_old_archived(retention_days INTEGER DEFAULT 30)
RETURNS TABLE (
  user_id UUID,
  deleted_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ := NOW() - (retention_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM public.user_books
    WHERE archived_at IS NOT NULL
      AND archived_at < cutoff_date
    RETURNING user_id
  )
  SELECT 
    user_id,
    COUNT(*)::BIGINT as deleted_count
  FROM deleted
  GROUP BY user_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION archive_book IS 
  'Archives a book by setting archived_at timestamp. Safe operation - can be restored.';

COMMENT ON FUNCTION restore_book IS 
  'Restores an archived book by clearing archived_at timestamp.';

COMMENT ON FUNCTION get_archived_books IS 
  'Returns all archived books for a user, sorted by most recently archived.';

COMMENT ON FUNCTION cleanup_old_archived IS 
  'Permanently deletes archived books older than retention period. Returns user_id and count of deleted books.';

-- ============================================================================
-- AUTOMATIC CLEANUP SCHEDULE
-- ============================================================================

-- Schedule monthly cleanup of old archived books (older than 90 days)
-- Note: This requires pg_cron extension
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Run cleanup on the 1st of every month at 2 AM
    PERFORM cron.schedule(
      'cleanup-old-archived-books',
      '0 2 1 * *', -- cron: minute hour day-of-month month day-of-week
      $$
        SELECT cleanup_old_archived(90);
      $$
    );
    RAISE NOTICE 'Scheduled monthly cleanup of archived books older than 90 days';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Manual cleanup will be required.';
  END IF;
END $$;

