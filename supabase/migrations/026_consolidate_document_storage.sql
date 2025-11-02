-- Migration: Consolidate documents table into user_books
-- This eliminates the duplicate document model and simplifies the schema
-- Date: 2025-01-27

-- Step 1: Add missing fields from documents to user_books if they don't exist
-- These fields are needed for chat/RAG functionality that previously used documents

ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' 
  CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed'));

-- OCR fields for scanned PDFs (previously in documents table)
ALTER TABLE user_books
ADD COLUMN IF NOT EXISTS needs_ocr BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'not_needed'
  CHECK (ocr_status IN ('not_needed', 'pending', 'processing', 'completed', 'failed', 'user_declined')),
ADD COLUMN IF NOT EXISTS ocr_metadata JSONB DEFAULT '{}'::jsonb;

-- s3_key should already exist from migration 004, but add if missing
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- Step 2: Migrate any existing documents data to user_books
-- This handles cases where the old documents table has data
INSERT INTO user_books (
  id, user_id, title, file_name, file_type, file_size_bytes, 
  s3_key, content, embedding_status, created_at, updated_at,
  needs_ocr, ocr_status, ocr_metadata
)
SELECT 
  d.id, d.user_id, d.title, d.file_name, d.file_type, d.file_size::BIGINT,
  d.s3_key, d.content, d.embedding_status, d.created_at, d.updated_at,
  COALESCE(d.needs_ocr, FALSE), 
  COALESCE(d.ocr_status, 'not_needed'),
  COALESCE(d.ocr_metadata, '{}'::jsonb)
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM user_books ub WHERE ub.id = d.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Drop foreign keys referencing documents before we drop the table
-- We'll recreate them to point to user_books after dropping documents

-- Drop constraint from conversations
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_document_id_fkey;

-- Drop constraints from memory tables (may not exist yet if 022 hasn't run)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversation_memories_document_id_fkey') THEN
    ALTER TABLE conversation_memories DROP CONSTRAINT conversation_memories_document_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'memory_relationships_document_id_fkey') THEN
    ALTER TABLE memory_relationships DROP CONSTRAINT memory_relationships_document_id_fkey;
  END IF;
END $$;

-- Drop constraints from response_cache and document_embeddings (may not exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name LIKE 'response_cache%document_id%') THEN
    ALTER TABLE response_cache DROP CONSTRAINT IF EXISTS response_cache_document_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name LIKE 'document_embeddings%') THEN
    ALTER TABLE document_embeddings DROP CONSTRAINT IF EXISTS document_embeddings_document_id_fkey;
  END IF;
END $$;

-- Step 4: Drop old tables that are no longer needed
-- These are replaced by user_books and conversation infrastructure
DROP TABLE IF EXISTS response_cache CASCADE;
DROP TABLE IF EXISTS document_embeddings CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- Step 5: Recreate foreign keys to reference user_books instead of documents
-- Change document_id to reference user_books instead of documents
ALTER TABLE conversations 
ADD CONSTRAINT conversations_document_id_fkey 
  FOREIGN KEY (document_id) REFERENCES user_books(id) ON DELETE CASCADE;

-- Recreate foreign keys for memory tables if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_memories') THEN
    ALTER TABLE conversation_memories
    ADD CONSTRAINT conversation_memories_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES user_books(id) ON DELETE SET NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_relationships') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_relationships' AND column_name = 'document_id') THEN
      ALTER TABLE memory_relationships
      ADD CONSTRAINT memory_relationships_document_id_fkey
        FOREIGN KEY (document_id) REFERENCES user_books(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Step 6: Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_user_books_ocr_status 
  ON user_books(ocr_status) 
  WHERE ocr_status != 'not_needed';

CREATE INDEX IF NOT EXISTS idx_user_books_embedding_status 
  ON user_books(embedding_status);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN user_books.content IS 'Full text content of the document (for AI chat/RAG)';
COMMENT ON COLUMN user_books.embedding_status IS 'Status of vector embedding generation (for semantic search)';
COMMENT ON COLUMN user_books.needs_ocr IS 'True if PDF is scanned/non-searchable and needs OCR';
COMMENT ON COLUMN user_books.ocr_status IS 'OCR processing status: not_needed, pending, processing, completed, failed, user_declined';
COMMENT ON COLUMN user_books.ocr_metadata IS 'OCR processing metadata (tokens, confidence, processing time)';

-- Step 8: Update function that references documents
-- The reset_monthly_ocr_counters function should update user_books now
CREATE OR REPLACE FUNCTION reset_monthly_ocr_counters()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
BEGIN
  UPDATE public.profiles 
  SET ocr_count_monthly = 0,
      ocr_last_reset = NOW()
  WHERE ocr_last_reset < NOW() - INTERVAL '1 month';
END;
$$;

