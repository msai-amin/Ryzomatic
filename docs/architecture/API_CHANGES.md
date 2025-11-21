# API Changes - Database Restructuring

**Version:** 2.0  
**Date:** 2025-01-27  
**Breaking Changes:** Yes

---

## Overview

This document details all API and database changes resulting from the database restructuring effort (migrations 026-033). These changes consolidate the schema, improve performance, and separate concerns.

---

## Breaking Changes

### 1. Documents Table Removed ⚠️ CRITICAL

**Before:**
```typescript
// Old API - documents table
const { data } = await supabase
  .from('documents')
  .select('*')
  .eq('id', documentId);
```

**After:**
```typescript
// New API - user_books table
const { data } = await supabase
  .from('user_books')
  .select('*')
  .eq('id', documentId);
```

**Impact:**
- All code using `documents` table must be updated
- API endpoints have been updated
- TypeScript types may need adjustment

**Status:** ✅ **All API code updated** in this restructuring

---

### 2. Field Name Changes

#### file_size → file_size_bytes

**Before:**
```typescript
const book: UserBook = {
  file_size: 1024000, // ❌ Old
  // ...
};
```

**After:**
```typescript
const book: UserBook = {
  file_size_bytes: 1024000, // ✅ New
  // ...
};
```

**Impact:** Type definition updated in `lib/supabase.ts`

---

#### metadata → custom_metadata (in some contexts)

**Before:**
```typescript
await supabase
  .from('documents')
  .insert({
    metadata: { author: 'John Doe' } // ❌ Old
  });
```

**After:**
```typescript
await supabase
  .from('user_books')
  .insert({
    custom_metadata: { author: 'John Doe' } // ✅ New
  });
```

---

### 3. Chat Schema Separation ⚠️ CRITICAL

**Before:**
```typescript
// Public schema
const { data } = await supabase
  .from('conversations')
  .select('*');
  
const { data: messages } = await supabase
  .from('messages')
  .select('*');
```

**After:**
```typescript
// Chat schema
const { data } = await supabase
  .from('chat.conversations')
  .select('*');
  
const { data: messages } = await supabase
  .from('chat.messages')
  .select('*');
```

**Impact:**
- All chat-related queries must use `chat.` prefix
- Memory extraction jobs moved to chat schema
- Action cache moved to chat schema

**Status:** ⚠️ **Code updates pending** - see TODO list

---

## Non-Breaking Changes

### 1. New Fields in user_books

**Added fields for OCR support:**
```typescript
interface UserBook {
  // Existing fields...
  
  // NEW: OCR fields
  needs_ocr?: boolean;
  ocr_status?: 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed' | 'user_declined';
  ocr_metadata?: Record<string, any>;
  
  // NEW: AI/RAG fields
  content?: string; // Full document text for chat
  embedding_status?: 'pending' | 'processing' | 'completed' | 'failed';
}
```

**Usage:** Backward compatible, fields are optional

---

### 2. New Analytics Views

**Materialized views for faster queries:**

```typescript
// Direct table query (still works)
const { data } = await supabase
  .from('user_books')
  .select('*');

// NEW: Use materialized view for stats
const { data: stats } = await supabase
  .from('user_activity_summary')
  .select('*')
  .eq('user_id', userId);
```

**Benefits:** Faster dashboard queries, reduced load

---

### 3. Partitioning Functions

**New helper functions:**

```sql
-- Create partition for new user
SELECT create_user_partition(user_id);

-- Cleanup user data (GDPR)
SELECT cleanup_user_data(user_id);

-- List partitions
SELECT list_user_partitions();
```

**Usage:** Administrative, not typically called by application code

---

## Updated Endpoints

### POST /api/chat/stream

**Changes:**
- Uses `user_books` instead of `documents`
- References updated

**Example:**
```typescript
// ✅ Updated
const { data: document } = await supabase
  .from('user_books')
  .select('content')
  .eq('id', documentId)
  .single();
```

---

### POST /api/memory

**Changes:**
- Uses `user_books` instead of `documents`
- Join syntax updated

**Example:**
```typescript
// ✅ Updated
const { data: conversation } = await supabase
  .from('conversations')
  .select('*, user_books(*)')
  .eq('id', conversationId)
  .single();
```

---

### POST /api/documents/upload

**Changes:**
- Creates records in `user_books`
- Uses `file_size_bytes` instead of `file_size`
- Uses `custom_metadata` instead of `metadata`

**Example:**
```typescript
// ✅ Updated
const { data: document } = await supabase
  .from('user_books')
  .insert({
    title,
    file_name,
    file_size_bytes: file.size,
    file_type: file.mimetype,
    s3_key: s3Key,
    content,
    custom_metadata: { ... }
  });
```

---

### POST /api/documents/ocr-process

**Changes:**
- Updates `user_books` instead of `documents`
- OCR fields work the same way

