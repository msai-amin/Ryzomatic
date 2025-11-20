# PDF Viewer V2 Testing Guide

## Overview

This guide explains how to test the PDF Viewer V2 component, including highlighting and other core features.

## Quick Start

### Run All Tests

```bash
# Unit tests for highlighting utilities
npm run test tests/utils/pdfHighlightGeometry.test.ts tests/utils/highlightCoordinates.test.ts

# E2E tests for PDF Viewer V2
npm run test:e2e tests/e2e/pdf-viewer-v2/
```

### Run Specific Test Suites

```bash
# Highlighting tests only
npm run test:e2e tests/e2e/pdf-viewer-v2/highlighting.spec.ts

# Features tests only
npm run test:e2e tests/e2e/pdf-viewer-v2/features.spec.ts
```

## Test Coverage

### Highlighting Tests (`highlighting.spec.ts`)

#### Highlight Creation
- ✅ Text selection in PDF
- ✅ Highlight popup display
- ✅ Saving highlights with default color
- ✅ Color selection for highlights

#### Highlight Management
- ✅ Highlight management panel display
- ✅ Listing saved highlights
- ✅ Deleting highlights

#### Highlight Persistence
- ✅ Highlights persist across page navigation

### Features Tests (`features.spec.ts`)

#### Page Navigation
- ✅ Navigate to next page
- ✅ Navigate to previous page
- ✅ Navigate to first page
- ✅ Navigate to last page (if implemented)
- ✅ Go to specific page (if implemented)

#### Zoom Functionality
- ✅ Zoom in
- ✅ Zoom out
- ✅ Zoom level indicator

#### Rotation
- ✅ Rotate PDF clockwise

#### Search Functionality
- ✅ Open search dialog
- ✅ Search for text in PDF

#### Reading Mode
- ✅ Toggle reading mode

#### Integration
- ✅ Notes panel integration
- ✅ TTS controls display

## Test Structure

```
tests/e2e/pdf-viewer-v2/
├── highlighting.spec.ts    # Highlighting-specific tests
├── features.spec.ts        # Core PDF viewer features
├── helpers.ts             # Helper functions
├── README.md              # Documentation
└── TESTING_GUIDE.md       # This file
```

## Helper Functions

The `helpers.ts` file provides reusable functions:

### PDF Viewer Utilities
- `waitForPDFViewer()` - Wait for PDF viewer to load
- `getPDFPageBounds()` - Get page bounding box

### Highlighting Utilities
- `selectTextInPDF()` - Select text by dragging
- `waitForHighlightPopup()` - Wait for highlight popup
- `saveHighlight()` - Save a highlight with optional color
- `hasHighlight()` - Check if highlight exists
- `openHighlightPanel()` - Open highlight management panel

### Navigation Utilities
- `navigateToPage()` - Navigate to specific page
- `getCurrentPage()` - Get current page number

## Writing Tests

### Basic Test Structure

```typescript
test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    // 1. Setup
    await page.goto('/');
    await ensureAuthenticated(page);
    
    // 2. Wait for PDF viewer
    const isLoaded = await waitForPDFViewer(page);
    if (!isLoaded) {
      test.skip(true, 'PDF viewer not available');
    }
    
    // 3. Perform action
    await someAction(page);
    
    // 4. Assert result
    await expect(someElement).toBeVisible();
  });
});
```

### Using Helpers

```typescript
// Select text
const bounds = await getPDFPageBounds(page);
if (bounds) {
  await selectTextInPDF(
    page,
    bounds.x + 100,
    bounds.y + 100,
    bounds.x + 200,
    bounds.y + 100
  );
}

// Save highlight
await saveHighlight(page, 'yellow');

// Navigate
await navigateToPage(page, 5);
const currentPage = await getCurrentPage(page);
```

## CI/CD Integration

Tests run automatically via GitHub Actions on:
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

The workflow runs:
1. Unit tests for highlighting utilities
2. E2E tests on multiple browsers (Chromium, Firefox, WebKit)
3. Separate jobs for highlighting and features
4. Test reports and artifacts

## Debugging

### View Test Execution

```bash
npm run test:e2e:ui
```

### Debug Mode

```bash
npm run test:e2e:debug tests/e2e/pdf-viewer-v2/
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots in `test-results/`
- Videos in `test-results/`
- HTML reports in `playwright-report/`

## Common Issues

### "PDF viewer not available"

**Cause**: PDF document not loaded or viewer not rendered

**Solution**:
- Ensure a PDF is uploaded/selected
- Check authentication
- Verify PDF viewer component is rendering
- Increase wait timeouts

### "Text selection not working"

**Cause**: PDF text layer not ready or coordinates incorrect

**Solution**:
- Wait longer for PDF to load
- Use `getPDFPageBounds()` for accurate coordinates
- Try different selection methods

### "Highlight popup not appearing"

**Cause**: Selection not registered or popup selector incorrect

**Solution**:
- Verify text was actually selected
- Check popup selector matches implementation
- Increase wait timeout
- Check browser console for errors

### "Tests timing out"

**Cause**: Operations taking longer than expected

**Solution**:
- Increase timeout values
- Add explicit waits
- Check network conditions
- Verify app performance

## Best Practices

1. **Always wait for PDF viewer** before interacting
2. **Use helper functions** for common operations
3. **Add appropriate timeouts** for async operations
4. **Skip tests gracefully** when prerequisites aren't met
5. **Use descriptive test names** that explain what's tested
6. **Group related tests** using `test.describe()`
7. **Clean up after tests** if needed (e.g., delete test highlights)

## Future Enhancements

Potential test additions:
- [ ] Visual regression tests
- [ ] Performance tests
- [ ] Accessibility tests
- [ ] Mobile device tests
- [ ] Multi-document tests
- [ ] Highlight export tests
- [ ] Highlight sharing tests

