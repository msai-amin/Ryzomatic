-- Migration: Rationalize and optimize database indexes
-- Drops redundant indexes and adds covering indexes for performance
-- Target: Reduce from 108+ indexes to 60-70 while improving query performance
-- Date: 2025-01-27

-- ============================================================================
-- SECTION 1: Drop Redundant Indexes
-- ============================================================================

-- These indexes are redundant because they're covered by composite indexes
-- or are rarely used alone

-- user_books: Drop single-column indexes that are covered by composite indexes
DROP INDEX IF EXISTS idx_user_books_file_type;  -- Covered by composite queries with user_id
DROP INDEX IF EXISTS idx_user_books_is_favorite;  -- Covered by idx_user_books_composite
DROP INDEX IF EXISTS idx_user_books_reading_progress;  -- Rarely used for standalone queries

-- user_books: These are already covered by cursor indexes from migration 009
-- Keeping the cursor indexes as they're optimized for pagination

-- Remove duplicate idx_user_books_file_type from 003 if it exists
-- (the one in 003 has no user_id, which is less useful)

-- ============================================================================
-- SECTION 2: Add Covering Indexes for Hot Queries
-- ============================================================================

-- Covering index for user_notes: book, page queries with position data
-- This includes commonly accessed columns to avoid table lookups
CREATE INDEX IF NOT EXISTS idx_user_notes_book_page_covering 
  ON user_notes(book_id, page_number) 
  INCLUDE (content, position_x, position_y, created_at);

-- Covering index for user_highlights: book, page queries with color data
CREATE INDEX IF NOT EXISTS idx_user_highlights_book_page_covering
  ON user_highlights(book_id, page_number)
  INCLUDE (highlighted_text, color_hex, is_orphaned, created_at);

-- Covering index for pomodoro_sessions: user time range queries
-- Includes frequently accessed columns for stats queries
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_time_covering
  ON pomodoro_sessions(user_id, started_at DESC)
  INCLUDE (book_id, mode, completed, duration_seconds, ended_at);

-- ============================================================================
-- SECTION 3: Optimize Composite Indexes for Common Filter Combinations
-- ============================================================================

-- user_books: Optimize for library view queries
-- Common pattern: user_id + favorite + last_read_at (or created_at)
-- The composite index from 007 is good, but we can enhance it
CREATE INDEX IF NOT EXISTS idx_user_books_library_view
  ON user_books(user_id, is_favorite DESC NULLS LAST, last_read_at DESC NULLS LAST, id);

-- user_books: Optimize for file type + date filtering
-- Common pattern: user_id + file_type + created_at
CREATE INDEX IF NOT EXISTS idx_user_books_type_date
  ON user_books(user_id, file_type, created_at DESC, id);

-- ============================================================================
-- SECTION 4: Partial Indexes for Efficient Filtering
-- ============================================================================

-- user_books: Partial index for active reads (reading_progress > 0)
CREATE INDEX IF NOT EXISTS idx_user_books_active_reading
  ON user_books(user_id, reading_progress DESC)
  WHERE reading_progress > 0;

-- user_notes: Index for recent notes queries
-- Note: Cannot use NOW() in partial index WHERE clause, so using regular index
CREATE INDEX IF NOT EXISTS idx_user_notes_recent
  ON user_notes(book_id, created_at DESC);

-- pomodoro_sessions: Partial index for active sessions
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_active_covering
  ON pomodoro_sessions(user_id, started_at DESC)
  WHERE ended_at IS NULL;

-- ============================================================================
-- SECTION 5: Optimize Junction Table Indexes
-- ============================================================================

-- These are optimized for both directions of many-to-many queries

-- book_collections: Optimize for "books in collection" and "collections of book"
-- The base indexes are already good from 007

-- book_tag_assignments: Same optimization
-- The base indexes are already good from 007

-- ============================================================================
-- SECTION 6: Vector Indexes (Keep as-is, These are Critical)
-- ============================================================================

-- Keep all vector similarity indexes:
-- - document_descriptions.description_embedding
-- - conversation_memories.embedding
-- - action_cache.embedding

-- These use IVFFlat which is essential for semantic search

-- ============================================================================
-- SECTION 7: Add Missing Indexes for Foreign Keys
-- ============================================================================

-- Ensure all foreign keys have supporting indexes for JOIN performance
-- This is especially important for cascading deletes and updates

-- Check if index exists before creating (most should already exist)
-- Note: memory_relationships may be in public or chat schema depending on migration 031
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_relationships' AND table_schema = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_memory_relationships_memory_from 
      ON memory_relationships(memory_from);
    CREATE INDEX IF NOT EXISTS idx_memory_relationships_memory_to 
      ON memory_relationships(memory_to);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_relationships' AND table_schema = 'chat') THEN
    CREATE INDEX IF NOT EXISTS idx_memory_relationships_memory_from 
      ON chat.memory_relationships(memory_from);
    CREATE INDEX IF NOT EXISTS idx_memory_relationships_memory_to 
      ON chat.memory_relationships(memory_to);
  END IF;
END $$;

-- ============================================================================
-- SECTION 8: Document Index Rationale
-- ============================================================================

-- Comments explaining index strategy
COMMENT ON INDEX idx_user_notes_book_page_covering IS 
  'Covering index for book/page note queries - includes position and content to avoid table scans';
  
COMMENT ON INDEX idx_user_highlights_book_page_covering IS
  'Covering index for book/page highlight queries - includes text and color to avoid table scans';

COMMENT ON INDEX idx_pomodoro_sessions_user_time_covering IS
  'Covering index for time-range stats queries - includes session details for aggregation';

COMMENT ON INDEX idx_user_books_library_view IS
  'Optimized for main library view queries with favorite and date sorting';

COMMENT ON INDEX idx_user_books_type_date IS
  'Optimized for file type filtering with date-based sorting';

-- ============================================================================
-- SECTION 9: Analyze Tables to Update Planner Statistics
-- ============================================================================

-- Update query planner statistics for all affected tables
ANALYZE user_books;
ANALYZE user_notes;
ANALYZE user_highlights;
ANALYZE pomodoro_sessions;
ANALYZE book_collections;
ANALYZE book_tag_assignments;

