-- Migration: Paper Embeddings and Pre-computation System
-- Adds embedding support, interaction tracking, and pre-computation infrastructure
-- Date: 2025-01-27

-- ============================================================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- UPDATE PAPER_RECOMMENDATIONS TABLE
-- ============================================================================

-- Add embedding column for pre-computed embeddings
ALTER TABLE public.paper_recommendations 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add pre-computation tracking
ALTER TABLE public.paper_recommendations 
ADD COLUMN IF NOT EXISTS precomputed_at TIMESTAMPTZ;

-- Add interaction tracking columns
ALTER TABLE public.paper_recommendations 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Create HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_embedding 
ON public.paper_recommendations USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Create composite index for popularity queries
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_popularity 
ON public.paper_recommendations((view_count + click_count * 2 + save_count * 5) DESC)
WHERE (view_count + click_count + save_count) > 0;

-- Index for pre-computed papers
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_precomputed 
ON public.paper_recommendations(precomputed_at DESC)
WHERE precomputed_at IS NOT NULL;

-- ============================================================================
-- POPULAR_PAPERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.popular_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  openalex_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  
  -- Popularity metrics
  popularity_score DECIMAL(10,4) DEFAULT 0,
  global_citations INTEGER DEFAULT 0,
  recent_citations INTEGER DEFAULT 0,
  user_interactions INTEGER DEFAULT 0,
  recommendation_frequency INTEGER DEFAULT 0,
  user_feedback_score DECIMAL(5,4) DEFAULT 0,
  
  -- Discovery metadata
  discovery_method TEXT CHECK (discovery_method IN ('most_cited', 'trending', 'user_interacted', 'frequently_recommended', 'topic_based', 'hybrid')),
  topics JSONB, -- Array of topic IDs from OpenAlex
  
  -- Pre-computation status
  precomputed BOOLEAN DEFAULT FALSE,
  precomputed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for popular_papers
CREATE INDEX IF NOT EXISTS idx_popular_papers_openalex_id 
ON public.popular_papers(openalex_id);

CREATE INDEX IF NOT EXISTS idx_popular_papers_popularity_score 
ON public.popular_papers(popularity_score DESC);

CREATE INDEX IF NOT EXISTS idx_popular_papers_precomputed 
ON public.popular_papers(precomputed, popularity_score DESC);

CREATE INDEX IF NOT EXISTS idx_popular_papers_discovery_method 
ON public.popular_papers(discovery_method);

-- Row Level Security
ALTER TABLE public.popular_papers ENABLE ROW LEVEL SECURITY;

-- Service role can manage popular papers
DROP POLICY IF EXISTS "Service role can manage popular papers" ON public.popular_papers;
CREATE POLICY "Service role can manage popular papers" ON public.popular_papers
  FOR ALL USING (true);

-- Users can read popular papers
DROP POLICY IF EXISTS "Users can read popular papers" ON public.popular_papers;
CREATE POLICY "Users can read popular papers" ON public.popular_papers
  FOR SELECT USING (true);

