-- Fix get_related_documents_with_details function
-- Migration 017 broke this function by using wrong column names
-- This restores it to match the actual document_relationships table schema

DROP FUNCTION IF EXISTS public.get_related_documents_with_details(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_related_documents_with_details(source_document_id UUID)
RETURNS TABLE (
  relationship_id UUID,
  related_document_id UUID,
  related_title TEXT,
  related_file_name TEXT,
  related_file_type TEXT,
  related_total_pages INTEGER,
  relationship_description TEXT,
  relevance_percentage DECIMAL(5,2),
  ai_generated_description TEXT,
  relevance_calculation_status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.id as relationship_id,
    dr.related_document_id,
    ub.title as related_title,
    ub.file_name as related_file_name,
    ub.file_type as related_file_type,
    ub.total_pages as related_total_pages,
    dr.relationship_description,
    dr.relevance_percentage,
    dr.ai_generated_description,
    dr.relevance_calculation_status,
    dr.created_at
  FROM public.document_relationships dr
  JOIN public.user_books ub ON dr.related_document_id = ub.id
  WHERE dr.source_document_id = get_related_documents_with_details.source_document_id
    AND dr.user_id = auth.uid()
  ORDER BY dr.relevance_percentage DESC NULLS LAST, dr.created_at DESC;
END;
$$;

