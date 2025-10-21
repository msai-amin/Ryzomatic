# Local Library Testing Guide

## Current Status

✅ **Library UI**: Fully functional with modern 3-panel layout  
✅ **Database Schema**: Collections, tags, and enhanced metadata ready  
✅ **Supabase Storage**: Fixed path handling (no more `books/books/` duplication)  
✅ **Local Upload/Download**: Should work with Supabase Storage bucket  
❌ **Vercel Deployment**: Platform issue (not code-related)

## Prerequisites Checklist

### 1. Supabase Storage Bucket Setup

Verify the `books` bucket exists with proper RLS policies:

**Check in Supabase Dashboard:**
- Go to: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/storage/buckets
- Confirm `books` bucket exists
- Bucket should be **PRIVATE** (not public)

**Required RLS Policies:**

1. **SELECT Policy**: `Allow users to download their own books`
   ```sql
   bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
   ```

2. **INSERT Policy**: `Allow users to upload their own books`
   ```sql
   bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
   ```

3. **DELETE Policy**: `Allow users to delete their own books`
   ```sql
   bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
   ```

4. **UPDATE Policy**: `Allow users to update their own books`
   ```sql
   bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
   ```

### 2. Database Migration

Run the library organization migration:

```bash
# In Supabase SQL Editor, run:
supabase/migrations/007_library_organization.sql
```

This creates:
- `user_collections` table
- `book_tags` table
- `book_collections` junction table
- `book_tag_assignments` junction table
- Enhanced `user_books` metadata columns

### 3. Local Development Environment

```bash
npm install
npm run dev
```

## Testing the Library

### Test 1: Upload a Book

1. **Open the app** in browser (http://localhost:5173)
2. **Click the upload button**
3. **Select a PDF** file (< 50MB)
4. **Check "Save to Library"** checkbox
5. **Wait for upload** to complete

**Expected Result:**
- ✅ PDF loads in viewer
- ✅ Book appears in database (`user_books` table)
- ✅ File stored in Supabase Storage at: `books/{userId}/{bookId}.pdf`

**If Upload Fails:**
- Check browser console for errors
- Verify RLS policies are set correctly
- Check Supabase logs for permission errors

### Test 2: View Library

1. **Click the Library button** (📚) in header
2. **Library modal opens** with:
   - Left panel: Collections & Tags
   - Center panel: Book grid/list
   - Books display with metadata

**Expected Result:**
- ✅ Library modal appears above other UI elements
- ✅ Books are listed with titles, progress bars, metadata
- ✅ Search bar is functional
- ✅ View mode toggles work (grid/list/comfortable)

### Test 3: Open a Book from Library

1. **In the library**, click on a book card
2. **Book should load** in the PDF viewer
3. **Reading progress** should be preserved

**Expected Result:**
- ✅ Library modal closes
- ✅ PDF downloads from Supabase Storage
- ✅ PDF renders in viewer
- ✅ Last read page is restored

**If Download Fails:**
- Check console for "Supabase Storage download failed" error
- Verify the file exists in Supabase Storage bucket
- Check if s3_key in database has correct format: `books/{userId}/{bookId}.pdf`

### Test 4: Search and Filter

1. **In library**, use the search bar
2. **Type book title** or filename
3. **Results filter** in real-time

**Expected Result:**
- ✅ Debounced search (300ms delay)
- ✅ Results update as you type
- ✅ Empty state shows when no results

### Test 5: Collections (Future)

Currently basic functionality:
- Collections list appears in left sidebar
- Can view "All Books" collection
- More advanced features pending

## Troubleshooting

### Issue: "Bucket not found"

**Solution:** Create the `books` bucket in Supabase Dashboard → Storage

### Issue: "Access denied" or 400 errors

**Solution:** Set up RLS policies as shown above

### Issue: Upload succeeds but book doesn't appear in library

**Solution:** 
- Check if `refreshLibrary()` is being called after upload
- Verify database has the book entry in `user_books`
- Refresh the library modal

### Issue: Books don't load from library

**Solution:**
- Check browser console for detailed error
- Verify s3_key format in database: `books/{userId}/{bookId}.pdf`
- The new fix handles path conversion automatically

### Issue: Library modal is masked by sidebar

**Solution:** Already fixed with z-index 9999 and portal rendering

## Current Path Handling

### Database Storage:
```
s3_key: "books/7a0e674c-bb0c-4e0e-8183-1c6dc5616d6b/bookId.pdf"
```

### Supabase Storage:
```
Bucket: "books"
Path: "7a0e674c-bb0c-4e0e-8183-1c6dc5616d6b/bookId.pdf"
```

### AWS S3 (when deployed):
```
Bucket: "smart-reader-documents"
Path: "books/7a0e674c-bb0c-4e0e-8183-1c6dc5616d6b/bookId.pdf"
```

The code automatically handles the conversion!

## Next Steps

1. ✅ **Test locally** with the fixes
2. ⏳ **Wait for Vercel** to resolve their deployment issue
3. 🔮 **Future enhancements**: Collections, tags, advanced filters

## Known Issues

- **Vercel Deployment**: Failing at "Deploying outputs" phase (platform bug, Vercel is notified)
- **API Endpoints**: Not deployed yet due to Vercel issue (but not needed for local dev)
- **Collections/Tags**: UI ready but CRUD operations need more testing

## Success Criteria

Local library is working if:
- ✅ Can upload PDFs
- ✅ Library button opens modal
- ✅ Books appear in library
- ✅ Can open books from library
- ✅ Search works
- ✅ No console errors

Test these and report any issues!

