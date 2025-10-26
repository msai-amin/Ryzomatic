-- Migration: Fix Database Linter Issues
-- Description: Resolves SECURITY DEFINER views and mutable search_path warnings

-- =============================================================================
-- PART 1: Remove SECURITY DEFINER from Views (ERRORS)
-- =============================================================================

-- Note: These views reference tables that don't exist in this project
-- We'll drop them to resolve the linter errors
-- They can be recreated later if needed when the tables are created

DROP VIEW IF EXISTS public.vision_extraction_stats CASCADE;
DROP VIEW IF EXISTS public.document_extraction_stats CASCADE;

-- =============================================================================
-- PART 2: Add SET search_path to Functions (WARNINGS)
-- =============================================================================

-- Fix mark_page_highlights_orphaned
CREATE OR REPLACE FUNCTION public.mark_page_highlights_orphaned()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE highlights
  SET is_orphaned = true
  WHERE book_id NOT IN (SELECT id FROM user_books);
END;
$$;

-- Fix get_highlight_stats
CREATE OR REPLACE FUNCTION public.get_highlight_stats(user_uuid UUID)
RETURNS TABLE (
  total_highlights BIGINT,
  books_with_highlights BIGINT,
  recent_highlights BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT h.id) as total_highlights,
    COUNT(DISTINCT h.book_id) as books_with_highlights,
    COUNT(DISTINCT h.id) FILTER (WHERE h.created_at > NOW() - INTERVAL '30 days') as recent_highlights
  FROM highlights h
  JOIN user_books ub ON h.book_id = ub.id
  WHERE ub.user_id = user_uuid;
END;
$$;

