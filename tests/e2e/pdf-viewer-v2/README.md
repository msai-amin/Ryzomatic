# PDF Viewer V2 E2E Tests

This directory contains end-to-end tests for the PDF Viewer V2 component, focusing on highlighting functionality and core features.

## Test Files

- **`highlighting.spec.ts`** - Tests for highlight creation, management, and persistence
- **`features.spec.ts`** - Tests for core PDF viewer features (navigation, zoom, rotation, search, etc.)
- **`helpers.ts`** - Helper functions for common test operations

## Running Tests

### Locally

```bash
# Run all PDF viewer tests
npm run test:e2e tests/e2e/pdf-viewer-v2/

# Run only highlighting tests
npm run test:e2e tests/e2e/pdf-viewer-v2/highlighting.spec.ts

# Run only features tests
npm run test:e2e tests/e2e/pdf-viewer-v2/features.spec.ts

# Run with UI
npm run test:e2e:ui tests/e2e/pdf-viewer-v2/
```

### In CI/CD

Tests run automatically via GitHub Actions workflow (`.github/workflows/pdf-viewer-v2-tests.yml`) on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

## Prerequisites

1. **Authentication**: Tests require a logged-in user. The `authenticateUser` helper handles this.
2. **Test Document**: A PDF document should be available in the app (either pre-uploaded or uploaded during test setup).
3. **Environment Variables**: 
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Test Structure

### Highlighting Tests

- **Highlight Creation**: Text selection, popup display, saving highlights
- **Color Selection**: Choosing different highlight colors
- **Highlight Management**: Viewing, editing, and deleting highlights
- **Persistence**: Highlights persist across page navigation

### Features Tests

- **Page Navigation**: Next, previous, first, last, goto page
- **Zoom**: Zoom in/out functionality
- **Rotation**: Clockwise rotation
- **Search**: Text search within PDF
- **Reading Mode**: Toggle reading mode
- **Notes Integration**: Notes panel functionality
- **TTS Integration**: Text-to-speech controls

## Helper Functions

The `helpers.ts` file provides utilities:

- `waitForPDFViewer()` - Wait for PDF viewer to load
- `selectTextInPDF()` - Select text by dragging
- `getPDFPageBounds()` - Get page bounding box
- `waitForHighlightPopup()` - Wait for highlight popup
- `saveHighlight()` - Save a highlight with optional color
- `navigateToPage()` - Navigate to specific page
- `getCurrentPage()` - Get current page number
- `hasHighlight()` - Check if highlight exists
- `openHighlightPanel()` - Open highlight management panel

## Writing New Tests

When adding new tests:

1. Use helper functions from `helpers.ts` when possible
2. Add appropriate waits for async operations
3. Use `test.skip()` for tests that require specific conditions
4. Use descriptive test names that explain what is being tested
5. Group related tests using `test.describe()`

Example:

```typescript
test('should perform specific action', async ({ page }) => {
  // Wait for PDF viewer
  const isLoaded = await waitForPDFViewer(page);
  if (!isLoaded) {
    test.skip(true, 'PDF viewer not available');
  }

  // Perform action
  await someAction(page);

  // Assert result
  await expect(someElement).toBeVisible();
});
```

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
- Screenshots (on failure)
- Videos (on failure)
- Traces (on first retry)

These are available in the `playwright-report/` directory.

## Known Limitations

1. **Text Selection**: PDF text selection can be tricky. Tests use mouse drag simulation, which may not work perfectly in all scenarios.
2. **Timing**: Some operations require specific wait times. Adjust timeouts if tests are flaky.
3. **Browser Differences**: Some features may behave differently across browsers (Chromium, Firefox, WebKit).

## CI/CD Integration

The GitHub Actions workflow runs:
- Unit tests for highlighting utilities
- E2E tests on multiple browsers (Chromium, Firefox, WebKit)
- Separate jobs for highlighting and features tests
- Test result artifacts and reports

## Troubleshooting

### Tests Fail with "PDF viewer not available"

- Ensure a PDF document is loaded in the app
- Check that authentication is working
- Verify the PDF viewer component is rendering

### Tests Fail with Timeout

- Increase timeout values in test configuration
- Check network conditions
- Verify the app is running correctly

### Highlight Tests Fail

- Verify highlight service is working
- Check that highlight popup appears after text selection
- Ensure highlight colors are configured correctly

