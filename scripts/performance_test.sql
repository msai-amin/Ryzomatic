-- Performance Test Script
-- Benchmarks database queries before and after optimization
-- Run this to measure improvements from index rationalization and other optimizations
-- Date: 2025-01-27

\timing on
\echo '\n=================================================================='
\echo 'Database Performance Test Suite'
\echo '==================================================================\n'

-- ============================================================================
-- TEST 1: Library List Query (Most Common)
-- ============================================================================

\echo 'Test 1: Library List Query (user_books pagination)\n'

EXPLAIN ANALYZE
SELECT 
  id, title, file_name, file_type, file_size_bytes,
  total_pages, reading_progress, last_read_page, last_read_at,
  is_favorite, notes_count, pomodoro_sessions_count,
  created_at, updated_at
FROM user_books
WHERE user_id = auth.uid()
ORDER BY last_read_at DESC NULLS LAST, id DESC
LIMIT 50;

\echo '\n---\n'

-- ============================================================================
-- TEST 2: Full-Text Search Query
-- ============================================================================

\echo 'Test 2: Full-Text Search Query\n'

EXPLAIN ANALYZE
SELECT 
  id, title, file_name, file_type, reading_progress
FROM user_books
WHERE user_id = auth.uid()
  AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(file_name,'')) 
      @@ plainto_tsquery('english', 'book guide')
ORDER BY last_read_at DESC NULLS LAST
LIMIT 20;

\echo '\n---\n'

-- ============================================================================
-- TEST 3: Filtered Library Query (By File Type)
-- ============================================================================

\echo 'Test 3: Filtered Library Query (PDFs only)\n'

EXPLAIN ANALYZE
SELECT 
  id, title, file_type, reading_progress
FROM user_books
WHERE user_id = auth.uid()
  AND file_type = 'pdf'
  AND reading_progress > 0
ORDER BY reading_progress DESC, last_read_at DESC
LIMIT 50;

\echo '\n---\n'

-- ============================================================================
-- TEST 4: Notes Retrieval (Covering Index Test)
-- ============================================================================

\echo 'Test 4: Notes Retrieval with Covering Index\n'

EXPLAIN ANALYZE
SELECT 
  id, page_number, content, position_x, position_y, created_at
FROM user_notes
WHERE book_id = (SELECT id FROM user_books LIMIT 1)
  AND page_number BETWEEN 1 AND 10
ORDER BY page_number, created_at;

\echo '\n---\n'

-- ============================================================================
-- TEST 5: Pomodoro Stats Query
-- ============================================================================

\echo 'Test 5: Pomodoro Statistics Aggregation\n'

EXPLAIN ANALYZE
SELECT 
  DATE(started_at) as session_date,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE mode = 'work') as work_sessions,
  SUM(duration_seconds) FILTER (WHERE mode = 'work') / 60 as work_minutes
FROM pomodoro_sessions
WHERE user_id = auth.uid()
  AND started_at >= NOW() - INTERVAL '30 days'
  AND ended_at IS NOT NULL
GROUP BY DATE(started_at)
ORDER BY session_date DESC;

\echo '\n---\n'

-- ============================================================================
-- TEST 6: Materialized View Query (Analytics)
-- ============================================================================

\echo 'Test 6: Materialized View Query (User Activity Summary)\n'

EXPLAIN ANALYZE
SELECT 
  total_books, favorite_books, books_with_notes,
  total_notes, total_pomodoro_sessions, total_study_seconds
FROM user_activity_summary
WHERE user_id = auth.uid();

\echo '\n---\n'

-- ============================================================================
-- TEST 7: Collection Hierarchy Query
-- ============================================================================

\echo 'Test 7: Collection Hierarchy with Book Count\n'

EXPLAIN ANALYZE
SELECT 
  c.id, c.name, c.parent_id, c.level, c.path,
  COALESCE(bc.book_count, 0) as book_count
