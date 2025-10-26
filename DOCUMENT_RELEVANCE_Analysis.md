# Document Relevance Analysis Status

## Current Status

### ✅ Gemini AI IS Being Invoked

The document relevance module **does use Gemini AI** through the following flow:

1. **Background Processing** (every 60 seconds):
   - Checks for relationships with `relevance_calculation_status = 'pending'`
   - Calls `calculateRelevance()` for each pending relationship

2. **AI Analysis** (in `documentRelevanceService.ts`):
   ```typescript
   // Line 146: Analyze document content using AI
   const response = await sendMessageToAI(analysisPrompt, content);
   
   // Line 277: Generate relationship description using AI
   const response = await sendMessageToAI(prompt);
   ```

3. **What Gemini Does**:
   - **Document Analysis**: Extracts summary, keywords, topics, themes
   - **Similarity Calculation**: Compares two documents based on keywords/topics/themes
   - **Relationship Description**: Generates a text description of how documents are related

## Why Analysis Appears "Static"

### Problem 1: Database Function Error (404)
The `get_related_documents_with_details` function returns 404, which prevents:
- Loading related documents to display results
- Completing the analysis workflow

**Status**: Need to apply `QUICK_FIX_RELATED_DOCUMENTS.sql` to Supabase.

### Problem 2: Background Processing is Slow
- Runs only once per minute
- First relationship might take 60+ seconds to process
- Uses 2-minute timeout with retry logic

### Problem 3: Static Fallback Values
If AI analysis fails (no API key, network error, timeout), the code uses fallback values:
```typescript
return {
  summary: 'Document analysis completed',
  keywords: this.extractKeywordsFallback(content),
  topics: ['General'],
  mainThemes: ['Academic Content']
};
```

### Problem 4: API Key Configuration
Check if `VITE_GEMINI_API_KEY` is configured:
- Without it, Gemini won't work
- Falls back to basic keyword extraction

## How to Verify AI is Working

### Check Console Logs
When AI analysis runs, you should see:
```
DocumentRelevanceService: Calculating relevance between [doc1] and [doc2]
DocumentRelevanceService: Attempt 1/3 for relationship [id]
Using Gemini API
Gemini API response received
DocumentRelevanceService: Success on attempt 1
```

### Database Status
Check the `document_relationships` table:
- `relevance_calculation_status` should change from `'pending'` → `'processing'` → `'completed'`
- `ai_generated_description` should have actual descriptions (not generic text)
- `relevance_percentage` should be calculated (0-100)

## Solutions

### 1. Fix Database Function (CRITICAL)
Apply `QUICK_FIX_RELATED_DOCUMENTS.sql` to restore the broken function.

### 2. Check API Keys
Verify `VITE_GEMINI_API_KEY` is set in `.env.local`:
```bash
VITE_GEMINI_API_KEY=your_key_here
```

### 3. Monitor Background Processing
Add console logs or UI indicator to show processing status:
```typescript
// In RelatedDocumentsPanel component
{calculationStatus === 'processing' && (
  <div>Analyzing relevance...</div>
)}
```

### 4. Reduce Processing Interval (Optional)
Change from 60s to 30s for faster processing:
```typescript
// src/services/backgroundProcessingService.ts
private readonly PROCESSING_INTERVAL = 30000; // 30 seconds
```

## Summary

**Is it static?** NO - the code is dynamic and uses Gemini AI.

**Why does it appear static?**
1. Takes time to process (60+ seconds per relationship)
2. Database function is broken (404 error)
3. Fallback values when AI fails

**Next Steps:**
1. Apply the database fix (QUICK_FIX_RELATED_DOCUMENTS.sql)
2. Verify Gemini API key is configured
3. Check console logs for processing activity
4. Wait 60+ seconds after creating relationship to see AI results