-- Trigger for last_updated
DROP TRIGGER IF EXISTS update_popular_papers_updated_at ON public.popular_papers;
CREATE TRIGGER update_popular_papers_updated_at 
  BEFORE UPDATE ON public.popular_papers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PAPER_EMBEDDING_JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.paper_embedding_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Job metadata
  job_type TEXT NOT NULL CHECK (job_type IN ('batch_precompute', 'single_paper', 'popular_papers_update', 'trending_refresh')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  priority INTEGER DEFAULT 5, -- 1-10, higher = more important
  
  -- Batch job tracking
  papers_total INTEGER DEFAULT 0,
  papers_processed INTEGER DEFAULT 0,
  papers_failed INTEGER DEFAULT 0,
  
  -- Job parameters
  parameters JSONB DEFAULT '{}', -- Store method, limit, batchSize, etc.
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for paper_embedding_jobs
CREATE INDEX IF NOT EXISTS idx_paper_embedding_jobs_status 
ON public.paper_embedding_jobs(status) 
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_paper_embedding_jobs_priority 
ON public.paper_embedding_jobs(priority DESC, created_at ASC) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_paper_embedding_jobs_type 
ON public.paper_embedding_jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_paper_embedding_jobs_created 
ON public.paper_embedding_jobs(created_at DESC);

-- Row Level Security
ALTER TABLE public.paper_embedding_jobs ENABLE ROW LEVEL SECURITY;

-- Service role can manage jobs
DROP POLICY IF EXISTS "Service role can manage paper embedding jobs" ON public.paper_embedding_jobs;
CREATE POLICY "Service role can manage paper embedding jobs" ON public.paper_embedding_jobs
  FOR ALL USING (true);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION find_similar_papers_by_embedding(
  query_embedding vector(768),
  similarity_threshold DECIMAL DEFAULT 0.7,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  openalex_id TEXT,
  title TEXT,
  authors JSONB,
  abstract_inverted_index JSONB,
  publication_year INTEGER,
  cited_by_count INTEGER,
  similarity_score DECIMAL(5,4),
  recommendation_score DECIMAL(5,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.openalex_id,
    pr.title,
    pr.authors,
    pr.abstract_inverted_index,
    pr.publication_year,
    pr.cited_by_count,
    (1 - (pr.embedding <=> query_embedding))::DECIMAL(5,4) as similarity_score,
    pr.recommendation_score
  FROM public.paper_recommendations pr
  WHERE pr.embedding IS NOT NULL
    AND (1 - (pr.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY pr.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$;

-- ============================================================================
-- ANALYTICS VIEWS AND FUNCTIONS
-- ============================================================================

-- View: Paper embedding statistics
CREATE OR REPLACE VIEW paper_embedding_stats AS
SELECT 
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as total_precomputed,
  COUNT(*) FILTER (WHERE embedding IS NULL) as total_without_embedding,
  COUNT(*) as total_papers,
  ROUND(
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as coverage_percentage,
  COUNT(DISTINCT openalex_id) FILTER (WHERE embedding IS NOT NULL) as unique_papers_with_embeddings,
  MAX(precomputed_at) as latest_precomputation
FROM public.paper_recommendations;

-- View: Popular papers usage tracking
CREATE OR REPLACE VIEW popular_papers_usage AS
SELECT 
  pp.openalex_id,
  pp.title,
  pp.popularity_score,
  pp.precomputed,
  pp.precomputed_at,
  COUNT(DISTINCT pr.user_id) as user_count,
  COUNT(*) as recommendation_count,
  SUM(pr.view_count) as total_views,
  SUM(pr.click_count) as total_clicks,
  SUM(pr.save_count) as total_saves,
  AVG(pr.recommendation_score) as avg_recommendation_score
FROM public.popular_papers pp
LEFT JOIN public.paper_recommendations pr ON pr.openalex_id = pp.openalex_id
GROUP BY pp.id, pp.openalex_id, pp.title, pp.popularity_score, pp.precomputed, pp.precomputed_at
ORDER BY pp.popularity_score DESC;

-- Function: Get embedding coverage statistics
CREATE OR REPLACE FUNCTION get_embedding_coverage_stats()
RETURNS TABLE (
  total_papers BIGINT,
  precomputed_count BIGINT,
  coverage_percentage DECIMAL(5,2),
  popular_papers_count BIGINT,
  popular_papers_precomputed BIGINT,
  avg_popularity_score DECIMAL(10,4),
  latest_precomputation TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(DISTINCT openalex_id) FROM public.paper_recommendations) as total_papers,
    (SELECT COUNT(DISTINCT openalex_id) FROM public.paper_recommendations WHERE embedding IS NOT NULL) as precomputed_count,
    ROUND(
      (SELECT COUNT(DISTINCT openalex_id) FROM public.paper_recommendations WHERE embedding IS NOT NULL)::DECIMAL /
      NULLIF((SELECT COUNT(DISTINCT openalex_id) FROM public.paper_recommendations), 0) * 100,
      2
    ) as coverage_percentage,
    (SELECT COUNT(*) FROM public.popular_papers) as popular_papers_count,
    (SELECT COUNT(*) FROM public.popular_papers WHERE precomputed = TRUE) as popular_papers_precomputed,
    (SELECT AVG(popularity_score) FROM public.popular_papers) as avg_popularity_score,
    (SELECT MAX(precomputed_at) FROM public.paper_recommendations WHERE precomputed_at IS NOT NULL) as latest_precomputation;
END;
$$;

-- Function: Get popular papers for pre-computation
CREATE OR REPLACE FUNCTION get_popular_papers_for_precompute(
  min_popularity_score DECIMAL DEFAULT 0,
  limit_count INTEGER DEFAULT 10000,
  exclude_precomputed BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  openalex_id TEXT,
  title TEXT,
  popularity_score DECIMAL(10,4),
  discovery_method TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.openalex_id,
    pp.title,
    pp.popularity_score,
    pp.discovery_method
  FROM public.popular_papers pp
  WHERE pp.popularity_score >= min_popularity_score
    AND (NOT exclude_precomputed OR pp.precomputed = FALSE)
  ORDER BY pp.popularity_score DESC
  LIMIT limit_count;
END;
$$;

-- Function: Track paper interaction
CREATE OR REPLACE FUNCTION track_paper_interaction(
  p_openalex_id TEXT,
  p_user_id UUID,
  p_interaction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate interaction type
  IF p_interaction_type NOT IN ('view', 'click', 'save') THEN
    RAISE EXCEPTION 'Invalid interaction type: %. Must be one of: view, click, save', p_interaction_type;
  END IF;
  
  UPDATE public.paper_recommendations
  SET 
    view_count = CASE WHEN p_interaction_type = 'view' THEN view_count + 1 ELSE view_count END,
    click_count = CASE WHEN p_interaction_type = 'click' THEN click_count + 1 ELSE click_count END,
    save_count = CASE WHEN p_interaction_type = 'save' THEN save_count + 1 ELSE save_count END,
    last_viewed_at = CASE WHEN p_interaction_type = 'view' THEN NOW() ELSE last_viewed_at END,
    updated_at = NOW()
  WHERE openalex_id = p_openalex_id
    AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.paper_recommendations.embedding IS 'Pre-computed vector embedding (768 dimensions) for semantic similarity search';
COMMENT ON COLUMN public.paper_recommendations.precomputed_at IS 'Timestamp when embedding was pre-computed';
COMMENT ON COLUMN public.paper_recommendations.view_count IS 'Number of times this paper was viewed by users';
COMMENT ON COLUMN public.paper_recommendations.click_count IS 'Number of times users clicked on this paper';
COMMENT ON COLUMN public.paper_recommendations.save_count IS 'Number of times users saved this paper to their library';
COMMENT ON TABLE public.popular_papers IS 'Tracks papers identified as popular for pre-computation';
COMMENT ON TABLE public.paper_embedding_jobs IS 'Tracks batch jobs for paper embedding pre-computation';
COMMENT ON FUNCTION find_similar_papers_by_embedding IS 'Find papers similar to a query embedding using vector cosine similarity';
COMMENT ON FUNCTION get_embedding_coverage_stats IS 'Get statistics about embedding pre-computation coverage';
COMMENT ON FUNCTION track_paper_interaction IS 'Track user interactions (view/click/save) with paper recommendations';

