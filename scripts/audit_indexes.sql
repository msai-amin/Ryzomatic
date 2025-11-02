-- Index Audit Script
-- Analyzes index usage, size, and identifies redundant/unused indexes
-- Run this to understand which indexes can be safely removed

-- 1. List all indexes with scan counts and sizes
-- Indexes with low or zero scans may be candidates for removal
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  indexrelid::regclass as full_index_name
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- 2. Find indexes that have never been used
-- These are prime candidates for removal (after verifying)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_size_bytes(pg_size_pretty(pg_relation_size(indexrelid))) as size_bytes
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. List all indexes per table with their definitions
SELECT
  t.tablename,
  i.indexname,
  i.indexdef,
  pg_size_pretty(pg_relation_size(i.indexrelid::regclass)) as size
FROM pg_indexes i
JOIN pg_tables t ON i.tablename = t.tablename AND i.schemaname = t.schemaname
WHERE t.schemaname = 'public'
ORDER BY t.tablename, i.indexname;

-- 4. Find potentially redundant composite indexes
-- These are indexes on the same table that share leading columns
WITH index_columns AS (
  SELECT
    t.tablename,
    i.indexname,
    string_agg(a.attname, ', ' ORDER BY array_position(i.indkey, a.attnum)) as columns
  FROM pg_index i
  JOIN pg_class c ON i.indexrelid = c.oid
  JOIN pg_tables t ON c.relname = t.tablename
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE t.schemaname = 'public'
    AND a.attnum > 0
  GROUP BY t.tablename, i.indexname
)
SELECT 
  tablename,
  indexname,
  columns,
  pg_size_pretty(pg_relation_size(indexrelid::regclass)) as size
FROM index_columns ic
JOIN pg_stat_user_indexes sui ON ic.indexname = sui.indexname
ORDER BY tablename, columns, size DESC;

-- 5. Find overlapping indexes (one index completely contained in another)
WITH index_defs AS (
  SELECT 
    tablename,
    indexname,
    REPLACE(indexdef, 'CREATE INDEX ', '') as index_definition,
    REPLACE(indexdef, 'UNIQUE ', '') as index_cols
  FROM pg_indexes
  WHERE schemaname = 'public'
)
SELECT 
  i1.tablename,
  i1.indexname as index1,
  i2.indexname as index2,
  i1.index_cols as columns
FROM index_defs i1
JOIN index_defs i2 ON i1.tablename = i2.tablename AND i1.indexname < i2.indexname
WHERE i1.index_cols LIKE '%' || i2.index_cols || '%'
   OR i2.index_cols LIKE '%' || i1.index_cols || '%';

-- 6. Calculate total index bloat
SELECT 
  schemaname,
  sum(pg_relation_size(indexrelid)) / 1024 / 1024 as total_index_size_mb
FROM pg_stat_user_indexes
GROUP BY schemaname
ORDER BY total_index_size_mb DESC;

-- 7. Find large indexes (>10MB) that may not be worth keeping
SELECT 
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read / NULLIF(idx_scan, 0) as tuples_per_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 10 * 1024 * 1024  -- >10MB
ORDER BY pg_relation_size(indexrelid) DESC;

-- 8. Summary of indexes by table
SELECT 
  tablename,
  COUNT(*) as index_count,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size,
  COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes
FROM pg_stat_user_indexes
GROUP BY tablename
ORDER BY SUM(pg_relation_size(indexrelid)) DESC;

