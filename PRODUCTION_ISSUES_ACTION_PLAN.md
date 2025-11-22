# Production Issues - Action Plan 🚨

**Date**: November 22, 2025  
**Status**: 3 Critical Issues Identified

---

## 📊 Issue Summary

| Issue | Severity | Status | ETA |
|-------|----------|--------|-----|
| PDFViewerV2 Infinite Loop | 🔴 Critical | ✅ Fixed, Deploying | 2-3 min |
| Gemini API 401 Error | 🔴 Critical | ⚠️ **Action Required** | 5 min |
| Database Migration Missing | 🔴 Critical | ⚠️ **Action Required** | 5 min |

---

## 🔴 Issue 1: PDFViewerV2 Infinite Loop

### Status
✅ **FIXED** - Code deployed, waiting for Vercel rebuild

### Evidence from Console
```
index-DyToHaJA.js:461 Uncaught RangeError: Maximum call stack size exceeded.
    at xe (index-DyToHaJA.js:461:2873)
    at n (index-DyToHaJA.js:726:9346)
    ... (infinite loop)
```

### What We Did
- Fixed the infinite loop in `PDFViewerV2.tsx` (commit `00a802d`)
- Changed from dispatching `resize` event to custom `pdf-viewer-resize` event
- Pushed to GitHub main branch

### Current Status
- ✅ Code is on GitHub
- 🔄 Vercel is deploying (takes 2-3 minutes)
- ⏳ Old build is still serving (hence the errors)

### What You Need to Do
**WAIT** for Vercel deployment to complete:
1. Check Vercel dashboard: https://vercel.com/dashboard
2. Wait for "Building..." to change to "Ready"
3. Refresh your browser (hard refresh: Cmd+Shift+R)
4. Verify no more `RangeError` in console

### Expected Timeline
- **2-3 minutes** from now

---

## 🔴 Issue 2: Gemini API 401 Error (WRONG API KEY TYPE)

### Status
⚠️ **ACTION REQUIRED** - You're using the wrong type of API key

### Evidence from Console
```
[401] API keys are not supported by this API. 
Expected OAuth2 access token or other authentication credentials
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent 401
```

### The Problem
You're using a **Google Cloud API key** (for Google Cloud AI Platform), but the code is calling **Gemini AI Studio API** (which uses a different key).

### Two Options

#### **Option A: Use Gemini AI Studio API Key (RECOMMENDED)**
This is what your code expects.

**Steps**:
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)
4. Go to Vercel → Settings → Environment Variables
5. **UPDATE** `GEMINI_API_KEY` with this new key
6. Redeploy

**Why this is better**:
- Free tier: 15 requests/minute
- Simpler authentication (just API key)
- No billing setup required
- Your code is already configured for this

#### **Option B: Switch to Google Cloud Vertex AI**
This requires code changes.

**Steps**:
1. Keep your current Google Cloud API key
2. Update code to use Vertex AI SDK instead of Generative AI SDK
3. Add OAuth2 authentication
4. Set up service account credentials

**Why this is harder**:
- Requires code changes
- More complex authentication
- Billing setup required
- Overkill for your use case

### ✅ **RECOMMENDED ACTION**

**Use Option A** - Get a Gemini AI Studio key:

1. **Get the key**:
   ```
   https://aistudio.google.com/app/apikey
   ```

2. **Update Vercel Environment Variable**:
   - Go to: https://vercel.com/dashboard
   - Project → Settings → Environment Variables
   - Find `GEMINI_API_KEY`
   - Click "Edit"
   - Paste new key (starts with `AIza...`)
   - Select "Production" environment
   - Click "Save"

3. **Redeploy**:
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"

### Expected Timeline
- **5 minutes** (including redeploy)

---

## 🔴 Issue 3: Database Migration Not Applied

### Status
⚠️ **ACTION REQUIRED** - Migration SQL not run in Supabase

### Evidence from Console
```
POST .../document_descriptions 404 (Not Found)
Error: operator does not exist: extensions.vector = extensions.vector
```

### The Problem
The `050_document_content_and_auto_graph.sql` migration was never applied to your Supabase database.

### What You Need to Do

#### Step 1: Enable pgvector Extension
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `pbfipmvtkbivnwwgukpw`
3. Go to **Database** → **Extensions**
4. Search for `vector`
5. Enable `vector` extension
6. Wait for confirmation

#### Step 2: Run the Migration SQL
1. Go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of:
   ```
   /Users/aminamouhadi/smart-reader-serverless/supabase/migrations/050_document_content_and_auto_graph.sql
   ```
4. Paste into the SQL editor
5. Click **"Run"**
6. Wait for success message

#### Step 3: Verify Tables Created
Run this query in SQL Editor:
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('document_content', 'document_descriptions');

