# E2E Testing Quick Start 🚀

## ✅ Authentication Fix Applied

Network-level mocking is now implemented. E2E tests can run without real authentication!

---

## Quick Commands

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npm run test:e2e tests/e2e/pdf-viewer-v2/features.spec.ts
```

### Run with Visual Browser (See What's Happening)
```bash
npm run test:e2e -- --headed
```

### Run in Debug Mode
```bash
npm run test:e2e -- --debug
```

### Run Only Chromium Tests
```bash
npm run test:e2e -- --project=chromium
```

### Run with UI Mode (Interactive)
```bash
npx playwright test --ui
```

---

## Writing Tests with Authentication

### Basic Example:

```typescript
import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../helpers/auth';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    // This handles all authentication
    await ensureAuthenticated(page);
  });

  test('should work when authenticated', async ({ page }) => {
    // User is already authenticated
    await expect(page.locator('button:has-text("Library")')).toBeVisible();
  });
});
```

### Advanced Example:

```typescript
import { 
  setupAuthMocking, 
  getMockUser,
  mockSupabaseTable 
} from '../helpers/auth';

test('custom test with mock data', async ({ page }) => {
  // Setup auth mocking
  await setupAuthMocking(page);
  
  // Mock additional data
  await mockSupabaseTable(page, 'user_books', [
    { 
      id: '1', 
      title: 'Test Book', 
      user_id: getMockUser().id 
    }
  ]);
  
  // Navigate
  await page.goto('/');
  
  // Test your feature
  await expect(page.locator('text=Test Book')).toBeVisible();
});
```

---

## Debugging Failed Tests

### 1. Run with Headed Browser
```bash
npm run test:e2e -- --headed
```
Watch the test run in a real browser window.

### 2. Check Console Logs
Look for these messages:
- ✅ `Network-level auth mocking configured`
- ✅ `Test user signed in`
- ✅ `Authentication verified via: [selector]`

### 3. Add Debug Logging
```typescript
test('my test', async ({ page }) => {
  // Log all console messages
  page.on('console', msg => console.log('PAGE:', msg.text()));
  
  // Log all errors
  page.on('pageerror', err => console.log('ERROR:', err));
  
  await ensureAuthenticated(page);
});
```

### 4. Take Screenshots
```typescript
test('my test', async ({ page }) => {
  await ensureAuthenticated(page);
  
  // Take screenshot at any point
  await page.screenshot({ path: 'debug-screenshot.png' });
});
```

### 5. Pause Execution
```typescript
test('my test', async ({ page }) => {
  await ensureAuthenticated(page);
  
  // Pause here to inspect
  await page.pause();
});
```

---

## Common Issues

### Issue: "Authentication could not be verified"

**Solution**: Check if auth UI elements exist
```typescript
// Try different selectors
const authIndicators = [
  '[data-testid="library-button"]',
  'button:has-text("Library")',
  '[aria-label*="library" i]'
];
```

### Issue: "Test times out"

**Solution**: Increase timeout or check for missing mocks
```typescript
test('my test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  await ensureAuthenticated(page);
});
```

### Issue: "Element not found"

**Solution**: Wait for element to appear
```typescript
await page.waitForSelector('button:has-text("Library")', { 
  timeout: 10000 
});
```

---

## Test Structure

### Recommended Test Organization:

```
tests/e2e/
├── helpers/
│   └── auth.ts          # Authentication helpers
├── fixtures/
│   └── test-data.ts     # Test data
├── auth/
│   └── signin.spec.ts   # Auth tests
├── documents/
│   └── upload.spec.ts   # Document tests
└── pdf-viewer-v2/
    ├── features.spec.ts # PDF viewer tests
    └── highlighting.spec.ts
```

---

## Mock User Data

### Access Mock User Info:

```typescript
import { getMockUser, getMockSession } from '../helpers/auth';

const user = getMockUser();
// {
//   id: 'test-user-e2e-12345',
//   email: 'test@e2e-testing.local',
//   user_metadata: {
//     full_name: 'E2E Test User'
//   }
// }

const session = getMockSession();
// {
//   access_token: 'mock-test-token-e2e',
//   user: { ... }
// }
```

---

## CI/CD Integration

### GitHub Actions:

E2E tests will run automatically on:
- Pull requests to `main`
- Pushes to `main`
- Manual workflow dispatch

### Check Test Results:

1. Go to GitHub Actions tab
2. Find the E2E Tests workflow
3. View test results and artifacts
4. Download Playwright report if tests fail

---

## Next Steps

1. **Run tests locally**:
   ```bash
   npm run test:e2e
   ```

2. **Check results**:
   - All tests should pass ✅
   - Authentication should work automatically

3. **Write new tests**:
   - Use `ensureAuthenticated(page)` in `beforeEach`
   - Test your features with authenticated state

4. **Enable in CI**:
   - Tests will run automatically
   - No secrets needed (uses mocking)

---

## Resources

- **Full Documentation**: `E2E_AUTH_FIX.md`
- **Playwright Docs**: https://playwright.dev
- **Test Examples**: `tests/e2e/` directory

---

**Status**: ✅ Ready to use  
**Authentication**: ✅ Network-level mocking  
**CI/CD**: ✅ Configured  
**Documentation**: ✅ Complete

