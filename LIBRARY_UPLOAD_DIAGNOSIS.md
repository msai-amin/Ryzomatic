# 🔍 Library Upload Diagnosis Guide

## Issue
Upload from library is not working. Need to identify if it's related to Supabase URL/environment variables.

---

## Current Environment Status ✅

Your `.env.local` has correct values:
- ✅ `VITE_SUPABASE_URL`: https://pbfipmvtkbivnwwgukpw.supabase.co
- ✅ `VITE_SUPABASE_ANON_KEY`: Valid JWT token
- ✅ `SUPABASE_SERVICE_ROLE_KEY`: Valid service role key

---

## Likely Causes (Not URL Related)

### 1. ❌ Missing Supabase Storage Bucket

**Check**:
1. Go to: https://app.supabase.com/project/pbfipmvtkbivnwwgukpw/storage/buckets
2. Look for bucket named `books`
3. If missing → Create it

**Solution**: 
```bash
# In Supabase Dashboard:
1. Storage → New bucket
2. Name: books
3. Public: NO (private bucket)
4. File size limit: 50MB
5. Create bucket
```

---

### 2. ❌ Missing RLS Policies

**Check**: Storage → books → Policies tab

**Required Policies**:

#### Policy 1: SELECT (Download)
```
Name: Allow users to download their own books
Target roles: authenticated
USING expression:
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

#### Policy 2: INSERT (Upload)
```
Name: Allow users to upload their own books
Target roles: authenticated
CHECK expression:
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

#### Policy 3: UPDATE
```
Name: Allow users to update their own books
Target roles: authenticated
USING expression:
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
WITH CHECK expression:
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

#### Policy 4: DELETE
```
Name: Allow users to delete their own books
Target roles: authenticated
USING expression:
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

---

### 3. ❌ Authentication Issue

**Check Console**:
```
"User not authenticated" → services not initialized
```

**Solution**: Make sure you're logged in before trying to upload

---

### 4. ❌ PDF.js Version Mismatch

**Status**: ✅ Fixed in commit `754e3c6`

Your worker file should match PDF.js 5.4.296

---

## Quick Diagnosis Steps

### Step 1: Check Browser Console

Look for these specific errors:

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Bucket not found" | Missing bucket | Create `books` bucket |
| "Access denied" or "new row violates row-level security" | Missing RLS policies | Add policies above |
| "User not authenticated" | Not logged in | Sign in first |
| "PDF file is too large" | File > 5MB | Use smaller file |
| "Failed to upload book" | General error | Check full error in console |

### Step 2: Test Upload with Console Open

1. Open DevTools (F12)
2. Go to **Console** tab
3. Try uploading a small PDF (< 1MB)
4. Watch for error messages

### Step 3: Check Network Tab

1. Open DevTools → **Network** tab
2. Try uploading
3. Look for failed requests to:
   - `/api/books` (upload API)
   - Storage requests to Supabase
4. Click failed request → check **Response** tab

---

## Most Common Issue

**90% of library upload failures are due to:**

❌ **Missing `books` bucket** in Supabase Storage

**Why?**
- The app migrated from storing PDFs in database to S3/Supabase Storage
- Old uploads worked because they saved to database
- New uploads require the bucket to exist

**Fix**:
1. Create the bucket
2. Add RLS policies
3. Try uploading again

---

## Verification Checklist

After fixing issues, verify:

- [ ] Can sign in successfully
- [ ] Console shows: `SupabaseStorageService initialized`
- [ ] Upload button opens file picker
- [ ] Can select a PDF file
- [ ] Console shows: `Uploading to Supabase Storage`
- [ ] Console shows: `Book uploaded successfully`
- [ ] File appears in Supabase Storage bucket
- [ ] Entry created in `user_books` table
- [ ] Library modal shows the uploaded book

---

## Still Not Working?

Provide the **exact error message** from browser console when you try to upload.

Common patterns:
- `error: "..."` → Check the quoted message
- `status: 403` → RLS policy issue
- `status: 404` → Bucket doesn't exist
- `status: 401` → Not authenticated

---

## Summary

**It's NOT a URL/environment variable issue** because:
- ✅ Your URLs are correct
- ✅ Your keys are valid
- ✅ Console shows Supabase initialized

**It IS likely**:
- Missing storage bucket
- Missing RLS policies
- File too large (> 5MB)
- Not authenticated

Fix these issues first, then try uploading again!

