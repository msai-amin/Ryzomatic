# Vision Fallback Deployment Checklist

## Prerequisites

- [x] Gemini API key configured (`GEMINI_API_KEY`)
- [ ] Database migration applied
- [ ] Server-side PDF rendering configured (optional for MVP)
- [ ] Environment variables set

## Deployment Steps

### 1. Database Migration

Run the vision fallback migration:

```bash
# Connect to your Supabase project
cd supabase

# Apply migration
supabase db push
```

Or manually run the SQL file in Supabase dashboard:
- File: `supabase/007_vision_fallback_support.sql`
- Location: SQL Editor

**Verify:**
```sql
-- Check if columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('vision_pages_monthly', 'vision_last_reset');

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'documents' 
AND column_name IN ('vision_pages', 'extraction_method');
```

### 2. Environment Variables

Ensure the following are set in your environment:

**Vercel:**
```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Already existing (should be set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AWS_S3_BUCKET=your_bucket_name
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

**Set via Vercel CLI:**
```bash
vercel env add GEMINI_API_KEY
# Paste your API key when prompted
# Select: Production, Preview, Development
```

**Or via Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add `GEMINI_API_KEY`
3. Set for all environments

### 3. Test Quality Validator (Local)

```bash
npm test tests/pdfExtractionRobustness.test.ts
```

Expected: All tests pass ✅

### 4. Deploy to Vercel

```bash
git add .
git commit -m "feat: Add robust PDF extraction with vision fallback"
git push origin main
```

Vercel will automatically deploy.

### 5. Verify Deployment

**Test Quality Detection:**
1. Upload a well-formatted PDF
2. Check extraction progress shows: "✓ All X pages extracted successfully"
3. No vision pages should be used

**Test Vision Fallback (if configured):**
1. Upload a poor quality or scanned PDF
2. Progress should show: "✓ X pages enhanced with AI vision"
3. Check user's `vision_pages_monthly` counter incremented

**Check Database:**
```sql
-- View vision extraction stats
SELECT * FROM vision_extraction_stats;

-- Check document extraction methods
SELECT extraction_method, COUNT(*) 
FROM documents 
GROUP BY extraction_method;

-- View user usage
SELECT tier, vision_pages_monthly 
FROM profiles 
WHERE vision_pages_monthly > 0;
```

### 6. Monitor Costs

**Gemini API Usage:**
- Dashboard: https://ai.google.dev/
- Check token usage and costs
- Set up billing alerts

**Expected Costs:**
- Good PDFs: $0.000 (no vision needed)
- Mixed quality: $0.002-0.006 per document
- Poor quality: $0.010-0.020 per document

**Monitor in Supabase:**
```sql
SELECT 
  COUNT(*) as vision_requests,
  SUM((metadata->>'tokensUsed')::int) as total_tokens,
  SUM(credits_used) as total_credits,
  SUM((metadata->>'estimatedCost')::float) as estimated_cost
FROM usage_records
WHERE feature = 'vision_extraction'
AND created_at >= NOW() - INTERVAL '30 days';
```

### 7. Set Up Monitoring

**Create Alerts:**

1. **High Vision Usage**
   ```sql
   -- Alert if > 30% of documents use vision
   SELECT 
     COUNT(CASE WHEN extraction_method IN ('hybrid', 'vision') THEN 1 END) * 100.0 / COUNT(*) as vision_pct
   FROM documents
   WHERE created_at >= NOW() - INTERVAL '7 days';
   ```

2. **User Quota Exceeded**
   ```sql
   -- Alert if users hitting limits frequently
   SELECT 
     tier,
     COUNT(*) as users_near_limit
   FROM profiles
   WHERE vision_pages_monthly >= (
     CASE tier
       WHEN 'free' THEN 18
       WHEN 'pro' THEN 180
       WHEN 'premium' THEN 900
     END
   )
   GROUP BY tier;
   ```

3. **Vision API Errors**
   - Check application logs for `Vision API error`
   - Monitor circuit breaker activations

### 8. Optional: Configure Server-Side PDF Rendering

**Current Status:**
- Vision API endpoint returns 501 (Not Implemented)
- Requires PDF rendering service

**Options:**

**A. Client-Side Rendering (Quick MVP)**
- Render pages to images in browser
- Upload images to server
- Call vision API with images
- No additional setup needed

**B. Server-Side with pdf-lib (Recommended)**
```bash
npm install pdf-lib canvas
```

Update `api/documents/vision-extract.ts`:
- Uncomment rendering code
- Implement PDF → PNG conversion
- Test locally first

**C. Third-Party Service**
- Use Cloudinary, imgix, or similar
- Upload PDF, get page images
- Call vision API with URLs

### 9. Update User Documentation

Add to user guide:
- How vision fallback works
- Tier limits and costs
- Quality indicators on documents
- How to read extraction badges

### 10. Feature Flags (Optional)

Consider adding feature flag for gradual rollout:

```typescript
// In config
export const FEATURES = {
  VISION_FALLBACK_ENABLED: process.env.ENABLE_VISION_FALLBACK === 'true'
}

// In orchestrator
if (FEATURES.VISION_FALLBACK_ENABLED && visionOptions.enabled) {
  // Use vision fallback
}
```

## Rollback Plan

If issues occur:

1. **Disable Vision Fallback**
   ```typescript
   // In DocumentUpload.tsx
   const extractionResult = await extractWithFallback(file, {
     enabled: false, // Disable vision fallback
     // ... other options
   })
   ```

2. **Revert to Old Extraction**
   - Keep `extractPDFData()` function as backup
   - Swap back if needed

3. **Database Rollback**
   ```sql
   -- Remove columns if needed
   ALTER TABLE profiles 
   DROP COLUMN vision_pages_monthly,
   DROP COLUMN vision_last_reset;
   
   ALTER TABLE documents 
   DROP COLUMN vision_pages,
   DROP COLUMN extraction_method;
   ```

## Success Criteria

✅ All tests pass
✅ Migration applied successfully
✅ Quality detection works on test PDFs
✅ No increase in extraction errors
✅ Costs remain under $0.01 per document average
✅ User experience is seamless (no UI blocking)

## Support

If issues arise:
1. Check application logs for errors
2. Review Gemini API dashboard for rate limits
3. Check database for vision usage stats
4. Review `ROBUST_PDF_EXTRACTION_IMPLEMENTATION.md` for troubleshooting

## Post-Deployment Tasks

- [ ] Monitor for 7 days
- [ ] Review cost reports
- [ ] Collect user feedback
- [ ] Adjust quality thresholds if needed
- [ ] Document lessons learned
- [ ] Plan Phase 2 enhancements

## Phase 2 Roadmap (Future)

1. Server-side PDF rendering
2. Smart batching (multi-page API calls)
3. Quality learning (adjust thresholds)
4. Advanced caching (page hash-based)
5. Usage dashboard UI
6. A/B testing different models
7. Multilingual optimization

---

**Status:** Ready for deployment (Tier 1 + 2 framework)
**Next:** Apply database migration and test

