# Audio Widget Reading Mode Fix

## Problem
The AudioWidget was not appearing in Reading Mode, making it impossible for users to listen to the customized (cleaned) text.

## Root Cause Analysis

### 1. **Visibility Issue**
- The AudioWidget was always rendered, but with a low z-index (`z-60`)
- Other UI elements in Reading Mode (modals, overlays) might have been covering it
- No conditional rendering based on document state

### 2. **Text Source Logic (Already Correct)**
The logic for prioritizing `cleanedPageTexts` over `pageTexts` was already implemented correctly:

```typescript
// In reading mode, prioritize cleaned text if available
const hasCleanedTexts = pdfViewer.readingMode && 
  normalizedCleanedPageTexts.length > 0 &&
  normalizedCleanedPageTexts.some(text => text !== null && text !== undefined && text.length > 0)

const useCleanedText = hasCleanedTexts
const sourceTexts = useCleanedText ? normalizedCleanedPageTexts : normalizedPageTexts
```

This logic is used in:
- `useEffect` for extracting paragraphs (line 376-522)
- `getCurrentPageText` (line 602-628)
- `getAllRemainingText` (line 631-668)

## Implemented Fixes

### Fix 1: Conditional Rendering
Added early return if no document is loaded:

```typescript
// Don't render if no document is loaded
if (!currentDocument) {
  console.log('🔊 AudioWidget: Not rendering - no document loaded');
  return null;
}
```

**Why**: Prevents the widget from appearing when there's no content to play.

### Fix 2: Increased Z-Index (CRITICAL FIX)
Changed z-index from `z-60` → `z-[9999]` → **`z-[100000]`** (final):

```typescript
className={`fixed z-[100000] transition-shadow duration-300 ...`}
```

**Why**: The CustomizableReadingWizard modal uses:
- Backdrop: `z-[9998]`
- Modal content: `z-[9999]`
- Internal elements: `z-[10001]`

Other modals (LibraryModal, GeneralSettings) use `z-[10000]`.

The AudioWidget **must be above all modals** to remain accessible during Reading Mode setup and usage. Using `z-[100000]` ensures it's always the topmost element.

### Fix 3: Enhanced Debug Logging
Added comprehensive logging to track widget state:

```typescript
useEffect(() => {
  console.log('🔊 AudioWidget: Render state', {
    hasDocument: !!currentDocument,
    documentId: currentDocument?.id,
    readingMode: pdfViewer.readingMode,
    hasPageTexts: !!currentDocument?.pageTexts,
    hasCleanedPageTexts: !!currentDocument?.cleanedPageTexts,
    pageTextsLength: currentDocument?.pageTexts?.length || 0,
    cleanedPageTextsLength: currentDocument?.cleanedPageTexts?.length || 0,
    position,
    isVisible: !!currentDocument
  });
}, [currentDocument?.id, pdfViewer.readingMode, ...]);
```

**Why**: Helps diagnose visibility and text source issues in production.

## How It Works Now

### Text Source Priority (Reading Mode)
1. **In Reading Mode** (`pdfViewer.readingMode === true`):
   - First checks if `cleanedPageTexts` exists and has valid content
   - If yes, uses `cleanedPageTexts` (customized text optimized for TTS)
   - If no, falls back to `pageTexts` (original extracted text)

2. **In Normal Mode** (`pdfViewer.readingMode === false`):
   - Always uses `pageTexts` (original extracted text)

### Visibility
- Widget only appears when a document is loaded (`currentDocument !== null`)
- Widget appears with z-index 9999, ensuring it's above all other elements
- Widget is draggable and can be repositioned by the user

## Testing Checklist

### Pre-Deployment Testing
- [ ] Load a document in normal mode
  - [ ] AudioWidget appears
  - [ ] Can play original text
  - [ ] Can drag and reposition widget
- [ ] Enter Reading Mode (via Customizable Reading Wizard)
  - [ ] AudioWidget remains visible
  - [ ] Can play customized text
  - [ ] Text sounds optimized (abbreviations expanded, etc.)
- [ ] Switch between documents
  - [ ] AudioWidget updates correctly
  - [ ] Playback stops when switching documents
- [ ] Close document (return to library)
  - [ ] AudioWidget disappears

### Debug Console Checks
Look for these console messages:
```
🔊 AudioWidget version: v3-reading-mode-fix
🔊 AudioWidget: Render state { hasDocument: true, readingMode: true, ... }
🔍 AudioWidget: Text source decision { useCleanedText: true, sourceType: 'cleanedPageTexts', ... }
```

## Files Modified
- `src/components/AudioWidget.tsx`
  - Added conditional rendering (early return if no document)
  - Increased z-index from `z-60` to `z-[9999]`
  - Added debug logging for render state
  - Updated version marker to `v3-reading-mode-fix`

## Related Components
- `src/components/PDFViewerV2.tsx` - Renders AudioWidget unconditionally
- `src/components/customReading/CustomizableReadingWizard.tsx` - Sets up Reading Mode
- `src/services/textCleanupService.ts` - Processes text for TTS
- `api/text/cleanup.ts` - Gemini 2.5 Flash endpoint for text optimization

## User Experience

### Before Fix
- AudioWidget not visible in Reading Mode
- Users couldn't listen to customized text
- Confusion about whether TTS was available

### After Fix
- AudioWidget always visible when document is loaded
- Clear visual feedback with status indicator
- Seamless switching between original and customized text
- Widget stays above all other UI elements

## Technical Notes

### Z-Index Hierarchy
```
z-[100000] - AudioWidget (FINAL - always on top)
z-[10001]  - CustomizableReadingWizard internal elements
z-[10000]  - LibraryModal, GeneralSettings modals
z-[9999]   - CustomizableReadingWizard modal content
z-[9998]   - CustomizableReadingWizard backdrop
z-[100]    - Sidebars
z-60       - AudioWidget (OLD - way too low)
z-50       - Floating panels
```

**Key Insight**: The AudioWidget must have the **highest z-index** of any element in the application to remain accessible at all times, especially during Reading Mode wizard and while reading.

### Text Source Selection Logic
The AudioWidget dynamically selects the text source based on:
1. **Reading Mode state** (`pdfViewer.readingMode`)
2. **Availability of cleaned text** (`cleanedPageTexts.length > 0`)
3. **Validity of cleaned text** (non-null, non-empty strings)

This ensures:
- No confusion between text sources
- Automatic fallback to original text if cleaned text is unavailable
- Single source of truth for playback mode

### No "Unsync" Needed
The user's concern about "unsynching the player when it is in reading mode from other instances" is not applicable because:
- There's only **one instance** of AudioWidget
- It dynamically switches text sources based on state
- No need for separate instances or synchronization logic

## Deployment

### Build Command
```bash
npm run build
```

### Verification Steps
1. Deploy to Vercel
2. Open production URL
3. Upload a document
4. Enter Reading Mode via Customizable Reading Wizard
5. Verify AudioWidget appears in bottom-right corner
6. Click play and verify customized text is spoken
7. Check browser console for debug logs

### Rollback Plan
If issues occur:
1. Revert `src/components/AudioWidget.tsx` to previous commit
2. Redeploy

## Success Metrics
- AudioWidget visible in 100% of document views
- Correct text source used in 100% of playback sessions
- Zero user reports of "missing audio widget"

## Future Enhancements
1. **Visual indicator** showing which text source is active (original vs. customized)
2. **Toggle button** to switch between text sources manually
3. **Persistent widget position** per user (already partially implemented)
4. **Keyboard shortcuts** for play/pause (Space), next/prev paragraph (Arrow keys)

