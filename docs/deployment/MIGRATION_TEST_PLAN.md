# Migration 050 - Test Plan

## Migration File
`supabase/migrations/050_document_content_and_auto_graph.sql`

## Pre-Migration Checks

### 1. Verify pgvector Extension
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```
Expected: Should return 1 row (pgvector already installed in migration 022)

### 2. Check Existing Tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('user_books', 'document_descriptions', 'document_relationships');
```
Expected: All 3 tables should exist

### 3. Check Existing Functions
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'update_updated_at_column';
```
Expected: Should exist (used in trigger)

## Migration Application

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard
2. Select project: `pbfipmvtkbivnwwgukpw`
3. Navigate to SQL Editor
4. Create new query
5. Paste contents of `050_document_content_and_auto_graph.sql`
6. Click "Run"
7. Verify no errors

### Option 2: psql Command Line
```bash
# Set connection string
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.pbfipmvtkbivnwwgukpw.supabase.co:5432/postgres"

# Apply migration
psql $DATABASE_URL < supabase/migrations/050_document_content_and_auto_graph.sql
```

## Post-Migration Verification

### 1. Verify Tables Created
```sql
-- Check document_content table
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'document_content'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- book_id (uuid)
- user_id (uuid)
- content (text)
- chunk_index (integer)
- chunk_count (integer)
- extraction_method (text)
- word_count (integer)
- character_count (integer)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

### 2. Verify Indexes Created
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'document_content';
```

Expected indexes:
- `document_content_pkey` (PRIMARY KEY on id)
- `idx_doc_content_book_id` (on book_id)
- `idx_doc_content_user_id` (on user_id)
- `idx_doc_content_chunk` (on book_id, chunk_index)
- `idx_doc_content_fts` (GIN index for full-text search)

### 3. Verify RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'document_content';
```

Expected policies:
- Users can read own document content (SELECT)
- Users can create own document content (INSERT)
- Users can update own document content (UPDATE)
- Users can delete own document content (DELETE)

### 4. Verify Functions Created
```sql
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name IN (
  'get_full_document_content',
  'get_document_content_summary',
  'auto_generate_document_relationships',
  'regenerate_all_document_relationships',
  'trigger_auto_generate_relationships',
  'search_document_content',
  'get_document_content_stats'
)
ORDER BY routine_name;
```

Expected: All 7 functions should exist

### 5. Verify Trigger Created
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'auto_generate_relationships_trigger';
```

Expected:
- trigger_name: `auto_generate_relationships_trigger`
- event_manipulation: `INSERT` and `UPDATE`
- event_object_table: `document_descriptions`

### 6. Test Function Execution

#### Test get_full_document_content
```sql
-- Should return empty string (no content yet)
SELECT get_full_document_content('00000000-0000-0000-0000-000000000000');
```

#### Test search_document_content
```sql
-- Should return empty array (no content yet)
SELECT * FROM search_document_content('test query', 10);
```

#### Test get_document_content_stats
```sql
-- Should return zeros (no content yet)
SELECT * FROM get_document_content_stats(auth.uid());
```

## Functional Testing

### Test 1: Insert Document Content

```sql
-- Insert test content
INSERT INTO document_content (
  book_id,
  user_id,
  content,
  chunk_index,
  chunk_count,
  extraction_method,
  word_count,
  character_count
) VALUES (
  gen_random_uuid(),
  auth.uid(),
  'This is a test document about quantum physics and relativity.',
  0,
  1,
  'manual',
  10,
  61
);

-- Verify insertion
SELECT * FROM document_content WHERE user_id = auth.uid();
```

Expected: 1 row inserted successfully

### Test 2: Full-Text Search

```sql
-- Search for 'quantum'
SELECT * FROM search_document_content('quantum', 10);
```

Expected: Should return the test document with highlighted snippet

### Test 3: Trigger Automatic Relationship Generation

```sql
-- Insert a document description with embedding
-- (This should trigger auto_generate_document_relationships)

-- First, create a test book
INSERT INTO user_books (id, user_id, title, file_name, file_type, file_size, total_pages)
VALUES (
  gen_random_uuid(),
  auth.uid(),
  'Test Book 1',
  'test1.pdf',
  'pdf',
  1000,
  10
)
RETURNING id;

