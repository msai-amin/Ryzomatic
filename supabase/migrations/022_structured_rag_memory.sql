-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversation memories (extracted semantic entities)
CREATE TABLE conversation_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'concept', 'question', 'insight', 'reference', 'action', 'document'
  entity_text TEXT NOT NULL,
  entity_metadata JSONB DEFAULT '{}',
  source_message_id UUID REFERENCES messages(id),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  embedding vector(768), -- Gemini text-embedding-004
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory relationships (connect related memories)
CREATE TABLE memory_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  memory_from UUID REFERENCES conversation_memories(id) ON DELETE CASCADE,
  memory_to UUID REFERENCES conversation_memories(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'relates_to', 'contradicts', 'supports', 'cites', 'explains'
  strength DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action cache (natural language → typed actions)
CREATE TABLE action_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  natural_language TEXT NOT NULL,
  action_schema JSONB NOT NULL,
  action_type TEXT NOT NULL, -- 'highlight', 'create_note', 'search', etc.
  embedding vector(768),
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory extraction jobs (track which conversations need extraction)
CREATE TABLE memory_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_memories_user_embedding ON conversation_memories 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memories_user_id ON conversation_memories(user_id);
CREATE INDEX idx_memories_conversation_id ON conversation_memories(conversation_id);
CREATE INDEX idx_memories_entity_type ON conversation_memories(user_id, entity_type);
CREATE INDEX idx_memories_document_id ON conversation_memories(document_id);
CREATE INDEX idx_memories_created_at ON conversation_memories(created_at DESC);

CREATE INDEX idx_relationships_user_id ON memory_relationships(user_id);
CREATE INDEX idx_relationships_from ON memory_relationships(memory_from);
CREATE INDEX idx_relationships_to ON memory_relationships(memory_to);

CREATE INDEX idx_action_cache_user_embedding ON action_cache 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_action_cache_user_id ON action_cache(user_id);
CREATE INDEX idx_action_cache_action_type ON action_cache(action_type);
CREATE INDEX idx_action_cache_hit_count ON action_cache(hit_count DESC);

CREATE INDEX idx_extraction_jobs_status ON memory_extraction_jobs(status, created_at);
CREATE INDEX idx_extraction_jobs_conversation ON memory_extraction_jobs(conversation_id);

-- Row Level Security (RLS)
ALTER TABLE conversation_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_extraction_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_memories
CREATE POLICY "Users can read own memories" ON conversation_memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert memories" ON conversation_memories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own memories" ON conversation_memories
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for memory_relationships
CREATE POLICY "Users can read own memory relationships" ON memory_relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert memory relationships" ON memory_relationships
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own memory relationships" ON memory_relationships
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for action_cache
CREATE POLICY "Users can read own action cache" ON action_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own action cache" ON action_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action cache" ON action_cache
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own action cache" ON action_cache
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for memory_extraction_jobs
CREATE POLICY "Users can read own extraction jobs" ON memory_extraction_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage extraction jobs" ON memory_extraction_jobs
  FOR ALL WITH CHECK (true);

-- Helper function to get similar memories
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.entity_type,
    m.entity_text,
    m.entity_metadata,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  FROM conversation_memories m
  WHERE m.user_id = user_uuid
    AND 1 - (m.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get related memories
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.entity_type,
    m.entity_text,
    r.relationship_type,
    r.strength
  FROM memory_relationships r
  JOIN conversation_memories m ON (
    (r.memory_to = m.id AND r.memory_from = memory_uuid) OR
    (r.memory_from = m.id AND r.memory_to = memory_uuid)
  )
  WHERE (r.memory_from = memory_uuid OR r.memory_to = memory_uuid)
    AND (array_length(relationship_filter, 1) IS NULL OR r.relationship_type = ANY(relationship_filter))
  ORDER BY r.strength DESC, r.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE TRIGGER update_extraction_jobs_updated_at 
BEFORE UPDATE ON memory_extraction_jobs
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

