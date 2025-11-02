# Database Schema Documentation

**Last Updated:** 2025-01-27  
**Version:** 2.0 (Post-Restructuring)

## Overview

The Smart Reader database uses PostgreSQL with Supabase, featuring:
- **Row-Level Security (RLS)** on all tables
- **Vector similarity search** with pgvector
- **Partitioned tables** for scalability
- **Materialized views** for analytics
- **Dual schemas**: `public` (library) and `chat` (AI/RAG)

---

## Schema Organization

### Public Schema (Library Management)

**Core Tables:**
- `profiles` - User profiles and subscription data
- `user_books` - Books/documents uploaded by users
- `user_notes` - Annotations and notes on books
- `user_highlights` - Text highlights in PDFs
- `user_collections` - Folders/collections for organization
- `book_tags` - Flexible tagging system
- `book_collections` - Many-to-many: books ↔ collections
- `book_tag_assignments` - Many-to-many: books ↔ tags

**Productivity Tables:**
- `pomodoro_sessions` - Individual timer sessions
- `pomodoro_achievements` - Unlocked achievements
- `pomodoro_streaks` - Daily streaks and weekly goals
- `tts_audio_cache` - Cached TTS audio files
- `document_descriptions` - AI/user document descriptions
- `document_relationships` - Links between related documents
- `note_relationships` - Links between notes and documents
- `embedding_metadata` - Vector embedding tracking

### Chat Schema (AI/RAG)

**Conversation Tables:**
- `conversations` - User chat conversations
- `messages` - Individual messages in conversations

**Memory Tables:**
- `conversation_memories` - Extracted semantic memories
- `memory_relationships` - Links between memories
- `action_cache` - Cached action mappings
- `memory_extraction_jobs` - Background job queue

---

## Core Tables

### profiles

User accounts and subscription management.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, references auth.users |
| `email` | TEXT | User email (unique) |
| `full_name` | TEXT | Display name |
| `tier` | TEXT | Subscription tier: free, pro, premium, enterprise |
| `credits` | INTEGER | Available AI credits |
| `stripe_customer_id` | TEXT | Stripe customer ID |
| `stripe_subscription_id` | TEXT | Stripe subscription ID |
| `subscription_status` | TEXT | Subscription status |
| `ocr_count_monthly` | INTEGER | Monthly OCR usage counter |
| `ocr_last_reset` | TIMESTAMPTZ | Last monthly reset timestamp |
| `created_at` | TIMESTAMPTZ | Account creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Key Indexes:**
- Primary key on `id`
- Unique constraint on `email`

---

### user_books

Central table for all user documents (consolidated from old `documents` table).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `title` | TEXT | Document title |
| `file_name` | TEXT | Original filename |
| `file_type` | TEXT | pdf, text (CHECK constraint) |
| `file_size_bytes` | BIGINT | File size in bytes |
| `s3_key` | TEXT | S3 storage path |
| `total_pages` | INTEGER | Page count (PDFs) |
| `text_content` | TEXT | Full text (text files) |
| `page_texts` | TEXT[] | Extracted page texts |
| `page_texts_cleaned` | TEXT[] | Cleaned texts for TTS |
| `content` | TEXT | Full document content (for AI/RAG) |
| `embedding_status` | TEXT | pending, processing, completed, failed |
| `needs_ocr` | BOOLEAN | Scanned PDF requiring OCR |
| `ocr_status` | TEXT | OCR processing status |
| `ocr_metadata` | JSONB | OCR metadata (confidence, tokens) |
| `tts_metadata` | JSONB | TTS settings and preferences |
| `tts_last_position` | JSONB | Last playback position |
| `custom_metadata` | JSONB | Flexible custom fields |
| `last_read_page` | INTEGER | Last read page number |
| `reading_progress` | DECIMAL | Progress percentage (0-100) |
| `last_read_at` | TIMESTAMPTZ | Last reading timestamp |
| `is_favorite` | BOOLEAN | Favorite flag |
| `notes_count` | INTEGER | Denormalized note count |
| `pomodoro_sessions_count` | INTEGER | Denormalized session count |
| `total_pomodoro_time_seconds` | INTEGER | Total study time |
| `total_pomodoro_sessions` | INTEGER | Total completed sessions |
| `last_pomodoro_at` | TIMESTAMPTZ | Last Pomodoro session |
| `created_at` | TIMESTAMPTZ | Upload timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Key Indexes:**
- Primary key on `id`
- `idx_user_books_user_id` on `user_id`
- `idx_user_books_last_read_cursor` covering index for pagination
- `idx_user_books_composite` for favorite/filter queries
- `idx_books_search` GIN index for full-text search
- Vector index on `description_embedding` (768-dim)

