# Local Testing Guide - Automatic Graph Generation

**Server**: Running on http://localhost:3001  
**Status**: ✅ Active  
**Date**: November 21, 2025

---

## 🚀 Server Status

```bash
✅ Dev server running on port 3001
✅ Vite HMR enabled
✅ React Fast Refresh active
✅ Environment variables loaded from .env.local
```

**Access the app**: http://localhost:3001

---

## 🧪 Testing Checklist

### Phase 1: Basic Functionality (No Migration Yet)

Since we haven't applied the database migration yet, the new features won't work, but we can verify the existing app works:

#### 1.1 App Loads ✅
- [ ] Navigate to http://localhost:3001
- [ ] App loads without errors
- [ ] No console errors
- [ ] Authentication modal appears

#### 1.2 Login Works
- [ ] Click "Sign in with Google"
- [ ] Complete OAuth flow
- [ ] Redirected back to app
- [ ] User profile loaded

#### 1.3 Existing Features Work
- [ ] Library modal opens
- [ ] Can view existing documents
- [ ] Can open a document
- [ ] PDF viewer loads
- [ ] Highlights work
- [ ] Notes work
- [ ] Related Documents panel exists (may be empty)

---

### Phase 2: Apply Migration Locally

To test the new features, we need to apply the migration to your database.

#### Option A: Apply to Production Database (Recommended)

Since you don't have local Supabase running, apply to production:

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Project: `pbfipmvtkbivnwwgukpw`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Paste Migration**
   - Open: `supabase/migrations/050_document_content_and_auto_graph.sql`
   - Copy all contents (395 lines)
   - Paste into SQL Editor

4. **Run Migration**
   - Click "Run" (or press Cmd+Enter)
   - Wait for completion
   - Verify: "Success. No rows returned"

5. **Verify Tables Created**
   ```sql
   -- Run this query to verify
   SELECT table_name FROM information_schema.tables 
   WHERE table_name IN ('document_content', 'document_descriptions', 'document_relationships');
   ```
   - Expected: 3 rows

6. **Verify Trigger Created**
   ```sql
   -- Run this query to verify
   SELECT trigger_name FROM information_schema.triggers 
   WHERE trigger_name = 'auto_generate_relationships_trigger';
   ```
   - Expected: 1 row

#### Option B: Skip Migration (Test Code Only)

If you want to test just the code changes without the database:
- The app will work normally
- New features will fail gracefully (logged warnings)
- Existing features unaffected

---

### Phase 3: Test New Features (After Migration)

#### 3.1 Upload a New Document

1. **Prepare Test PDFs**
   - Use 2-3 PDFs with related content
   - Example: "Quantum Physics.pdf", "Introduction to Physics.pdf"
   - Or any PDFs you have

2. **Upload First Document**
   - Click "Upload Document" or drag & drop
   - Select a PDF
   - Wait for upload to complete

3. **Check Browser Console**
   - Open DevTools (F12 or Cmd+Option+I)
   - Look for these log messages:
     ```
     ✅ "Storing document content"
     ✅ "Document content stored successfully"
     ✅ "Generating embedding and description"
     ✅ "Embedding stored, automatic relationship generation triggered"
     ```

4. **Check Network Tab**
   - Look for POST to `/api/gemini/embedding`
   - Status should be 200
   - Response should contain 768-element array

5. **Verify in Database**
   ```sql
   -- Check content stored
   SELECT book_id, chunk_count, word_count, extraction_method
   FROM document_content 
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY created_at DESC 
   LIMIT 5;
   
   -- Check embedding generated
   SELECT book_id, description_embedding IS NOT NULL as has_embedding
   FROM document_descriptions 
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY updated_at DESC 
   LIMIT 5;
   ```

#### 3.2 Upload Second Related Document

1. **Upload Another PDF**
   - Choose a PDF with related content to the first
   - Complete upload

2. **Check Console for Trigger**
   - Look for: "Embedding stored, automatic relationship generation triggered"

3. **Verify Relationships Created**
   ```sql
   -- Check relationships
   SELECT 
     dr.source_document_id,
     dr.related_document_id,
     dr.relevance_percentage,
     ub1.title as source_title,
     ub2.title as related_title
   FROM document_relationships dr
   JOIN user_books ub1 ON ub1.id = dr.source_document_id
   JOIN user_books ub2 ON ub2.id = dr.related_document_id
   WHERE dr.user_id = 'YOUR_USER_ID'
   ORDER BY dr.created_at DESC
   LIMIT 10;
   ```

