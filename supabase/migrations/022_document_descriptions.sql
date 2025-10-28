-- Document descriptions (central nodes for graph)
CREATE TABLE document_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ai_generated_description TEXT,
  user_entered_description TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  description_embedding vector(768), -- For auto-linking using embeddings
  last_auto_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note relationships (connect notes to documents, memories, other notes)
CREATE TABLE note_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  note_id UUID REFERENCES user_notes(id) ON DELETE CASCADE NOT NULL,
  related_type TEXT NOT NULL, -- 'document', 'memory', 'note'
  related_id UUID NOT NULL, -- Flexible ID (book_id, memory_id, or note_id)
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('references', 'illustrates', 'contradicts', 'complements', 'exemplifies', 'defines')),
  similarity_score DECIMAL(5,4), -- 0.0000 to 1.0000 for auto-detected
  is_auto_detected BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend document_relationships to reference document descriptions
ALTER TABLE document_relationships 
ADD COLUMN source_description_id UUID REFERENCES document_descriptions(id) ON DELETE SET NULL,
ADD COLUMN related_description_id UUID REFERENCES document_descriptions(id) ON DELETE SET NULL;

-- Indexes for document_descriptions
CREATE INDEX idx_doc_desc_book_id ON document_descriptions(book_id);
CREATE INDEX idx_doc_desc_user_id ON document_descriptions(user_id);
CREATE INDEX idx_doc_desc_embedding ON document_descriptions USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_doc_desc_updated_at ON document_descriptions(updated_at DESC);

-- Indexes for note_relationships
CREATE INDEX idx_note_rel_user_id ON note_relationships(user_id);
CREATE INDEX idx_note_rel_note_id ON note_relationships(note_id);
CREATE INDEX idx_note_rel_related ON note_relationships(related_type, related_id);
CREATE INDEX idx_note_rel_auto_detected ON note_relationships(is_auto_detected);
CREATE INDEX idx_note_rel_similarity ON note_relationships(similarity_score DESC);
CREATE INDEX idx_note_rel_type ON note_relationships(relationship_type);

-- Row Level Security (RLS)
ALTER TABLE document_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_descriptions
CREATE POLICY "Users can read own document descriptions" ON document_descriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document descriptions" ON document_descriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document descriptions" ON document_descriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document descriptions" ON document_descriptions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for note_relationships
CREATE POLICY "Users can read own note relationships" ON note_relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own note relationships" ON note_relationships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note relationships" ON note_relationships
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own note relationships" ON note_relationships
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_document_descriptions_updated_at BEFORE UPDATE ON document_descriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get document description (with fallback to AI or user)
CREATE OR REPLACE FUNCTION get_document_description(book_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT COALESCE(user_entered_description, ai_generated_description, '') INTO result
  FROM document_descriptions
  WHERE book_id = book_uuid;
  
  RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document-centric graph
CREATE OR REPLACE FUNCTION get_document_centric_graph(
  book_uuid UUID,
  user_uuid UUID,
  max_depth INTEGER DEFAULT 2
)
RETURNS TABLE (
  node_type TEXT,
  node_id UUID,
  node_content TEXT,
  relationship_type TEXT,
  similarity_score DECIMAL(5,4),
  depth_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph_nodes AS (
    -- Start with the document description node
    SELECT 
      'document'::TEXT as node_type,
      dd.id::UUID as node_id,
      COALESCE(dd.user_entered_description, dd.ai_generated_description, '')::TEXT as node_content,
      NULL::TEXT as relationship_type,
      NULL::DECIMAL(5,4) as similarity_score,
      0::INTEGER as depth_level
    FROM document_descriptions dd
    WHERE dd.book_id = book_uuid AND dd.user_id = user_uuid
    
    UNION ALL
    
    -- Related documents (one level)
    SELECT 
      'document'::TEXT,
      rd.id::UUID,
      COALESCE(rd.user_entered_description, rd.ai_generated_description, '')::TEXT,
      dr.relationship_type::TEXT,
      dr.relevance_percentage::DECIMAL(5,4),
      1::INTEGER
    FROM document_relationships dr
    JOIN document_descriptions rd ON dr.related_description_id = rd.id
    JOIN document_descriptions sd ON dr.source_description_id = sd.id
    WHERE sd.book_id = book_uuid
      AND rd.user_id = user_uuid
    
    UNION ALL
    
    -- Notes related to this document (one level)
    SELECT 
      'note'::TEXT,
      un.id::UUID,
      un.content::TEXT,
      nr.relationship_type::TEXT,
      nr.similarity_score::DECIMAL(5,4),
      1::INTEGER
    FROM note_relationships nr
    JOIN user_notes un ON nr.note_id = un.id
    WHERE nr.related_type = 'document' 
      AND nr.related_id = book_uuid
      AND nr.user_id = user_uuid
  )
  SELECT * FROM graph_nodes WHERE depth_level <= max_depth;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get note relationships
CREATE OR REPLACE FUNCTION get_note_relationships(note_uuid UUID, user_uuid UUID)
RETURNS TABLE (
  relationship_id UUID,
  related_type TEXT,
  related_id UUID,
  relationship_type TEXT,
  similarity_score DECIMAL(5,4),
  is_auto_detected BOOLEAN,
  content TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nr.id as relationship_id,
    nr.related_type,
    nr.related_id,
    nr.relationship_type,
    nr.similarity_score,
    nr.is_auto_detected,
    CASE 
      WHEN nr.related_type = 'document' THEN 
        COALESCE(dd.user_entered_description, dd.ai_generated_description, '')
      WHEN nr.related_type = 'note' THEN 
        (SELECT content FROM user_notes WHERE id = nr.related_id)
      WHEN nr.related_type = 'memory' THEN 
        (SELECT entity_text FROM conversation_memories WHERE id = nr.related_id)
      ELSE ''
    END::TEXT as content,
    nr.created_at
  FROM note_relationships nr
  LEFT JOIN document_descriptions dd ON (nr.related_type = 'document' AND nr.related_id = dd.book_id)
  WHERE nr.note_id = note_uuid
    AND nr.user_id = user_uuid
  ORDER BY nr.is_auto_detected ASC, nr.similarity_score DESC NULLS LAST, nr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

