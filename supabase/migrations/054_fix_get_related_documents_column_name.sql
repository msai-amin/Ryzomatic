-- Migration: Fix column name in get_related_documents_with_details function
-- Date: 2025-01-XX
-- Issue: Function uses ub.type but column is actually ub.file_type

-- ============================================================================
-- FIX: Update get_related_documents_with_details function
-- ============================================================================

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
    ub.file_type AS related_file_type,  -- FIXED: Changed from ub.type to ub.file_type
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

COMMENT ON FUNCTION get_related_documents_with_details IS 'Retrieves all related documents for a given document, including bidirectional relationships and document details. Fixed to use file_type column instead of type.';