FROM collection_hierarchy_cache c
LEFT JOIN (
  SELECT collection_id, COUNT(*) as book_count
  FROM book_collections
  GROUP BY collection_id
) bc ON c.id = bc.collection_id
WHERE c.user_id = auth.uid()
ORDER BY c.level, c.display_order, c.name;

\echo '\n---\n'

-- ============================================================================
-- TEST 8: Vector Similarity Search (If Available)
-- ============================================================================

\echo 'Test 8: Vector Similarity Search\n'

-- This requires actual embeddings to be present
EXPLAIN ANALYZE
SELECT 
  id, entity_type, entity_text,
  1 - (embedding <=> 
    (SELECT embedding FROM chat.conversation_memories LIMIT 1)
  ) as similarity
FROM chat.conversation_memories
WHERE user_id = auth.uid()
ORDER BY embedding <=> 
  (SELECT embedding FROM chat.conversation_memories LIMIT 1)
LIMIT 10;

\echo '\n---\n'

-- ============================================================================
-- TEST 9: Complex Join Query (Collections + Tags + Books)
-- ============================================================================

\echo 'Test 9: Complex Join Query (Books with Collections and Tags)\n'

EXPLAIN ANALYZE
SELECT 
  ub.id, ub.title, ub.file_type,
  json_agg(DISTINCT uc.name) as collections,
  json_agg(DISTINCT bt.name) as tags
FROM user_books ub
LEFT JOIN book_collections bc ON ub.id = bc.book_id
LEFT JOIN user_collections uc ON bc.collection_id = uc.id
LEFT JOIN book_tag_assignments bta ON ub.id = bta.book_id
LEFT JOIN book_tags bt ON bta.tag_id = bt.id
WHERE ub.user_id = auth.uid()
GROUP BY ub.id, ub.title, ub.file_type
LIMIT 20;

\echo '\n---\n'

-- ============================================================================
-- TEST 10: Orphaned Highlights Check
-- ============================================================================

\echo 'Test 10: Orphaned Highlights Query\n'

EXPLAIN ANALYZE
SELECT 
  page_number,
  COUNT(*) as orphaned_count,
  COUNT(*) FILTER (WHERE is_orphaned = FALSE) as active_count
FROM user_highlights
WHERE book_id = (SELECT id FROM user_books LIMIT 1)
  AND user_id = auth.uid()
GROUP BY page_number
ORDER BY page_number;

\echo '\n---\n'

-- ============================================================================
-- PERFORMANCE SUMMARY
-- ============================================================================

\timing off

\echo '\n=================================================================='
\echo 'Performance Benchmark Summary'
\echo '==================================================================\n'

\echo 'Key Metrics to Monitor:'
\echo '- Execution Time: Should be < 100ms for most queries'
\echo '- Index Usage: Should show "Index Scan" or "Index Only Scan"'
\echo '- Planning Time: Should be < 10ms'
\echo '- Buffers: Look for high cache hit ratio (>95%)'
\echo '- Rows Returned: Verify correctness'
\echo ''
\echo 'Expected Improvements After Optimization:'
\echo '- 10-30% faster execution time'
\echo '- Reduced planning time'
\echo '- Better use of covering indexes'
\echo '- Lower disk I/O'
\echo ''
\echo 'Run EXPLAIN ANALYZE on any query that shows:'
\echo '- Sequential Scan'
\echo '- High execution time (> 500ms)'
\echo '- Low cache hit ratio (< 90%)'
\echo '==================================================================\n'

-- Additional detailed statistics
SELECT 
  'Buffer Cache Hit Ratio' as metric,
  ROUND(
    (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 
    2
  ) as value,
  'Should be > 95%' as target
FROM pg_statio_user_tables
WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Index Cache Hit Ratio',
  ROUND(
    (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0)) * 100, 
    2
  ),
  'Should be > 99%'
FROM pg_statio_user_indexes
WHERE schemaname = 'public';

