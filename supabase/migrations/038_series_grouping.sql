-- Migration: Add Series Grouping for Multi-Volume Books
-- Enables users to group related books into series and track reading order
-- Date: 2025-01-27

-- ============================================================================
-- BOOK SERIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Series metadata
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  cover_image_url TEXT,
  
  -- Ordering and display
  display_order INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  custom_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate series names per user
  UNIQUE(user_id, name)
);

-- ============================================================================
-- BOOK-SERIES RELATIONSHIP
-- ============================================================================

-- Add series relationship to user_books
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES book_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS series_order INTEGER DEFAULT 0;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_book_series_user ON book_series(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_book_series_favorite ON book_series(user_id) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_books_series ON user_books(user_id, series_id, series_order);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE book_series ENABLE ROW LEVEL SECURITY;

-- RLS Policies for book_series
CREATE POLICY "Users can read own series" ON book_series
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own series" ON book_series
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own series" ON book_series
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own series" ON book_series
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_book_series_updated_at
BEFORE UPDATE ON book_series
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get all books in a series
CREATE OR REPLACE FUNCTION get_series_books(series_id_param UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  reading_progress DECIMAL,
  series_order INTEGER,
  is_favorite BOOLEAN,
  created_at TIMESTAMPTZ
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
    ub.reading_progress,
    ub.series_order,
    ub.is_favorite,
    ub.created_at
  FROM public.user_books ub
  WHERE ub.series_id = series_id_param
  ORDER BY ub.series_order ASC, ub.created_at ASC;
$$;

-- Function to calculate series progress
CREATE OR REPLACE FUNCTION get_series_progress(series_id_param UUID)
RETURNS TABLE (
  total_books BIGINT,
  completed_books BIGINT,
  overall_progress DECIMAL,
  avg_progress_per_book DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COUNT(*)::BIGINT as total_books,
    COUNT(*) FILTER (WHERE reading_progress >= 100)::BIGINT as completed_books,
    COALESCE(AVG(reading_progress), 0) as overall_progress,
    COALESCE(AVG(reading_progress), 0) as avg_progress_per_book
  FROM public.user_books
  WHERE series_id = series_id_param;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE book_series IS 
  'User-defined book series for grouping multi-volume works';

COMMENT ON COLUMN book_series.name IS 
  'Series name (e.g., "Harry Potter", "The Lord of the Rings")';

COMMENT ON COLUMN book_series.series_order IS 
  'Display order for series in the library';

COMMENT ON COLUMN user_books.series_id IS 
  'Reference to book series this book belongs to';

COMMENT ON COLUMN user_books.series_order IS 
  'Order of this book within the series (e.g., 1 for first book, 2 for second)';

COMMENT ON FUNCTION get_series_books IS 
  'Returns all books in a series ordered by series_order';

COMMENT ON FUNCTION get_series_progress IS 
  'Returns aggregate progress statistics for a book series';

