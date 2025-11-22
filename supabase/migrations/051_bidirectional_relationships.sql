-- Migration: Bidirectional Document Relationships
-- Makes the document graph symmetric: if A relates to B, then B relates to A
-- Date: 2025-11-22

-- ============================================================================
-- UPDATE AUTO-GRAPH GENERATION FUNCTION FOR BIDIRECTIONAL RELATIONSHIPS
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS auto_generate_document_relationships(UUID, UUID, DECIMAL, INTEGER);
DROP FUNCTION IF EXISTS auto_generate_document_relationships(UUID, UUID);
DROP FUNCTION IF EXISTS auto_generate_document_relationships;

-- Recreate with bidirectional relationship creation
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
  new_embedding extensions.vector(768);
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
    RAISE WARNING 'No embedding found for new document %s, skipping auto-relationship generation.', new_book_id;
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
-- BACKFILL EXISTING RELATIONSHIPS (Make them bidirectional)
-- ============================================================================

-- For all existing relationships A → B, create B → A if it doesn't exist
INSERT INTO public.document_relationships (
  user_id,
  source_document_id,
  related_document_id,
  relationship_description,
  relevance_percentage,
  ai_generated_description,
  relevance_calculation_status,
  created_at
)
SELECT 
  user_id,
  related_document_id AS source_document_id,  -- Swap
  source_document_id AS related_document_id,  -- Swap
  relationship_description,
  relevance_percentage,
  ai_generated_description,
  relevance_calculation_status,
  created_at
FROM public.document_relationships
ON CONFLICT (source_document_id, related_document_id) DO NOTHING;

-- ============================================================================
-- RPC FUNCTION: Get Related Documents with Details (Bidirectional)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_related_documents_with_details(source_document_id UUID)
RETURNS TABLE (
  relationship_id UUID,
  source_document_id UUID,
  related_document_id UUID,
  related_document_title TEXT,
  related_document_file_name TEXT,
  related_document_type TEXT,
  relationship_description TEXT,
  relevance_percentage DECIMAL(5,2),
  ai_generated_description TEXT,
  relevance_calculation_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id AS relationship_id,
    dr.source_document_id,
    dr.related_document_id,
    ub.title AS related_document_title,
    ub.file_name AS related_document_file_name,
    ub.type AS related_document_type,
    dr.relationship_description,
    dr.relevance_percentage,
    dr.ai_generated_description,
    dr.relevance_calculation_status,
    dr.created_at,
    dr.updated_at
  FROM public.document_relationships dr
  INNER JOIN public.user_books ub ON ub.id = dr.related_document_id
  WHERE dr.source_document_id = get_related_documents_with_details.source_document_id
  ORDER BY dr.relevance_percentage DESC NULLS LAST, dr.created_at DESC;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION auto_generate_document_relationships IS 'Automatically finds and creates BIDIRECTIONAL document relationships using vector embeddings. When A relates to B, B also relates to A.';
COMMENT ON FUNCTION get_related_documents_with_details IS 'Fetches all related documents for a given source document with full details. Now returns bidirectional relationships automatically.';

