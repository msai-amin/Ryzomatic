/**
 * Helper functions for PDF Viewer V2 E2E tests
 */

import { Page, Locator } from '@playwright/test';

/**
 * Wait for PDF viewer to be fully loaded
 */
export async function waitForPDFViewer(page: Page, timeout = 10000): Promise<boolean> {
  try {
    // Wait for PDF viewer container
    const viewer = page.locator('.rpv-core__viewer, .pdf-viewer-container');
    await viewer.first().waitFor({ state: 'visible', timeout });
    
    // Wait for PDF.js to load
    await page.waitForFunction(
      () => {
        return (
          typeof (window as any).pdfjsLib !== 'undefined' ||
          document.querySelector('.rpv-core__page-layer') !== null
        );
      },
      { timeout }
    );

    // Wait for at least one page to render
    await page.waitForSelector('.rpv-core__page-layer, .rpv-core__inner-page', { timeout });
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Select text in PDF by dragging
 */
export async function selectTextInPDF(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
  
  // Wait a bit for selection to register
  await page.waitForTimeout(300);
}

/**
 * Get PDF page bounding box
 */
export async function getPDFPageBounds(page: Page, pageIndex = 0): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const pageLayer = page.locator('.rpv-core__page-layer, .rpv-core__inner-page').nth(pageIndex);
  
  if (await pageLayer.count() === 0) {
    return null;
  }

  const boundingBox = await pageLayer.boundingBox();
  return boundingBox;
}

/**
 * Wait for highlight popup to appear
 */
export async function waitForHighlightPopup(page: Page, timeout = 3000): Promise<Locator | null> {
  try {
    const popup = page.locator(
      'button:has-text("Save Highlight"), ' +
      'button:has-text("Highlight"), ' +
      '[data-testid="highlight-popup"], ' +
      '.highlight-popup'
    ).first();

    await popup.waitFor({ state: 'visible', timeout });
    return popup;
  } catch (error) {
    return null;
  }
}

/**
 * Save highlight with optional color
 */
export async function saveHighlight(
  page: Page,
  color?: string
): Promise<boolean> {
  // Wait for popup
  const popup = await waitForHighlightPopup(page);
  if (!popup) {
    return false;
  }

  // Select color if provided
  if (color) {
    const colorButton = page.locator(
      `button[data-color="${color}"], ` +
      `[data-testid="color-${color}"], ` +
      `button[aria-label*="${color}"]`
    ).first();

    if (await colorButton.count() > 0) {
      await colorButton.click();
      await page.waitForTimeout(300);
    }
  }

  // Click save button
  const saveButton = page.locator(
    'button:has-text("Save Highlight"), ' +
    'button:has-text("Save"), ' +
    '[data-testid="save-highlight"]'
  ).first();

  if (await saveButton.count() > 0) {
    await saveButton.click();
    await page.waitForTimeout(1000);
    return true;
  }

  return false;
}

/**
 * Navigate to specific page
 */
export async function navigateToPage(page: Page, targetPage: number): Promise<boolean> {
  // Try to find page input or use navigation buttons
  const pageInput = page.locator(
    'input[type="number"][aria-label*="page"], ' +
    'input[data-testid="page-input"]'
  ).first();

  if (await pageInput.count() > 0) {
    await pageInput.fill(targetPage.toString());
    await pageInput.press('Enter');
    await page.waitForTimeout(2000);
    return true;
  }

  // Fallback: use navigation buttons
  const currentPageIndicator = page.locator('[data-testid="page-indicator"], .page-indicator').first();
  let currentPage = 1;

  if (await currentPageIndicator.count() > 0) {
    const pageText = await currentPageIndicator.textContent() || '1';
    const match = pageText.match(/(\d+)/);
    if (match) {
      currentPage = parseInt(match[1]);
    }
  }

  const nextButton = page.locator('button[aria-label*="next"]').first();
  const prevButton = page.locator('button[aria-label*="previous"]').first();

  if (targetPage > currentPage) {
    for (let i = currentPage; i < targetPage; i++) {
      if (await nextButton.count() > 0) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      } else {
        return false;
      }
    }
  } else if (targetPage < currentPage) {
    for (let i = currentPage; i > targetPage; i--) {
      if (await prevButton.count() > 0) {
        await prevButton.click();
        await page.waitForTimeout(1000);
      } else {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get current page number
 */
export async function getCurrentPage(page: Page): Promise<number> {
  const pageIndicator = page.locator(
    '[data-testid="page-indicator"], ' +
    '.page-indicator, ' +
    '[class*="page"][class*="number"]'
  ).first();

  if (await pageIndicator.count() > 0) {
    const pageText = await pageIndicator.textContent() || '1';
    const match = pageText.match(/(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return 1;
}

/**
 * Check if highlight exists on page
 */
export async function hasHighlight(page: Page, highlightId?: string): Promise<boolean> {
  if (highlightId) {
    const highlight = page.locator(`[data-highlight-id="${highlightId}"]`);
    return (await highlight.count()) > 0;
  }

  const highlights = page.locator('[data-highlight-id], .rpv-highlight__area');
  return (await highlights.count()) > 0;
}

/**
 * Open highlight management panel
 */
export async function openHighlightPanel(page: Page): Promise<boolean> {
  const panelButton = page.locator(
    'button[aria-label*="highlight"], ' +
    'button[aria-label*="Highlight"], ' +
    '[data-testid="highlight-panel-toggle"]'
  ).first();

  if (await panelButton.count() > 0) {
    await panelButton.click();
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

