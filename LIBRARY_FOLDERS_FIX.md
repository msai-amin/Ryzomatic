# Library Folders Update Fix ✅

## Problem

Library Modal folders (All Books, Trash, Collections, etc.) were not updating their counts after:
- Deleting books
- Uploading new files
- Importing data
- Syncing with Google Drive

**Root Cause**: After these operations, `loadData()` was called to refresh the books list, but `fetchCollections()` was NOT called to refresh the folder structure and counts.

---

## Solution

Added `fetchCollections()` calls after all operations that modify the library:

### Files Modified:
- `src/components/LibraryModal.tsx`

### Changes Made:

#### 1. After Delete Book (Line ~1183)
```typescript
// Before:
await loadData();

// After:
await loadData();
await fetchCollections(); // Refresh folder counts
```

#### 2. After Delete Audio (Line ~1216)
```typescript
// Before:
await storageService.deleteAudio(id);
await loadData();

// After:
await storageService.deleteAudio(id);
await loadData();
await fetchCollections(); // Refresh folder counts
```

#### 3. After Import Data (Line ~1251)
```typescript
// Before:
reader.onload = (event) => {
  // ...
  loadData();
}

// After:
reader.onload = async (event) => {
  // ...
  await loadData();
  await fetchCollections(); // Refresh folder counts
}
```

#### 4. After Google Drive Sync To (Line ~1317)
```typescript
// Before:
await loadData();

// After:
await loadData();
await fetchCollections(); // Refresh folder counts
```

#### 5. After Google Drive Sync From (Line ~1337)
```typescript
// Before:
await loadData();

// After:
await loadData();
await fetchCollections(); // Refresh folder counts
```

#### 6. After Enable Google Drive (Line ~1294)
```typescript
// Before:
await loadData();

// After:
await loadData();
await fetchCollections(); // Refresh folder counts
```

#### 7. On Modal Open / Refresh Trigger (Line ~325)
```typescript
// Before:
useEffect(() => {
  if (isOpen) {
    loadData();
  }
}, [isOpen, activeTab, refreshTrigger, normalizedUserId]);

// After:
useEffect(() => {
  if (isOpen) {
    loadData();
    fetchCollections(); // Also refresh collections when modal opens or refreshTrigger changes
  }
}, [isOpen, activeTab, refreshTrigger, normalizedUserId, fetchCollections]);
```

#### 8. Updated Dependencies (Line ~1202)
```typescript
// Before:
}, [confirmDialog, loadData]);

// After:
}, [confirmDialog, loadData, fetchCollections]);
```

---

## What This Fixes

### Before Fix:
1. User deletes a book
2. Book disappears from list ✅
3. Folder counts stay the same ❌
4. "All Books" still shows old count ❌
5. "Trash" doesn't update ❌

### After Fix:
1. User deletes a book
2. Book disappears from list ✅
3. Folder counts update immediately ✅
4. "All Books" shows correct count ✅
5. "Trash" shows updated count ✅

---

## Testing

### Manual Testing Steps:

1. **Test Delete**:
   - Open Library Modal
   - Note the "All Books" count
   - Delete a book
   - ✅ Verify "All Books" count decreases
   - ✅ Verify "Trash" count increases

2. **Test Upload** (via DocumentUpload):
   - Open Library Modal
   - Note the "All Books" count
   - Upload a new file
   - Open Library Modal again
   - ✅ Verify "All Books" count increases

3. **Test Import**:
   - Export library data
   - Delete some books
   - Import the backup
   - ✅ Verify folder counts update

4. **Test Google Drive Sync**:
   - Enable Google Drive
   - Sync to/from Drive
   - ✅ Verify folder counts update

---

## Technical Details

### Collections Structure:
- Collections are stored in `user_collections` table
- Each collection has a count of associated books
- Collections include:
  - "All Books" (virtual - all non-trash books)
  - "Trash" (special collection)
  - User-created folders

### Refresh Flow:
1. `loadData()` - Fetches books, notes, audio
2. `fetchCollections()` - Fetches collections with updated counts
3. UI re-renders with new data

### Why Both Are Needed:
- `loadData()` updates the books list
- `fetchCollections()` updates the folder structure and counts
- Without both, the UI shows stale folder counts

---

## Impact

### User Experience:
- ✅ Immediate visual feedback after operations
- ✅ Accurate folder counts at all times
- ✅ No need to close/reopen modal to see updates
- ✅ Better trust in the application

### Performance:
- Minimal impact (fetchCollections is lightweight)
- Only runs after user actions
- No continuous polling

### Reliability:
- Ensures data consistency
- Prevents confusion from stale counts
- Improves overall app reliability

---

## Related Components

### Also Uses refreshTrigger:
- `DocumentUpload.tsx` - Calls `refreshLibrary()` after upload
- `Header.tsx` - Passes `libraryRefreshTrigger` to modal
- `appStore.ts` - Manages `libraryRefreshTrigger` state

### Upload Flow:
1. User uploads file via `DocumentUpload`
2. `DocumentUpload` calls `refreshLibrary()`
3. `refreshLibrary()` increments `libraryRefreshTrigger`
4. `LibraryModal` detects trigger change
5. `LibraryModal` calls `loadData()` AND `fetchCollections()`
6. UI updates with new file and updated counts

---

## Deployment

### Files Changed:
- ✅ `src/components/LibraryModal.tsx` (8 locations updated)

### Linter Status:
- ✅ No errors
- ⚠️ 1 warning (pre-existing, unrelated)

### Git Commands:
```bash
git add src/components/LibraryModal.tsx
git commit -m "fix: Refresh folder counts after library operations

- Add fetchCollections() calls after delete, upload, import, sync
- Ensure folder counts update immediately after operations
- Fix stale folder counts in Library Modal
- Improves UX with immediate visual feedback"
git push origin main
```

---

## Summary

**Problem**: Folder counts not updating after library operations  
**Solution**: Call `fetchCollections()` after all operations that modify the library  
**Impact**: Better UX, accurate counts, immediate feedback  
**Status**: ✅ Fixed and ready to deploy

---

**Date**: November 21, 2025  
**Type**: Bug Fix  
**Priority**: High (UX issue)  
**Breaking Changes**: None  
**Ready for Production**: Yes ✅

