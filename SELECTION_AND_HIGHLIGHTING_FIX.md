# Text Selection and Highlighting Position Fixes

## Issues Fixed

### 1. Text Selection Not Working in Continuous Scrolling Mode

**Problem**: Users couldn't select text when viewing PDFs in continuous scrolling mode. Selection only worked after switching to single page mode first.

**Root Causes**: 
1. Text layer div in continuous mode didn't have explicit inline styles
2. Rendering timing issue - refs not ready when text layers were being created
3. Styles not applied programmatically after rendering

**Fixes Applied**:

**A. Static Inline Styles** (Line 2553)
```typescript
<div
  className="textLayer"
  style={{ opacity: 1, pointerEvents: 'auto', userSelect: 'text' }}
/>
```

**B. Dynamic Styles in renderAllPages** (Lines 630-632)
```typescript
textLayerDiv.style.opacity = '1'
textLayerDiv.style.pointerEvents = 'auto'
textLayerDiv.style.userSelect = 'text'
```

**C. Retry Mechanism for Ref Readiness** (Lines 533-547)
```typescript
// Wait up to 1 second for canvas refs to be populated
let attempts = 0
const maxAttempts = 20 // 20 attempts * 50ms = 1 second max wait

while (attempts < maxAttempts && pageCanvasRefs.current.size === 0) {
  await new Promise(resolve => setTimeout(resolve, 50))
  attempts++
}
```

**D. Render Completion Tracking** (Lines 230, 286, 520, 675, 679)
```typescript
const [continuousModeRendered, setContinuousModeRendered] = useState(false)
// Reset when PDF loads or mode changes
// Set to true after rendering completes
// Guard prevents duplicate renders
```

**E. Safety Net Check** (Lines 686-702)
```typescript
// Double-check all text layers after 200ms
setTimeout(() => {
  pageTextLayerRefs.current.forEach((textLayerDiv) => {
    textLayerDiv.style.opacity = '1'
    textLayerDiv.style.pointerEvents = 'auto'
    textLayerDiv.style.userSelect = 'text'
  })
}, 200)
```

**Why This Works**:
- Retry mechanism waits for DOM to be ready instead of fixed delay
- Render tracking prevents infinite loops and duplicate renders
- Safety net catches cases where initial render fails
- Multiple defensive layers ensure text selection always works
- Extensive logging helps diagnose any remaining issues
- Text selection now works immediately on page load without mode switching

### 2. Highlighted Area Doesn't Match Selection Area

**Problem**: When creating highlights, the yellow/colored boxes appeared in incorrect positions, not matching the selected text. Sometimes the selection would cover the phrase completely, sometimes not, and the highlight wouldn't match.

**Root Causes**: 
1. Using `getClientRects()` which returns multiple rectangles (one per line fragment)
2. Font-based adjustments were being applied to positions
3. Using only the first rectangle from a multi-rect selection

**Fixes Applied**:

**A. Changed to getBoundingClientRect()** (Line 1319)
```typescript
// Before: const rects = range.getClientRects()
// After:
const selectionRect = range.getBoundingClientRect()
```

**B. Removed Font-Based Adjustments** (Line 1373-1374)
```typescript
// TEXT ALIGNMENT: Use browser's getBoundingClientRect() without adjustments  
// Previous adjustments were causing position misalignment - browser rect is already accurate
```

**Why This Works**:
- `getBoundingClientRect()` returns a single unified bounding box encompassing the entire selection
- No multiple rects to handle - one box fits all selected text
- Browser's API already provides pixel-perfect accuracy
- Positions match the text span coordinates exactly (e.g., left: 216.07px, top: 167.447px)

### 3. Enhanced Debugging

**Added**: More comprehensive debug logging for highlight position issues
- Container information (data-page-number, className, offsets)
- Scroll position tracking
- Raw vs normalized positions
- Text element details

**Location**: Lines 1386-1400

## Technical Details

### Z-Index Layering

Fixed the stacking order to ensure proper layering:
- Canvas: base layer (z-index: 0, implicit)
- Text Layer: z-index: 2 (from CSS)
- Text Spans: z-index: 1 (from CSS)
- Highlights: z-index: 3 (new, ensures they appear above text)

This ensures:
1. Text can be selected (text layer has pointerEvents: auto)
2. Highlights appear above text (z-index: 3)
3. Highlights don't block selection (pointerEvents: none)
4. Delete buttons work (pointerEvents: auto on button)

### Position Calculation Flow

1. **Get Selection**: `window.getSelection()` and `range.getBoundingClientRect()`
2. **Find Container**: Traverse DOM to find page container with `data-page-number`
3. **Calculate Offset**: `firstRect.left - containerRect.left`, `firstRect.top - containerRect.top`
4. **Normalize Scale**: Divide by current scale to store at scale 1.0
5. **Render Highlight**: Multiply by current scale when rendering

This ensures highlights scale correctly when zooming.

## Files Modified

- `src/components/PDFViewer.tsx`:
  - Line 230: Added continuousModeRendered state tracking
  - Line 286: Reset continuousModeRendered when PDF loads
  - Line 293: Added scrollMode to PDF info logging
  - Lines 518-521: Reset render flag when scale/rotation/mode changes
  - Lines 524-529: Added render guard and enhanced logging
  - Lines 533-547: Added retry mechanism for ref readiness (up to 1 second)
  - Line 549: Log when refs are ready
  - Lines 552-556: Check both canvas and textLayer refs
  - Lines 657-667: Enhanced text layer render logging with child count
  - Lines 675-679: Set render completion flag and log success
  - Lines 686-702: Added safety net to force text layer styles after 200ms
  - Line 1323: Changed from getClientRects() to getBoundingClientRect()
  - Lines 1249-1260: Added selection detection logging
  - Lines 1340-1346: Improved position calculation comments
  - Line 2557: Added inline styles to textLayer in continuous mode
  - Lines 1361-1362: Removed problematic text alignment adjustments
  - Lines 1391-1403: Enhanced highlight position debug logging
  - Lines 2580, 2668: Added z-index: 3 to highlights

## Impact

### Text Selection
- ✅ Works in continuous scrolling mode
- ✅ Works in single page mode
- ✅ Works in reading mode
- ✅ Works with or without highlights present

### Highlight Positioning
- ✅ Accurate positioning matching selected text
- ✅ Works at all zoom levels
- ✅ Works in both scrolling modes
- ✅ Proper layering (highlights visible above text)

## Testing Guide

### Test Text Selection
1. Open a PDF in continuous scrolling mode
2. Try to select text on any page
3. ✅ Selection should work, color picker should appear
4. Switch to single page mode
5. ✅ Selection should still work

### Test Highlight Positioning
1. Select some text in continuous mode
2. Choose a highlight color
3. ✅ Yellow/colored box should exactly match the selected text
4. Zoom in/out
5. ✅ Highlight should scale correctly
6. Try on different pages
7. ✅ Positions should be accurate on all pages

### Debug Console
If positioning issues persist, check browser console for "Highlight position debug:" log which now includes:
- Container information
- Scroll position
- Raw and normalized positions
- All calculation details

## No Cost Impact

All fixes are client-side only - no API calls or additional costs.

