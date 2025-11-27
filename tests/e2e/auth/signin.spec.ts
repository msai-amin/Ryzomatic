/**
 * E2E Tests for Authentication
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display landing page with sign in option', async ({ page }) => {
    await expect(page).toHaveTitle(/ryzomatic|Smart Reader|Immersive Reader/);
    
    // Check for sign in button or link (more flexible selectors)
    const signInButton = page.getByRole('button', { name: /sign in|get started|start free trial|log in/i });
    await expect(signInButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should open auth modal when sign in is clicked', async ({ page }) => {
    // Click sign in (use first() to handle multiple matches)
    const signInButton = page.getByRole('button', { name: /sign in|get started|log in/i }).first();
    await signInButton.click({ timeout: 10000 });
    
    // Wait for auth modal to appear (more flexible selectors)
    const authModal = page.locator('[role="dialog"], .auth-modal, #auth-modal, [data-testid="auth-modal"]');
    await expect(authModal).toBeVisible({ timeout: 10000 });
  });

  test('should show Google OAuth option', async ({ page }) => {
    // Open auth modal
    const signInButton = page.getByRole('button', { name: /sign in|get started|log in/i }).first();
    await signInButton.click({ timeout: 10000 });
    await page.waitForSelector('[role="dialog"], .auth-modal, #auth-modal', { state: 'visible', timeout: 10000 });
    
    // Check for Google sign in button (more flexible)
    const googleButton = page.getByRole('button', { name: /sign in with google|continue with google|google/i });
    await expect(googleButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should close auth modal when cancel is clicked', async ({ page }) => {
    // Open auth modal
    const signInButton = page.getByRole('button', { name: /sign in|get started|log in/i }).first();
    await signInButton.click({ timeout: 10000 });
    await page.waitForSelector('[role="dialog"], .auth-modal, #auth-modal', { state: 'visible', timeout: 10000 });
    
    // Click cancel/close (try multiple selectors)
    const cancelButton = page.getByRole('button', { name: /cancel|close/i }).first();
    await cancelButton.click({ timeout: 10000 });
    
    // Modal should be hidden
    await expect(page.locator('[role="dialog"], .auth-modal, #auth-modal').first()).not.toBeVisible({ timeout: 10000 });
  });
});

