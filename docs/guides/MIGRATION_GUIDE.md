# Database Migration Guide

**Last Updated:** 2025-01-27  
**Version:** 2.0 (Post-Restructuring)

## Overview

This guide covers applying database migrations for the Smart Reader project. Migrations are sequenced SQL scripts that evolve the database schema over time.

---

## Prerequisites

- Supabase project access (or local PostgreSQL instance)
- Database connection URL
- `psql` CLI tool OR access to Supabase SQL Editor

---

## Quick Start

### Option 1: Supabase SQL Editor (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **"New query"**
5. Copy/paste migration SQL
6. Click **"Run"**
7. Verify success message

### Option 2: Supabase CLI

```bash
# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Or run specific migration
psql $DATABASE_URL -f supabase/migrations/026_consolidate_document_storage.sql
```

---

## Migration List

### Phase 1: Foundation (001-008)

| # | File | Description | Status |
|---|------|-------------|--------|
| 001 | `001_initial_schema.sql` | Core schema (profiles, documents, conversations, messages) | ⚠️ Deprecated |
| 002 | `002_add_profile_insert_policy.sql` | Profile creation RLS policy | ✅ Active |
| 003 | `003_add_user_books_table.sql` | User books and notes tables | ✅ Active |
| 004 | `004_move_books_to_s3.sql` | S3 storage migration | ✅ Active |
| 005 | `005_add_pomodoro_tracking.sql` | Pomodoro session tracking | ✅ Active |
| 006 | `006_add_ocr_support.sql` | OCR feature support | ✅ Active |
| 007 | `007_library_organization.sql` | Collections, tags, metadata | ✅ Active |
| 008 | `008_add_pomodoro_gamification.sql` | Achievements and streaks | ✅ Active |

### Phase 2: Search & Security (009-016)

| # | File | Description | Status |
|---|------|-------------|--------|
| 009 | `009_search_rpcs.sql` | Search functions and indexes | ✅ Active |
| 010 | `010_fix_search_path_security.sql` | Security fixes for functions | ✅ Active |
| 011 | `011_debug_and_optimization.sql` | Debug tools, hierarchy cache | ✅ Active |
| 012 | `012_feature_flags_and_monitoring.sql` | Feature flags, performance logging | ✅ Active |
| 013 | `013_comprehensive_security_fixes.sql` | Comprehensive RLS and search_path fixes | ✅ Active |
| 014 | `014_fix_remaining_search_path.sql` | Additional security fixes | ✅ Active |
| 015 | `015_add_highlights_table.sql` | User highlights feature | ✅ Active |
| 016 | `016_add_document_relationships.sql` | Document relationship graph | ✅ Active |

### Phase 3: Refinements (017-025)

| # | File | Description | Status |
|---|------|-------------|--------|
| 017 | `017_fix_achievement_progress_types.sql` | Fix achievement types | ✅ Active |
| 018 | `018_fix_database_linter_issues.sql` | Linter compliance | ✅ Active |
| 019 | `019_enhance_user_notes.sql` | Note types and metadata | ✅ Active |
| 020 | `020_enhance_tts_caching.sql` | TTS audio cache | ✅ Active |
| 021 | `021_add_tts_playback_position.sql` | Playback position tracking | ✅ Active |
| 022 | `022_structured_rag_memory.sql` | Chat memory infrastructure | ✅ Active |
| 023 | `023_document_descriptions.sql` | Document description graph | ✅ Active |
| 024 | `024_add_cleaned_texts.sql` | Cleaned text fields for TTS | ✅ Active |
| 025 | `025_fix_remaining_search_path.sql` | Final security fixes | ✅ Active |

### Phase 4: Restructuring (026-033) ⭐ NEW

| # | File | Description | Status |
|---|------|-------------|--------|
| 026 | `026_consolidate_document_storage.sql` | Merge documents → user_books | 🆕 Applied |
| 027 | `027_standardize_fields.sql` | Standardize field names | 🆕 Applied |
| 028 | `028_rationalize_indexes.sql` | Index optimization | 🆕 Applied |
| 029 | `029_user_partitioning.sql` | Partitioning infrastructure | 🆕 Applied |
| 030 | `030_analytics_views.sql` | Materialized views | 🆕 Applied |
| 031 | `031_separate_chat_schema.sql` | Move chat tables to chat schema | 🆕 Applied |
| 032 | `032_vector_metadata.sql` | Vector offloading prep | 🆕 Applied |
| 033 | `033_cleanup_unused_functions.sql` | Function cleanup | 🆕 Applied |

---

## Critical Migrations

### Migration 026: Consolidate Document Storage ⚠️ BREAKING

**What it does:**
- Merges `documents` table into `user_books`
- Migrates existing data
- Updates all foreign key references
- Drops old `documents`, `document_embeddings`, `response_cache` tables

**Before running:**
1. Backup your database
2. Check for any code using `documents` table (should already be updated)
3. Verify no orphaned `document_id` references

**After running:**
- Verify data integrity: `SELECT COUNT(*) FROM user_books;`
- Check foreign keys: `SELECT COUNT(*) FROM conversations WHERE document_id IS NOT NULL;`
- Application code should already be updated

