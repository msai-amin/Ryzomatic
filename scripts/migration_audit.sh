#!/bin/bash

# Migration Audit Script
# Comprehensive checks for database integrity, RLS coverage, and migration health
# Run this after applying migrations to verify everything is working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if database URL is provided
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable not set${NC}"
  echo "Usage: DATABASE_URL='your-connection-string' ./scripts/migration_audit.sh"
  exit 1
fi

echo "========================================"
echo "Database Migration Audit"
echo "========================================"
echo ""

# Function to run SQL and display results
run_sql() {
  local query="$1"
  local description="$2"
  
  echo -e "${YELLOW}Checking: ${description}${NC}"
  psql "$DATABASE_URL" -t -c "$query"
  echo ""
}

# 1. Check for RLS coverage on all tables
echo -e "${GREEN}1. RLS Coverage Audit${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  schemaname || '.' || tablename as table_name,
  CASE WHEN tablename IN (
    SELECT tablename FROM pg_policies
  ) THEN '✓ Has Policies' ELSE '✗ NO POLICIES' END as rls_status
FROM pg_tables
WHERE schemaname IN ('public', 'chat')
ORDER BY schemaname, tablename;
" "Tables with RLS policies"

# 2. Check for duplicate table definitions
echo -e "${GREEN}2. Duplicate Table Check${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  tablename,
  COUNT(*) as occurrence_count
FROM pg_tables
WHERE schemaname IN ('public', 'chat')
GROUP BY tablename
HAVING COUNT(*) > 1;
" "Duplicate tables (should be empty)"

# 3. List all functions and their callers
echo -e "${GREEN}3. Function Inventory${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'invoker' END as security
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'chat')
ORDER BY n.nspname, p.proname;
" "All database functions"

# 4. Check for functions without proper search_path
echo -e "${GREEN}4. Functions Missing Search Path${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'chat')
  AND p.prosecdef = TRUE
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
ORDER BY n.nspname, p.proname;
" "SECURITY DEFINER functions without search_path (security risk!)"

# 5. Verify foreign key integrity
echo -e "${GREEN}5. Foreign Key Verification${NC}"
echo "----------------------------------------"
run_sql "
SELECT
  tc.table_schema || '.' || tc.table_name as source_table,
  kcu.column_name as source_column,
  ccu.table_schema || '.' || ccu.table_name as target_table,
  ccu.column_name as target_column,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('public', 'chat')
ORDER BY tc.table_schema, tc.table_name;
" "All foreign key constraints"

# 6. Check for orphaned foreign keys
echo -e "${GREEN}6. Orphaned Records Check${NC}"
echo "----------------------------------------"
# Note: This is a general check - customize for your specific tables
run_sql "
SELECT 
  'conversations' as table_name,
  COUNT(*) as orphaned_count
FROM conversations c
WHERE c.document_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM user_books ub WHERE ub.id = c.document_id
  );
" "Orphaned conversations referencing non-existent user_books"

# 7. Generate migration dependency graph
echo -e "${GREEN}7. Migration Dependencies${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  schemaname,
  tablename,
  attname as column_name,
  pg_catalog.format_type(atttypid, atttypmod) as data_type,
  attnotnull as not_null
FROM pg_attribute
WHERE attnum > 0 
  AND NOT attisdropped
  AND attrelid IN (
    SELECT oid FROM pg_class WHERE relname IN (
      'user_books', 'user_notes', 'user_highlights', 
      'pomodoro_sessions', 'conversations', 'messages'
    )
  )
ORDER BY attrelid, attnum;
" "Key tables and their columns"

# 8. Index health check
echo -e "${GREEN}8. Index Usage Statistics${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  schemaname,
  tablename,
  COUNT(*) as total_indexes,
  COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'chat')
GROUP BY schemaname, tablename
ORDER BY SUM(pg_relation_size(indexrelid)) DESC
LIMIT 20;
" "Index usage by table (top 20)"

# 9. Check for large tables
echo -e "${GREEN}9. Large Tables Check${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  schemaname || '.' || tablename as table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname IN ('public', 'chat')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 15;
" "Largest tables by size"

# 10. Check materialized views
echo -e "${GREEN}10. Materialized Views Status${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  schemaname || '.' || matviewname as view_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
  pg_stat_get_last_vacuum_time(c.oid) as last_vacuum,
  pg_stat_get_last_autovacuum_time(c.oid) as last_autovacuum
FROM pg_matviews m
JOIN pg_class c ON m.matviewname = c.relname
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||matviewname) DESC;
" "Materialized views status"

# 11. Extension check
echo -e "${GREEN}11. Installed Extensions${NC}"
echo "----------------------------------------"
run_sql "
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension
ORDER BY extname;
" "Installed PostgreSQL extensions"

# 12. Summary report
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Audit Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Final checks
echo "Running final validation checks..."
echo ""

# Check if critical tables exist
run_sql "
SELECT 
  CASE 
    WHEN COUNT(*) >= 15 THEN '✓ SUFFICIENT TABLES'
    ELSE '✗ MISSING TABLES'
  END as table_count_status,
  COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname IN ('public', 'chat');
" "Total tables count"

# Check if indexes are reasonable
run_sql "
SELECT 
  CASE 
    WHEN COUNT(*) BETWEEN 60 AND 80 THEN '✓ OPTIMAL INDEX COUNT'
    WHEN COUNT(*) > 100 THEN '⚠ TOO MANY INDEXES'
    WHEN COUNT(*) < 50 THEN '⚠ TOO FEW INDEXES'
  END as index_count_status,
  COUNT(*) as total_indexes
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'chat');
" "Total indexes count"

echo ""
echo -e "${GREEN}✓ Audit completed successfully!${NC}"
echo ""
echo "If any issues were found, please review the output above and:"
echo "1. Fix any missing RLS policies"
echo "2. Review unused indexes and consider removing them"
echo "3. Check for orphaned records and clean them up"
echo "4. Ensure all SECURITY DEFINER functions have proper search_path"

