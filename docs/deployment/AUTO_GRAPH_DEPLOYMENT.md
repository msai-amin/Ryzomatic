# Automatic Graph Generation - Deployment Guide

## Pre-Deployment Checklist

- [x] Migration file created: `050_document_content_and_auto_graph.sql`
- [x] Service created: `documentContentService.ts`
- [x] Integration completed: `DocumentUpload.tsx`
- [x] Integration completed: `supabaseStorageService.ts`
- [x] Documentation created: `AUTO_GRAPH_GENERATION.md`
- [ ] Local testing completed
- [ ] Staging deployment completed
- [ ] Production deployment completed

## Deployment Steps

### Step 1: Database Migration

#### Local Testing (Development)

```bash
# Navigate to project root
cd /Users/aminamouhadi/smart-reader-serverless

# Apply migration to local Supabase
supabase db push

# Or manually apply
psql $DATABASE_URL < supabase/migrations/050_document_content_and_auto_graph.sql
```

#### Verify Migration

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('document_content', 'document_descriptions', 'document_relationships');

-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'auto_generate_relationships_trigger';

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN (
  'auto_generate_document_relationships',
  'regenerate_all_document_relationships',
  'get_full_document_content',
  'search_document_content'
);

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('document_content', 'document_descriptions');
```

### Step 2: Code Deployment

#### Files Changed

1. **New Files**:
   - `supabase/migrations/050_document_content_and_auto_graph.sql`
   - `src/services/documentContentService.ts`
   - `docs/features/AUTO_GRAPH_GENERATION.md`
   - `docs/deployment/AUTO_GRAPH_DEPLOYMENT.md`

2. **Modified Files**:
   - `src/services/supabaseStorageService.ts` (added content storage on PDF open)
   - `src/components/DocumentUpload.tsx` (added content storage on upload)

#### Build & Test

```bash
# Install dependencies (if needed)
npm install

# Run linter
npm run lint

# Run type check
npm run type-check

# Build
npm run build

# Run tests
npm test
```

### Step 3: Environment Variables

No new environment variables required! The system uses existing:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GOOGLE_GEMINI_API_KEY` (already configured)

### Step 4: Deploy to Vercel

#### Automatic Deployment (Recommended)

```bash
# Commit changes
git add .
git commit -m "feat: Implement automatic graph generation with vector embeddings

- Add document_content table for persistent text storage
- Add auto_generate_document_relationships trigger
- Integrate documentContentService in upload flow
- Enable O(1) similarity search with pgvector
- Add comprehensive documentation"

# Push to main (triggers Vercel deployment)
git push origin main
```

#### Manual Deployment (Alternative)

```bash
# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

### Step 5: Database Migration (Production)

#### Option A: Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `050_document_content_and_auto_graph.sql`
3. Click "Run"
4. Verify success (no errors)

#### Option B: Supabase CLI

```bash
# Link to production project
supabase link --project-ref YOUR_PROJECT_REF

# Push migration
supabase db push
```

#### Option C: Manual psql

```bash
# Connect to production database
psql $PRODUCTION_DATABASE_URL < supabase/migrations/050_document_content_and_auto_graph.sql
```

### Step 6: Verification (Production)

#### 1. Check Database

```sql
-- Verify tables
SELECT COUNT(*) FROM document_content;
SELECT COUNT(*) FROM document_descriptions;

-- Verify trigger
SELECT * FROM pg_trigger WHERE tgname = 'auto_generate_relationships_trigger';
```

#### 2. Test Upload Flow

1. Upload a new PDF document
2. Check logs for "Storing document content"
3. Verify content stored:
   ```sql
   SELECT book_id, chunk_count, word_count 
   FROM document_content 
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

4. Check embedding generated:
   ```sql
   SELECT book_id, description_embedding IS NOT NULL as has_embedding
   FROM document_descriptions 
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY updated_at DESC 
   LIMIT 5;
   ```

5. Check relationships created:
   ```sql
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

#### 3. Test Related Documents UI

1. Open a document
2. Navigate to "Related Documents" tab
3. Verify relationships appear instantly
4. Check similarity scores are displayed

### Step 7: Backfill Existing Documents

For documents uploaded before this feature:

#### Option A: Automatic (Lazy Loading)

Documents will be processed automatically when users open them. No action needed.

#### Option B: Manual Trigger (Batch Processing)

Create a one-time script or admin function:

```typescript
// In browser console or admin panel
const userId = 'YOUR_USER_ID';

// Get all books without content
const { data: books } = await supabase
  .from('user_books')
  .select('id')
  .eq('user_id', userId);