#### 3.3 Test Related Documents UI

1. **Open First Document**
   - Click on the first uploaded document
   - PDF viewer opens

2. **Navigate to Related Documents Tab**
   - Click "Related Documents" in sidebar
   - Should see the second document listed
   - Should show similarity percentage (e.g., "85%")

3. **Verify Instant Loading**
   - No loading spinner
   - Relationships appear immediately
   - Click "Preview" to test preview modal

4. **Test Preview Modal**
   - Click preview icon on a related document
   - Modal opens with document details
   - Shows relevance analysis
   - Can close modal

#### 3.4 Test with Multiple Documents

1. **Upload 3-5 More Documents**
   - Mix of related and unrelated topics
   - Example: 2 physics PDFs, 2 history PDFs, 1 cooking PDF

2. **Check Relationships**
   - Physics PDFs should relate to each other (high %)
   - History PDFs should relate to each other (high %)
   - Cooking PDF should have low/no relationships

3. **Verify Similarity Scores**
   - Related documents: 60-90%
   - Unrelated documents: <50% or not shown

#### 3.5 Test Full-Text Search (Bonus)

```sql
-- Search for a keyword across all documents
SELECT * FROM search_document_content('quantum', 10);

-- Should return ranked results with snippets
```

---

### Phase 4: Performance Testing

#### 4.1 Measure Upload Time

1. **Upload a Large PDF (50+ pages)**
2. **Time the process**:
   - Start: Click upload
   - End: "Upload complete" message
