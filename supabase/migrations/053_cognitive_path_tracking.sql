-- Migration: Cognitive Path Tracking System
-- Tracks user learning journeys, reading flow, and concept connections
-- Date: 2025-01-XX
-- 
-- This migration adds:
-- 1. Reading sessions (temporal flow tracking)
-- 2. Document navigation log (how users move between documents)
-- 3. Highlight-to-note connections (idea development)
-- 4. Cognitive concepts (extracted ideas across documents)
-- 5. Concept occurrences (where concepts appear)
-- 6. Cognitive paths (explicit learning journeys)
-- 7. Enhanced document relationships with cognitive metadata

-- ============================================================================
-- ENSURE PGVECTOR EXTENSION IS ENABLED
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. READING SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reading_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE,
  
  -- Session metadata
  session_type TEXT CHECK (session_type IN ('reading', 'reviewing', 'research', 'study')) DEFAULT 'reading',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Reading flow tracking
  pages_read INTEGER[] DEFAULT '{}', -- Array of page numbers read
  highlights_created INTEGER DEFAULT 0,
  notes_created INTEGER DEFAULT 0,
  
  -- Context
  previous_session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL, -- Link to previous session
  next_document_id UUID REFERENCES user_books(id) ON DELETE SET NULL, -- Which doc they read next
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reading_sessions
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_start_time ON reading_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_previous ON reading_sessions(previous_session_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_next_doc ON reading_sessions(next_document_id);

-- Row Level Security
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reading sessions" ON reading_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reading sessions" ON reading_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading sessions" ON reading_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading sessions" ON reading_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 2. DOCUMENT NAVIGATION LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_navigation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Navigation sequence
  from_document_id UUID REFERENCES user_books(id) ON DELETE SET NULL,
  to_document_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Navigation context
  navigation_type TEXT CHECK (navigation_type IN (
    'related_document_click',  -- Clicked related doc in graph
    'note_reference',          -- Followed note link
    'highlight_reference',     -- Followed highlight link
    'search_result',           -- Found via search
    'manual_open'              -- Manually opened
  )) DEFAULT 'manual_open',
  
  -- What triggered navigation
  trigger_highlight_id UUID REFERENCES user_highlights(id) ON DELETE SET NULL,
  trigger_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL,
  trigger_concept_id UUID, -- Will reference cognitive_concepts after it's created
  
  navigation_time TIMESTAMPTZ DEFAULT NOW(),
  time_spent_seconds INTEGER -- How long on previous doc
);

-- Indexes for document_navigation_log
CREATE INDEX IF NOT EXISTS idx_nav_log_user_id ON document_navigation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_nav_log_from_doc ON document_navigation_log(from_document_id);
CREATE INDEX IF NOT EXISTS idx_nav_log_to_doc ON document_navigation_log(to_document_id);
CREATE INDEX IF NOT EXISTS idx_nav_log_time ON document_navigation_log(navigation_time DESC);
CREATE INDEX IF NOT EXISTS idx_nav_log_type ON document_navigation_log(navigation_type);

-- Row Level Security
ALTER TABLE document_navigation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own navigation log" ON document_navigation_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own navigation log" ON document_navigation_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own navigation log" ON document_navigation_log
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. HIGHLIGHT-TO-NOTE CONNECTIONS
-- ============================================================================

-- Add columns to existing tables
ALTER TABLE user_notes 
ADD COLUMN IF NOT EXISTS source_highlight_id UUID REFERENCES user_highlights(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_from_highlight BOOLEAN DEFAULT FALSE;

ALTER TABLE user_highlights
ADD COLUMN IF NOT EXISTS has_note BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS linked_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL;

-- Create explicit relationship table for richer connections
CREATE TABLE IF NOT EXISTS highlight_note_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  highlight_id UUID REFERENCES user_highlights(id) ON DELETE CASCADE NOT NULL,
  note_id UUID REFERENCES user_notes(id) ON DELETE CASCADE NOT NULL,
  
  -- Connection metadata
  connection_type TEXT CHECK (connection_type IN ('expanded', 'questioned', 'summarized', 'related')) DEFAULT 'expanded',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(highlight_id, note_id)
);

