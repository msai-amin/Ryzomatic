# Highlighting Position Fix

## Issue
Highlighted areas don't correspond to the selected text area in production.

## Root Cause
Position calculation needs to account for:
1. Page container's relative positioning
2. Canvas vs text layer coordinate systems  
3. Zoom/scale transformations
4. Scroll container padding (p-8)
5. Continuous vs single page mode differences

## Solution

### Debug Logging Added
Console logs now show:
- Selection rectangle (viewport coordinates)
- Container rectangle (viewport coordinates)
- Calculated position (relative to container)
- Current scale/zoom
- Page number and scroll mode

### Testing Instructions

1. **Open production app**
2. **Upload a PDF**
3. **Wait 30 seconds** for database sync
4. **Select some text**
5. **Open browser console** (F12)
6. **Look for "Highlight position debug:" log**
7. **Take a screenshot of:**
   - The selected text
   - The console log output
   - The created highlight position (if any)

### Expected Console Output

```javascript
Highlight position debug: {
  pageNumber: 1,
  scrollMode: "continuous",
  selectionRect: { left: 523, top: 345, width: 150, height: 20 },
  containerRect: { left: 500, top: 200, width: 800, height: 1000 },
  calculatedPosition: { x: 23, y: 145, width: 150, height: 20 },
  scale: 1,
  zoom: 1
}
```

### What to Check

If highlights still don't match:

1. **Check if x/y are negative** - Page container detection might be wrong
2. **Check if scale != zoom** - Zoom state might be out of sync
3. **Check containerRect.width** - Should match canvas width
4. **Try both scroll modes** - Single page vs continuous

### Alternative Fix (if needed)

If debug shows the calculation is correct but rendering is wrong, the issue is in the CSS/positioning of the highlight overlay divs. Check:
- Are highlights using `position: absolute`?
- Is the parent container using `position: relative`?
- Are there any CSS transforms affecting positioning?

## Files Modified
- `src/components/PDFViewer.tsx` - Better container detection and debug logging

