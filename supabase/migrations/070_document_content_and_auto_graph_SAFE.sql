-- Migration: Document Content Storage and Automatic Graph Generation (SAFE VERSION)
-- This version is idempotent - safe to run multiple times
-- Date: 2025-11-22

-- ============================================================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- DOCUMENT CONTENT TABLE
-- ============================================================================

-- Store parsed text from PDFs/EPUBs to avoid re-parsing
CREATE TABLE IF NOT EXISTS document_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Content storage
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 1,
  
  -- Metadata
  extraction_method TEXT CHECK (extraction_method IN ('pdfjs', 'epub', 'manual', 'ocr')),
  word_count INTEGER,
  character_count INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(book_id, chunk_index)
);

-- Indexes (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_doc_content_book_id ON document_content(book_id);
CREATE INDEX IF NOT EXISTS idx_doc_content_user_id ON document_content(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_content_chunk ON document_content(book_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_doc_content_fts ON document_content USING gin(to_tsvector('english', content));

-- Row Level Security
ALTER TABLE document_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own document content" ON document_content;
DROP POLICY IF EXISTS "Users can create own document content" ON document_content;
DROP POLICY IF EXISTS "Users can update own document content" ON document_content;
DROP POLICY IF EXISTS "Users can delete own document content" ON document_content;

-- Create policies
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
CREATE TRIGGER update_document_content_updated_at BEFORE UPDATE ON document_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DOCUMENT RELATIONSHIPS TABLE
-- ============================================================================

-- Create document_relationships table if it doesn't exist
CREATE TABLE IF NOT EXISTS document_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  source_document_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  related_document_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Relationship metadata
  relationship_description TEXT,
  relevance_percentage DECIMAL(5,2),
  ai_generated_description TEXT,
  relevance_calculation_status TEXT CHECK (relevance_calculation_status IN ('pending', 'calculating', 'completed', 'failed')) DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicate relationships
  UNIQUE(source_document_id, related_document_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_rel_user_id ON document_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_rel_source_id ON document_relationships(source_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_rel_related_id ON document_relationships(related_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_rel_status ON document_relationships(relevance_calculation_status);

-- Row Level Security
ALTER TABLE document_relationships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own document relationships" ON document_relationships;
DROP POLICY IF EXISTS "Users can create own document relationships" ON document_relationships;
DROP POLICY IF EXISTS "Users can update own document relationships" ON document_relationships;
DROP POLICY IF EXISTS "Users can delete own document relationships" ON document_relationships;

-- Create policies
CREATE POLICY "Users can read own document relationships" ON document_relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document relationships" ON document_relationships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document relationships" ON document_relationships
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document relationships" ON document_relationships
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_document_relationships_updated_at ON document_relationships;
CREATE TRIGGER update_document_relationships_updated_at BEFORE UPDATE ON document_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DOCUMENT DESCRIPTIONS TABLE (Create if not exists, then add embedding)
-- ============================================================================

-- Create document_descriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.document_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES public.user_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- AI-generated description
  description TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  last_auto_generated_at TIMESTAMPTZ,
  
  -- Vector embedding for similarity search (768 dimensions)
  description_embedding vector(768),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One description per book
  UNIQUE(book_id)
);

-- Add embedding column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'document_descriptions' 
    AND column_name = 'description_embedding'
  ) THEN
    ALTER TABLE public.document_descriptions 
    ADD COLUMN description_embedding vector(768);
  END IF;
END $$;

-- Indexes for document_descriptions
CREATE INDEX IF NOT EXISTS idx_document_descriptions_book_id 
  ON public.document_descriptions(book_id);
CREATE INDEX IF NOT EXISTS idx_document_descriptions_user_id 
  ON public.document_descriptions(user_id);

-- Create an index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_descriptions_embedding 
  ON public.document_descriptions USING hnsw (description_embedding vector_cosine_ops);

-- Row Level Security
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

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_document_descriptions_updated_at ON public.document_descriptions;
CREATE TRIGGER update_document_descriptions_updated_at BEFORE UPDATE ON public.document_descriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-GRAPH GENERATION FUNCTION
-- ============================================================================

-- Drop existing function if it exists (with all possible signatures)
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
SET search_path = 'public, extensions'
AS $$
DECLARE
  related_doc_id UUID;
  similarity_score DECIMAL(5,2);
  relationship_type TEXT;
  ai_description TEXT;
  relationship_record public.document_relationships;
  source_desc_id UUID;
BEGIN
  -- Get the description ID for the new document
  SELECT id INTO source_desc_id
  FROM public.document_descriptions
  WHERE book_id = new_book_id AND user_id = new_user_id AND description_embedding IS NOT NULL;

  IF source_desc_id IS NULL THEN
    RAISE WARNING 'No embedding found for new document %s, skipping auto-relationship generation.', new_book_id;
    RETURN;
  END IF;

  -- Find similar existing documents using vector similarity
  -- Use CTE to avoid declaring vector type in DECLARE section
  FOR related_doc_id, similarity_score IN
    WITH source_embedding AS (
      SELECT description_embedding
      FROM public.document_descriptions
      WHERE id = source_desc_id
    )
    SELECT
      dd.book_id,
      (1 - (dd.description_embedding <=> se.description_embedding)) AS similarity
    FROM public.document_descriptions dd
    CROSS JOIN source_embedding se
    WHERE dd.user_id = new_user_id
      AND dd.book_id != new_book_id
      AND dd.description_embedding IS NOT NULL
      AND (1 - (dd.description_embedding <=> se.description_embedding)) >= similarity_threshold
    ORDER BY (dd.description_embedding <=> se.description_embedding)
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

DROP TRIGGER IF EXISTS after_document_description_upsert ON document_descriptions;
CREATE TRIGGER after_document_description_upsert
AFTER INSERT OR UPDATE OF description_embedding ON document_descriptions
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_generate_document_relationships();

-- ============================================================================
-- UPDATE USER_BOOKS TO REFERENCE DOCUMENT_CONTENTS
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_books' 
    AND column_name = 'primary_content_id'
  ) THEN
    ALTER TABLE user_books ADD COLUMN primary_content_id UUID REFERENCES document_content(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE document_content IS 'Stores the full extracted text content of documents, chunked if necessary, to avoid re-parsing PDFs and keep user_books table lean.';
COMMENT ON FUNCTION auto_generate_document_relationships IS 'Automatically finds and creates document relationships using vector embeddings when a new document is added or its embedding is updated.';
COMMENT ON TRIGGER after_document_description_upsert ON document_descriptions IS 'Trigger to call auto_generate_document_relationships after a document_description is inserted or its embedding is updated.';

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_books' 
    AND column_name = 'primary_content_id'
  ) THEN
    COMMENT ON COLUMN user_books.primary_content_id IS 'References the primary entry in document_content for the full text of the book.';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration to verify)
-- ============================================================================

-- Uncomment to run verification:
/*
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('document_content', 'document_descriptions');

-- Check if vector column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'document_descriptions' 
AND column_name = 'description_embedding';

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'document_descriptions';

-- Check if vector extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';
*/

