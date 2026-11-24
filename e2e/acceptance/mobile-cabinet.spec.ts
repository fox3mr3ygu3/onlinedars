import { expect, type Page, test } from '@playwright/test';
import {
  call,
  DEMO_COURSE,
  gotoReady,
  grantAccess,
  registerStudent,
  signInBrowser,
} from './support';

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

/**
 * §13.10 the student cabinet on a 375px phone against the real API: get the seeded demo course,
 * navigate with the mobile menu, open the course tree and the first lesson, no horizontal scroll.
 * Runs only in the `mobile` Playwright project.
 */
test.describe('mobile cabinet @fullstack', () => {
  test('a student studies from a phone', async ({ page, context, baseURL, request }) => {
    const demo = await call(request, 'GET', `/courses/${DEMO_COURSE.slug}`);
    const student = await registerStudent(request, 'Telefon');
    await grantAccess(request, student.token, demo.id);
    await signInBrowser(context, baseURL!, student);

    await gotoReady(page, '/cabinet');
    await expect(
      page.getByRole('heading', { name: `Xush kelibsiz, ${student.fullName}!` }),
    ).toBeVisible();
    await noHorizontalScroll(page);

    await page.getByRole('button', { name: 'Menyuni ochish' }).click();
    await page.locator('#cabinet-mobile-nav').getByRole('link', { name: 'Kurslarim' }).click();
    await expect(page).toHaveURL(/\/cabinet\/courses$/);
    await expect(page.getByRole('heading', { name: 'Kurslarim' })).toBeVisible();
    await expect(page.getByText(DEMO_COURSE.title).first()).toBeVisible();
    await noHorizontalScroll(page);

    await gotoReady(page, `/cabinet/courses/${demo.id}`);
    await expect(page.getByRole('heading', { level: 2, name: 'HTML asoslari' })).toBeVisible();
    const first = page.getByRole('link', { name: /^HTML hujjat tuzilishi/ });
    await expect(first).toBeVisible();
    await noHorizontalScroll(page);

    await first.click();
    await expect(page).toHaveURL(/\/cabinet\/courses\/[^/]+\/lessons\/[^/]+$/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalScroll(page);
  });
});