// Process each book
for (const book of books) {
  // Open the book (triggers extraction)
  const bookData = await supabaseStorageService.getBook(book.id);
  console.log(`Processed: ${bookData.title}`);
  
  // Wait a bit to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Regenerate all relationships
const stats = await documentContentService.regenerateAllRelationships(userId, 0.60);
console.log(`Generated ${stats.totalRelationships} relationships for ${stats.totalBooks} books`);
```

#### Option C: Database-Level Backfill

If you have direct database access:

```sql
-- This would require a custom migration or script
-- to extract text from S3, generate embeddings, and store them
-- Not recommended for production (use Option A or B)
```

## Monitoring

### Key Metrics

1. **Content Storage Rate**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as documents_processed
   FROM document_content
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

2. **Embedding Generation Rate**
   ```sql
   SELECT 
     DATE(last_auto_generated_at) as date,
     COUNT(*) as embeddings_generated
   FROM document_descriptions
   WHERE description_embedding IS NOT NULL
   GROUP BY DATE(last_auto_generated_at)
   ORDER BY date DESC;
   ```

3. **Relationship Generation Rate**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as relationships_created,
     AVG(relevance_percentage) as avg_similarity
   FROM document_relationships
   WHERE relevance_calculation_status = 'completed'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

4. **Error Rate**
   ```sql
   -- Check for failed relationships
   SELECT COUNT(*) 
   FROM document_relationships 
   WHERE relevance_calculation_status = 'failed';
   ```

### Logging

Key log messages to monitor:

- `"Storing document content"` - Content storage initiated
- `"Document content stored successfully"` - Content stored
- `"Generating embedding and description"` - Embedding generation started
- `"Embedding stored, automatic relationship generation triggered"` - Trigger fired
- `"Failed to store document content"` - Error (investigate)
- `"Failed to generate embedding"` - Error (check API key)

### Performance Monitoring

```sql
-- Check average query time for vector search
EXPLAIN ANALYZE
SELECT * FROM document_descriptions
WHERE description_embedding <=> '[0.1, 0.2, ...]'::vector
ORDER BY description_embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 20;

-- Should be <100ms with proper indexing
```

## Rollback Plan

### If Issues Occur

#### 1. Disable Trigger (Immediate)

```sql
-- Disable automatic relationship generation
DROP TRIGGER IF EXISTS auto_generate_relationships_trigger ON document_descriptions;

-- Re-enable later
CREATE TRIGGER auto_generate_relationships_trigger
  AFTER INSERT OR UPDATE OF description_embedding ON document_descriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_relationships();
```

#### 2. Revert Code Changes

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

#### 3. Drop Tables (Nuclear Option)

```sql
-- CAUTION: This deletes all data
DROP TABLE IF EXISTS document_content CASCADE;

-- Relationships table is unchanged, so existing relationships remain
-- Only new automatic generation is disabled
```

### Data Recovery

If content storage fails but uploads succeed:
- Documents are still in S3
- Text can be re-extracted on next open
- No data loss

If embedding generation fails:
- Content is still stored
- Can retry embedding generation manually
- Relationships can be regenerated later

## Post-Deployment Tasks

### Week 1: Monitoring

- [ ] Check error logs daily
- [ ] Monitor embedding generation rate
- [ ] Verify relationship quality (spot check)
- [ ] Monitor database size growth
- [ ] Check API costs (Gemini embeddings)

### Week 2: Optimization

- [ ] Analyze similarity threshold (adjust if needed)
- [ ] Check index performance
- [ ] Optimize chunking strategy (if needed)
- [ ] Review user feedback on "Related Documents"

### Month 1: Analysis

- [ ] Calculate cost savings vs. LLM approach
- [ ] Measure user engagement with "Related Documents"
- [ ] Identify most common similarity scores
- [ ] Plan Phase 2 enhancements

## Troubleshooting

### Issue: No relationships generated

**Symptoms**: Documents upload successfully but no relationships appear

**Diagnosis**:
```sql
-- Check if embeddings exist
SELECT book_id, description_embedding IS NOT NULL 
FROM document_descriptions 
WHERE user_id = 'USER_ID';

-- Check if trigger is active
SELECT * FROM pg_trigger 
WHERE tgname = 'auto_generate_relationships_trigger';
```

**Solution**:
1. Verify trigger exists (see above)
2. Check embedding generation logs
3. Manually trigger relationship generation:
   ```typescript
   await documentContentService.regenerateAllRelationships(userId, 0.60);
   ```

### Issue: Slow uploads

**Symptoms**: Document uploads take longer than before

**Diagnosis**:
- Content storage is async and shouldn't block
- Check logs for "Failed to store document content"
- Check database connection pool

**Solution**:
1. Verify async execution (no `await` on content storage)
2. Increase database connection pool if needed
3. Consider moving to background job queue

### Issue: High API costs

**Symptoms**: Gemini API costs higher than expected

**Diagnosis**:
```sql
-- Count embeddings generated
SELECT COUNT(*) FROM document_descriptions 
WHERE description_embedding IS NOT NULL;
```

**Solution**:
1. Verify embeddings are only generated once per document
2. Check for duplicate uploads
3. Consider caching embeddings for identical content

## Success Criteria

✅ **Deployment Successful** if:
1. Migration applies without errors
2. New documents generate relationships automatically
3. "Related Documents" tab populates instantly
4. No increase in upload errors
5. Database queries remain fast (<100ms)
6. API costs stay within budget (<$0.001 per document)

## Contact & Support

- **Documentation**: `/docs/features/AUTO_GRAPH_GENERATION.md`
- **Migration File**: `/supabase/migrations/050_document_content_and_auto_graph.sql`
- **Service Code**: `/src/services/documentContentService.ts`

---

**Deployment Date**: _To be filled after deployment_
**Deployed By**: _To be filled after deployment_
**Production URL**: https://smart-reader-serverless.vercel.app
**Database**: Supabase (Production)

