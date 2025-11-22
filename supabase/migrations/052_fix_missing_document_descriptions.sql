-- Migration: Fix Missing document_descriptions Table
-- This creates ONLY the missing document_descriptions table and related components
-- Date: 2025-11-22

-- ============================================================================
-- ENSURE PGVECTOR EXTENSION IS ENABLED
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CREATE DOCUMENT_DESCRIPTIONS TABLE (if it doesn't exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES public.user_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- AI-generated description
  description TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  last_auto_generated_at TIMESTAMPTZ,
  
  -- Vector embedding for similarity search (768 dimensions for OpenAI text-embedding-3-small)
  description_embedding vector(768),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One description per book
  UNIQUE(book_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for book_id lookups
CREATE INDEX IF NOT EXISTS idx_document_descriptions_book_id 
  ON public.document_descriptions(book_id);

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_document_descriptions_user_id 
  ON public.document_descriptions(user_id);

-- Index for vector similarity search (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_document_descriptions_embedding 
  ON public.document_descriptions USING hnsw (description_embedding vector_cosine_ops);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.document_descriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own document descriptions" ON public.document_descriptions;
DROP POLICY IF EXISTS "Users can create own document descriptions" ON public.document_descriptions;
DROP POLICY IF EXISTS "Users can update own document descriptions" ON public.document_descriptions;
DROP POLICY IF EXISTS "Users can delete own document descriptions" ON public.document_descriptions;

-- Create policies
CREATE POLICY "Users can read own document descriptions" ON public.document_descriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document descriptions" ON public.document_descriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document descriptions" ON public.document_descriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document descriptions" ON public.document_descriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_document_descriptions_updated_at ON public.document_descriptions;
CREATE TRIGGER update_document_descriptions_updated_at 
  BEFORE UPDATE ON public.document_descriptions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-GRAPH GENERATION FUNCTION (Update to use correct table)
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS auto_generate_document_relationships(UUID, UUID, DECIMAL, INTEGER);
DROP FUNCTION IF EXISTS auto_generate_document_relationships(UUID, UUID);
DROP FUNCTION IF EXISTS auto_generate_document_relationships;

CREATE OR REPLACE FUNCTION auto_generate_document_relationships(
  new_book_id UUID,
  new_user_id UUID,
  similarity_threshold DECIMAL DEFAULT 0.70,
  limit_count INTEGER DEFAULT 5
)
RETURNS SETOF public.document_relationships
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_embedding vector(768);
  related_doc_id UUID;
  similarity_score DECIMAL(5,2);
  relationship_type TEXT;
  ai_description TEXT;
  relationship_record public.document_relationships;
BEGIN
  -- Get the embedding of the newly added document
  SELECT description_embedding INTO new_embedding
  FROM public.document_descriptions
  WHERE book_id = new_book_id AND user_id = new_user_id AND description_embedding IS NOT NULL;

  IF new_embedding IS NULL THEN
    RAISE WARNING 'No embedding found for new document %, skipping auto-relationship generation.', new_book_id;
    RETURN;
  END IF;

  -- Find similar existing documents using vector similarity
  FOR related_doc_id, similarity_score IN
    SELECT
      dd.book_id,
      (1 - (dd.description_embedding <=> new_embedding)) AS similarity
    FROM public.document_descriptions dd
    WHERE dd.user_id = new_user_id
      AND dd.book_id != new_book_id
      AND dd.description_embedding IS NOT NULL
      AND (1 - (dd.description_embedding <=> new_embedding)) >= similarity_threshold
    ORDER BY (dd.description_embedding <=> new_embedding)
    LIMIT limit_count
  LOOP
    -- Determine relationship type based on similarity score
    IF similarity_score >= 0.90 THEN
      relationship_type := 'Identical';
    ELSIF similarity_score >= 0.80 THEN
      relationship_type := 'Extension / Follow-up';
    ELSIF similarity_score >= 0.70 THEN
      relationship_type := 'Shared Topic';
    ELSE
      relationship_type := 'Related (Tangential)';
    END IF;

    -- Generate a simple AI description
    ai_description := 'Automatically detected relationship based on content similarity.';

    -- Insert the new relationship if it doesn't already exist (A → B)
    INSERT INTO public.document_relationships (
      user_id,
      source_document_id,
      related_document_id,
      relationship_description,
      relevance_percentage,
      ai_generated_description,
      relevance_calculation_status
    ) VALUES (
      new_user_id,
      new_book_id,
      related_doc_id,
      relationship_type,
      (similarity_score * 100)::DECIMAL(5,2),
      ai_description,
      'completed'
    )
    ON CONFLICT (source_document_id, related_document_id) DO NOTHING
    RETURNING * INTO relationship_record;

    IF relationship_record.id IS NOT NULL THEN
      RETURN NEXT relationship_record;
    END IF;

    -- Insert the reverse relationship (B → A) for bidirectional graph
    INSERT INTO public.document_relationships (
      user_id,
      source_document_id,
      related_document_id,
      relationship_description,
      relevance_percentage,
      ai_generated_description,
      relevance_calculation_status
    ) VALUES (
      new_user_id,
      related_doc_id,
      new_book_id,
      relationship_type,
      (similarity_score * 100)::DECIMAL(5,2),
      ai_description,
      'completed'
    )
    ON CONFLICT (source_document_id, related_document_id) DO NOTHING;

  END LOOP;

  RETURN;
END;
$$;

-- ============================================================================
-- TRIGGER FOR AUTO-GRAPH GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_auto_generate_document_relationships()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.description_embedding IS NOT NULL AND NEW.book_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    PERFORM auto_generate_document_relationships(NEW.book_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_document_description_upsert ON public.document_descriptions;
CREATE TRIGGER after_document_description_upsert
AFTER INSERT OR UPDATE OF description_embedding ON public.document_descriptions
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_generate_document_relationships();

-- ============================================================================
-- RPC FUNCTION FOR FETCHING RELATED DOCUMENTS (Bidirectional)
-- ============================================================================

DROP FUNCTION IF EXISTS get_related_documents_with_details(UUID);

CREATE OR REPLACE FUNCTION get_related_documents_with_details(
  p_document_id UUID
)
RETURNS TABLE (
  relationship_id UUID,
  source_document_id UUID,
  related_document_id UUID,
  relationship_description TEXT,
  relevance_percentage DECIMAL(5,2),
  ai_generated_description TEXT,
  relevance_calculation_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  related_title TEXT,
  related_file_name TEXT,
  related_file_type TEXT,
  related_total_pages INTEGER,
  related_last_read_page INTEGER,
  related_uploaded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.id AS relationship_id,
    dr.source_document_id,
    dr.related_document_id,
    dr.relationship_description,
    dr.relevance_percentage,
    dr.ai_generated_description,
    dr.relevance_calculation_status,
    dr.created_at,
    dr.updated_at,
    ub.title AS related_title,
    ub.file_name AS related_file_name,
    ub.type AS related_file_type,
    ub.total_pages AS related_total_pages,
    ub.last_read_page AS related_last_read_page,
    ub.saved_at AS related_uploaded_at
  FROM
    public.document_relationships dr
  JOIN
    public.user_books ub ON dr.related_document_id = ub.id
  WHERE
    dr.user_id = auth.uid()
    AND (dr.source_document_id = p_document_id OR dr.related_document_id = p_document_id)
  ORDER BY
    dr.relevance_percentage DESC, dr.created_at DESC;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.document_descriptions IS 'Stores AI-generated descriptions and vector embeddings for documents to enable semantic search and automatic relationship discovery.';
COMMENT ON COLUMN public.document_descriptions.description_embedding IS 'Vector embedding (768 dimensions) for semantic similarity search using pgvector.';
COMMENT ON FUNCTION public.auto_generate_document_relationships IS 'Automatically finds and creates bidirectional document relationships using vector embeddings when a new document is added or its embedding is updated.';
COMMENT ON FUNCTION public.get_related_documents_with_details IS 'Retrieves all related documents for a given document, including bidirectional relationships and document details.';
COMMENT ON TRIGGER after_document_description_upsert ON public.document_descriptions IS 'Trigger to call auto_generate_document_relationships after a document_description is inserted or its embedding is updated.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if document_descriptions table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_descriptions'
  ) THEN
    RAISE NOTICE '✅ document_descriptions table exists';
  ELSE
    RAISE WARNING '❌ document_descriptions table does NOT exist';
  END IF;
END $$;

-- Check if description_embedding column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_descriptions' 
    AND column_name = 'description_embedding'
  ) THEN
    RAISE NOTICE '✅ description_embedding column exists';
  ELSE
    RAISE WARNING '❌ description_embedding column does NOT exist';
  END IF;
END $$;

-- Check if trigger exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'document_descriptions'
    AND trigger_name = 'after_document_description_upsert'
  ) THEN
    RAISE NOTICE '✅ after_document_description_upsert trigger exists';
  ELSE
    RAISE WARNING '❌ after_document_description_upsert trigger does NOT exist';
  END IF;
END $$;

-- Check if vector extension is enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE NOTICE '✅ pgvector extension is enabled';
  ELSE
    RAISE WARNING '❌ pgvector extension is NOT enabled';
  END IF;
END $$;