**Example:**
```typescript
// ✅ Updated
await supabase
  .from('user_books')
  .update({
    ocr_status: 'completed',
    content: ocrResult.extractedText,
    ocr_metadata: { ... }
  })
  .eq('id', documentId);
```

---

## TypeScript Type Updates

### lib/supabase.ts

**Updated interfaces:**

```typescript
// ✅ Consolidated UserBook
export interface UserBook {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'text';
  file_size_bytes: number; // Changed from file_size
  total_pages?: number;
  s3_key?: string;
  text_content?: string;
  
  // NEW: OCR fields
  needs_ocr?: boolean;
  ocr_status?: string;
  ocr_metadata?: Record<string, any>;
  
  // NEW: AI/RAG fields
  content?: string;
  embedding_status?: string;
  
  // Metadata
  custom_metadata?: Record<string, any>; // Changed from metadata
  tts_metadata?: Record<string, any>;
  
  // Reading progress
  last_read_page: number;
  reading_progress: number;
  // ... other fields
}
```

**Removed interface:**

```typescript
// ❌ REMOVED - use UserBook instead
export interface Document {
  // This interface is deprecated
}
```

**Removed helper:**

```typescript
// ❌ REMOVED - use userBooks helper instead
export const documents = {
  list: ...,
  get: ...,
  create: ...,
  update: ...,
  delete: ...
};
```

---

## Migration Checklist

### For Developers

- [x] Update all `documents` references to `user_books`
- [x] Update `file_size` to `file_size_bytes`
- [x] Update API endpoints (chat, memory, documents)
- [ ] Update chat schema references (pending)
- [ ] Update any direct SQL queries
- [ ] Test all document-related features
- [ ] Verify OCR still works
- [ ] Check chat functionality
- [ ] Test memory extraction

### For Database Admins

- [x] Review migration SQL
- [x] Backup database
- [x] Run migrations in sequence
- [x] Verify data integrity
- [x] Check RLS policies
- [x] Run audit script
- [x] Monitor performance
- [ ] Update connection pooling config
- [ ] Configure analytics refresh schedules

---

## Rollback Instructions

### If Critical Issues Occur

**Option 1: Restore from Backup** (Recommended)

```bash
# Supabase Dashboard → Backups → Point-in-time recovery
# Select timestamp before migration 026
```

**Option 2: Manual Rollback** (Complex)

```sql
-- Recreate documents table
CREATE TABLE documents (...) AS SELECT * FROM user_books;

-- Restore foreign keys
ALTER TABLE conversations 
  DROP CONSTRAINT conversations_document_id_fkey,
  ADD CONSTRAINT conversations_document_id_fkey 
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Drop added columns from user_books
ALTER TABLE user_books 
  DROP COLUMN content,
  DROP COLUMN embedding_status,
  DROP COLUMN needs_ocr,
  DROP COLUMN ocr_status,
  DROP COLUMN ocr_metadata;

-- Application code must also be reverted
```

⚠️ **Warning:** Manual rollback is complex and error-prone. Prefer backup restore.

---

## Testing Guide

### 1. Smoke Tests

```bash
# Test document upload
curl -X POST /api/documents/upload
  -F "file=@test.pdf"
  -H "Authorization: Bearer $TOKEN"

# Test document retrieval
curl -X GET /api/books?userId=$USER_ID
  -H "Authorization: Bearer $TOKEN"

# Test chat
curl -X POST /api/chat/stream
  -H "Authorization: Bearer $TOKEN"
  -d '{"message": "Hello", "documentId": "$BOOK_ID"}'
```

### 2. Integration Tests

Run existing test suite:
```bash
npm test
# Should pass all tests
```

### 3. Performance Tests

```bash
# Run performance test script
psql $DATABASE_URL -f scripts/performance_test.sql

# Verify queries are fast
# All queries should be < 200ms
```

---

## Questions & Answers

**Q: Do I need to update my code immediately?**  
A: If you're using the latest API, it's already updated. If running older code, you'll need to update references.

**Q: Will this break my existing data?**  
A: No. Data is migrated from `documents` to `user_books` automatically.

**Q: What about documents I created before migration 026?**  
A: They're automatically migrated to `user_books` with all fields preserved.

**Q: Can I still use the same queries?**  
A: Yes, but you need to change table names and some field names (see above).

**Q: What if I have custom SQL queries?**  
A: You'll need to update them to use new table/field names. See examples above.

---

## Support

**Need Help?**

1. Check this document
2. Review `docs/DATABASE_SCHEMA.md`
3. Review `docs/MIGRATION_GUIDE.md`
4. Run audit script: `./scripts/migration_audit.sh`
5. Check Supabase dashboard for errors

**Common Issues:**

- "relation documents does not exist" → Use `user_books`
- "column file_size does not exist" → Use `file_size_bytes`
- "column metadata does not exist" → Use `custom_metadata`
- "schema chat does not exist" → Apply migration 031

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-01-27 | Complete restructuring, consolidation, optimization |
| 1.0 | Previous | Initial schema |

