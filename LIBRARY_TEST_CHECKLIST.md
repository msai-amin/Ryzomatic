# Library Testing Checklist

## Prerequisites ✅

Before testing, ensure these are set up:

### 1. Supabase Storage Bucket
- [ ] Bucket named `books` exists
- [ ] Bucket is set to **Private** (not public)
- [ ] 4 RLS policies are configured (see below)

### 2. Database Migration
- [ ] Run `supabase/migrations/007_library_organization.sql` in Supabase SQL Editor

### 3. Local Dev Server
- [ ] Run `npm run dev`
- [ ] App loads at http://localhost:5173
- [ ] No console errors on initial load

## RLS Policies for Supabase Storage

Copy-paste these **one at a time** in Supabase Dashboard → Storage → books bucket → Policies:

### Policy 1: Allow users to download their own books
```sql
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

### Policy 2: Allow users to upload their own books  
```sql
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

### Policy 3: Allow users to delete their own books
```sql
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

### Policy 4: Allow users to update their own books
```sql
bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text
```

---

## Test 1: Upload a PDF 📤

### Steps:
1. [ ] Click the **Upload** button (or drag-and-drop)
2. [ ] Select a PDF file (< 50MB recommended)
3. [ ] Ensure **"Save to Library"** checkbox is checked
4. [ ] Click upload or wait for processing

### Expected Results:
- [ ] PDF loads in the main viewer
- [ ] No errors in console
- [ ] See log: `[INFO] [BookStorageService] Uploading to Supabase Storage`
- [ ] See log: `[INFO] Book uploaded successfully`

### If Successful:
- [ ] PDF file appears in Supabase Storage: `books/{userId}/{bookId}.pdf`
- [ ] Database entry created in `user_books` table
- [ ] `s3_key` column contains: `books/{userId}/{bookId}.pdf`

### If Failed:
Check console for:
- `Bucket not found` → Create the bucket
- `Access denied` → Check RLS policies
- `400 Bad Request` → Check path format

---

## Test 2: View Library 📚

### Steps:
1. [ ] Click the **Library button** (📚) in the header
2. [ ] Library modal should open

### Expected Results:
- [ ] Modal appears with dark overlay (75% opacity)
- [ ] Modal is above all other UI elements (z-index 9999)
- [ ] Three-panel layout visible:
  - Left: Collections & Tags
  - Center: Books grid
  - Right: (will show book details when selected)
- [ ] Books appear in grid with:
  - [ ] Book title
  - [ ] File type badge (PDF)
  - [ ] Reading progress bar
  - [ ] Metadata (notes count, audio sessions, last read date)

### If Failed:
- Modal doesn't appear → Check `LibraryModal` is imported in `ThemedHeader`
- Modal masked by sidebar → Already fixed with portal + z-index
- No books showing → Check database query and console logs

---

## Test 3: Search Books 🔍

### Steps:
1. [ ] In library modal, type in the search bar
2. [ ] Enter part of a book title or filename

### Expected Results:
- [ ] Search debounces (waits 300ms after typing stops)
- [ ] Results filter in real-time
- [ ] Books matching query are displayed
- [ ] Empty state shows if no matches: "No books found"

### Console Logs:
- [ ] See: `[INFO] Search completed`
- [ ] No errors about missing functions or 404s

---

## Test 4: Open Book from Library 📖

### Steps:
1. [ ] In library, click on a book card
2. [ ] Wait for book to load

### Expected Results:
- [ ] See log: `[INFO] Downloading book from Supabase Storage`
- [ ] See log: `[INFO] Book downloaded successfully`
- [ ] Library modal closes
- [ ] PDF loads in main viewer
- [ ] Reading progress restores (if previously read)

### If Failed:
Check console for:
- `Supabase Storage download failed` → Check file exists in storage
- `Both Supabase Storage and API failed` → Check path format
- `400 Bad Request` → Path issue (should be fixed now)

---

## Test 5: View Modes 👁️

### Steps:
1. [ ] In library, click **Grid View** button
2. [ ] Click **List View** button
3. [ ] Click **Comfortable View** button

### Expected Results:
- [ ] Grid view: 3-4 columns of book cards
- [ ] List view: Single column, compact rows
- [ ] Comfortable view: 2 columns, larger cards
- [ ] Active button is highlighted with primary color

---

## Test 6: Collections & Tags 🏷️

### Steps:
1. [ ] In library left sidebar, see "Collections" section
2. [ ] See "All Books" at the top
3. [ ] See "Tags" section below

### Expected Results:
- [ ] Collections tree is visible (may be empty)
- [ ] Tags list is visible (may be empty)
- [ ] Notification drawer (at top of sidebar) remains empty until actions occur
- [ ] No console errors loading these
- [ ] See log: `[INFO] Collections retrieved`

### Sidebar Smoke Checklist:
- [ ] Click the **+** button next to Collections and create `QA Temp Collection`
  - Toast appears: "Collection created successfully."
  - New collection shows in tree.
- [ ] Right-click the new collection → **Rename** → change to `QA Temp Collection (Renamed)`
  - Toast appears confirming the rename.
  - Name updates immediately in tree.
- [ ] Drag the renamed collection above/below another root collection
  - Order updates without page refresh.
  - No duplicate/ghost entries appear.
- [ ] Right-click the collection → **Move to...** → choose another collection as parent (or root)
  - Toast appears: "Collection moved."
  - Tree refreshes to show new nesting.
- [ ] Toggle the star icon to favorite/unfavorite
  - Star icon fills/unfills.
  - Close and reopen Library → state persists.
- [ ] Right-click → **Delete** the temp collection
  - Confirm prompt appears.
  - Toast appears: "Collection deleted."
  - Collection disappears from tree.

### Tag Smoke Checklist:
- [ ] Click the **+** button next to Tags and create `QA Temp Tag`
  - Toast appears: "Tag created successfully."
  - Tag chip appears under Tags list.
- [ ] (Optional) Assign the tag via bulk toolbar and verify chip count increments.
- [ ] Close/reopen Library → tag persists.

### Error Handling (Optional):
- [ ] Toggle offline mode (DevTools → Network → Offline), attempt to rename a collection
  - Error toast appears.
  - After restoring connectivity, toast clears and tree refetches without stale state.

---

## Test 7: Multiple Books 📚📚📚

### Steps:
1. [ ] Upload 3-5 different PDFs
2. [ ] Open library
3. [ ] Verify all books appear

### Expected Results:
- [ ] All uploaded books visible
- [ ] Each book shows correct:
  - [ ] Title
  - [ ] File size
  - [ ] Page count
  - [ ] Reading progress
- [ ] Books are sortable (default: last read)

---

## Test 8: Book Metadata 📊

### Steps:
1. [ ] Open a book from library
2. [ ] Read a few pages
3. [ ] Close and reopen library
4. [ ] Check if reading progress updated

### Expected Results:
- [ ] Progress bar reflects pages read
- [ ] Percentage shown (e.g., "25% Read")
- [ ] Last read date updates

---

## Common Issues & Solutions

### Issue: "Bucket not found"
**Solution**: Create bucket in Supabase Dashboard → Storage → New Bucket

### Issue: "Access denied" or "new row violates row-level security"
**Solution**: Add all 4 RLS policies exactly as shown above

### Issue: Books upload but don't appear in library
**Solution**: 
- Check `user_books` table in Supabase
- Verify `s3_key` format: `books/{userId}/{bookId}.pdf`
- Click library button to refresh

### Issue: "Failed to download book file"
**Solution**:
- Verify file exists in Storage: `books/{userId}/{bookId}.pdf`
- Check RLS SELECT policy is set
- Verify path handling (should strip `books/` prefix for Supabase)

### Issue: Library modal doesn't open
**Solution**:
- Check browser console for errors
- Verify `LibraryModal` is imported in `ThemedHeader`
- Check if `showLibrary` state is toggling

### Issue: Console shows duplicate initialization logs
**Solution**: This is normal - React StrictMode causes double renders in dev

---

## Success Criteria ✅

Library is working if ALL these pass:

- ✅ Can upload PDFs successfully
- ✅ Uploaded PDFs appear in library
- ✅ Can open books from library
- ✅ Search filters books correctly
- ✅ View modes switch properly
- ✅ No 400/403/404 errors in console
- ✅ Reading progress saves and restores

---

## Current Known Limitations

These are expected and will be enhanced later:

1. **Collections Management**: Cross-parent drag via DnD not yet supported (use “Move to…” action)
2. **Tag Management**: Reordering and archival are not yet implemented
3. **Bulk Operations**: Some toolbar actions still pending backend wiring
4. **Virtual Scrolling**: Not yet implemented (loads all books at once)
5. **Advanced Filters**: UI exists but some filters not connected yet

---

## Testing Instructions

### Quick Test (5 minutes):
1. Upload 1 PDF
2. Open library
3. Click the book to open it
4. ✅ If this works, core functionality is good!

### Full Test (15 minutes):
1. Upload 3-5 PDFs
2. Test search with different queries
3. Test all 3 view modes
4. Open different books from library
5. Check reading progress updates
6. Verify no console errors

---

## Expected Console Logs (Normal)

These logs are GOOD and expected:

```
[INFO] [BookStorageService] Uploading to Supabase Storage
[INFO] Book uploaded successfully
[INFO] Collections retrieved
[INFO] Search completed
[INFO] Downloading book from Supabase Storage
[INFO] Book downloaded successfully
```

## Red Flags (Need Fixing)

These logs indicate PROBLEMS:

```
[ERROR] Bucket not found
[ERROR] Access denied
[ERROR] 400 Bad Request
[ERROR] Failed to download book
[WARN] Supabase Storage upload failed (followed by API fallback failing)
```

---

## After Testing

Report back with:
1. Which tests passed ✅
2. Which tests failed ❌
3. Any console errors
4. Screenshots if helpful

This will help me fix any remaining issues!

