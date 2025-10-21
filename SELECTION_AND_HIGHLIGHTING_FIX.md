# Text Selection and Highlighting Position Fixes

## Issues Fixed

### 1. Text Selection Not Working in Continuous Scrolling Mode

**Problem**: Users couldn't select text when viewing PDFs in continuous scrolling mode.

**Root Cause**: The text layer div in continuous mode didn't have explicit inline styles to ensure it was visible and selectable.

**Fix**: Added explicit inline styles to the textLayer div in continuous mode
```typescript
// Line 2553
<div
  className="textLayer"
  style={{ opacity: 1, pointerEvents: 'auto', userSelect: 'text' }}
/>
```

**Why This Works**:
- `opacity: 1` - Ensures text layer is visible
- `pointerEvents: 'auto'` - Allows mouse interactions
- `userSelect: 'text'` - Enables text selection

### 2. Highlighted Area Doesn't Match Selection Area

**Problem**: When creating highlights, the yellow/colored boxes appeared in incorrect positions, not matching the selected text.

**Root Cause**: The position calculation was applying font-based adjustments (baseline adjustment, height reduction) that were causing misalignment:
```typescript
// REMOVED - These were causing misalignment:
const baselineAdjustment = fontSize * 0.2 // Move down 20% 
rawPosition.y += baselineAdjustment
const textBodyHeight = fontSize * 0.7 // Use 70% of font size
rawPosition.height = Math.min(rawPosition.height, textBodyHeight)
```

**Fix**: Removed the text alignment adjustments and trusted the browser's `getBoundingClientRect()` API
```typescript
// Line 1357-1358
// TEXT ALIGNMENT: Use browser's getBoundingClientRect() without adjustments  
// Previous adjustments were causing position misalignment - browser rect is already accurate
```

**Why This Works**:
- Browser's `getBoundingClientRect()` already provides accurate positions
- No need for font-based adjustments
- Positions now correctly match the selected text bounds

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
  - Line 2553: Added inline styles to textLayer in continuous mode
  - Line 1357-1358: Removed problematic text alignment adjustments
  - Lines 1343-1346: Added scroll adjustment tracking (for future use)
  - Lines 1385-1399: Enhanced debug logging
  - Lines 2576, 2664: Added z-index: 3 to highlights

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

