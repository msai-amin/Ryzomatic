/**
 * Authentication helpers for E2E tests
 */

import { Page } from '@playwright/test';

export async function signInAsTestUser(page: Page): Promise<void> {
  // Navigate to the app
  await page.goto('/');
  
  // Check if already authenticated by looking for user-specific UI
  const isAuthenticated = await page.locator('[data-testid="user-menu"], [data-testid="library-button"]').count() > 0;
  
  if (isAuthenticated) {
    console.log('User is already authenticated');
    return;
  }
  
  // Click sign in
  await page.getByRole('button', { name: /sign in|get started/i }).click();
  
  // Wait for auth modal
  await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  
  // NOTE: Actual Google OAuth requires proper test credentials
  // For now, we'll skip the actual sign-in process
  console.log('⚠️  Skipping actual authentication - requires test credentials');
  
  // Close the modal
  await page.getByRole('button', { name: /cancel|close/i }).click();
}

export async function ensureAuthenticated(page: Page): Promise<boolean> {
  // Check if authenticated
  const libraryButton = page.locator('[data-testid="library-button"], button:has-text("Library")');
  const isVisible = await libraryButton.isVisible();
  
  if (!isVisible) {
    await signInAsTestUser(page);
    return false;
  }
  
  return true;
}

