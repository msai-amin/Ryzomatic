-- Migration: User Interest Profiles
-- Caches aggregated user interest profiles based on notes and highlights
-- Date: 2025-01-27

-- ============================================================================
-- ENSURE PGVECTOR EXTENSION IS ENABLED
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- USER INTEREST PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_interest_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Aggregated interest vector (average of all note/highlight embeddings)
  interest_vector vector(768),
  
  -- Top concepts extracted from notes/highlights
  top_concepts JSONB DEFAULT '[]', -- Array of {concept: string, frequency: number, importance: float}
  
  -- Interest trends (how interests change over time)
  interest_trends JSONB DEFAULT '{}', -- {emerging: [], declining: [], stable: []}
  
  -- Statistics
  total_notes_analyzed INTEGER DEFAULT 0,
  total_highlights_analyzed INTEGER DEFAULT 0,
  analysis_period_days INTEGER DEFAULT 30,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_interest_profiles_user_id ON user_interest_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_profiles_updated ON user_interest_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_interest_profiles_vector ON user_interest_profiles USING hnsw (interest_vector vector_cosine_ops) WHERE interest_vector IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_interest_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own interest profile" ON user_interest_profiles;
CREATE POLICY "Users can read own interest profile" ON user_interest_profiles
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own interest profile" ON user_interest_profiles;
CREATE POLICY "Users can update own interest profile" ON user_interest_profiles
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage interest profiles" ON user_interest_profiles;
CREATE POLICY "Service role can manage interest profiles" ON user_interest_profiles
  FOR ALL USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create interest profile
CREATE OR REPLACE FUNCTION get_or_create_interest_profile(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
BEGIN
  SELECT id INTO profile_id
  FROM user_interest_profiles
  WHERE user_id = p_user_id;
  
  IF profile_id IS NULL THEN
    INSERT INTO user_interest_profiles (user_id)
    VALUES (p_user_id)
    RETURNING id INTO profile_id;
  END IF;
  
  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update interest profile
CREATE OR REPLACE FUNCTION update_interest_profile(
  p_user_id UUID,
  p_interest_vector vector(768) DEFAULT NULL,
  p_top_concepts JSONB DEFAULT NULL,
  p_interest_trends JSONB DEFAULT NULL,
  p_total_notes INTEGER DEFAULT NULL,
  p_total_highlights INTEGER DEFAULT NULL,
  p_analysis_period_days INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Ensure profile exists
  PERFORM get_or_create_interest_profile(p_user_id);
  
  UPDATE user_interest_profiles
  SET 
    interest_vector = COALESCE(p_interest_vector, interest_vector),
    top_concepts = COALESCE(p_top_concepts, top_concepts),
    interest_trends = COALESCE(p_interest_trends, interest_trends),
    total_notes_analyzed = COALESCE(p_total_notes, total_notes_analyzed),
    total_highlights_analyzed = COALESCE(p_total_highlights, total_highlights_analyzed),
    analysis_period_days = COALESCE(p_analysis_period_days, analysis_period_days),
    last_analyzed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find similar users based on interest profiles
CREATE OR REPLACE FUNCTION find_similar_users(
  p_user_id UUID,
  similarity_threshold FLOAT DEFAULT 0.75,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  similarity FLOAT
) AS $$
DECLARE
  user_interest_vector vector(768);
BEGIN
  -- Get user's interest vector
  SELECT interest_vector INTO user_interest_vector
  FROM user_interest_profiles
  WHERE user_id = p_user_id;
  
  IF user_interest_vector IS NULL THEN
    RETURN;
  END IF;
  
  -- Find similar users
  RETURN QUERY
  SELECT 
    p.user_id,
    1 - (p.interest_vector <=> user_interest_vector) as similarity
  FROM user_interest_profiles p
  WHERE p.user_id != p_user_id
    AND p.interest_vector IS NOT NULL
    AND (1 - (p.interest_vector <=> user_interest_vector)) >= similarity_threshold
  ORDER BY p.interest_vector <=> user_interest_vector
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_user_interest_profiles_updated_at 
BEFORE UPDATE ON user_interest_profiles
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_interest_profiles IS 'Cached aggregated interest profiles for users based on their notes and highlights';
COMMENT ON COLUMN user_interest_profiles.interest_vector IS 'Aggregated vector embedding representing user interests (average of note/highlight embeddings)';
COMMENT ON COLUMN user_interest_profiles.top_concepts IS 'Top concepts extracted from user notes/highlights with frequency and importance scores';
COMMENT ON COLUMN user_interest_profiles.interest_trends IS 'Trending concepts: emerging (new), declining (less frequent), stable (consistent)';

