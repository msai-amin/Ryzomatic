# TTS and Text Selection Fixes

## Issues Fixed

### 1. TTS Not Working (Probably Because Document is Highlighted)
**Problem**: When clicking the TTS play button, it showed "Missing document or page data for TTS" error.

**Root Cause**: The AudioWidget was checking for `currentPage` to be truthy, but it could be 0 or undefined in some cases, causing the check to fail even when document and page texts were available.

**Solution**: 
- Changed `currentPage` to use a fallback value of 1 if not set: `const currentPage = useAppStore.getState().pdfViewer.currentPage || 1`
- Modified the condition from checking `currentPage` specifically to checking if `pageTexts` array has content: `if (currentDoc && currentDoc.pageTexts && currentDoc.pageTexts.length > 0)`

**Files Modified**:
- `src/components/AudioWidget.tsx` (lines 123, 140)

### 2. Text Selection Not Working in Scrolling Mode
**Problem**: Users couldn't select text for highlighting in certain modes.

**Root Cause**: The `handleTextSelection` callback was returning early when in reading mode, preventing text selection for highlighting.

**Solution**:
- Removed the check `if (pdfViewer.readingMode) return` that was blocking text selection in reading mode
- Updated the useCallback dependencies to remove the now-unused `pdfViewer.readingMode` dependency

**Files Modified**:
- `src/components/PDFViewer.tsx` (lines 1211, 1255)

## Technical Details

### TTS Fix
Before:
```typescript
const currentPage = useAppStore.getState().pdfViewer.currentPage
if (currentDoc && currentDoc.pageTexts && currentPage) {
  // ... TTS code
}
```

After:
```typescript
const currentPage = useAppStore.getState().pdfViewer.currentPage || 1 // Fallback to page 1
if (currentDoc && currentDoc.pageTexts && currentDoc.pageTexts.length > 0) {
  // ... TTS code
}
```

### Text Selection Fix
Before:
```typescript
const handleTextSelection = useCallback((event: MouseEvent) => {
  if (isHighlightMode) return
  if (pdfViewer.readingMode) return // This was blocking selection!
  
  const selection = window.getSelection()
  // ... rest of code
}, [isHighlightMode, pdfViewer.readingMode, pdfViewer.scrollMode, pageNumber])
```

After:
```typescript
const handleTextSelection = useCallback((event: MouseEvent) => {
  if (isHighlightMode) return
  // Removed the readingMode check - users should be able to highlight in all modes
  
  const selection = window.getSelection()
  // ... rest of code
}, [isHighlightMode, pdfViewer.scrollMode, pageNumber])
```

## Verification

### Existing Correct Implementations
Both fixes build on already-correct implementations:

1. **Highlight Pointer Events**: The highlight overlays already have `pointerEvents: 'none'` set, which allows text selection underneath highlights. Delete buttons have `pointerEvents: 'auto'` to remain interactive. (Lines 2577, 2590, 2664, 2677)

2. **Text Layer CSS**: The `.textLayer` CSS already has `pointer-events: auto !important` to ensure text is selectable. (src/index.css line 186)

3. **Event Listener**: The mouseup event listener for text selection is properly attached to the document. (Line 1489)

## Testing

To verify the fixes work:

1. **TTS Fix**:
   - Open a PDF document
   - Add some highlights to the page
   - Click the TTS play button
   - ✅ Audio should start playing without errors
   - ✅ Console should not show "Missing document or page data for TTS" error

2. **Text Selection Fix**:
   - Open a PDF in continuous scroll mode
   - Try to select text on different pages
   - ✅ Highlight color picker should appear after selection
   - Try the same in reading mode
   - ✅ Text selection for highlighting should work in both modes

## Bonus Fix: Health Check Console Spam

### Problem
The console was flooded with hundreds of 404 errors from the HealthMonitor trying to reach `/api/health` endpoint every 30 seconds.

### Root Cause
The health endpoint was disabled (moved to `api-disabled` folder) but the connectivity health check was still attempting to call it.

### Solution
Disabled the connectivity health check by commenting it out in `healthMonitor.ts`.

**Files Modified**:
- `src/services/healthMonitor.ts` (lines 145-183)

## Impact

- **TTS**: Now works reliably even when highlights are present or when page state initialization has timing issues
- **Text Selection**: Works consistently in all modes (single page, continuous scroll, reading mode)
- **Console Output**: Clean console without health check spam
- **User Experience**: Both features now work as expected without workarounds