-- Check if vector column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'document_descriptions' 
AND column_name = 'description_embedding';

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'document_descriptions';
```

**Expected Result**:
- 2 tables: `document_content`, `document_descriptions`
- 1 column: `description_embedding` (type: `USER-DEFINED` for vector)
- 1 trigger: `after_document_description_upsert`

### Expected Timeline
- **5 minutes**

---

## 📋 Step-by-Step Action Checklist

### ✅ Immediate Actions (Do Now)

- [ ] **1. Check Vercel Deployment Status**
  - Go to https://vercel.com/dashboard
  - Verify PDFViewer fix is deployed
  - ETA: 2-3 minutes

- [ ] **2. Get Correct Gemini API Key**
  - Go to https://aistudio.google.com/app/apikey
  - Create new API key
  - Copy key (starts with `AIza...`)
  - ETA: 1 minute

- [ ] **3. Update Vercel Environment Variable**
  - Vercel → Settings → Environment Variables
  - Update `GEMINI_API_KEY`
  - Select "Production"
  - Save
  - ETA: 1 minute

- [ ] **4. Enable pgvector in Supabase**
  - Supabase Dashboard → Database → Extensions
  - Enable `vector` extension
  - ETA: 1 minute

- [ ] **5. Run Database Migration**
  - Supabase Dashboard → SQL Editor
  - Copy/paste `050_document_content_and_auto_graph.sql`
  - Run
  - ETA: 2 minutes

- [ ] **6. Redeploy Vercel**
  - Vercel → Deployments
  - Redeploy latest
  - ETA: 2-3 minutes

### ✅ Verification (After Actions)

- [ ] **7. Hard Refresh Browser**
  - Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
  - Clear console

- [ ] **8. Upload a Test PDF**
  - Upload any PDF
  - Watch console for errors

- [ ] **9. Check for Success**
  - ✅ No `RangeError` (infinite loop fixed)
  - ✅ No `401 Unauthorized` (API key fixed)
  - ✅ No `404 Not Found` on `document_descriptions` (migration applied)
  - ✅ See: `[INFO] [Unknown] Document content stored successfully`
  - ✅ See: `[INFO] [Unknown] Generating embedding and description`
  - ✅ See: Embedding generation succeeds (no 500 error)

---

## 🎯 Expected Console Output (After Fixes)

### ✅ Good Console Output
```
[INFO] [DocumentUpload] Starting file upload
[INFO] [PDFExtractionOrchestrator] PDF extraction completed successfully
[INFO] [Unknown] Book saved successfully
[INFO] [Unknown] Document content stored successfully
[INFO] [Unknown] Generating embedding and description
[INFO] [Unknown] Embedding generated and saved successfully
AppStore: refreshRelatedDocuments() called
```

### ❌ Bad Console Output (Current)
```
❌ Uncaught RangeError: Maximum call stack size exceeded
❌ POST .../gemini-2.5-flash:generateContent 401 (Unauthorized)
❌ POST .../document_descriptions 404 (Not Found)
❌ operator does not exist: extensions.vector = extensions.vector
```

---

## 📞 If You Need Help

### Issue 1 (PDFViewer) - Still Seeing Errors After 5 Minutes?
- Check Vercel deployment status
- Verify commit `00a802d` is deployed
- Try hard refresh (Cmd+Shift+R)

### Issue 2 (Gemini API) - Still Getting 401?
- Verify you're using **AI Studio** key (not Cloud)
- Key should start with `AIza...`
- Verify key is in **Production** environment
- Redeploy after changing env var

### Issue 3 (Database) - Still Getting 404?
- Verify `vector` extension is enabled
- Check SQL ran without errors
- Run verification queries above
- Check RLS policies are created

---

## 🎉 Success Criteria

All 3 issues are resolved when:

1. ✅ **No `RangeError`** in console (PDFViewer works)
2. ✅ **No `401` errors** on Gemini API (API key works)
3. ✅ **No `404` errors** on `document_descriptions` (migration applied)
4. ✅ **Embeddings generate successfully** (auto-graph works)
5. ✅ **Related Documents appear automatically** (trigger fires)

---

## ⏱️ Total Time Estimate

- **Vercel deployment**: 2-3 minutes (automatic)
- **Get Gemini key**: 1 minute
- **Update env var**: 1 minute
- **Enable pgvector**: 1 minute
- **Run migration**: 2 minutes
- **Redeploy**: 2-3 minutes
- **Verification**: 2 minutes

**Total: ~12-15 minutes**

---

## 📝 Notes

### Why These Issues Happened

1. **PDFViewer Bug**: Pre-existing bug, discovered during testing
2. **Wrong API Key**: Confusion between Google Cloud vs Gemini AI Studio APIs
3. **Migration Not Applied**: Manual step required in Supabase dashboard

### What's Working

- ✅ Document upload
- ✅ PDF extraction
- ✅ Content storage
- ✅ Document opening
- ✅ Authentication
- ✅ Basic UI

### What's Broken (Temporarily)

- ❌ PDF viewer (infinite loop) - **Fix deploying**
- ❌ Embedding generation (wrong API key) - **Action required**
- ❌ Auto-graph relationships (no migration) - **Action required**

---

**Next Steps**: Follow the checklist above, starting with checking Vercel deployment status.

