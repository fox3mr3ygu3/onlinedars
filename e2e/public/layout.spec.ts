import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

test.describe('public layout @smoke', () => {
  for (const vp of VIEWPORTS) {
    test(`landing renders without horizontal scroll at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page).toHaveTitle(/OnlineDars/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Menyuni ochish' }).click();
    await page.locator('#mobile-nav').getByRole('link', { name: 'Savol-javob' }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Ko'p beriladigan savollar");
  });

  test('verify form goes to the verify page', async ({ page }) => {
    await page.goto('/verify');
    await page.getByLabel('Sertifikat ID').fill('OD-2026-000001');
    await page.getByRole('button', { name: 'Tekshirish' }).click();
    await expect(page).toHaveURL(/\/verify\/OD-2026-000001$/);
  });
});

test.describe('catalog (needs the real API + seed)', () => {
  test.skip(process.env.E2E_API !== '1', 'needs the real API (E2E_API=1)');

  test('catalog lists courses and opens a course page', async ({ page }) => {
    await page.goto('/courses');
    const first = page.locator('article h3 a').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/courses\/[a-z0-9-]+$/);
    await expect(page.getByTestId('course-cta')).toBeVisible();
  });
});
