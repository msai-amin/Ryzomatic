# E2E Authentication Fix - Network-Level Mocking ✅

## Problem Solved

E2E tests were failing because:
1. ❌ Mock authentication only set localStorage
2. ❌ App checks Supabase session via API calls
3. ❌ `supabase.auth.getSession()` returned no session
4. ❌ Services weren't initialized without valid session

## Solution Implemented

**Network-Level Mocking** - Intercepts Supabase API calls and returns mock responses.

---

## What Was Changed

### File Updated:
- `tests/e2e/helpers/auth.ts` (Complete rewrite)

### New Implementation:

#### 1. **Network Route Interception**
Intercepts all Supabase auth API calls:
- `**/auth/v1/token**` - Session/token requests
- `**/auth/v1/user**` - User info requests
- `**/rest/v1/user_profiles**` - User profile CRUD
- `**/rest/v1/rpc/**` - Database function calls

#### 2. **Mock User & Session**
```typescript
const MOCK_USER = {
  id: 'test-user-e2e-12345',
  email: 'test@e2e-testing.local',
  user_metadata: {
    full_name: 'E2E Test User'
  },
  app_metadata: {
    provider: 'email'
  },
  aud: 'authenticated',
  role: 'authenticated'
};

const MOCK_SESSION = {
  access_token: 'mock-test-token-e2e',
  refresh_token: 'mock-refresh-token-e2e',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: MOCK_USER
};
```

#### 3. **Enhanced Functions**

**`setupAuthMocking(page)`**
- Sets up all network route interceptions
- Adds localStorage initialization script
- Logs all intercepted requests for debugging

**`signInAsTestUser(page)`**
- Sets up mocking
- Navigates to app
- Waits for initialization
- Returns when ready

**`ensureAuthenticated(page)`**
- Sets up mocking
- Handles navigation/reload
- Verifies auth UI elements
- Returns authentication status

**`clearAuthentication(page)`**
- Clears localStorage/sessionStorage
- Removes route mocks
- Resets authentication state

**New Utilities:**
- `mockSupabaseTable(page, tableName, data)` - Mock specific tables
- `getMockUser()` - Get mock user for assertions
- `getMockSession()` - Get mock session for assertions

---

## How It Works

### Authentication Flow:

```
1. Test calls setupAuthMocking(page)
   ↓
2. Playwright intercepts network routes
   ↓
3. App loads and calls supabase.auth.getSession()
   ↓
4. Playwright intercepts the API call
   ↓
5. Returns mock session response
   ↓
6. App thinks user is authenticated ✅
   ↓
7. Services initialize with mock user ID
   ↓
8. Tests can run with authenticated state
```

### Network Interception Example:

```typescript
// When app calls: supabase.auth.getSession()
// Playwright intercepts: GET /auth/v1/token
// Returns: { access_token: 'mock...', user: {...} }

await page.route('**/auth/v1/token**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(MOCK_SESSION)
  });
});
```

---

## Usage in Tests

### Basic Usage:

```typescript
import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../helpers/auth';

test.describe('My Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    // This handles everything
    await ensureAuthenticated(page);
  });

  test('should work when authenticated', async ({ page }) => {
    // Your test code here
    // User is already authenticated
  });
});
```

### Advanced Usage:

```typescript
import { 
  setupAuthMocking, 
  signInAsTestUser, 
  getMockUser,
  mockSupabaseTable 
} from '../helpers/auth';

test('custom authentication flow', async ({ page }) => {
  // Manual setup
  await setupAuthMocking(page);
  
  // Mock additional data
  await mockSupabaseTable(page, 'user_books', [
    { id: '1', title: 'Test Book', user_id: getMockUser().id }
  ]);
  
  // Navigate
  await page.goto('/');
  
  // Verify
  const user = getMockUser();
  expect(user.email).toBe('test@e2e-testing.local');
});
```

---

## Benefits

### ✅ Advantages:

1. **Most Reliable** - Mocks at the network level, closest to real behavior
2. **No Code Changes** - App code doesn't need modification
3. **Complete Control** - Can mock any Supabase endpoint
4. **Easy Debugging** - Logs all intercepted requests
5. **Flexible** - Can mock different responses per test
6. **Fast** - No real API calls, tests run faster

### 🎯 What This Fixes:

- ✅ E2E tests can run without real authentication
- ✅ No need for test credentials
- ✅ Tests work in CI/CD without secrets
- ✅ Consistent test environment
- ✅ No rate limiting from Supabase
- ✅ Tests are isolated and repeatable