-- Note the returned ID, then insert description with embedding
INSERT INTO document_descriptions (
  book_id,
  user_id,
  description_embedding,
  is_ai_generated,
  last_auto_generated_at
) VALUES (
  'BOOK_ID_FROM_ABOVE',
  auth.uid(),
  array_fill(0.1::float, ARRAY[768])::vector, -- Dummy 768-dim vector
  true,
  NOW()
);

-- Check if trigger fired (should see log or check relationships table)
SELECT * FROM document_relationships WHERE user_id = auth.uid();
```

Expected: Trigger should execute without errors (relationships may be empty if no similar documents exist)

### Test 4: Regenerate All Relationships

```sql
-- Call the regenerate function
SELECT * FROM regenerate_all_document_relationships(0.60);
```

Expected: Should return array of {book_id, relationships_created}

## Cleanup Test Data

```sql
-- Delete test content
DELETE FROM document_content WHERE user_id = auth.uid();

-- Delete test descriptions
DELETE FROM document_descriptions WHERE user_id = auth.uid();

-- Delete test books
DELETE FROM user_books WHERE title LIKE 'Test Book%' AND user_id = auth.uid();

-- Delete test relationships
DELETE FROM document_relationships WHERE user_id = auth.uid();
```

## Performance Testing

### Test Vector Search Performance

```sql
-- Create sample data (10 documents with embeddings)
DO $$
DECLARE
  i INTEGER;
  book_uuid UUID;
BEGIN
  FOR i IN 1..10 LOOP
    -- Insert book
    INSERT INTO user_books (id, user_id, title, file_name, file_type, file_size, total_pages)
    VALUES (
      gen_random_uuid(),
      auth.uid(),
      'Performance Test Book ' || i,
      'test' || i || '.pdf',
      'pdf',
      1000,
      10
    )
    RETURNING id INTO book_uuid;
    
    -- Insert description with random embedding
    INSERT INTO document_descriptions (
      book_id,
      user_id,
      description_embedding,
      is_ai_generated
    ) VALUES (
      book_uuid,
      auth.uid(),
      (SELECT array_agg(random()::float) FROM generate_series(1, 768))::vector,
      true
    );
  END LOOP;
END $$;

-- Test query performance
EXPLAIN ANALYZE
SELECT 
  dd.book_id,
  1 - (dd.description_embedding <=> (SELECT description_embedding FROM document_descriptions LIMIT 1)) as similarity
FROM document_descriptions dd
WHERE dd.user_id = auth.uid()
ORDER BY dd.description_embedding <=> (SELECT description_embedding FROM document_descriptions LIMIT 1)
LIMIT 20;
```

Expected: Query should complete in <100ms with index usage

## Rollback Plan

If migration fails or causes issues:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS auto_generate_relationships_trigger ON document_descriptions;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_auto_generate_relationships CASCADE;
DROP FUNCTION IF EXISTS auto_generate_document_relationships CASCADE;
DROP FUNCTION IF EXISTS regenerate_all_document_relationships CASCADE;
DROP FUNCTION IF EXISTS get_full_document_content CASCADE;
DROP FUNCTION IF EXISTS get_document_content_summary CASCADE;
DROP FUNCTION IF EXISTS search_document_content CASCADE;
DROP FUNCTION IF EXISTS get_document_content_stats CASCADE;

-- Drop table (CAUTION: Deletes all data)
DROP TABLE IF EXISTS document_content CASCADE;
```

## Success Criteria

✅ Migration is successful if:
1. All tables created without errors
2. All indexes created successfully
3. All RLS policies applied
4. All functions created and executable
5. Trigger created and fires correctly
6. Test queries return expected results
7. Performance is acceptable (<100ms for vector search)
8. No impact on existing functionality

## Notes

- Migration is **additive only** - no existing tables are modified
- Migration is **idempotent** - can be run multiple times safely (uses `IF NOT EXISTS`)
- Migration uses **SECURITY DEFINER** for functions - ensures proper permissions
- Migration includes **comprehensive comments** for maintainability

## Approval

- [ ] Pre-migration checks passed
- [ ] Migration applied successfully
- [ ] Post-migration verification passed
- [ ] Functional tests passed
- [ ] Performance tests passed
- [ ] Ready for production deployment

**Tested By**: _________________
**Date**: _________________
**Approved By**: _________________

