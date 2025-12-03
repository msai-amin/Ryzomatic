-- Migration: Create lightweight embedding metadata table
-- Prepares for moving actual vector data to external vector store
-- Keeps only metadata and references in PostgreSQL
-- Date: 2025-01-27

-- ============================================================================
-- EMBEDDING METADATA TABLE
-- ============================================================================

-- Lightweight table to track embedding metadata
-- Actual vectors stored in external service (Supabase Vector Store, Pinecone, etc.)
CREATE TABLE IF NOT EXISTS embedding_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Vector store information
  provider TEXT NOT NULL CHECK (provider IN ('supabase', 'pinecone', 'weaviate', 'qdrant', 'local')),
  namespace TEXT, -- For Pinecone-style namespacing
  vector_id TEXT NOT NULL, -- External vector store ID
  collection TEXT, -- Collection/namespace in vector store
  
  -- Embedding metadata
  embedding_model TEXT NOT NULL DEFAULT 'gemini-embedding-001', -- Model used for generation
  vector_dimensions INTEGER NOT NULL DEFAULT 768,
  chunk_index INTEGER, -- For multi-chunk documents
  chunk_text TEXT, -- Store text snippet for reference
  chunk_count INTEGER DEFAULT 1, -- Total chunks for this document
  
  -- Generation metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  generation_cost_usd DECIMAL(10,6), -- Cost in USD for generation
  
  -- Usage tracking
  last_queried_at TIMESTAMPTZ,
  query_count INTEGER DEFAULT 0,
  
  UNIQUE(book_id, chunk_index), -- One embedding per chunk
  UNIQUE(vector_id, provider) -- One vector ID per provider
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_embedding_metadata_user_book ON embedding_metadata(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_provider ON embedding_metadata(provider, vector_id);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_model ON embedding_metadata(embedding_model);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_last_queried ON embedding_metadata(last_queried_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE embedding_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own embedding metadata" ON embedding_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert embedding metadata" ON embedding_metadata
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update embedding metadata" ON embedding_metadata
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own embedding metadata" ON embedding_metadata
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment query count
CREATE OR REPLACE FUNCTION increment_embedding_query_count(
  embedding_uuid UUID
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
BEGIN
  UPDATE public.embedding_metadata
  SET 
    query_count = query_count + 1,
    last_queried_at = NOW()
  WHERE id = embedding_uuid;
END;
$$;

-- Function to get embeddings for a book
CREATE OR REPLACE FUNCTION get_book_embeddings(
  book_uuid UUID
)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  vector_id TEXT,
  chunk_index INTEGER,
  chunk_count INTEGER,
  chunk_text TEXT,
  embedding_model TEXT,
  generated_at TIMESTAMPTZ
)
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT 
    em.id,
    em.provider,
    em.vector_id,
    em.chunk_index,
    em.chunk_count,
    em.chunk_text,
    em.embedding_model,
    em.generated_at
  FROM public.embedding_metadata em
  WHERE em.book_id = book_uuid
  ORDER BY em.chunk_index;
$$;

-- Function to check if embeddings exist for a book
CREATE OR REPLACE FUNCTION has_book_embeddings(
  book_uuid UUID
)
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.embedding_metadata
    WHERE book_id = book_uuid
  );
$$;

-- Function to get embedding generation stats
CREATE OR REPLACE FUNCTION get_embedding_stats(
  user_uuid UUID
)
RETURNS TABLE (
  total_embeddings BIGINT,
  total_cost_usd DECIMAL,
  total_queries BIGINT,
  avg_query_count_per_embedding DECIMAL,
  embeddings_by_provider JSONB,
  embeddings_by_model JSONB
)
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  WITH stats AS (
    SELECT 
      COUNT(*)::BIGINT as total_embeddings,
      COALESCE(SUM(generation_cost_usd), 0) as total_cost_usd,
      COALESCE(SUM(query_count), 0)::BIGINT as total_queries,
      COALESCE(AVG(query_count), 0) as avg_query_count_per_embedding
    FROM public.embedding_metadata
    WHERE user_id = user_uuid
  ),
  provider_counts AS (
    SELECT 
      provider,
      COUNT(*)::INTEGER as count
    FROM public.embedding_metadata
    WHERE user_id = user_uuid
    GROUP BY provider
  ),
  model_counts AS (
    SELECT 
      embedding_model,
      COUNT(*)::INTEGER as count
    FROM public.embedding_metadata
    WHERE user_id = user_uuid
    GROUP BY embedding_model
  )
  SELECT 
    s.total_embeddings,
    s.total_cost_usd,
    s.total_queries,
    s.avg_query_count_per_embedding,
    (SELECT jsonb_object_agg(provider, count) FROM provider_counts) as embeddings_by_provider,
    (SELECT jsonb_object_agg(embedding_model, count) FROM model_counts) as embeddings_by_model
  FROM stats s;
$$;

-- ============================================================================
-- MIGRATION FROM OLD VECTOR COLUMNS
-- ============================================================================

-- Note: Actual vectors in document_descriptions table will need to be migrated
-- to external vector store. This migration creates the metadata infrastructure.

-- For now, we keep document_descriptions.description_embedding
-- Future migration will:
-- 1. Extract all vectors
-- 2. Upload to chosen vector store
-- 3. Create metadata records
-- 4. Drop vector columns

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE embedding_metadata IS 
  'Lightweight metadata for document embeddings. Actual vectors stored in external vector store (Supabase, Pinecone, etc.).';

COMMENT ON COLUMN embedding_metadata.provider IS 
  'Vector store provider: supabase, pinecone, weaviate, qdrant, or local';

COMMENT ON COLUMN embedding_metadata.vector_id IS 
  'Unique identifier for the vector in the external store';

COMMENT ON COLUMN embedding_metadata.chunk_index IS 
  'Index of this chunk within the document (NULL for single-chunk embeddings)';

COMMENT ON COLUMN embedding_metadata.chunk_count IS 
  'Total number of chunks this document was split into';

COMMENT ON COLUMN embedding_metadata.generation_cost_usd IS 
  'Cost in USD to generate this embedding (for tracking AI expenses)';

COMMENT ON FUNCTION increment_embedding_query_count IS 
  'Increments the query count and updates last_queried_at for an embedding';

COMMENT ON FUNCTION get_book_embeddings IS 
  'Returns all embedding metadata for a specific book, ordered by chunk index';

COMMENT ON FUNCTION has_book_embeddings IS 
  'Checks if embeddings exist for a book (returns true/false)';

COMMENT ON FUNCTION get_embedding_stats IS 
  'Returns comprehensive embedding statistics for a user including costs and usage';

