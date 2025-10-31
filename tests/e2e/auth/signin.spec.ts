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
    await expect(page).toHaveTitle(/Smart Reader|Immersive Reader/);
    
    // Check for sign in button or link
    const signInButton = page.getByRole('button', { name: /sign in|get started|start free trial/i });
    await expect(signInButton).toBeVisible();
  });

  test('should open auth modal when sign in is clicked', async ({ page }) => {
    // Click sign in
    await page.getByRole('button', { name: /sign in|get started/i }).click();
    
    // Wait for auth modal to appear
    const authModal = page.locator('[role="dialog"], .auth-modal, #auth-modal');
    await expect(authModal).toBeVisible();
  });

  test('should show Google OAuth option', async ({ page }) => {
    // Open auth modal
    await page.getByRole('button', { name: /sign in|get started/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    
    // Check for Google sign in button
    const googleButton = page.getByRole('button', { name: /sign in with google|continue with google/i });
    await expect(googleButton).toBeVisible();
  });

  test('should close auth modal when cancel is clicked', async ({ page }) => {
    // Open auth modal
    await page.getByRole('button', { name: /sign in|get started/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    
    // Click cancel/close
    const cancelButton = page.getByRole('button', { name: /cancel|close/i });
    await cancelButton.click();
    
    // Modal should be hidden
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});