**Rollback:**
This migration is **not easily reversible**. Restore from backup if needed.

---

### Migration 031: Separate Chat Schema ⚠️ BREAKING

**What it does:**
- Creates `chat` schema
- Moves conversation/message/memory tables to `chat` schema
- Updates all RLS policies
- Updates foreign key references

**Before running:**
1. Backup database
2. Review which tables will move:
   - `conversations` → `chat.conversations`
   - `messages` → `chat.messages`
   - `conversation_memories` → `chat.conversation_memories`
   - `memory_relationships` → `chat.memory_relationships`
   - `action_cache` → `chat.action_cache`
   - `memory_extraction_jobs` → `chat.memory_extraction_jobs`

**After running:**
- Application code will need updates to use `chat.` prefix
- Verify RLS policies: `SELECT tablename FROM pg_policies WHERE schemaname = 'chat';`

---

## Testing Migrations

### Before Applying

```bash
# Dry run (check syntax only)
psql $DATABASE_URL -f supabase/migrations/026_consolidate_document_storage.sql --dry-run

# Run audit to check current state
./scripts/migration_audit.sh
```

### After Applying

```bash
# Verify integrity
./scripts/migration_audit.sh

# Test performance
psql $DATABASE_URL -f scripts/performance_test.sql

# Check for errors
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database_conflicts;"
```

---

## Common Issues

### Issue: "table already exists"

**Cause:** Migration already applied  
**Solution:** Check migration history in Supabase dashboard

```sql
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

### Issue: "foreign key constraint violation"

**Cause:** Orphaned references  
**Solution:** Find and fix orphaned records

```sql
-- Example: Find orphaned conversations
SELECT c.id, c.document_id 
FROM conversations c
WHERE c.document_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_books ub WHERE ub.id = c.document_id
  );
```

### Issue: "permission denied"

**Cause:** Insufficient privileges  
**Solution:** Use service role key or proper user role

### Issue: "disk space exceeded"

**Cause:** Migration too large  
**Solution:**
1. Delete old/backup data
2. Run VACUUM
3. Expand storage

```bash
# Vacuum full (blocking)
psql $DATABASE_URL -c "VACUUM FULL ANALYZE;"
```

---

## Rollback Strategy

### For Non-Breaking Migrations

Most migrations use `IF NOT EXISTS` and are idempotent. Simply re-run them.

### For Breaking Migrations

**Option 1: Restore from Backup** (Recommended)

```bash
# Supabase dashboard → Backups → Point-in-time recovery
```

**Option 2: Manual Rollback** (Advanced)

Create reverse migration script:

```sql
-- Example rollback for 026
-- Recreate documents table
CREATE TABLE documents (...) AS 
SELECT * FROM user_books;

-- Restore foreign keys
ALTER TABLE conversations 
  DROP CONSTRAINT conversations_document_id_fkey,
  ADD CONSTRAINT conversations_document_id_fkey 
    FOREIGN KEY (document_id) REFERENCES documents(id);

-- Drop user_books additions
ALTER TABLE user_books 
  DROP COLUMN content,
  DROP COLUMN embedding_status;
```

⚠️ **Warning:** Manual rollbacks are complex and error-prone. Prefer backups.

---

## Migration Best Practices

### 1. Always Backup First

```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test in Staging

Apply migrations to staging environment first.

### 3. Run During Low Traffic

Schedule migrations during maintenance windows.

### 4. Monitor After Application

- Check application logs
- Monitor error rates
- Verify key functionality

### 5. Document Issues

Keep notes on any issues encountered for future reference.

---

## Schema Evolution Timeline

### 2025-09: Initial Schema
- Core tables: profiles, documents, conversations, messages
- Basic RLS, no partitioning

### 2025-10: Library Features
- Added: user_books, collections, tags, Pomodoro
- S3 migration to reduce database size

### 2025-11: Security Hardening
- Fixed search_path vulnerabilities
- Comprehensive RLS review
- Function security improvements

### 2025-12: Restructuring
- Consolidated documents → user_books
- Rationalized indexes (108+ → 60-70)
- Added analytics views
- Separated chat schema
- Vector offloading prep

---

## Future Migrations

### Planned

- **034:** Read replica configuration
- **035:** External vector store migration
- **036:** Auto-partitioning triggers
- **037:** Archive old data strategy

### Proposed

- **TimescaleDB** for Pomodoro time-series
- **GraphQL** schema layer
- **Multi-region** replication

---

## Support

**Need Help?**
1. Check audit script output: `./scripts/migration_audit.sh`
2. Review migration SQL comments
3. Test in staging environment
4. Restore from backup if critical

**Common Commands:**

```bash
# List applied migrations
psql $DATABASE_URL -c "SELECT * FROM supabase_migrations.schema_migrations;"

# Check table sizes
psql $DATABASE_URL -f scripts/audit_indexes.sql

# Verify RLS
psql $DATABASE_URL -c "SELECT schemaname, tablename FROM pg_policies ORDER BY tablename;"
```

For issues or questions, refer to the main project repository.

