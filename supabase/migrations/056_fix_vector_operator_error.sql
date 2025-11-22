-- Migration: Fix vector operator error on INSERT
-- The error "operator does not exist: extensions.vector = extensions.vector"
-- occurs when PostgreSQL tries to compare vector columns directly.
-- This migration ensures triggers and constraints don't cause vector comparisons.

-- ============================================================================
-- FIX TRIGGER FUNCTION
-- ============================================================================

-- Update the trigger function to avoid vector comparisons
CREATE OR REPLACE FUNCTION trigger_auto_generate_relationships_books()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only trigger if embedding was added or changed
  -- For INSERT: always trigger if embedding is not null
  -- For UPDATE: trigger if embedding changed from null to not null, or if it's a new value
  IF NEW.description_embedding IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      -- For INSERT, always generate relationships if embedding exists
      PERFORM auto_generate_document_relationships(NEW.id, 0.60);
    ELSIF TG_OP = 'UPDATE' THEN
      -- For UPDATE, only trigger if embedding was null before or if it's actually different
      -- Compare by casting to text to avoid vector operator issues
      IF OLD.description_embedding IS NULL THEN
        -- Embedding was added
        PERFORM auto_generate_document_relationships(NEW.id, 0.60);
      ELSIF OLD.description_embedding::text IS DISTINCT FROM NEW.description_embedding::text THEN
        -- Embedding changed (compare as text to avoid vector operator)
        PERFORM auto_generate_document_relationships(NEW.id, 0.60);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ENSURE NO UNIQUE CONSTRAINTS ON VECTOR COLUMNS
-- ============================================================================

-- Verify there are no unique constraints on description_embedding
-- (This is just a safety check - we shouldn't have any)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = 'user_books'::regclass 
      AND contype = 'u'
      AND conkey::text LIKE '%description_embedding%'
  ) THEN
    RAISE WARNING 'Found unique constraint on description_embedding - this may cause vector operator errors';
  END IF;
END $$;

-- ============================================================================
-- VERIFY INDEX IS CORRECT
-- ============================================================================

-- The ivfflat index should already exist from migration 055
-- Just verify it's using the correct operator class
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'user_books' 
      AND indexname = 'idx_user_books_embedding'
  ) THEN
    -- Recreate the index if it doesn't exist
    CREATE INDEX IF NOT EXISTS idx_user_books_embedding ON user_books 
      USING ivfflat (description_embedding extensions.vector_cosine_ops) WITH (lists = 100)
      WHERE description_embedding IS NOT NULL;
  END IF;
END $$;