-- Indexes for highlight_note_connections
CREATE INDEX IF NOT EXISTS idx_highlight_note_highlight ON highlight_note_connections(highlight_id);
CREATE INDEX IF NOT EXISTS idx_highlight_note_note ON highlight_note_connections(note_id);
CREATE INDEX IF NOT EXISTS idx_highlight_note_user ON highlight_note_connections(user_id);

-- Row Level Security
ALTER TABLE highlight_note_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own highlight-note connections" ON highlight_note_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own highlight-note connections" ON highlight_note_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlight-note connections" ON highlight_note_connections
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. COGNITIVE CONCEPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_concepts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Concept identification
  concept_text TEXT NOT NULL, -- e.g., "machine learning", "quantum physics"
  concept_embedding vector(768), -- For similarity matching
  
  -- First appearance
  first_seen_in_document_id UUID REFERENCES user_books(id) ON DELETE SET NULL,
  first_seen_in_highlight_id UUID REFERENCES user_highlights(id) ON DELETE SET NULL,
  first_seen_in_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Concept metadata
  frequency INTEGER DEFAULT 1, -- How many times user engaged with this concept
  importance_score DECIMAL(5,2) DEFAULT 0, -- Calculated from engagement
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique concepts per user
  UNIQUE(user_id, concept_text)
);

-- Indexes for cognitive_concepts
CREATE INDEX IF NOT EXISTS idx_concepts_user_id ON cognitive_concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_text ON cognitive_concepts(user_id, concept_text);
CREATE INDEX IF NOT EXISTS idx_concepts_frequency ON cognitive_concepts(user_id, frequency DESC);
CREATE INDEX IF NOT EXISTS idx_concepts_importance ON cognitive_concepts(user_id, importance_score DESC);

-- Vector index for concept similarity
CREATE INDEX IF NOT EXISTS idx_concepts_embedding ON cognitive_concepts 
  USING ivfflat (concept_embedding vector_cosine_ops) WITH (lists = 50)
  WHERE concept_embedding IS NOT NULL;

