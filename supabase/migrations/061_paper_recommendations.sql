-- Migration: Paper Recommendations from OpenAlex
-- Stores external paper recommendations linked to user documents
-- Date: 2025-01-27

-- ============================================================================
-- PAPER_RECOMMENDATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.paper_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  source_document_id UUID REFERENCES public.user_books(id) ON DELETE CASCADE,
  
  -- OpenAlex data
  openalex_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authors JSONB, -- Array of {display_name, id, orcid}
  abstract_inverted_index JSONB, -- OpenAlex format
  publication_year INTEGER,
  cited_by_count INTEGER DEFAULT 0,
  open_access_url TEXT,
  doi TEXT,
  venue TEXT, -- Primary venue/source display name
  topics JSONB, -- Array of {display_name, id, score}
  primary_location JSONB, -- Full location object
  
  -- Recommendation metadata
  recommendation_type TEXT CHECK (recommendation_type IN ('related_works', 'cited_by', 'co_citation', 'author', 'venue', 'semantic', 'hybrid')) DEFAULT 'related_works',
  recommendation_score DECIMAL(5,2) CHECK (recommendation_score >= 0 AND recommendation_score <= 100),
  recommendation_reason TEXT,
  
  -- User interaction
  user_feedback TEXT CHECK (user_feedback IN ('relevant', 'not_relevant', 'saved', NULL)),
  saved_to_library BOOLEAN DEFAULT FALSE,
  saved_at TIMESTAMPTZ,
  
  -- Caching
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One recommendation per user per paper (can be updated)
  UNIQUE(user_id, openalex_id, source_document_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_user_id 
  ON public.paper_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_source_doc 
  ON public.paper_recommendations(source_document_id);
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_openalex_id 
  ON public.paper_recommendations(openalex_id);
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_type 
  ON public.paper_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_score 
  ON public.paper_recommendations(recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_cached_at 
  ON public.paper_recommendations(cached_at DESC);

-- Full-text search on title and abstract
CREATE INDEX IF NOT EXISTS idx_paper_recommendations_fts 
  ON public.paper_recommendations USING gin(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(abstract_inverted_index::text, ''))
  );

-- Row Level Security
ALTER TABLE public.paper_recommendations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own paper recommendations" ON public.paper_recommendations;
DROP POLICY IF EXISTS "Users can create own paper recommendations" ON public.paper_recommendations;
DROP POLICY IF EXISTS "Users can update own paper recommendations" ON public.paper_recommendations;
DROP POLICY IF EXISTS "Users can delete own paper recommendations" ON public.paper_recommendations;

CREATE POLICY "Users can read own paper recommendations" ON public.paper_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own paper recommendations" ON public.paper_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paper recommendations" ON public.paper_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own paper recommendations" ON public.paper_recommendations
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
-- Drop trigger if it exists (idempotent migration)
DROP TRIGGER IF EXISTS update_paper_recommendations_updated_at ON public.paper_recommendations CASCADE;

CREATE TRIGGER update_paper_recommendations_updated_at 
  BEFORE UPDATE ON public.paper_recommendations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get paper recommendations for a document
CREATE OR REPLACE FUNCTION get_paper_recommendations(
  source_doc_id UUID,
  user_id_param UUID,
  limit_count INTEGER DEFAULT 20,
  min_score DECIMAL DEFAULT 0,
  recommendation_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  openalex_id TEXT,
  title TEXT,
  authors JSONB,
  abstract_inverted_index JSONB,
  publication_year INTEGER,
  cited_by_count INTEGER,
  open_access_url TEXT,
  doi TEXT,
  venue TEXT,
  topics JSONB,
  recommendation_type TEXT,
  recommendation_score DECIMAL,
  recommendation_reason TEXT,
  user_feedback TEXT,
  saved_to_library BOOLEAN,
  cached_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.openalex_id,
    pr.title,
    pr.authors,
    pr.abstract_inverted_index,
    pr.publication_year,
    pr.cited_by_count,
    pr.open_access_url,
    pr.doi,
    pr.venue,
    pr.topics,
    pr.recommendation_type,
    pr.recommendation_score,
    pr.recommendation_reason,
    pr.user_feedback,
    pr.saved_to_library,
    pr.cached_at
  FROM public.paper_recommendations pr
  WHERE pr.source_document_id = source_doc_id
    AND pr.user_id = user_id_param
    AND pr.recommendation_score >= min_score
    AND (recommendation_type_filter IS NULL OR pr.recommendation_type = recommendation_type_filter)
  ORDER BY pr.recommendation_score DESC, pr.cited_by_count DESC
  LIMIT limit_count;
END;
$$;

-- Function to update user feedback on a recommendation
CREATE OR REPLACE FUNCTION update_paper_recommendation_feedback(
  recommendation_id UUID,
  user_id_param UUID,
  feedback TEXT,
  saved_to_library BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.paper_recommendations
  SET 
    user_feedback = feedback,
    saved_to_library = saved_to_library,
    saved_at = CASE WHEN saved_to_library THEN NOW() ELSE saved_at END,
    updated_at = NOW()
  WHERE id = recommendation_id
    AND user_id = user_id_param;
  
  RETURN FOUND;
END;
$$;

-- Function to check if a paper is already in user's library (by DOI or title)
CREATE OR REPLACE FUNCTION is_paper_in_library(
  user_id_param UUID,
  paper_doi TEXT,
  paper_title TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  found_count INTEGER;
BEGIN
  -- Check by DOI if provided
  IF paper_doi IS NOT NULL AND paper_doi != '' THEN
    SELECT COUNT(*) INTO found_count
    FROM public.user_books
    WHERE user_id = user_id_param
      AND custom_metadata->>'doi' = paper_doi
      AND archived_at IS NULL;
    
    IF found_count > 0 THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Check by title similarity (simple match, can be improved)
  SELECT COUNT(*) INTO found_count
  FROM public.user_books
  WHERE user_id = user_id_param
    AND LOWER(TRIM(title)) = LOWER(TRIM(paper_title))
    AND archived_at IS NULL;
  
  RETURN found_count > 0;
END;
$$;
