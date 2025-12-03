-- Migration: Clear All User-Uploaded Data
-- This migration clears all user-uploaded content for test mode reset
-- Date: 2025-01-XX
-- 
-- WARNING: This will delete ALL user-uploaded data including:
-- - Documents/books
-- - Notes and annotations
-- - Chat conversations
-- - Highlights and bookmarks
-- - Reading sessions and progress
-- - Collections and tags
-- - And all related data
--
-- NOTE: S3 files are NOT deleted by this migration. 
-- You may want to run a separate script to clean up S3 storage.

-- ============================================================================
-- DELETE USER-UPLOADED DATA (in order to respect foreign key constraints)
-- ============================================================================

-- Helper function to safely delete from a table if it exists
CREATE OR REPLACE FUNCTION safe_delete_from_table(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_where_clause TEXT DEFAULT ''
) RETURNS void AS $$
DECLARE
  full_table_name TEXT;
  sql_stmt TEXT;
BEGIN
  full_table_name := quote_ident(p_schema_name) || '.' || quote_ident(p_table_name);
  
  IF EXISTS (
    SELECT FROM information_schema.tables t
    WHERE t.table_schema = p_schema_name 
    AND t.table_name = p_table_name
  ) THEN
    IF p_where_clause = '' THEN
      sql_stmt := 'DELETE FROM ' || full_table_name;
    ELSE
      sql_stmt := 'DELETE FROM ' || full_table_name || ' WHERE ' || p_where_clause;
    END IF;
    EXECUTE sql_stmt;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Delete in reverse dependency order to avoid foreign key violations

-- Chat schema tables (delete first as they may reference documents)
SELECT safe_delete_from_table('chat', 'messages');
SELECT safe_delete_from_table('chat', 'conversation_memories');
SELECT safe_delete_from_table('chat', 'memory_relationships');
SELECT safe_delete_from_table('chat', 'action_cache');
SELECT safe_delete_from_table('chat', 'memory_extraction_jobs');
SELECT safe_delete_from_table('chat', 'conversations');

-- Public schema tables - start with dependent tables

-- Junction tables (no direct user_id, but depend on user data)
SELECT safe_delete_from_table('public', 'book_collections');
SELECT safe_delete_from_table('public', 'book_tag_assignments');
SELECT safe_delete_from_table('public', 'highlight_note_connections');
SELECT safe_delete_from_table('public', 'note_relationships');

-- User content tables
SELECT safe_delete_from_table('public', 'user_highlights');
SELECT safe_delete_from_table('public', 'user_notes');
SELECT safe_delete_from_table('public', 'annotations');
SELECT safe_delete_from_table('public', 'bookmarks');
SELECT safe_delete_from_table('public', 'document_descriptions');
SELECT safe_delete_from_table('public', 'document_content');
SELECT safe_delete_from_table('public', 'document_relationships');
SELECT safe_delete_from_table('public', 'document_navigation_log');

-- Reading and tracking tables
SELECT safe_delete_from_table('public', 'reading_sessions');
SELECT safe_delete_from_table('public', 'reading_goals');
SELECT safe_delete_from_table('public', 'pomodoro_sessions');
SELECT safe_delete_from_table('public', 'pomodoro_achievements');
SELECT safe_delete_from_table('public', 'pomodoro_streaks');

-- Cognitive tracking
SELECT safe_delete_from_table('public', 'concept_occurrences');
SELECT safe_delete_from_table('public', 'cognitive_concepts');
SELECT safe_delete_from_table('public', 'cognitive_paths');

-- Collections and organization
SELECT safe_delete_from_table('public', 'user_collections');
SELECT safe_delete_from_table('public', 'book_series');
SELECT safe_delete_from_table('public', 'book_tags');
SELECT safe_delete_from_table('public', 'filter_presets');
SELECT safe_delete_from_table('public', 'collection_templates', 'is_system = FALSE'); -- Keep system templates

-- Recommendations and reviews
SELECT safe_delete_from_table('public', 'paper_recommendations');
SELECT safe_delete_from_table('public', 'peer_reviews');

-- TTS and audio
SELECT safe_delete_from_table('public', 'tts_audio_cache');
SELECT safe_delete_from_table('public', 'user_audio');

-- Embeddings and vector data
SELECT safe_delete_from_table('public', 'embedding_metadata');
SELECT safe_delete_from_table('public', 'document_embeddings');

-- Main documents/books table (this will cascade to many dependent tables)
-- But we delete explicitly above to be safe and clear
SELECT safe_delete_from_table('public', 'user_books');

-- Legacy documents table (if it still exists)
SELECT safe_delete_from_table('public', 'documents');

-- Clean up helper function
DROP FUNCTION IF EXISTS safe_delete_from_table(TEXT, TEXT, TEXT);

-- Usage records (optional - you may want to keep these for analytics)
-- Uncomment if you want to clear usage history too:
-- DELETE FROM usage_records;

-- Response cache (optional - you may want to keep these)
-- Uncomment if you want to clear cache:
-- DELETE FROM response_cache;

-- Rate limit tracking (optional - you may want to keep these)
-- Uncomment if you want to clear rate limit data:
-- DELETE FROM rate_limit_tracking;

-- ============================================================================
-- RESET SEQUENCES (if any tables use sequences)
-- ============================================================================
-- Most tables use UUIDs, but if any use sequences, reset them here
-- Example: SELECT setval('some_sequence_name', 1, false);

-- ============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to verify)
-- ============================================================================
-- Run these after migration to verify data is cleared:
-- 
-- SELECT COUNT(*) as remaining_books FROM user_books;
-- SELECT COUNT(*) as remaining_notes FROM user_notes;
-- SELECT COUNT(*) as remaining_conversations FROM chat.conversations;
-- SELECT COUNT(*) as remaining_messages FROM chat.messages;
-- SELECT COUNT(*) as remaining_highlights FROM user_highlights;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This migration does NOT delete:
--    - User profiles (auth.users and profiles tables)
--    - System templates (collection_templates with is_system = TRUE)
--    - Usage records (commented out - uncomment if needed)
--    - Response cache (commented out - uncomment if needed)
--
-- 2. S3 files are NOT deleted by this migration. To clean up S3:
--    - You can write a script that queries user_books for s3_key values
--    - Then calls the S3 delete API for each file
--    - Or use AWS CLI: aws s3 rm s3://bucket-name/books/ --recursive
--
-- 3. Vector embeddings in external services (e.g., Pinecone) are NOT deleted.
--    You may need to clear those separately if you're using vector search.
--
-- 4. To preserve user accounts but clear data, this is the right approach.
--    To also delete user accounts, you would need to delete from auth.users
--    (which would cascade to profiles and all other tables).

COMMENT ON SCHEMA public IS 'User data cleared on 2025-01-XX for test mode reset';
