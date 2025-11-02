-- Migration: Book Recommendations System
-- AI-powered recommendations based on reading history, embeddings, and metadata
-- Date: 2025-01-27

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- HELPER FUNCTIONS FOR RECOMMENDATIONS
-- ============================================================================

-- Function to get similar books based on document descriptions
CREATE OR REPLACE FUNCTION get_similar_books(
  book_id_param UUID,
  similarity_threshold DECIMAL DEFAULT 0.7,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  similarity_score DECIMAL,
  reading_progress DECIMAL,
  last_read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  source_embedding vector(768);
  user_uuid UUID;
BEGIN
  -- Get current user
  user_uuid := auth.uid();
  
  -- Get source book embedding
  SELECT description_embedding INTO source_embedding
  FROM public.document_descriptions
  WHERE book_id = book_id_param
    AND user_id = user_uuid;
  
  IF source_embedding IS NULL THEN
    -- Return empty if no embedding
    RETURN;
  END IF;
  
  -- Find similar books
  RETURN QUERY
  SELECT 
    ub.id,
    ub.title,
    ub.file_name,
    ub.file_type,
    1 - (dd.description_embedding <=> source_embedding) as similarity_score,
    ub.reading_progress,
    ub.last_read_at
  FROM public.document_descriptions dd
  JOIN public.user_books ub ON ub.id = dd.book_id
  WHERE dd.user_id = user_uuid
    AND dd.book_id != book_id_param
    AND dd.description_embedding IS NOT NULL
    AND 1 - (dd.description_embedding <=> source_embedding) > similarity_threshold
  ORDER BY dd.description_embedding <=> source_embedding
  LIMIT limit_count;
END;
$$;

-- Function to get recommendations based on collection overlap
CREATE OR REPLACE FUNCTION get_collection_based_recommendations(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  common_collections TEXT[],
  reading_progress DECIMAL,
  last_read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_collection_ids UUID[];
BEGIN
  -- Get user's active collection IDs
  SELECT ARRAY_AGG(DISTINCT bc.collection_id) INTO user_collection_ids
  FROM public.book_collections bc
  WHERE bc.book_id IN (
    SELECT id FROM public.user_books 
    WHERE user_id = user_id_param 
    AND reading_progress > 50
  );
  
  IF user_collection_ids IS NULL OR ARRAY_LENGTH(user_collection_ids, 1) = 0 THEN
    -- Return empty if no collections
    RETURN;
  END IF;
  
  -- Find books in same collections
  RETURN QUERY
  SELECT 
    ub.id,
    ub.title,
    ub.file_name,
    ub.file_type,
    ARRAY_AGG(c.name) FILTER (WHERE c.name IS NOT NULL) as common_collections,
    ub.reading_progress,
    ub.last_read_at
  FROM public.user_books ub
  JOIN public.book_collections bc ON bc.book_id = ub.id
  JOIN public.user_collections c ON c.id = bc.collection_id
  WHERE ub.user_id = user_id_param
    AND bc.collection_id = ANY(user_collection_ids)
    AND ub.reading_progress < 50 -- Haven't read much yet
    AND ub.archived_at IS NULL
  GROUP BY ub.id, ub.title, ub.file_name, ub.file_type, ub.reading_progress, ub.last_read_at
  HAVING COUNT(DISTINCT bc.collection_id) > 0
  ORDER BY COUNT(DISTINCT bc.collection_id) DESC, ub.last_read_at DESC NULLS LAST
  LIMIT limit_count;
END;
$$;

-- Function to get recommendations based on tag overlap
CREATE OR REPLACE FUNCTION get_tag_based_recommendations(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  common_tags TEXT[],
  reading_progress DECIMAL,
  is_favorite BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_tag_ids UUID[];
BEGIN
  -- Get user's popular tag IDs from books with good progress
  SELECT ARRAY_AGG(DISTINCT bta.tag_id) INTO user_tag_ids
  FROM public.book_tag_assignments bta
  WHERE bta.book_id IN (
    SELECT id FROM public.user_books 
    WHERE user_id = user_id_param 
    AND reading_progress > 50
  );
  
  IF user_tag_ids IS NULL OR ARRAY_LENGTH(user_tag_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Find books with similar tags
  RETURN QUERY
  SELECT 
    ub.id,
    ub.title,
    ub.file_name,
    ub.file_type,
    ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL) as common_tags,
    ub.reading_progress,
    ub.is_favorite
  FROM public.user_books ub
  JOIN public.book_tag_assignments bta ON bta.book_id = ub.id
  JOIN public.book_tags t ON t.id = bta.tag_id
  WHERE ub.user_id = user_id_param
    AND bta.tag_id = ANY(user_tag_ids)
    AND ub.reading_progress < 30 -- Not started or barely started
    AND ub.archived_at IS NULL
  GROUP BY ub.id, ub.title, ub.file_name, ub.file_type, ub.reading_progress, ub.is_favorite
  HAVING COUNT(DISTINCT bta.tag_id) > 0
  ORDER BY COUNT(DISTINCT bta.tag_id) DESC, ub.is_favorite DESC, ub.last_read_at DESC NULLS LAST
  LIMIT limit_count;
END;
$$;

-- Function to get recommendations based on incomplete series
CREATE OR REPLACE FUNCTION get_series_recommendations(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  series_name TEXT,
  series_order INTEGER,
  series_progress DECIMAL,
  next_book_in_series BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  series_record RECORD;
BEGIN
  -- Find series where user has progress on some books but not all
  FOR series_record IN
    SELECT bs.id, bs.name
    FROM public.book_series bs
    WHERE bs.user_id = user_id_param
  LOOP
    -- Get books in this series with low progress
    RETURN QUERY
    SELECT 
      ub.id,
      ub.title,
      ub.file_name,
      ub.file_type,
      bs.name as series_name,
      ub.series_order,
      COALESCE((
        SELECT AVG(reading_progress)
        FROM public.user_books
        WHERE series_id = series_record.id
      ), 0) as series_progress,
      CASE 
        WHEN ub.series_order = (
          SELECT MIN(series_order) 
          FROM public.user_books 
          WHERE series_id = series_record.id 
            AND reading_progress < 50
        ) THEN TRUE
        ELSE FALSE
      END as next_book_in_series
    FROM public.user_books ub
    JOIN public.book_series bs ON bs.id = ub.series_id
    WHERE ub.user_id = user_id_param
      AND ub.series_id = series_record.id
      AND ub.reading_progress < 50
      AND ub.archived_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.user_books
        WHERE series_id = series_record.id
        AND reading_progress > 50
      )
    ORDER BY ub.series_order, ub.last_read_at DESC NULLS LAST
    LIMIT limit_count;
    
    IF FOUND THEN
      EXIT; -- Exit loop once we have results
    END IF;
  END LOOP;
END;
$$;

-- Unified recommendation function
CREATE OR REPLACE FUNCTION get_unified_recommendations(
  user_id_param UUID,
  limit_per_type INTEGER DEFAULT 5
)
RETURNS TABLE (
  recommendation_type TEXT,
  id UUID,
  title TEXT,
  file_name TEXT,
  file_type TEXT,
  score DECIMAL,
  reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Collection-based recommendations
  RETURN QUERY
  SELECT 
    'collection'::TEXT as recommendation_type,
    r.id,
    r.title,
    r.file_name,
    r.file_type,
    (ARRAY_LENGTH(r.common_collections, 1)::DECIMAL / 10) as score,
    ('In your ' || ARRAY_TO_STRING(r.common_collections[1:3], ', ') || ' collections')::TEXT as reason
  FROM get_collection_based_recommendations(user_id_param, limit_per_type) r;
  
  -- Tag-based recommendations
  RETURN QUERY
  SELECT 
    'tag'::TEXT as recommendation_type,
    r.id,
    r.title,
    r.file_name,
    r.file_type,
    (ARRAY_LENGTH(r.common_tags, 1)::DECIMAL / 5) as score,
    ('Similar tags: ' || ARRAY_TO_STRING(r.common_tags[1:3], ', '))::TEXT as reason
  FROM get_tag_based_recommendations(user_id_param, limit_per_type) r;
  
  -- Series recommendations
  RETURN QUERY
  SELECT 
    'series'::TEXT as recommendation_type,
    r.id,
    r.title,
    r.file_name,
    r.file_type,
    CASE WHEN r.next_book_in_series THEN 1.0 ELSE 0.7 END as score,
    ('Continue ' || r.series_name || ' series')::TEXT as reason
  FROM get_series_recommendations(user_id_param, limit_per_type) r;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_similar_books IS 
  'Returns books similar to a given book based on semantic embeddings. Requires document descriptions with embeddings.';

COMMENT ON FUNCTION get_collection_based_recommendations IS 
  'Returns books from collections shared with books you have 50%+ progress on.';

COMMENT ON FUNCTION get_tag_based_recommendations IS 
  'Returns books with tags matching your most engaged books.';

COMMENT ON FUNCTION get_series_recommendations IS 
  'Returns next books in series where you have progress on earlier books.';

COMMENT ON FUNCTION get_unified_recommendations IS 
  'Combines all recommendation types with scoring and reasoning.';