**RLS Policies:**
- SELECT: Users can read own books
- INSERT: Users can create own books
- UPDATE: Users can update own books
- DELETE: Users can delete own books

---

### user_notes

Annotations and research notes on book pages.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `book_id` | UUID | Foreign key to user_books |
| `page_number` | INTEGER | Page number (0-indexed) |
| `content` | TEXT | Note content |
| `position_x` | DECIMAL | X coordinate on page |
| `position_y` | DECIMAL | Y coordinate on page |
| `note_type` | TEXT | cornell, outline, mindmap, chart, boxing, freeform |
| `note_metadata` | JSONB | Template-specific data |
| `is_ai_generated` | BOOLEAN | AI-generated note flag |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

**Key Indexes:**
- Primary key on `id`
- `idx_user_notes_book_id` on `book_id`
- `idx_user_notes_book_page_covering` covering index with content/position

---

### user_highlights

Text highlights with position and context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `book_id` | UUID | Foreign key to user_books |
| `page_number` | INTEGER | Page number |
| `highlighted_text` | TEXT | Selected text |
| `color_id` | TEXT | Highlight color ID |
| `color_hex` | TEXT | Hex color code |
| `position_data` | JSONB | Canvas coordinates {x, y, width, height} |
| `text_start_offset` | INTEGER | Text range start |
| `text_end_offset` | INTEGER | Text range end |
| `text_context_before` | TEXT | 50 chars before for matching |
| `text_context_after` | TEXT | 50 chars after for matching |
| `is_orphaned` | BOOLEAN | Text was edited |
| `orphaned_reason` | TEXT | Reason for orphaned status |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

---

### pomodoro_sessions

Individual Pomodoro timer sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `book_id` | UUID | Foreign key to user_books |
| `started_at` | TIMESTAMPTZ | Session start |
| `ended_at` | TIMESTAMPTZ | Session end (NULL if active) |
| `duration_seconds` | INTEGER | Calculated duration |
| `mode` | TEXT | work, shortBreak, longBreak |
| `completed` | BOOLEAN | Completed successfully |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

---

### Chat Schema

#### conversations

User chat conversations linked to documents.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `document_id` | UUID | Foreign key to user_books (NULL for general chat) |
| `title` | TEXT | Conversation title |
| `metadata` | JSONB | Flexible metadata |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

#### messages

