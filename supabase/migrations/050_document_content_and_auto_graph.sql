-- Migration: Document Content Storage and Automatic Graph Generation
-- Stores parsed text permanently and auto-generates document relationships using vector embeddings
-- Date: 2025-11-21

-- ============================================================================
-- DOCUMENT CONTENT TABLE
-- ============================================================================

-- Store parsed text from PDFs/EPUBs to avoid re-parsing
-- Supports chunking for large documents
CREATE TABLE IF NOT EXISTS document_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Content storage
  content TEXT NOT NULL, -- Full extracted text or chunk
  chunk_index INTEGER DEFAULT 0, -- 0 for single-chunk documents
  chunk_count INTEGER DEFAULT 1, -- Total chunks for this document
  
  -- Metadata
  extraction_method TEXT CHECK (extraction_method IN ('pdfjs', 'epub', 'manual', 'ocr')),
  word_count INTEGER,
  character_count INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(book_id, chunk_index) -- One content per chunk
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_content_book_id ON document_content(book_id);
CREATE INDEX IF NOT EXISTS idx_doc_content_user_id ON document_content(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_content_chunk ON document_content(book_id, chunk_index);

-- Full-text search index for content
CREATE INDEX IF NOT EXISTS idx_doc_content_fts ON document_content USING gin(to_tsvector('english', content));

-- Row Level Security
ALTER TABLE document_content ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can read own document content" ON document_content;
DROP POLICY IF EXISTS "Users can create own document content" ON document_content;
DROP POLICY IF EXISTS "Users can update own document content" ON document_content;
DROP POLICY IF EXISTS "Users can delete own document content" ON document_content;

CREATE POLICY "Users can read own document content" ON document_content
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document content" ON document_content
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document content" ON document_content
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document content" ON document_content
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_document_content_updated_at ON document_content;
CREATE TRIGGER update_document_content_updated_at 
  BEFORE UPDATE ON document_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get full document content (all chunks concatenated)
CREATE OR REPLACE FUNCTION get_full_document_content(book_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  full_content TEXT;
BEGIN
  SELECT string_agg(content, E'\n\n' ORDER BY chunk_index)
  INTO full_content
  FROM public.document_content
  WHERE book_id = book_uuid
    AND user_id = auth.uid();
  
  RETURN COALESCE(full_content, '');
END;
$$;

-- Function to get document content summary (first 5000 chars)
CREATE OR REPLACE FUNCTION get_document_content_summary(book_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  summary TEXT;
BEGIN
  SELECT LEFT(content, 5000)
  INTO summary
  FROM public.document_content
  WHERE book_id = book_uuid
    AND user_id = auth.uid()
    AND chunk_index = 0;
  
  RETURN COALESCE(summary, '');
END;
$$;

-- ============================================================================
-- AUTOMATIC GRAPH GENERATION
-- ============================================================================

-- Function to automatically find and create document relationships
-- Called when a new document description embedding is created/updated
CREATE OR REPLACE FUNCTION auto_generate_document_relationships(
  source_book_uuid UUID,
  similarity_threshold DECIMAL DEFAULT 0.60
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_uuid UUID;
  source_desc_id UUID;
  relationships_created INTEGER := 0;
  related_record RECORD;
BEGIN
  -- Get current user
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get source document description
  SELECT id INTO source_desc_id
  FROM public.document_descriptions
  WHERE book_id = source_book_uuid
    AND user_id = user_uuid
    AND description_embedding IS NOT NULL;
  
  IF source_desc_id IS NULL THEN
    -- No embedding yet, skip
    RETURN 0;
  END IF;
  
  -- Find similar documents using vector similarity
  FOR related_record IN
    WITH source_embedding AS (
      SELECT description_embedding
      FROM public.document_descriptions
      WHERE id = source_desc_id
    )
    SELECT 
      dd.id as related_desc_id,
      dd.book_id as related_book_id,
      1 - (dd.description_embedding <=> se.description_embedding) as similarity
    FROM public.document_descriptions dd
    CROSS JOIN source_embedding se
    WHERE dd.user_id = user_uuid
      AND dd.book_id != source_book_uuid
      AND dd.description_embedding IS NOT NULL
      AND 1 - (dd.description_embedding <=> se.description_embedding) >= similarity_threshold
    ORDER BY dd.description_embedding <=> se.description_embedding
    LIMIT 20 -- Limit to top 20 most similar
  LOOP
    -- Insert relationship if it doesn't exist
    INSERT INTO public.document_relationships (
      user_id,
      source_document_id,
      related_document_id,
      source_description_id,
      related_description_id,
      relevance_percentage,
      relevance_calculation_status,
      ai_generated_description
    )
    VALUES (
      user_uuid,
      source_book_uuid,
      related_record.related_book_id,
      source_desc_id,
      related_record.related_desc_id,
      ROUND((related_record.similarity * 100)::numeric, 2),
      'completed',
      jsonb_build_object(
        'method', 'vector_similarity',
        'model', 'text-embedding-004',
        'similarity_score', related_record.similarity,
        'auto_generated', true,
        'generated_at', NOW()
      )::text
    )
    ON CONFLICT (source_document_id, related_document_id) 
    DO UPDATE SET
      relevance_percentage = ROUND(related_record.similarity * 100, 2),
      relevance_calculation_status = 'completed',
      updated_at = NOW();
    
    relationships_created := relationships_created + 1;
  END LOOP;
  
  RETURN relationships_created;
END;
$$;

-- Function to trigger relationship generation for all documents
-- Useful for backfilling existing documents
CREATE OR REPLACE FUNCTION regenerate_all_document_relationships(
  similarity_threshold DECIMAL DEFAULT 0.60
)
RETURNS TABLE (
  book_id UUID,
  relationships_created INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_uuid UUID;
  book_record RECORD;
BEGIN
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Process each document with an embedding
  FOR book_record IN
    SELECT DISTINCT dd.book_id
    FROM public.document_descriptions dd
    WHERE dd.user_id = user_uuid
      AND dd.description_embedding IS NOT NULL
  LOOP
    RETURN QUERY
    SELECT 
      book_record.book_id,
      auto_generate_document_relationships(book_record.book_id, similarity_threshold);
  END LOOP;
END;
$$;

-- ============================================================================
-- TRIGGER FOR AUTOMATIC RELATIONSHIP GENERATION
-- ============================================================================

-- Trigger function to auto-generate relationships when embedding is added/updated
CREATE OR REPLACE FUNCTION trigger_auto_generate_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only trigger if embedding was added or changed
  IF NEW.description_embedding IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.description_embedding IS DISTINCT FROM NEW.description_embedding) THEN
    
    -- Generate relationships asynchronously (don't block the insert/update)
    -- Note: In production, this should be moved to a background job queue
    PERFORM auto_generate_document_relationships(NEW.book_id, 0.60);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to document_descriptions table (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_descriptions'
  ) THEN
    DROP TRIGGER IF EXISTS auto_generate_relationships_trigger ON document_descriptions;
    CREATE TRIGGER auto_generate_relationships_trigger
      AFTER INSERT OR UPDATE OF description_embedding ON document_descriptions
      FOR EACH ROW
      EXECUTE FUNCTION trigger_auto_generate_relationships();
  END IF;
END $$;

-- ============================================================================
-- ENHANCED SEARCH FUNCTIONS
-- ============================================================================

-- Function to search document content using full-text search
CREATE OR REPLACE FUNCTION search_document_content(
  search_query TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  book_id UUID,
  title TEXT,
  file_name TEXT,
  content_snippet TEXT,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  RETURN QUERY
  SELECT 
    dc.book_id,
    ub.title,
    ub.file_name,
    ts_headline('english', dc.content, plainto_tsquery('english', search_query), 
                'MaxWords=50, MinWords=25, ShortWord=3') as content_snippet,
    ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', search_query)) as rank
  FROM public.document_content dc
  JOIN public.user_books ub ON ub.id = dc.book_id
  WHERE dc.user_id = user_uuid
    AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- STATISTICS FUNCTIONS
-- ============================================================================

-- Function to get document content statistics
CREATE OR REPLACE FUNCTION get_document_content_stats(user_uuid UUID)
RETURNS TABLE (
  total_documents BIGINT,
  total_chunks BIGINT,
  total_words BIGINT,
  total_characters BIGINT,
  avg_words_per_doc DECIMAL,
  documents_with_content BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT dc.book_id)::BIGINT as total_documents,
    COUNT(*)::BIGINT as total_chunks,
    COALESCE(SUM(dc.word_count), 0)::BIGINT as total_words,
    COALESCE(SUM(dc.character_count), 0)::BIGINT as total_characters,
    COALESCE(AVG(dc.word_count), 0)::DECIMAL as avg_words_per_doc,
    COUNT(DISTINCT dc.book_id)::BIGINT as documents_with_content
  FROM public.document_content dc
  WHERE dc.user_id = user_uuid;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE document_content IS 
  'Stores parsed text from documents to avoid re-parsing. Supports chunking for large documents.';

COMMENT ON COLUMN document_content.content IS 
  'Extracted text content. For chunked documents, this is one chunk.';

COMMENT ON COLUMN document_content.chunk_index IS 
  'Zero-based index of this chunk. 0 for single-chunk documents.';

COMMENT ON COLUMN document_content.extraction_method IS 
  'Method used to extract text: pdfjs, epub, manual, or ocr';

COMMENT ON FUNCTION auto_generate_document_relationships IS 
  'Automatically finds and creates document relationships using vector similarity. Called when embeddings are added/updated.';

COMMENT ON FUNCTION get_full_document_content IS 
  'Returns the full text content of a document (all chunks concatenated).';

COMMENT ON FUNCTION search_document_content IS 
  'Full-text search across all document content using PostgreSQL FTS.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_full_document_content TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_content_summary TO authenticated;
GRANT EXECUTE ON FUNCTION auto_generate_document_relationships TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_all_document_relationships TO authenticated;
GRANT EXECUTE ON FUNCTION search_document_content TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_content_stats TO authenticated;