3. **Expected**: 5-15 seconds (depending on PDF size)
4. **Check**: Content storage should be async (doesn't block)

#### 4.2 Measure Relationship Generation Time

1. **Check Database Timestamps**
   ```sql
   SELECT 
     created_at,
     updated_at,
     EXTRACT(EPOCH FROM (updated_at - created_at)) as seconds
   FROM document_relationships
   ORDER BY created_at DESC
   LIMIT 10;
   ```
2. **Expected**: <1 second (usually <0.1s)

#### 4.3 Measure Query Performance

```sql
-- Test vector search performance
EXPLAIN ANALYZE
SELECT 
  dd.book_id,
  1 - (dd.description_embedding <=> (
    SELECT description_embedding 
    FROM document_descriptions 
    LIMIT 1
  )) as similarity
FROM document_descriptions dd
WHERE dd.user_id = 'YOUR_USER_ID'
ORDER BY dd.description_embedding <=> (
  SELECT description_embedding 
  FROM document_descriptions 
  LIMIT 1
)
LIMIT 20;
```

**Expected**: Execution time <100ms

---

### Phase 5: Error Handling Testing

#### 5.1 Test Graceful Degradation

1. **Temporarily Disable Gemini API**
   - Comment out `GOOGLE_GEMINI_API_KEY` in `.env.local`
   - Restart server

2. **Upload a Document**
   - Should still succeed
   - Console shows: "Embedding service unavailable"
   - No crash

3. **Re-enable API**
   - Uncomment `GOOGLE_GEMINI_API_KEY`
   - Restart server

#### 5.2 Test Network Failure

1. **Disconnect Internet**
2. **Try to Upload**
   - Should show error message
   - App doesn't crash
   - Can retry after reconnecting

#### 5.3 Test Large Document

1. **Upload 200+ Page PDF**
2. **Verify Chunking**
   ```sql
   SELECT book_id, chunk_index, chunk_count, character_count
   FROM document_content
   WHERE book_id = 'LARGE_DOC_ID'
   ORDER BY chunk_index;
   ```
3. **Expected**: Multiple chunks (10,000 chars each)

---

## 🐛 Troubleshooting

### Issue: "Storing document content" not appearing

**Possible Causes**:
1. Migration not applied
2. User not authenticated
3. PDF extraction failed

**Solution**:
```javascript
// Check in browser console
console.log('User ID:', user?.id);
console.log('Document uploaded:', documentId);
```

### Issue: No embeddings generated

**Possible Causes**:
1. Gemini API key not set
2. API rate limit exceeded
3. Network error

**Solution**:
```bash
# Check .env.local
cat .env.local | grep GEMINI_API_KEY

# Check API status
curl -X POST http://localhost:3001/api/gemini/embedding \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}'
```

### Issue: No relationships created

**Possible Causes**:
1. Trigger not created
2. Similarity threshold too high
3. Only one document uploaded

**Solution**:
```sql
-- Check trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'auto_generate_relationships_trigger';

-- Lower threshold temporarily
SELECT * FROM regenerate_all_document_relationships(0.50);
```

### Issue: Slow performance

**Possible Causes**:
1. Index not created
2. Too many documents
3. Network latency

**Solution**:
```sql
-- Check index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'document_descriptions' 
AND indexname LIKE '%embedding%';

-- Rebuild index if needed
REINDEX INDEX idx_doc_desc_embedding;
```

---

## 📊 Monitoring During Testing

### Browser Console Logs to Watch

**Good Signs** ✅:
```
[INFO] Storing document content
[INFO] Document content stored successfully
[INFO] Generating embedding and description
[INFO] Embedding stored, automatic relationship generation triggered
```

**Warning Signs** ⚠️:
```
[WARN] Failed to store document content
[WARN] Embedding service unavailable
[ERROR] Failed to generate embedding
```

### Network Requests to Monitor

1. **POST /api/gemini/embedding**
   - Status: 200
   - Response: `{ embedding: [768 numbers] }`

2. **Supabase Requests**
   - `INSERT INTO document_content`
   - `INSERT INTO document_descriptions`
   - `SELECT FROM document_relationships`

### Database Queries to Run

```sql
-- Overall stats
SELECT 
  (SELECT COUNT(*) FROM document_content) as content_count,
  (SELECT COUNT(*) FROM document_descriptions WHERE description_embedding IS NOT NULL) as embedding_count,
  (SELECT COUNT(*) FROM document_relationships) as relationship_count;

-- Recent activity
SELECT 
  'content' as type, 
  created_at 
FROM document_content 
WHERE user_id = 'YOUR_USER_ID'
UNION ALL
SELECT 
  'embedding' as type, 
  last_auto_generated_at 
FROM document_descriptions 
WHERE user_id = 'YOUR_USER_ID' AND description_embedding IS NOT NULL
UNION ALL
SELECT 
  'relationship' as type, 
  created_at 
FROM document_relationships 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✅ Testing Completion Checklist

### Basic Functionality
- [ ] App loads on localhost:3001
- [ ] Login works
- [ ] Existing features work
- [ ] No console errors

### New Features (After Migration)
- [ ] Document upload stores content
- [ ] Embeddings generated automatically
- [ ] Relationships created automatically
- [ ] Related Documents tab shows relationships
- [ ] Similarity scores displayed correctly
- [ ] Preview modal works

### Performance
- [ ] Upload completes in reasonable time
- [ ] Relationships appear instantly (<100ms)
- [ ] No UI lag or freezing
- [ ] Console shows async operations

### Error Handling
- [ ] Graceful degradation when API unavailable
- [ ] Network errors handled properly
- [ ] Large documents chunked correctly
- [ ] No crashes or unhandled exceptions

### Database
- [ ] Content stored in document_content
- [ ] Embeddings stored in document_descriptions
- [ ] Relationships stored in document_relationships
- [ ] Trigger fires automatically
- [ ] Indexes created and used

---

## 🎯 Success Criteria

Testing is successful if:

1. ✅ All existing features still work
2. ✅ New documents generate content + embeddings
3. ✅ Relationships created automatically
4. ✅ Related Documents tab populates instantly
5. ✅ No errors in console (except expected warnings)
6. ✅ Performance is acceptable (<100ms for relationships)
7. ✅ Error handling works gracefully

---

## 📝 Next Steps After Testing

1. **If All Tests Pass**:
   - Migration is already applied to production DB
   - Ready to deploy code to Vercel
   - Follow `READY_FOR_DEPLOYMENT.md`

2. **If Issues Found**:
   - Document the issue
   - Check troubleshooting section
   - Fix and re-test
   - Don't deploy until all tests pass

3. **After Successful Testing**:
   - Commit changes
   - Push to production
   - Monitor for 24 hours
   - Collect user feedback

---

## 🔗 Quick Links

- **App**: http://localhost:3001
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Migration File**: `supabase/migrations/050_document_content_and_auto_graph.sql`
- **Deployment Guide**: `READY_FOR_DEPLOYMENT.md`
- **Test Report**: `TEST_EVALUATION_REPORT.md`

---

**Happy Testing!** 🧪

If you encounter any issues, check the troubleshooting section or refer to the comprehensive documentation in `docs/`.

