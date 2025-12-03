-- Migration: Fix Search Path Security for Document Relationship Functions
-- Addresses security lint warning: Function has mutable search_path
-- Date: 2025-01-XX

-- Ensure vector extension is available (required for vector(768) type)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- FIX: trigger_auto_generate_document_relationships()
-- ============================================================================
-- Issue: Function lacks fixed search_path, making it vulnerable to search_path injection
-- Fix: Add SET search_path = pg_catalog, public and schema-qualify function call

CREATE OR REPLACE FUNCTION public.trigger_auto_generate_document_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.description_embedding IS NOT NULL AND NEW.book_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    PERFORM public.auto_generate_document_relationships(NEW.book_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FIX: auto_generate_document_relationships()
-- ============================================================================
-- Issue: SECURITY DEFINER function lacks fixed search_path
-- Fix: Add SET search_path = '' (empty) for maximum security with SECURITY DEFINER
-- Note: All table references are already schema-qualified (public.*)

CREATE OR REPLACE FUNCTION public.auto_generate_document_relationships(
  new_book_id UUID,
  new_user_id UUID,
  similarity_threshold DECIMAL DEFAULT 0.70,
  limit_count INTEGER DEFAULT 5
)
RETURNS SETOF public.document_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.trigger_auto_generate_document_relationships() IS 
  'Trigger function to auto-generate document relationships when embedding is added/updated. Fixed search_path prevents injection attacks.';

COMMENT ON FUNCTION public.auto_generate_document_relationships(UUID, UUID, DECIMAL, INTEGER) IS 
  'Automatically finds and creates document relationships using vector similarity. SECURITY DEFINER with empty search_path for maximum security.';
