-- Migration: Add Embeddings to Notes and Highlights
-- Adds vector embeddings for semantic search and similarity matching
-- Date: 2025-01-27

-- ============================================================================
-- ENSURE PGVECTOR EXTENSION IS ENABLED
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ADD EMBEDDING COLUMNS TO USER_NOTES
-- ============================================================================

ALTER TABLE user_notes 
ADD COLUMN IF NOT EXISTS embedding vector(768),
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- ============================================================================
-- ADD EMBEDDING COLUMNS TO USER_HIGHLIGHTS
-- ============================================================================

ALTER TABLE user_highlights 
ADD COLUMN IF NOT EXISTS embedding vector(768),
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- ============================================================================
-- CREATE VECTOR INDEXES FOR SIMILARITY SEARCH
-- ============================================================================

-- HNSW indexes for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_user_notes_embedding 
ON user_notes USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_highlights_embedding 
ON user_highlights USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Composite indexes for filtered vector search (book_id + embedding)
CREATE INDEX IF NOT EXISTS idx_user_notes_book_embedding 
ON user_notes(book_id) 
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_highlights_book_embedding 
ON user_highlights(book_id) 
WHERE embedding IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS FOR VECTOR SIMILARITY SEARCH
-- ============================================================================

-- Function to find similar notes using vector similarity
CREATE OR REPLACE FUNCTION find_similar_notes(
  query_embedding vector(768),
  p_user_id UUID,
  p_book_id UUID DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.7,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  page_number INTEGER,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.content,
    n.page_number,
    1 - (n.embedding <=> query_embedding) as similarity
  FROM user_notes n
  WHERE n.user_id = p_user_id
    AND n.embedding IS NOT NULL
    AND (p_book_id IS NULL OR n.book_id = p_book_id)
    AND (1 - (n.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find similar highlights using vector similarity
CREATE OR REPLACE FUNCTION find_similar_highlights(
  query_embedding vector(768),
  p_user_id UUID,
  p_book_id UUID DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.7,
  result_limit INTEGER DEFAULT 10,
  include_orphaned BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  highlighted_text TEXT,
  page_number INTEGER,
  color_hex TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.highlighted_text,
    h.page_number,
    h.color_hex,
    1 - (h.embedding <=> query_embedding) as similarity
  FROM user_highlights h
  WHERE h.user_id = p_user_id
    AND h.embedding IS NOT NULL
    AND (p_book_id IS NULL OR h.book_id = p_book_id)
    AND (include_orphaned OR h.is_orphaned = FALSE)
    AND (1 - (h.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY h.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN user_notes.embedding IS 'Vector embedding (768-dim) for semantic search and similarity matching';
COMMENT ON COLUMN user_notes.embedding_updated_at IS 'Timestamp when embedding was last generated or updated';
COMMENT ON COLUMN user_highlights.embedding IS 'Vector embedding (768-dim) for semantic search and similarity matching';
COMMENT ON COLUMN user_highlights.embedding_updated_at IS 'Timestamp when embedding was last generated or updated';

