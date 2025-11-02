-- Migration: Fix RLS on Partitioned Tables
-- Enables Row Level Security on user_books_partitioned and its partitions
-- Date: 2025-01-27

-- ============================================================================
-- ROW LEVEL SECURITY FOR PARTITIONED TABLES
-- ============================================================================

-- Enable RLS on the partitioned table (this applies to all partitions)
ALTER TABLE user_books_partitioned ENABLE ROW LEVEL SECURITY;

-- Enable RLS on the default partition
ALTER TABLE IF EXISTS user_books_default ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR PARTITIONED TABLES
-- ============================================================================

-- Note: Policies on the parent table automatically apply to all partitions
-- These policies are identical to those on user_books for consistency

-- RLS Policy: Users can read own books
DROP POLICY IF EXISTS "Users can read own books" ON user_books_partitioned;
CREATE POLICY "Users can read own books" ON user_books_partitioned
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Users can create own books
DROP POLICY IF EXISTS "Users can create own books" ON user_books_partitioned;
CREATE POLICY "Users can create own books" ON user_books_partitioned
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update own books
DROP POLICY IF EXISTS "Users can update own books" ON user_books_partitioned;
CREATE POLICY "Users can update own books" ON user_books_partitioned
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policy: Users can delete own books
DROP POLICY IF EXISTS "Users can delete own books" ON user_books_partitioned;
CREATE POLICY "Users can delete own books" ON user_books_partitioned
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- APPLY POLICIES TO EXISTING PARTITIONS
-- ============================================================================

-- Apply RLS policies to all existing user-specific partitions
DO $$
DECLARE
  partition_record RECORD;
BEGIN
  FOR partition_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'user_books_u%'
  LOOP
    -- Enable RLS on each partition
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
                   partition_record.schemaname, partition_record.tablename);
    
    RAISE NOTICE 'Enabled RLS on partition %', partition_record.tablename;
  END LOOP;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can read own books" ON user_books_partitioned IS 
  'Allows users to read only their own books from any partition';

COMMENT ON POLICY "Users can create own books" ON user_books_partitioned IS 
  'Allows users to insert books only with their own user_id';

COMMENT ON POLICY "Users can update own books" ON user_books_partitioned IS 
  'Allows users to update only their own books from any partition';

COMMENT ON POLICY "Users can delete own books" ON user_books_partitioned IS 
  'Allows users to delete only their own books from any partition';

