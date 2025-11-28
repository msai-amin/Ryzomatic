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
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for the new consistent branding - be flexible with the separator
    const title = await page.title();
    expect(title).toMatch(/ryzomatic/i);
    expect(title).toMatch(/Smart Research Platform/i);
    
    // Check for sign in button or link (more flexible selectors)
    const signInButton = page.getByRole('button', { name: /sign in|get started|start free trial|log in/i });
    await expect(signInButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should open auth modal when sign in is clicked', async ({ page }) => {
    // Click sign in (use first() to handle multiple matches)
    const signInButton = page.getByRole('button', { name: /sign in|get started|log in/i }).first();
    await signInButton.click({ timeout: 10000 });
    
    // Wait for navigation to complete (auth modal opens via ?auth=true URL)
    await page.waitForURL(/\?auth=true/, { timeout: 10000 });
    
    // Wait for auth modal to appear (more flexible selectors)
    // Increased timeout to 20s to account for page load and modal animation
    const authModal = page.locator('[role="dialog"], .auth-modal, #auth-modal, [data-testid="auth-modal"]');
    await expect(authModal).toBeVisible({ timeout: 20000 });
  });

  test('should show Google OAuth option', async ({ page }) => {
    // Open auth modal
    const signInButton = page.getByRole('button', { name: /sign in|get started|log in/i }).first();
    await signInButton.click({ timeout: 10000 });
    
    // Wait for navigation to complete
    await page.waitForURL(/\?auth=true/, { timeout: 10000 });
    
    // Wait for auth modal to appear
    await page.waitForSelector('[role="dialog"], .auth-modal, #auth-modal, [data-testid="auth-modal"]', { state: 'visible', timeout: 20000 });
    
    // Check for Google sign in button (more flexible)
    const googleButton = page.getByRole('button', { name: /sign in with google|continue with google|google/i });
    await expect(googleButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should close auth modal when cancel is clicked', async ({ page }) => {
    // Open auth modal
    const signInButton = page.getByRole('button', { name: /sign in|get started|log in/i }).first();
    await signInButton.click({ timeout: 10000 });
    
    // Wait for navigation to complete
    await page.waitForURL(/\?auth=true/, { timeout: 10000 });
    
    // Wait for auth modal to appear
    await page.waitForSelector('[role="dialog"], .auth-modal, #auth-modal, [data-testid="auth-modal"]', { state: 'visible', timeout: 20000 });
    
    // Click cancel/close (the X button in the modal header)
    // The close button contains an X icon (lucide-react X component)
    const closeButton = page.locator('[role="dialog"] button:has(svg), .auth-modal button:has(svg)').first();
    await closeButton.click({ timeout: 10000 });
    
    // Wait for navigation back to landing page (modal closes by navigating to /)
    await page.waitForURL(/^[^?]*$/, { timeout: 10000 });
    
    // Modal should be hidden (landing page should be visible)
    await expect(page.locator('[role="dialog"], .auth-modal, #auth-modal, [data-testid="auth-modal"]').first()).not.toBeVisible({ timeout: 10000 });
  });
});