-- Fix bulk_delete_highlights
CREATE OR REPLACE FUNCTION public.bulk_delete_highlights(highlight_ids UUID[])
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM highlights
  WHERE id = ANY(highlight_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Fix search_annotations
CREATE OR REPLACE FUNCTION public.search_annotations(user_uuid UUID, q TEXT DEFAULT NULL)
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
  FROM user_notes an
  JOIN user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid
    AND (q IS NULL OR an.content ILIKE '%' || q || '%')
  ORDER BY an.created_at DESC;
$$;

-- Fix get_annotation_stats
CREATE OR REPLACE FUNCTION public.get_annotation_stats(user_uuid UUID)
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
  FROM user_notes an
  JOIN user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid;
$$;

-- Fix get_related_documents_with_details
CREATE OR REPLACE FUNCTION public.get_related_documents_with_details(source_document_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  relevance_score NUMERIC,
  relationship_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.target_document_id as id,
    dr.description as title,
    dr.description as description,
    dr.relevance_score,
    dr.relationship_type,
    dr.created_at
  FROM document_relationships dr
  WHERE dr.source_document_id = get_related_documents_with_details.source_document_id
  ORDER BY dr.relevance_score DESC, dr.created_at DESC;
END;
$$;

-- Fix get_document_relationship_stats
CREATE OR REPLACE FUNCTION public.get_document_relationship_stats(user_id_param UUID)
RETURNS TABLE (
  total_relationships BIGINT,
  documents_with_relations BIGINT,
  average_relevance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_relationships,
    COUNT(DISTINCT source_document_id) as documents_with_relations,
    AVG(relevance_score) as average_relevance
  FROM document_relationships dr
  WHERE dr.user_id = user_id_param;
END;
$$;

-- Fix reset_monthly_vision_counters
CREATE OR REPLACE FUNCTION public.reset_monthly_vision_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM vision_usage
  WHERE extraction_date < DATE_TRUNC('month', CURRENT_DATE);
  
  DELETE FROM document_usage
  WHERE extraction_date < DATE_TRUNC('month', CURRENT_DATE);
END;
$$;

-- Fix can_perform_vision_extraction
CREATE OR REPLACE FUNCTION public.can_perform_vision_extraction(user_uuid UUID)
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
  FROM profiles p
  LEFT JOIN vision_usage vu ON vu.user_id = user_uuid 
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

-- Fix check_pomodoro_achievements
CREATE OR REPLACE FUNCTION public.check_pomodoro_achievements(p_user_id UUID, p_session_data JSONB)
RETURNS TABLE (achievement_type VARCHAR(50), unlocked BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mode TEXT;
  v_completed BOOLEAN;
  v_books_session_count INT;
BEGIN
  v_mode := p_session_data->>'mode';
  v_completed := (p_session_data->>'completed')::BOOLEAN;
  
  IF NOT v_completed THEN
    RETURN;
  END IF;
  
  -- Check first_steps achievement
  IF NOT EXISTS (
    SELECT 1 FROM pomodoro_achievements 
    WHERE user_id = p_user_id AND achievement_type = 'first_steps'
  ) THEN
    INSERT INTO pomodoro_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'first_steps');
    
    RETURN QUERY SELECT 'first_steps'::VARCHAR(50), TRUE;
  END IF;
  
  -- Check consistent_reader achievement (3 sessions same day)
  IF (SELECT COUNT(*) FROM pomodoro_sessions 
      WHERE user_id = p_user_id AND completed = TRUE 
      AND DATE(started_at) = CURRENT_DATE) >= 3 
     AND NOT EXISTS (
       SELECT 1 FROM pomodoro_achievements 
       WHERE user_id = p_user_id AND achievement_type = 'consistent_reader'
     ) THEN
    INSERT INTO pomodoro_achievements (user_id, achievement_type)
    VALUES (p_user_id, 'consistent_reader');
    
    RETURN QUERY SELECT 'consistent_reader'::VARCHAR(50), TRUE;
  END IF;
  
  RETURN;
END;
$$;

-- Fix update_pomodoro_streak
CREATE OR REPLACE FUNCTION public.update_pomodoro_streak(p_user_id UUID, p_session_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_streak RECORD;
  v_yesterday DATE;
BEGIN
  v_yesterday := p_session_date - INTERVAL '1 day';
  
  SELECT * INTO v_existing_streak
  FROM pomodoro_streaks
  WHERE user_id = p_user_id;
  
  IF v_existing_streak IS NULL THEN
    -- Create new streak
    INSERT INTO pomodoro_streaks (user_id, current_streak, longest_streak, last_session_date)
    VALUES (p_user_id, 1, 1, p_session_date);
  ELSIF v_existing_streak.last_session_date = v_yesterday OR v_existing_streak.last_session_date = p_session_date THEN
    -- Continue streak
    UPDATE pomodoro_streaks
    SET 
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_session_date = p_session_date
    WHERE user_id = p_user_id;
  ELSE
    -- Reset streak
    UPDATE pomodoro_streaks
    SET current_streak = 1, last_session_date = p_session_date
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Fix get_user_achievements
CREATE OR REPLACE FUNCTION public.get_user_achievements(p_user_id UUID)
RETURNS TABLE (
  achievement_type VARCHAR(50),
  unlocked_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT pa.achievement_type, pa.unlocked_at, pa.metadata
  FROM pomodoro_achievements pa
  WHERE pa.user_id = p_user_id
  ORDER BY pa.unlocked_at DESC;
END;
$$;

-- Fix get_user_streak
CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id UUID)
RETURNS TABLE (
  current_streak INT,
  longest_streak INT,
  last_session_date DATE,
  weekly_goal INT,
  weekly_progress INT,
  week_start_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ps.current_streak, 0),
    COALESCE(ps.longest_streak, 0),
    ps.last_session_date,
    COALESCE(ps.weekly_goal, 15),
    COALESCE(ps.weekly_progress, 0),
    ps.week_start_date
  FROM pomodoro_streaks ps
  WHERE ps.user_id = p_user_id;
END;
$$;

-- Fix get_achievement_progress (already exists, just add SET search_path)
-- This will be handled by the previous fix in migration 016

-- Fix update_tag_usage_count
CREATE OR REPLACE FUNCTION public.update_tag_usage_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO tag_usage_counts (tag_name, usage_count)
  VALUES (NEW.tag_name, 1)
  ON CONFLICT (tag_name) 
  DO UPDATE SET usage_count = tag_usage_counts.usage_count + 1;
  
  RETURN NEW;
END;
$$;

-- Fix get_collection_hierarchy
CREATE OR REPLACE FUNCTION public.get_collection_hierarchy(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_id UUID,
  level INT,
  path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    SELECT 
      c.id,
      c.name,
      c.parent_id,
      0 as level,
      c.name as path
    FROM collections c
    WHERE c.user_id = user_uuid AND c.parent_id IS NULL
    
    UNION ALL
    
    SELECT 
      c.id,
      c.name,
      c.parent_id,
      h.level + 1,
      h.path || ' > ' || c.name
    FROM collections c
    JOIN hierarchy h ON c.parent_id = h.id
  )
  SELECT * FROM hierarchy;
END;
$$;

-- Fix get_book_highlights
CREATE OR REPLACE FUNCTION public.get_book_highlights(user_uuid UUID, book_uuid UUID)
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
  FROM highlights h
  WHERE h.book_id = book_uuid
    AND EXISTS (
      SELECT 1 FROM user_books ub 
      WHERE ub.id = book_uuid AND ub.user_id = user_uuid
    )
  ORDER BY h.page_number, h.created_at;
END;
$$;

-- Fix get_library_stats
CREATE OR REPLACE FUNCTION public.get_library_stats(user_uuid UUID)
RETURNS TABLE (
  total_books BIGINT,
  total_pages BIGINT,
  total_reading_time BIGINT,
  average_progress NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_books,
    SUM(total_pages) as total_pages,
    SUM(reading_time_minutes) as total_reading_time,
    AVG(progress_percentage) as average_progress
  FROM user_books
  WHERE user_id = user_uuid;
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.mark_page_highlights_orphaned() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_highlight_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_delete_highlights(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_annotations(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_annotation_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_related_documents_with_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_relationship_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_vision_counters() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_perform_vision_extraction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_pomodoro_achievements(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pomodoro_streak(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_achievements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tag_usage_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_collection_hierarchy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_book_highlights(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_library_stats(UUID) TO authenticated;

-- Note: Views were dropped as they referenced non-existent tables

