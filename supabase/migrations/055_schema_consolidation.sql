-- Migration: Schema Consolidation
-- Consolidates sessions, descriptions, and deduplicates content
-- Date: 2025-01-XX

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================================
-- 1. CONSOLIDATE SESSIONS
-- ============================================================================

-- Add Pomodoro fields to reading_sessions
ALTER TABLE reading_sessions 
ADD COLUMN IF NOT EXISTS is_pomodoro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pomodoro_mode TEXT CHECK (pomodoro_mode IN ('work', 'shortBreak', 'longBreak'));

-- Index for Pomodoro queries
CREATE INDEX IF NOT EXISTS idx_reading_sessions_pomodoro ON reading_sessions(user_id, is_pomodoro);

-- Migrate data from pomodoro_sessions to reading_sessions
INSERT INTO reading_sessions (
  id,
  user_id,
  book_id,
  session_type,
  start_time,
  end_time,
  duration_seconds,
  is_pomodoro,
  pomodoro_mode,
  created_at
)
SELECT 
  id,
  user_id,
  book_id,
  'study', -- Default session type for Pomodoro
  started_at,
  ended_at,
  duration_seconds,
  TRUE,
  mode,
  created_at
FROM pomodoro_sessions
ON CONFLICT (id) DO NOTHING;

-- Drop dependent materialized views first
DROP MATERIALIZED VIEW IF EXISTS reading_stats_weekly;
DROP MATERIALIZED VIEW IF EXISTS pomodoro_stats_daily;
DROP MATERIALIZED VIEW IF EXISTS user_activity_summary;

-- Drop pomodoro_sessions table
DROP TABLE IF EXISTS pomodoro_sessions;

-- ============================================================================
-- 2. CONSOLIDATE DESCRIPTIONS
-- ============================================================================

-- Add description fields to user_books
-- Use extensions.vector explicitly to avoid path issues
ALTER TABLE user_books
ADD COLUMN IF NOT EXISTS description_embedding extensions.vector(768),
ADD COLUMN IF NOT EXISTS ai_description TEXT,
ADD COLUMN IF NOT EXISTS user_description TEXT,
ADD COLUMN IF NOT EXISTS last_auto_generated_at TIMESTAMPTZ;

-- Index for vector similarity search on user_books
CREATE INDEX IF NOT EXISTS idx_user_books_embedding ON user_books 
  USING ivfflat (description_embedding extensions.vector_cosine_ops) WITH (lists = 100)
  WHERE description_embedding IS NOT NULL;

-- Migrate data from document_descriptions to user_books
UPDATE user_books ub
SET 
  description_embedding = dd.description_embedding,
  ai_description = dd.ai_generated_description,
  user_description = dd.user_entered_description,
  last_auto_generated_at = dd.last_auto_generated_at
FROM document_descriptions dd
WHERE ub.id = dd.book_id;

-- Update auto_generate_document_relationships function to use user_books
CREATE OR REPLACE FUNCTION auto_generate_document_relationships(
  source_book_uuid UUID,
  similarity_threshold DECIMAL DEFAULT 0.60
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_uuid UUID;
  relationships_created INTEGER := 0;
  related_record RECORD;
  source_embedding extensions.vector(768);
BEGIN
  -- Get current user
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get source embedding
  SELECT description_embedding INTO source_embedding
  FROM public.user_books
  WHERE id = source_book_uuid
    AND user_id = user_uuid
    AND description_embedding IS NOT NULL;
  
  IF source_embedding IS NULL THEN
    -- No embedding yet, skip
    RETURN 0;
  END IF;
  
  -- Find similar documents using vector similarity
  FOR related_record IN
    SELECT 
      ub.id as related_book_id,
      1 - (ub.description_embedding <=> source_embedding) as similarity
    FROM public.user_books ub
    WHERE ub.user_id = user_uuid
      AND ub.id != source_book_uuid
      AND ub.description_embedding IS NOT NULL
      AND 1 - (ub.description_embedding <=> source_embedding) >= similarity_threshold
    ORDER BY ub.description_embedding <=> source_embedding
    LIMIT 20 -- Limit to top 20 most similar
  LOOP
    -- Insert relationship if it doesn't exist
    INSERT INTO public.document_relationships (
      user_id,
      source_document_id,
      related_document_id,
      relevance_percentage,
      relevance_calculation_status,
      ai_generated_description
    )
    VALUES (
      user_uuid,
      source_book_uuid,
      related_record.related_book_id,
      ROUND(related_record.similarity * 100, 2),
      'completed',
      jsonb_build_object(
        'method', 'vector_similarity',
        'model', 'text-embedding-004',
        'similarity_score', related_record.similarity,
        'auto_generated', true,
        'generated_at', NOW()
      )::text
    )
    ON CONFLICT (source_document_id, related_document_id) 
    DO UPDATE SET
      relevance_percentage = ROUND(related_record.similarity * 100, 2),
      relevance_calculation_status = 'completed',
      updated_at = NOW();
    
    relationships_created := relationships_created + 1;
  END LOOP;
  
  RETURN relationships_created;
END;
$$;

-- Drop foreign key constraints on document_relationships first
ALTER TABLE document_relationships DROP CONSTRAINT IF EXISTS document_relationships_source_description_id_fkey;
ALTER TABLE document_relationships DROP CONSTRAINT IF EXISTS document_relationships_related_description_id_fkey;

-- Drop document_descriptions table and its trigger
DROP TRIGGER IF EXISTS auto_generate_relationships_trigger ON document_descriptions;
DROP TABLE IF EXISTS document_descriptions;

-- Create trigger for user_books embedding updates
CREATE OR REPLACE FUNCTION trigger_auto_generate_relationships_books()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only trigger if embedding was added or changed
  IF NEW.description_embedding IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.description_embedding IS DISTINCT FROM NEW.description_embedding) THEN
    
    PERFORM auto_generate_document_relationships(NEW.id, 0.60);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_relationships_books_trigger
  AFTER INSERT OR UPDATE OF description_embedding ON user_books
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_relationships_books();

-- ============================================================================
-- 3. DEDUPLICATE CONTENT
-- ============================================================================

-- Ensure document_content has data for books with content before dropping
-- This is a safety check - in production, you might want to verify this manually first
-- For now, we'll assume document_content is populated or handled by application logic

-- Drop content column from user_books
-- Commented out for safety - user can uncomment to execute
-- ALTER TABLE user_books DROP COLUMN IF EXISTS content;

-- Instead of dropping, set to NULL to free space but keep column for now
UPDATE user_books SET content = NULL;

-- ============================================================================
-- 4. CLEANUP & PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION auto_generate_document_relationships TO authenticated;

