# Testing Guide

## Overview

Smart Reader uses a comprehensive testing strategy with Vitest for unit/integration tests and Playwright for E2E tests.

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run CI mode
npm run test:ci
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# CI mode
npm run test:e2e:ci
```

## Test Coverage

Target: **70%+ coverage** for all services, utilities, and critical components.

Current coverage report is generated in `coverage/` directory. View it in browser:
```bash
open coverage/index.html
```

## Test Structure

```
tests/
├── services/          # Unit tests for services
├── ai/               # AI-specific tests
├── e2e/              # End-to-end tests
│   ├── auth/         # Authentication flow tests
│   ├── documents/    # Document management tests
│   └── library/      # Library functionality tests
├── fixtures/         # Test data and mocks
└── mocks/            # Mock implementations
```

## Writing Tests

### Unit Tests Example
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    const result = myService.doSomething();
    expect(result).toBe('expected');
  });
});
```

### E2E Tests Example
```typescript
import { test, expect } from '@playwright/test';

test('should display landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Smart Reader/);
});
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Services**: Use fixtures for Supabase, S3, AI services
3. **Clear Test Names**: Use descriptive names explaining what is tested
4. **Coverage**: Aim for 70%+ for all services
5. **Performance**: Tests should complete in reasonable time
6. **Maintainability**: Keep tests DRY and well-structured

## Continuous Integration

Tests run automatically on:
- Every push to any branch
- Every pull request
- Scheduled nightly runs

## Debugging Tests

### Unit Tests
```bash
npm run test:ui  # Opens Vitest UI
npm run test -- --reporter=verbose  # Verbose output
```

### E2E Tests
```bash
npm run test:e2e:debug  # Opens Playwright inspector
npx playwright codegen http://localhost:3001  # Record tests
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Documentation](https://testing-library.com/)

