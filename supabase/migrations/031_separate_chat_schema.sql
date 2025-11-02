-- Migration: Separate chat/RAG tables into dedicated chat schema
-- Isolates conversation and memory infrastructure from library management
-- Improves organization and enables separate scaling strategies
-- Date: 2025-01-27

-- Create chat schema
CREATE SCHEMA IF NOT EXISTS chat;

-- ============================================================================
-- MOVE TABLES TO CHAT SCHEMA
-- ============================================================================

-- Move conversations table
ALTER TABLE conversations SET SCHEMA chat;

-- Move messages table
ALTER TABLE messages SET SCHEMA chat;

-- Move conversation_memories table
ALTER TABLE conversation_memories SET SCHEMA chat;

-- Move memory_relationships table
ALTER TABLE memory_relationships SET SCHEMA chat;

-- Move action_cache table
ALTER TABLE action_cache SET SCHEMA chat;

-- Move memory_extraction_jobs table
ALTER TABLE memory_extraction_jobs SET SCHEMA chat;

-- ============================================================================
-- UPDATE RLS POLICIES FOR NEW SCHEMA
-- ============================================================================

-- Drop existing policies (they'll be recreated)
DROP POLICY IF EXISTS "Users can manage own conversations" ON chat.conversations;
DROP POLICY IF EXISTS "Users can read own messages" ON chat.messages;
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON chat.messages;
DROP POLICY IF EXISTS "Users can read own memories" ON chat.conversation_memories;
DROP POLICY IF EXISTS "Service can insert memories" ON chat.conversation_memories;
DROP POLICY IF EXISTS "Users can delete own memories" ON chat.conversation_memories;
DROP POLICY IF EXISTS "Users can read own memory relationships" ON chat.memory_relationships;
DROP POLICY IF EXISTS "Service can insert memory relationships" ON chat.memory_relationships;
DROP POLICY IF EXISTS "Users can delete own memory relationships" ON chat.memory_relationships;
DROP POLICY IF EXISTS "Users can read own action cache" ON chat.action_cache;
DROP POLICY IF EXISTS "Users can create own action cache" ON chat.action_cache;
DROP POLICY IF EXISTS "Users can update own action cache" ON chat.action_cache;
DROP POLICY IF EXISTS "Users can delete own action cache" ON chat.action_cache;
DROP POLICY IF EXISTS "Users can read own extraction jobs" ON chat.memory_extraction_jobs;
DROP POLICY IF EXISTS "Service can manage extraction jobs" ON chat.memory_extraction_jobs;

-- RLS Policies for chat.conversations
CREATE POLICY "Users can read own conversations" ON chat.conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON chat.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON chat.conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON chat.conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat.messages
CREATE POLICY "Users can read own messages" ON chat.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations" ON chat.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages" ON chat.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own messages" ON chat.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- RLS Policies for chat.conversation_memories
CREATE POLICY "Users can read own memories" ON chat.conversation_memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert memories" ON chat.conversation_memories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own memories" ON chat.conversation_memories
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat.memory_relationships
CREATE POLICY "Users can read own memory relationships" ON chat.memory_relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert memory relationships" ON chat.memory_relationships
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own memory relationships" ON chat.memory_relationships
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat.action_cache
CREATE POLICY "Users can read own action cache" ON chat.action_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own action cache" ON chat.action_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action cache" ON chat.action_cache
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own action cache" ON chat.action_cache
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat.memory_extraction_jobs
CREATE POLICY "Users can read own extraction jobs" ON chat.memory_extraction_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage extraction jobs" ON chat.memory_extraction_jobs
  FOR ALL WITH CHECK (true);

-- ============================================================================
-- UPDATE FOREIGN KEY REFERENCES
-- ============================================================================

-- conversations references need to be updated to chat schema
-- Note: Some foreign keys may need manual adjustment after this migration

-- Update conversation_id references in messages
-- (Already handled by moving the tables together)

-- ============================================================================
-- UPDATE FUNCTIONS TO REFERENCE CHAT SCHEMA
-- ============================================================================

-- Function to get similar memories (updated for chat schema)
CREATE OR REPLACE FUNCTION get_similar_memories(
  user_uuid UUID,
  query_embedding vector(768),
  limit_count INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_text TEXT,
  entity_metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.entity_type,
    m.entity_text,
    m.entity_metadata,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  FROM chat.conversation_memories m
  WHERE m.user_id = user_uuid
    AND 1 - (m.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT limit_count;
END;
$$;

-- Function to get related memories (updated for chat schema)
CREATE OR REPLACE FUNCTION get_related_memories(
  memory_uuid UUID,
  relationship_filter TEXT[] DEFAULT ARRAY[]::TEXT[],
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  related_memory_id UUID,
  entity_type TEXT,
  entity_text TEXT,
  relationship_type TEXT,
  strength DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.entity_type,
    m.entity_text,
    r.relationship_type,
    r.strength
  FROM chat.memory_relationships r
  JOIN chat.conversation_memories m ON (
    (r.memory_to = m.id AND r.memory_from = memory_uuid) OR
    (r.memory_from = m.id AND r.memory_to = memory_uuid)
  )
  WHERE (r.memory_from = memory_uuid OR r.memory_to = memory_uuid)
    AND (array_length(relationship_filter, 1) IS NULL OR r.relationship_type = ANY(relationship_filter))
  ORDER BY r.strength DESC, r.created_at DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA chat IS 
  'Schema for chat/RAG conversation and memory infrastructure. Separated from library management for better organization.';

COMMENT ON TABLE chat.conversations IS 
  'User conversations for AI chat interface. Moved to chat schema for separation.';

COMMENT ON TABLE chat.messages IS 
  'Individual messages within conversations. Moved to chat schema.';

COMMENT ON TABLE chat.conversation_memories IS 
  'Extracted semantic memories from conversations. Used for context building in AI chat.';

COMMENT ON TABLE chat.memory_relationships IS 
  'Relationships between extracted memories. Enables semantic knowledge graph.';

COMMENT ON TABLE chat.action_cache IS 
  'Cached natural language action mappings for improved AI response consistency.';

COMMENT ON TABLE chat.memory_extraction_jobs IS 
  'Job queue for background memory extraction from conversations.';

