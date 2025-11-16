import { test, expect } from '@playwright/test';

const base = process.env.PROD_URL!;

test('homepage responds and has a title', async ({ page }) => {
  if (!base) test.skip(true, 'PROD_URL not set');

  const errors: string[] = [];
  page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console error: ${msg.text()}`);
    }
  });

  const resp = await page.goto(base, { waitUntil: 'domcontentloaded' });
  expect(resp).not.toBeNull();
  const status = resp!.status();
  expect([200, 301, 302, 304, 401]).toContain(status);

  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);

  // Allow one or two minor errors on auth page, but fail on many
  expect(errors.length).toBeLessThan(3);
});


