-- Migration: Clear All Embeddings
-- This migration clears all embedding data from the database
-- Date: 2025-01-XX
-- 
-- This will:
-- - Clear vector embeddings from pgvector columns
-- - Delete embedding metadata records
-- - Clear legacy embedding references
--
-- NOTE: If you're using external vector stores (Pinecone, etc.), 
-- you'll need to clear those separately using their APIs.

-- ============================================================================
-- CLEAR VECTOR EMBEDDINGS (pgvector columns)
-- ============================================================================

-- Clear document description embeddings
UPDATE document_descriptions 
SET description_embedding = NULL 
WHERE description_embedding IS NOT NULL;

-- Clear conversation memory embeddings
UPDATE chat.conversation_memories 
SET embedding = NULL 
WHERE embedding IS NOT NULL;

-- Clear action cache embeddings
UPDATE chat.action_cache 
SET embedding = NULL 
WHERE embedding IS NOT NULL;

-- ============================================================================
-- DELETE EMBEDDING METADATA RECORDS
-- ============================================================================

-- Delete embedding metadata (tracks embeddings in external vector stores)
DELETE FROM embedding_metadata;

-- Delete legacy document embeddings (Pinecone references)
-- Only delete if table exists (it may have been removed in schema consolidation)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_embeddings'
  ) THEN
    DELETE FROM document_embeddings;
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to verify)
-- ============================================================================
-- Run these after migration to verify embeddings are cleared:
-- 
-- SELECT COUNT(*) as remaining_embeddings FROM embedding_metadata;
-- SELECT COUNT(*) as remaining_doc_embeddings FROM document_embeddings;
-- SELECT COUNT(*) as descriptions_with_embeddings FROM document_descriptions WHERE description_embedding IS NOT NULL;
-- SELECT COUNT(*) as memories_with_embeddings FROM chat.conversation_memories WHERE embedding IS NOT NULL;
-- SELECT COUNT(*) as cache_with_embeddings FROM chat.action_cache WHERE embedding IS NOT NULL;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This migration clears embeddings but preserves:
--    - Document descriptions (text content remains, only embedding cleared)
--    - Conversation memories (entity data remains, only embedding cleared)
--    - Action cache (cached actions remain, only embedding cleared)
--    - All other user data
--
-- 2. External vector stores (if used):
--    - If you're using Pinecone or other external vector stores, 
--      you'll need to clear those separately
--    - Check embedding_metadata table for vector_id values before running this
--    - Then use the external service's API to delete those vectors
--
-- 3. To regenerate embeddings:
--    - Documents will need to be re-processed to generate new embeddings
--    - The embedding_status in user_books may need to be reset to 'pending'

COMMENT ON SCHEMA public IS 'Embeddings cleared on 2025-01-XX for test mode reset';
