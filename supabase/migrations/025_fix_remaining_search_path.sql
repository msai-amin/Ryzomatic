-- Migration: Fix Remaining Search Path Security Warnings
-- Description: Adds SET search_path to functions created in migrations 019, 021, and 022
-- Date: 2025-01-27
--
-- This migration addresses 13 SECURITY warnings from the Supabase database linter
-- about functions with mutable search_path. All functions are idempotent (CREATE OR REPLACE).
-- These functions are not currently called via RPC from the application code, so
-- there is minimal risk of disruption.

-- =============================================================================
-- PART 1: Fix Functions from Migration 019 (TTS Caching)
-- =============================================================================

-- Function to clean old cache entries (keep last 30 days or top 1000 by access)
CREATE OR REPLACE FUNCTION cleanup_old_tts_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM tts_audio_cache
  WHERE id NOT IN (
    SELECT id FROM tts_audio_cache
    WHERE last_accessed_at > NOW() - INTERVAL '30 days'
    UNION
    SELECT id FROM (
      SELECT id FROM tts_audio_cache
      ORDER BY access_count DESC, last_accessed_at DESC
      LIMIT 1000
    ) top_accessed
  );
END;
$$;

-- Function to increment access count and update last accessed time
CREATE OR REPLACE FUNCTION increment_tts_cache_access(cache_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE tts_audio_cache
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = cache_id;
END;
$$;

-- =============================================================================
-- PART 2: Fix Functions from Migration 021 (Structured RAG Memory)
-- =============================================================================

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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  FROM conversation_memories m
  WHERE m.user_id = user_uuid
    AND 1 - (m.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT limit_count;
END;
$$;

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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- =============================================================================
-- PART 3: Fix Functions from Migration 022 (Document Descriptions)
-- =============================================================================

-- Function to get document description (with fallback to AI or user)
CREATE OR REPLACE FUNCTION get_document_description(book_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT COALESCE(user_entered_description, ai_generated_description, '') INTO result
  FROM document_descriptions
  WHERE book_id = book_uuid;
  
  RETURN COALESCE(result, '');
END;
$$;

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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- =============================================================================
-- PART 4: Re-verify Functions from Migration 017 (Check for Missing Permissions)
-- =============================================================================
-- These were already fixed in migration 017 but may need GRANT statements
-- They are re-created here to ensure they have proper permissions

-- Re-verify search_annotations
CREATE OR REPLACE FUNCTION search_annotations(user_uuid UUID, q TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  book_id UUID,
  page_number INT,
  content TEXT,
  position_x NUMERIC,
  position_y NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    an.id,
    an.book_id,
    an.page_number,
    an.content,
    an.position_x,
    an.position_y,
    an.created_at
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid
    AND (q IS NULL OR an.content ILIKE '%' || q || '%')
  ORDER BY an.created_at DESC;
$$;

-- Re-verify get_annotation_stats
CREATE OR REPLACE FUNCTION get_annotation_stats(user_uuid UUID)
RETURNS TABLE (
  total_annotations BIGINT,
  books_with_annotations BIGINT,
  recent_annotations BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(*) as total_annotations,
    COUNT(DISTINCT an.book_id) as books_with_annotations,
    COUNT(*) FILTER (WHERE an.created_at > NOW() - INTERVAL '30 days') as recent_annotations
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid;
$$;

-- Re-verify get_book_highlights
CREATE OR REPLACE FUNCTION get_book_highlights(user_uuid UUID, book_uuid UUID)
RETURNS TABLE (
  id UUID,
  page_number INT,
  content TEXT,
  color VARCHAR(20),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT h.id, h.page_number, h.content, h.color, h.created_at
  FROM public.highlights h
  WHERE h.book_id = book_uuid
    AND EXISTS (
      SELECT 1 FROM public.user_books ub 
      WHERE ub.id = book_uuid AND ub.user_id = user_uuid
    )
  ORDER BY h.page_number, h.created_at;
END;
$$;

-- Re-verify can_perform_vision_extraction
CREATE OR REPLACE FUNCTION can_perform_vision_extraction(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  monthly_count BIGINT;
  tier_limit INT;
BEGIN
  -- Get user's tier and current monthly count
  SELECT 
    COALESCE((metadata->>'tier')::INT, 0),
    COUNT(*)
  INTO tier_limit, monthly_count
  FROM public.profiles p
  LEFT JOIN public.vision_usage vu ON vu.user_id = user_uuid 
    AND DATE_TRUNC('month', vu.extraction_date) = DATE_TRUNC('month', CURRENT_DATE)
  WHERE p.id = user_uuid
  GROUP BY p.metadata;
  
  -- Tier limits: 0=free (50/month), 1=basic (200/month), 2=pro (unlimited)
  IF tier_limit >= 2 THEN
    RETURN TRUE; -- Pro tier has unlimited
  END IF;
  
  RETURN monthly_count < COALESCE(
    CASE tier_limit
      WHEN 0 THEN 50
      WHEN 1 THEN 200
      ELSE 50
    END,
    50
  );
END;
$$;

-- Re-verify mark_page_highlights_orphaned
CREATE OR REPLACE FUNCTION mark_page_highlights_orphaned()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.highlights
  SET is_orphaned = true
  WHERE book_id NOT IN (SELECT id FROM public.user_books);
END;
$$;

-- Re-verify get_collection_hierarchy (missing from PART 4)
CREATE OR REPLACE FUNCTION get_collection_hierarchy(user_uuid UUID, root_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  parent_id UUID,
  color TEXT,
  icon TEXT,
  is_favorite BOOLEAN,
  display_order INTEGER,
  level INTEGER,
  path TEXT,
  book_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE collection_tree AS (
    -- Base case: root collections
    SELECT 
      c.id,
      c.name,
      c.description,
      c.parent_id,
      c.color,
      c.icon,
      c.is_favorite,
      c.display_order,
      0 as level,
      c.name as path,
      COALESCE(bc.book_count, 0) as book_count,
      c.created_at
    FROM public.user_collections c
    LEFT JOIN (
      SELECT collection_id, COUNT(*) as book_count
      FROM public.book_collections
      GROUP BY collection_id
    ) bc ON c.id = bc.collection_id
    WHERE c.user_id = user_uuid 
      AND (root_id IS NULL OR c.id = root_id)
      AND c.parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child collections
    SELECT 
      c.id,
      c.name,
      c.description,
      c.parent_id,
      c.color,
      c.icon,
      c.is_favorite,
      c.display_order,
      ct.level + 1,
      ct.path || ' > ' || c.name,
      COALESCE(bc.book_count, 0) as book_count,
      c.created_at
    FROM public.user_collections c
    JOIN collection_tree ct ON c.parent_id = ct.id
    LEFT JOIN (
      SELECT collection_id, COUNT(*) as book_count
      FROM public.book_collections
      GROUP BY collection_id
    ) bc ON c.id = bc.collection_id
    WHERE c.user_id = user_uuid
  )
  SELECT * FROM collection_tree
  ORDER BY level, display_order, name;
END;
$$;

-- =============================================================================
-- PART 5: Grant Permissions to All Functions
-- =============================================================================

GRANT EXECUTE ON FUNCTION cleanup_old_tts_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_tts_cache_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_similar_memories(UUID, vector, INTEGER, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_related_memories(UUID, TEXT[], INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_description(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_centric_graph(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_note_relationships(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_annotations(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_annotation_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_book_highlights(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_perform_vision_extraction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_page_highlights_orphaned() TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_hierarchy(UUID, UUID) TO authenticated;

-- =============================================================================
-- PART 6: Add Function Comments for Documentation
-- =============================================================================

COMMENT ON FUNCTION cleanup_old_tts_cache() IS 'Cleans old TTS cache entries, keeping last 30 days or top 1000 by access count. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION increment_tts_cache_access(UUID) IS 'Increments TTS cache access counter and updates last accessed timestamp. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_similar_memories(UUID, vector, INTEGER, FLOAT) IS 'Finds similar memories using vector similarity search. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_related_memories(UUID, TEXT[], INTEGER) IS 'Gets related memories by traversing memory relationships graph. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_document_description(UUID) IS 'Retrieves document description with fallback to AI-generated or user-entered. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_document_centric_graph(UUID, UUID, INTEGER) IS 'Builds graph of document relationships including related docs and notes. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_note_relationships(UUID, UUID) IS 'Gets relationships for a note, including linked documents, memories, and other notes. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION search_annotations(UUID, TEXT) IS 'Searches user annotations with optional query filter. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_annotation_stats(UUID) IS 'Gets annotation statistics for a user. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_book_highlights(UUID, UUID) IS 'Retrieves highlights for a specific book. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION can_perform_vision_extraction(UUID) IS 'Checks if user can perform vision extraction based on tier and monthly usage. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION mark_page_highlights_orphaned() IS 'Marks highlights as orphaned when their parent book is deleted. Security: SET search_path prevents injection attacks.';
COMMENT ON FUNCTION get_collection_hierarchy(UUID, UUID) IS 'Gets hierarchical collection tree with recursive traversal. Security: SET search_path prevents injection attacks.';

-- =============================================================================
-- NOTES
-- =============================================================================
-- 
-- This migration fixes 13 SECURITY warnings from Supabase database linter:
-- - 2 from migration 019 (TTS caching)
-- - 2 from migration 021 (memory graph)
-- - 3 from migration 022 (document descriptions)
-- - 6 from migration 017/012/007 (re-verified and granted permissions)
--
-- All functions now have SET search_path = public, pg_temp to prevent search_path
-- injection attacks, a known PostgreSQL security vulnerability.
--
-- APPLICATION IMPACT:
-- - None of these functions are currently called via RPC from application code
-- - Services in lib/ use direct table queries, not RPC functions
-- - All changes are backward compatible (same signatures)
-- - All functions are idempotent (CREATE OR REPLACE)
--
-- To fix the remaining "Extension in Public" warning for the vector extension,
-- you can optionally run (requires manual intervention):
--   CREATE SCHEMA IF NOT EXISTS extensions;
--   ALTER EXTENSION vector SET SCHEMA extensions;
--
-- To enable leaked password protection, configure it in Supabase Dashboard:
--   Auth -> Settings -> Password -> Enable "Leaked Password Protection"