-- Row Level Security
ALTER TABLE cognitive_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own concepts" ON cognitive_concepts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own concepts" ON cognitive_concepts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own concepts" ON cognitive_concepts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own concepts" ON cognitive_concepts
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_cognitive_concepts_updated_at 
  BEFORE UPDATE ON cognitive_concepts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. CONCEPT OCCURRENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS concept_occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  concept_id UUID REFERENCES cognitive_concepts(id) ON DELETE CASCADE NOT NULL,
  
  -- Where concept appears
  occurrence_type TEXT CHECK (occurrence_type IN ('highlight', 'note', 'document')) NOT NULL,
  occurrence_id UUID NOT NULL, -- highlight_id, note_id, or book_id
  
  -- Context
  context_text TEXT, -- Surrounding text
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for concept_occurrences
CREATE INDEX IF NOT EXISTS idx_concept_occurrences_concept ON concept_occurrences(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_occurrences_type ON concept_occurrences(occurrence_type, occurrence_id);
CREATE INDEX IF NOT EXISTS idx_concept_occurrences_user ON concept_occurrences(user_id);
CREATE INDEX IF NOT EXISTS idx_concept_occurrences_created ON concept_occurrences(created_at DESC);

-- Row Level Security
ALTER TABLE concept_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own concept occurrences" ON concept_occurrences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own concept occurrences" ON concept_occurrences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own concept occurrences" ON concept_occurrences
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 6. COGNITIVE PATHS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Path sequence (ordered list of items)
  path_items JSONB NOT NULL, -- Array of {type: 'document'|'note'|'highlight', id: UUID, order: INT}
  
  -- Path metadata
  path_name TEXT, -- User-given name or auto-generated
  path_type TEXT CHECK (path_type IN ('reading_flow', 'research_trail', 'concept_exploration', 'study_session')) DEFAULT 'reading_flow',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Statistics
  total_items INTEGER DEFAULT 0,
  total_documents INTEGER DEFAULT 0,
  total_notes INTEGER DEFAULT 0,
  total_highlights INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cognitive_paths
CREATE INDEX IF NOT EXISTS idx_cognitive_paths_user_id ON cognitive_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_cognitive_paths_type ON cognitive_paths(path_type);
CREATE INDEX IF NOT EXISTS idx_cognitive_paths_started ON cognitive_paths(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cognitive_paths_name ON cognitive_paths(user_id, path_name) WHERE path_name IS NOT NULL;

-- GIN index for JSONB path_items queries
CREATE INDEX IF NOT EXISTS idx_cognitive_paths_items ON cognitive_paths USING gin(path_items);

-- Row Level Security
ALTER TABLE cognitive_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cognitive paths" ON cognitive_paths
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cognitive paths" ON cognitive_paths
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cognitive paths" ON cognitive_paths
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cognitive paths" ON cognitive_paths
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_cognitive_paths_updated_at 
  BEFORE UPDATE ON cognitive_paths
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. ENHANCE DOCUMENT RELATIONSHIPS WITH COGNITIVE METADATA
-- ============================================================================

-- Add cognitive path columns to document_relationships
ALTER TABLE document_relationships
ADD COLUMN IF NOT EXISTS cognitive_path_type TEXT CHECK (cognitive_path_type IN (
  'similarity',        -- Content similarity (existing)
  'reading_flow',      -- User read B after A
  'concept_link',      -- Share same concept
  'note_connection',   -- Notes connect them
  'highlight_chain',   -- Highlights connect them
  'research_path'      -- User researched B while reading A
)),
ADD COLUMN IF NOT EXISTS path_strength DECIMAL(5,2), -- How strong is this cognitive connection
ADD COLUMN IF NOT EXISTS first_connected_at TIMESTAMPTZ, -- When did user first connect these
ADD COLUMN IF NOT EXISTS connection_count INTEGER DEFAULT 1; -- How many times user connected them

-- Index for cognitive path type
CREATE INDEX IF NOT EXISTS idx_doc_rel_cognitive_type ON document_relationships(cognitive_path_type) 
  WHERE cognitive_path_type IS NOT NULL;

-- ============================================================================
-- 8. ADD FOREIGN KEY CONSTRAINT FOR CONCEPT IN NAVIGATION LOG
-- ============================================================================

-- Now that cognitive_concepts exists, add the foreign key
ALTER TABLE document_navigation_log
ADD CONSTRAINT fk_nav_log_concept 
  FOREIGN KEY (trigger_concept_id) 
  REFERENCES cognitive_concepts(id) 
  ON DELETE SET NULL;

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to get cognitive path graph for a document
CREATE OR REPLACE FUNCTION get_cognitive_path_graph(
  book_uuid UUID,
  user_uuid UUID,
  include_types TEXT[] DEFAULT ARRAY['document', 'note', 'highlight', 'concept']
)
RETURNS TABLE (
  node_id TEXT,
  node_type TEXT,
  node_content TEXT,
  edge_type TEXT,
  edge_strength DECIMAL(5,2),
  connection_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH cognitive_nodes AS (
    -- Documents
    SELECT 
      'doc:' || ub.id::TEXT as node_id,
      'document'::TEXT as node_type,
      COALESCE(dd.user_entered_description, dd.ai_generated_description, ub.title, '') as node_content,
      ub.created_at
    FROM user_books ub
    LEFT JOIN document_descriptions dd ON dd.book_id = ub.id AND dd.user_id = user_uuid
    WHERE ub.user_id = user_uuid
    
    UNION ALL
    
    -- Notes
    SELECT 
      'note:' || un.id::TEXT,
      'note'::TEXT,
      un.content,
      un.created_at
    FROM user_notes un
    WHERE un.user_id = user_uuid
    
    UNION ALL
    
    -- Highlights
    SELECT 
      'highlight:' || uh.id::TEXT,
      'highlight'::TEXT,
      uh.highlighted_text,
      uh.created_at
    FROM user_highlights uh
    WHERE uh.user_id = user_uuid
    
    UNION ALL
    
    -- Concepts
    SELECT 
      'concept:' || cc.id::TEXT,
      'concept'::TEXT,
      cc.concept_text,
      cc.first_seen_at
    FROM cognitive_concepts cc
    WHERE cc.user_id = user_uuid
  ),
  
  cognitive_edges AS (
    -- Document relationships
    SELECT 
      'doc:' || dr.source_document_id::TEXT as from_node,
      'doc:' || dr.related_document_id::TEXT as to_node,
      COALESCE(dr.cognitive_path_type, 'similarity') as edge_type,
      dr.relevance_percentage as edge_strength,
      dr.relationship_description as connection_reason,
      dr.created_at
    FROM document_relationships dr
    WHERE dr.user_id = user_uuid
      AND dr.source_document_id = book_uuid
    
    UNION ALL
    
    -- Reading flow (navigation)
    SELECT 
      'doc:' || COALESCE(dnl.from_document_id::TEXT, 'null'),
      'doc:' || dnl.to_document_id::TEXT,
      'reading_flow'::TEXT,
      CASE 
        WHEN dnl.time_spent_seconds > 300 THEN 90.0  -- Strong if spent >5min
        WHEN dnl.time_spent_seconds > 60 THEN 70.0
        ELSE 50.0
      END as edge_strength,
      'Read after ' || COALESCE(ub.title, 'previous document') as connection_reason,
      dnl.navigation_time
    FROM document_navigation_log dnl
    LEFT JOIN user_books ub ON ub.id = dnl.from_document_id
    WHERE dnl.user_id = user_uuid
      AND (dnl.from_document_id = book_uuid OR dnl.to_document_id = book_uuid)
    
    UNION ALL
    
    -- Highlight to Note connections
    SELECT 
      'highlight:' || hnc.highlight_id::TEXT,
      'note:' || hnc.note_id::TEXT,
      'note_connection'::TEXT,
      85.0 as edge_strength,
      'Note created from highlight' as connection_reason,
      hnc.created_at
    FROM highlight_note_connections hnc
    JOIN user_highlights uh ON uh.id = hnc.highlight_id
    WHERE hnc.user_id = user_uuid
      AND uh.book_id = book_uuid
    
    UNION ALL
    
    -- Concept connections (same concept in multiple places)
    SELECT DISTINCT
      CASE 
        WHEN co1.occurrence_type = 'document' THEN 'doc:' || co1.occurrence_id::TEXT
        WHEN co1.occurrence_type = 'note' THEN 'note:' || co1.occurrence_id::TEXT
        WHEN co1.occurrence_type = 'highlight' THEN 'highlight:' || co1.occurrence_id::TEXT
      END as from_node,
      CASE 
        WHEN co2.occurrence_type = 'document' THEN 'doc:' || co2.occurrence_id::TEXT
        WHEN co2.occurrence_type = 'note' THEN 'note:' || co2.occurrence_id::TEXT
        WHEN co2.occurrence_type = 'highlight' THEN 'highlight:' || co2.occurrence_id::TEXT
      END as to_node,
      'concept_link'::TEXT,
      cc.importance_score as edge_strength,
      'Shared concept: ' || cc.concept_text as connection_reason,
      LEAST(co1.created_at, co2.created_at) as created_at
    FROM concept_occurrences co1
    JOIN concept_occurrences co2 ON co2.concept_id = co1.concept_id
    JOIN cognitive_concepts cc ON cc.id = co1.concept_id
    WHERE co1.user_id = user_uuid
      AND co2.user_id = user_uuid
      AND co1.occurrence_id != co2.occurrence_id
      AND (
        (co1.occurrence_type = 'document' AND co1.occurrence_id::UUID = book_uuid) OR
        (co2.occurrence_type = 'document' AND co2.occurrence_id::UUID = book_uuid)
      )
  )
  
  SELECT 
    ce.to_node as node_id,
    cn.node_type,
    cn.node_content,
    ce.edge_type,
    ce.edge_strength,
    ce.connection_reason,
    ce.created_at
  FROM cognitive_edges ce
  JOIN cognitive_nodes cn ON cn.node_id = ce.to_node
  WHERE ce.from_node = 'doc:' || book_uuid::TEXT
    AND cn.node_type = ANY(include_types)
  ORDER BY ce.edge_strength DESC, ce.created_at DESC;
END;
$$;

-- Function to get reading flow for a user
CREATE OR REPLACE FUNCTION get_reading_flow(
  user_uuid UUID,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  from_document_id UUID,
  from_document_title TEXT,
  to_document_id UUID,
  to_document_title TEXT,
  navigation_type TEXT,
  navigation_time TIMESTAMPTZ,
  time_spent_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dnl.from_document_id,
    ub_from.title as from_document_title,
    dnl.to_document_id,
    ub_to.title as to_document_title,
    dnl.navigation_type,
    dnl.navigation_time,
    dnl.time_spent_seconds
  FROM document_navigation_log dnl
  LEFT JOIN user_books ub_from ON ub_from.id = dnl.from_document_id
  JOIN user_books ub_to ON ub_to.id = dnl.to_document_id
  WHERE dnl.user_id = user_uuid
  ORDER BY dnl.navigation_time DESC
  LIMIT limit_count;
END;
$$;

-- Function to get concept connections
CREATE OR REPLACE FUNCTION get_concept_connections(
  concept_uuid UUID,
  user_uuid UUID
)
RETURNS TABLE (
  occurrence_type TEXT,
  occurrence_id UUID,
  context_text TEXT,
  page_number INTEGER,
  document_title TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    co.occurrence_type,
    co.occurrence_id::UUID,
    co.context_text,
    co.page_number,
    CASE 
      WHEN co.occurrence_type = 'document' THEN ub.title
      WHEN co.occurrence_type = 'note' THEN ub_note.title
      WHEN co.occurrence_type = 'highlight' THEN ub_highlight.title
      ELSE NULL
    END as document_title,
    co.created_at
  FROM concept_occurrences co
  LEFT JOIN user_books ub ON ub.id = co.occurrence_id::UUID AND co.occurrence_type = 'document'
  LEFT JOIN user_notes un_note ON un_note.id = co.occurrence_id::UUID AND co.occurrence_type = 'note'
  LEFT JOIN user_books ub_note ON ub_note.id = un_note.book_id
  LEFT JOIN user_highlights uh ON uh.id = co.occurrence_id::UUID AND co.occurrence_type = 'highlight'
  LEFT JOIN user_books ub_highlight ON ub_highlight.id = uh.book_id
  WHERE co.concept_id = concept_uuid
    AND co.user_id = user_uuid
  ORDER BY co.created_at DESC;
END;
$$;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE reading_sessions IS 'Tracks user reading sessions with temporal flow and context';
COMMENT ON TABLE document_navigation_log IS 'Logs how users navigate between documents, revealing cognitive flow';
COMMENT ON TABLE highlight_note_connections IS 'Connects highlights to notes, showing idea development';
COMMENT ON TABLE cognitive_concepts IS 'Extracted concepts that appear across documents, notes, and highlights';
COMMENT ON TABLE concept_occurrences IS 'Tracks where and when concepts appear in user content';
COMMENT ON TABLE cognitive_paths IS 'Explicit learning journeys and research trails';
COMMENT ON FUNCTION get_cognitive_path_graph IS 'Returns cognitive path graph showing all connections (documents, notes, highlights, concepts) for a given document';
COMMENT ON FUNCTION get_reading_flow IS 'Returns reading flow sequence showing how user navigated between documents';
COMMENT ON FUNCTION get_concept_connections IS 'Returns all places where a concept appears (documents, notes, highlights)';