Individual messages within conversations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `conversation_id` | UUID | Foreign key to conversations |
| `role` | TEXT | user, assistant, system |
| `content` | TEXT | Message content |
| `tokens_used` | INTEGER | Token count |
| `model` | TEXT | AI model used |
| `metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMPTZ | Message timestamp |

#### conversation_memories

Extracted semantic memories from conversations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to profiles |
| `conversation_id` | UUID | Foreign key to conversations |
| `entity_type` | TEXT | concept, question, insight, reference, action, document |
| `entity_text` | TEXT | Memory content |
| `entity_metadata` | JSONB | Additional metadata |
| `source_message_id` | UUID | Foreign key to messages |
| `document_id` | UUID | Foreign key to user_books |
| `embedding` | vector(768) | Vector embedding |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Key Indexes:**
- Vector index: `idx_memories_user_embedding` (IVFFlat)
- `idx_memories_user_id` on `user_id`
- `idx_memories_entity_type` on `user_id, entity_type`

---

## Materialized Views

### user_books_daily_stats

Daily upload and activity statistics.

**Refresh:** Daily at 2 AM  
**Columns:** user_id, upload_date, total_books, pdf_books, text_books, total_size_bytes, avg_reading_progress, favorite_books, books_with_notes, books_with_sessions

### reading_stats_weekly

Weekly reading statistics aggregated by user.

**Refresh:** Weekly on Sunday at 3 AM  
**Columns:** user_id, week_start, books_read, total_progress, avg_progress_per_book, total_pages_read, avg_session_duration_seconds, total_study_time_seconds

### pomodoro_stats_daily

Daily Pomodoro session statistics.

**Refresh:** Daily at 2 AM  
**Columns:** user_id, session_date, total_sessions, work_sessions, break_sessions, completed_sessions, total_work_seconds, avg_work_duration_seconds, unique_books_studied

### user_activity_summary

Comprehensive user activity overview.

**Refresh:** Hourly or on-demand  
**Columns:** user_id, tier, total_books, favorite_books, books_with_notes, total_notes, notes_last_7_days, total_pomodoro_sessions, total_study_seconds, sessions_last_7_days, total_collections, total_tags, last_activity_at

### collection_hierarchy_cache

Cached collection hierarchy with book counts.

**Refresh:** On collection changes  
**Columns:** id, name, description, parent_id, color, icon, is_favorite, display_order, level, path, book_count

---

## Security

### Row-Level Security (RLS)

**All tables have RLS enabled.**

Basic pattern:
- **SELECT:** Users can read own data
- **INSERT:** Users can create own data
- **UPDATE:** Users can update own data
- **DELETE:** Users can delete own data

**Service functions** use `SECURITY DEFINER` with `SET search_path = ''` for safety.

### Index Security

- No index access bypasses RLS
- Vector indexes inherit table RLS
- Materialized views respect ownership

---

## Performance

### Index Strategy

**Total Indexes:** ~60-70 (optimized from 108+)

**Covering Indexes:**
- `user_notes`: Includes content, position, created_at
- `user_highlights`: Includes text, color, orphaned status
- `pomodoro_sessions`: Includes book_id, mode, duration

**Composite Indexes:**
- `user_books`: user_id, is_favorite, last_read_at DESC, id
- `book_collections`: collection_id, display_order
- `user_collections`: user_id, parent_id, display_order

**Partial Indexes:**
- `user_books_active_reading`: WHERE reading_progress > 0
- `pomodoro_sessions_active`: WHERE ended_at IS NULL
- `user_notes_recent`: WHERE created_at > NOW() - 30 days

**Vector Indexes:**
- IVFFlat with cosine distance for similarity search
- Dimensions: 768 (Gemini text-embedding-004)

### Query Patterns

**Library List:** Keyset pagination with covering index  
**Full-Text Search:** GIN index on tsvector  
**Vector Search:** IVFFlat index with cosine similarity  
**Stats Queries:** Materialized views pre-aggregated  
**Collection Hierarchy:** Recursive CTE with caching  

---

## Migrations

**Total Migrations:** 33+  
**Latest Migration:** 033_cleanup_unused_functions.sql

**Key Migration History:**
- 001-004: Core schema and S3 migration
- 005-008: Pomodoro and OCR support
- 007-016: Library organization and tags
- 017-025: Security fixes and highlights
- 026-027: Consolidation and standardization
- 028-033: Optimization and restructuring

---

## Backup & Recovery

### Automated Backups

Supabase provides daily backups (Pro+ tiers)

### Manual Export

```bash
# Export schema
pg_dump --schema-only $DATABASE_URL > schema.sql

# Export data (specific tables)
pg_dump -t user_books -t user_notes $DATABASE_URL > data.sql
```

### Recovery

```bash
# Restore schema
psql $DATABASE_URL < schema.sql

# Restore data
psql $DATABASE_URL < data.sql
```

---

## Monitoring

### Key Metrics

**Query Performance:**
- Library list: < 100ms
- Search: < 200ms
- Analytics: < 50ms (from views)

**Cache Hit Ratios:**
- Buffer cache: > 95%
- Index cache: > 99%

**Index Usage:**
- Unused indexes: < 10%
- Index bloat: < 20%

**Disk Usage:**
- Database size: Monitor growth
- Index overhead: Should be < 30% of data

### Health Checks

```bash
# Run audit script
./scripts/migration_audit.sh

# Run performance tests
psql $DATABASE_URL -f scripts/performance_test.sql

# Check index usage
psql $DATABASE_URL -f scripts/audit_indexes.sql
```

---

## Future Improvements

### Planned

1. **Read Replicas** for analytics workloads
2. **External Vector Store** migration (Pinecone/Supabase)
3. **Automatic VACUUM** scheduling
4. **Query Result Caching** for common queries

### Under Consideration

1. **TimescaleDB** for time-series Pomodoro data
2. **GraphQL API** layer on top of PostgREST
3. **Real-time Subscriptions** for live updates
4. **Multi-region Deployment** for global users

---

## Support

For questions or issues:
1. Check `docs/MIGRATION_GUIDE.md` for migration help
2. Review `docs/API_CHANGES.md` for breaking changes
3. Run audit scripts to diagnose problems
4. Consult Supabase documentation: https://supabase.com/docs

