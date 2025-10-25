-- Document Relationships table for linking related documents
CREATE TABLE document_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  source_document_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  related_document_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  relationship_description TEXT,
  relevance_percentage DECIMAL(5,2) CHECK (relevance_percentage >= 0 AND relevance_percentage <= 100),
  ai_generated_description TEXT,
  relevance_calculation_status TEXT CHECK (relevance_calculation_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_document_id, related_document_id)
);

-- Indexes for performance
CREATE INDEX idx_doc_relationships_source ON document_relationships(source_document_id);
CREATE INDEX idx_doc_relationships_user ON document_relationships(user_id);
CREATE INDEX idx_doc_relationships_status ON document_relationships(relevance_calculation_status);
CREATE INDEX idx_doc_relationships_related ON document_relationships(related_document_id);

-- Row Level Security (RLS)
ALTER TABLE document_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own document relationships" ON document_relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document relationships" ON document_relationships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document relationships" ON document_relationships
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document relationships" ON document_relationships
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_document_relationships_updated_at BEFORE UPDATE ON document_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get related documents with full document details
CREATE OR REPLACE FUNCTION get_related_documents_with_details(source_doc_id UUID)
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
) AS $$
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
  FROM document_relationships dr
  JOIN user_books ub ON dr.related_document_id = ub.id
  WHERE dr.source_document_id = source_doc_id
    AND dr.user_id = auth.uid()
  ORDER BY dr.relevance_percentage DESC NULLS LAST, dr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document relationship statistics
CREATE OR REPLACE FUNCTION get_document_relationship_stats(user_uuid UUID)
RETURNS TABLE (
  total_relationships BIGINT,
  completed_calculations BIGINT,
  pending_calculations BIGINT,
  failed_calculations BIGINT,
  average_relevance DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_relationships,
    COUNT(*) FILTER (WHERE relevance_calculation_status = 'completed')::BIGINT as completed_calculations,
    COUNT(*) FILTER (WHERE relevance_calculation_status = 'pending')::BIGINT as pending_calculations,
    COUNT(*) FILTER (WHERE relevance_calculation_status = 'failed')::BIGINT as failed_calculations,
    COALESCE(AVG(relevance_percentage), 0)::DECIMAL(5,2) as average_relevance
  FROM document_relationships
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
