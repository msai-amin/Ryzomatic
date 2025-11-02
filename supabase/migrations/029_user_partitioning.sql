-- Migration: Add user-based table partitioning
-- Creates partitioned tables for scalable multi-tenant architecture
-- Enables efficient user data isolation and cleanup
-- Date: 2025-01-27

-- Note: This migration sets up partitioning infrastructure
-- For existing production data, we'll migrate in a separate maintenance window

-- ============================================================================
-- PARTITIONING SETUP FOR USER_BOOKS
-- ============================================================================

-- Create partitioned table for user_books
-- This will replace the existing user_books table after data migration
-- Note: Cannot use INCLUDING ALL because of PK constraint issues with partitioning
-- Using LIKE without constraints, then adding PK with partition key
CREATE TABLE IF NOT EXISTS user_books_partitioned (
  LIKE user_books INCLUDING DEFAULTS
) PARTITION BY LIST (user_id);

-- Add PRIMARY KEY constraint that includes partition key (required for partitioned tables)
ALTER TABLE user_books_partitioned 
ADD PRIMARY KEY (user_id, id);

-- Create a default partition for existing/new users
CREATE TABLE IF NOT EXISTS user_books_default PARTITION OF user_books_partitioned
  DEFAULT;

-- ============================================================================
-- FUNCTIONS FOR AUTOMATIC PARTITION MANAGEMENT
-- ============================================================================

-- Function to create a new partition for a specific user
-- This enables per-user performance optimization and easy GDPR cleanup
CREATE OR REPLACE FUNCTION create_user_partition(user_uuid UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
DECLARE
  partition_name TEXT;
  table_oid OID;
BEGIN
  partition_name := 'user_books_u' || REPLACE(user_uuid::TEXT, '-', '_');
  
  -- Only create if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I PARTITION OF public.user_books_partitioned
      FOR VALUES IN (%L)
    ', partition_name, user_uuid);
    
    RAISE NOTICE 'Created partition % for user %', partition_name, user_uuid;
  END IF;
END;
$$;

-- Function to cleanup all data for a specific user (GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_user_data(user_uuid UUID)
RETURNS TABLE(
  table_name TEXT,
  rows_deleted BIGINT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
DECLARE
  partition_name TEXT;
  deleted_count BIGINT;
BEGIN
  -- Drop user-specific partition (fastest cleanup)
  partition_name := 'user_books_u' || REPLACE(user_uuid::TEXT, '-', '_');
  
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', partition_name);
    RAISE NOTICE 'Dropped partition % for user %', partition_name, user_uuid;
    
    RETURN QUERY SELECT 'user_books_partitioned'::TEXT, -1::BIGINT; -- -1 means partition dropped
  ELSE
    -- Fallback: delete from default partition
    DELETE FROM public.user_books_default WHERE user_id = user_uuid;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'user_books_default'::TEXT, deleted_count;
  END IF;
END;
$$;

-- Function to list all user partitions with statistics
CREATE OR REPLACE FUNCTION list_user_partitions()
RETURNS TABLE(
  partition_name TEXT,
  user_id UUID,
  row_count BIGINT,
  total_size TEXT
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT 
    c.relname::TEXT as partition_name,
    NULL::UUID as user_id, -- Would need to parse from partition_name
    s.n_live_tup::BIGINT as row_count,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
  FROM pg_class c
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE c.relname LIKE 'user_books_u%'
    AND c.relkind = 'r' -- Only regular tables
  ORDER BY pg_total_relation_size(c.oid) DESC;
$$;

-- ============================================================================
-- INDEXES ON PARTITIONED TABLE
-- ============================================================================

-- Add indexes that will be inherited by all partitions
-- These are essential for query performance

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_user_books_partitioned_user 
  ON user_books_partitioned(user_id, created_at DESC, id);

-- Full-text search index (GIN index)
CREATE INDEX IF NOT EXISTS idx_user_books_partitioned_search 
  ON user_books_partitioned USING gin(to_tsvector('english', title || ' ' || file_name));

-- Favorite and read status
CREATE INDEX IF NOT EXISTS idx_user_books_partitioned_favorites 
  ON user_books_partitioned(user_id) WHERE is_favorite = TRUE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_books_partitioned IS 
  'Partitioned table for user books. Each partition represents one user for GDPR compliance and performance.';

COMMENT ON FUNCTION create_user_partition IS 
  'Creates a dedicated partition for a specific user. Should be called when a user creates their first book.';

COMMENT ON FUNCTION cleanup_user_data IS 
  'Deletes all data for a specific user by dropping their partition. Returns table name and rows deleted (-1 means partition dropped).';

COMMENT ON FUNCTION list_user_partitions IS 
  'Lists all user partitions with their sizes and row counts for monitoring.';

-- ============================================================================
-- MIGRATION NOTE
-- ============================================================================

-- To migrate from user_books to user_books_partitioned:
-- 1. Run this migration to create the partitioned structure
-- 2. In a maintenance window:
--    INSERT INTO user_books_partitioned SELECT * FROM user_books;
--    ALTER TABLE user_books RENAME TO user_books_old;
--    ALTER TABLE user_books_partitioned RENAME TO user_books;
--    DROP TABLE user_books_old;
-- 3. Recreate foreign key constraints
-- 4. Recreate views/functions that reference user_books

