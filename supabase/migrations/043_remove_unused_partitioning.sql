-- Migration: Remove Unused Partitioning Infrastructure
-- The partitioning feature was created but never activated
-- Temporarily removing to avoid Supabase linter warnings
-- Can be re-added when ready to migrate
-- Date: 2025-01-27

-- ============================================================================
-- DROP PARTITIONING INFRASTRUCTURE
-- ============================================================================

-- Drop the default partition
DROP TABLE IF EXISTS user_books_default CASCADE;

-- Drop the partitioned parent table
-- This will fail if any data exists, which is expected
DROP TABLE IF EXISTS user_books_partitioned CASCADE;

-- ============================================================================
-- DROP PARTITIONING FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS create_user_partition(UUID);
DROP FUNCTION IF EXISTS cleanup_user_data(UUID);
DROP FUNCTION IF EXISTS list_user_partitions();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_books IS 
  'Main table for user books. Partitioning infrastructure removed until ready to migrate.';

