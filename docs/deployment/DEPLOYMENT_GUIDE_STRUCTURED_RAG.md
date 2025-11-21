# Deployment Guide: Structured RAG Memory System

## Prerequisites

- Supabase database with pgvector extension
- Environment variables configured
- Node.js 18+ with TypeScript

## Step 1: Verify Database Setup

The database tables should already be created. Verify with:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'conversation_memories',
  'memory_relationships', 
  'action_cache',
  'memory_extraction_jobs'
);

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Step 2: Environment Variables

Ensure these are set in your Vercel environment or `.env.local`:

```bash
# Required
GEMINI_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here

# Optional (for production monitoring)
LOG_LEVEL=info
ENABLE_MEMORY_EXTRACTION=true
MEMORY_EXTRACTION_THRESHOLD=4  # Extract after 4+ messages
```

## Step 3: Deploy to Vercel

The code is already in your repository. Deploy:

```bash
# Push to main branch triggers deployment
git add .
git commit -m "Add Structured RAG Memory System"
git push origin main

# Or deploy directly
vercel --prod
```

## Step 4: Test the Integration

After deployment, test the API endpoints:

### Test Memory Extraction

```bash
curl -X POST https://your-domain.vercel.app/api/memory/extract \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "YOUR_CONVERSATION_ID",
    "documentId": "YOUR_DOCUMENT_ID"
  }'
```

Expected response:
```json
{
  "success": true,
  "conversationId": "abc123",
  "entitiesCreated": 12,
  "relationshipsCreated": 8
}
```

### Test Memory Search

```bash
curl -X POST https://your-domain.vercel.app/api/memory/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "methodology",
    "limit": 10,
    "entityTypes": ["concept", "insight"]
  }'
```

Expected response:
```json
{
  "success": true,
  "query": "methodology",
  "memories": [...],
  "count": 5
}
```

### Test Chat with Memory

```bash
curl -X POST https://your-domain.vercel.app/api/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What did I read about methodology?",
    "conversationId": "YOUR_CONV_ID"
  }'
```

## Step 5: Enable for Production

### For Pro+ Tier Users

Memory context is automatically enabled for Pro, Premium, and Enterprise tier users. Verify user tiers in your profiles table:

```sql
SELECT id, tier FROM profiles WHERE tier IN ('pro', 'premium', 'enterprise');
```

### Trigger Automatic Extraction

Memory extraction happens automatically when:
- User has 4+ messages in a conversation
- User is on Pro+ tier
- No previous extraction job exists

To manually trigger extraction:

```bash
# Via API
curl -X POST /api/memory/extract ...

# Or via SQL
INSERT INTO memory_extraction_jobs (conversation_id, user_id, status)
VALUES ('conversation_id', 'user_id', 'pending');
```

## Step 6: Monitor Usage

Check extraction jobs:

```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
FROM memory_extraction_jobs
GROUP BY status;
```

Check memory growth:

```sql
SELECT 
  entity_type,
  COUNT(*) as count
FROM conversation_memories
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY entity_type
ORDER BY count DESC;
```

Monitor cache performance:

```sql
SELECT 
  action_type,
  COUNT(*) as total,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits
FROM action_cache
GROUP BY action_type;
```

## Troubleshooting

### Issue: "Vector extension not found"

**Solution**: Enable pgvector in Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: "Embedding generation failed"

**Solution**: Check GEMINI_API_KEY environment variable:

```bash
echo $GEMINI_API_KEY
```

Or test directly:

```bash
curl https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
```

### Issue: "Memory extraction returns 0 entities"

**Possible causes**:
1. Conversation has < 2 messages
2. Messages are too short (< 10 characters)
3. Gemini API rate limit hit

**Solution**: Check logs for extraction errors:

```sql
SELECT * FROM memory_extraction_jobs 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Issue: "Context builder returns no memories"

**Possible causes**:
1. No memories extracted yet for this user
2. Query similarity threshold too high (default 0.7)
3. No memories match the query

**Solution**: Lower threshold or extract more memories:

```typescript
// In your code
const memories = await memoryService.searchMemories({
  userId,
  query,
  similarityThreshold: 0.6, // Lower threshold
});
```

## Performance Optimization

### Embedding Generation

If embedding generation is slow, batch process:

```typescript
const texts = await getTextsToEmbed(userId);
const embeddings = await embeddingService.embedBatch(texts);
```

### Cache Cleanup

Remove old cache entries (>90 days):

```sql
DELETE FROM action_cache 
WHERE last_used_at < NOW() - INTERVAL '90 days';
```

### Index Optimization

Ensure indexes are being used:

```sql
EXPLAIN ANALYZE
SELECT * FROM conversation_memories
WHERE user_id = 'user_id'
ORDER BY created_at DESC;
```

## Cost Tracking

### Estimate Embedding Costs

Gemini text-embedding-004 is FREE on free tier.

For paid usage:
- Embeddings: Free up to 1500 requests/minute
- Memory extraction: Uses Gemini Flash Lite (cheapest)

### Monitor API Usage

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as extractions,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful
FROM memory_extraction_jobs
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Rollback Plan

If issues occur, you can:

1. **Disable memory extraction**:
   ```bash
   # Set in environment
   ENABLE_MEMORY_EXTRACTION=false
   ```

2. **Disable memory context in chat**:
   Comment out in `api/chat/stream.ts`:
   ```typescript
   // const contextResult = await contextBuilder.buildContext(...);
   ```

3. **Keep using simple history**:
   Free tier users already use simple history by default.

## Next Steps

1. **Monitor for 1-2 weeks**: Watch extraction success rates and memory growth
2. **Optimize prompts**: Adjust extraction quality based on real conversations
3. **Build UI**: Add MemoryExplorer component for users
4. **Add analytics**: Track cost savings and user satisfaction

## Support

For issues:
- Check logs in Vercel dashboard
- Review `memory_extraction_jobs` table for failures
- Test API endpoints manually
- Check environment variables

For questions:
- See `STRUCTURED_RAG_IMPLEMENTATION.md` for technical details
- See `IMPLEMENTATION_STATUS.md` for current capabilities
- Check Supabase SQL logs for database errors