---

## Testing

### Run E2E Tests:

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e tests/e2e/pdf-viewer-v2/features.spec.ts

# Run with headed browser (see what's happening)
npm run test:e2e -- --headed

# Run with debug mode
npm run test:e2e -- --debug
```

### Verify Authentication:

```bash
# Run auth-specific tests
npm run test:e2e tests/e2e/auth/signin.spec.ts

# Check console output for:
# ✅ Network-level auth mocking configured
# ✅ Test user signed in
# ✅ Authentication verified via: [selector]
```

---

## Debugging

### If Tests Still Fail:

1. **Check Console Logs**
   ```bash
   npm run test:e2e -- --headed
   ```
   Look for:
   - `🔧 Setting up network-level auth mocking...`
   - `📡 Intercepted auth token request`
   - `✅ Test user signed in`

2. **Verify Network Interception**
   - Open browser DevTools (when using `--headed`)
   - Check Network tab
   - Should see intercepted requests with status 200

3. **Check Authentication UI**
   - Look for "Library" button
   - Look for "Upload" button
   - Look for user menu

4. **Enable Verbose Logging**
   Add to test:
   ```typescript
   page.on('console', msg => console.log('PAGE:', msg.text()));
   page.on('pageerror', err => console.log('ERROR:', err));
   ```

---

## Common Issues & Solutions

### Issue 1: "Authentication could not be verified"

**Cause**: Auth UI elements not found  
**Solution**: Check if selectors match your app's HTML

```typescript
// Update selectors in ensureAuthenticated()
const authIndicators = [
  '[data-testid="library-button"]',  // Your actual selector
  'button:has-text("Library")',
  // Add more selectors specific to your app
];
```

### Issue 2: "Network request not intercepted"

**Cause**: URL pattern doesn't match  
**Solution**: Check actual Supabase URL in Network tab

```typescript
// Update route pattern to match your Supabase URL
await page.route('**/auth/v1/token**', ...);
// Or use more specific pattern:
await page.route('https://your-project.supabase.co/auth/v1/token**', ...);
```

### Issue 3: "Tests timeout"

**Cause**: App waiting for real API response  
**Solution**: Ensure all necessary endpoints are mocked

```typescript
// Add more route mocks as needed
await page.route('**/rest/v1/your_table**', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify([])
  });
});
```

---

## CI/CD Integration

### GitHub Actions (.github/workflows/e2e.yml):

```yaml
- name: Run E2E tests
  env:
    # Mock Supabase URLs (not used with network mocking, but good practice)
    VITE_SUPABASE_URL: 'https://mock.supabase.co'
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key'
    PLAYWRIGHT_TEST_BASE_URL: http://localhost:3001
  run: npm run test:e2e -- --project=chromium
```

**Note**: With network-level mocking, you don't need real Supabase credentials!

---

## Next Steps

### 1. Update Existing Tests

Replace old auth helpers with new ones:

```typescript
// Old (localStorage only)
await mockAuthentication(page);

// New (network-level)
await ensureAuthenticated(page);
```

### 2. Add More Mocks

Mock additional endpoints as needed:

```typescript
// Mock user books
await mockSupabaseTable(page, 'user_books', [
  { id: '1', title: 'Book 1', user_id: getMockUser().id }
]);

// Mock collections
await mockSupabaseTable(page, 'user_collections', [
  { id: '1', name: 'My Collection', user_id: getMockUser().id }
]);
```

### 3. Run Tests in CI

Enable E2E tests in your CI pipeline:

```yaml
# Remove continue-on-error
- name: Run E2E tests
  run: npm run test:e2e
  # continue-on-error: true  # Remove this line
```

---

## Summary

**Problem**: E2E tests failing due to authentication  
**Solution**: Network-level mocking of Supabase API calls  
**Status**: ✅ Implemented and ready to use  
**Impact**: E2E tests can now run reliably without real auth

### Key Changes:
- ✅ Complete rewrite of `tests/e2e/helpers/auth.ts`
- ✅ Network route interception for all Supabase auth endpoints
- ✅ Mock user and session data
- ✅ Enhanced debugging and logging
- ✅ Utility functions for advanced testing

### Usage:
```typescript
import { ensureAuthenticated } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await ensureAuthenticated(page);
});
```

**Ready to use!** 🎉

---

**Date**: November 21, 2025  
**Type**: E2E Testing Infrastructure  
**Status**: ✅ Complete  
**Breaking Changes**: None (backward compatible)

