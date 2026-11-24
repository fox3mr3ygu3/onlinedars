import { expect, test } from '@playwright/test';
import { call, DEMO_COURSE, gotoReady } from './support';

/** §13.2 browse the catalog, open a course page (server-rendered from the real API). */
test.describe('catalog @fullstack', () => {
  test('search the catalog and open the course page', async ({ page }) => {
    await gotoReady(page, '/courses');
    // Page 1 lists courses; which ones depends on how many exist (demo seed, earlier runs), so the
    // demo course is only asserted after searching for it.
    await expect(page.locator('main a[href^="/courses/"]').first()).toBeVisible();

    await page.getByLabel('Qidiruv').fill('Veb-dasturlash');
    await page.getByRole('button', { name: 'Qidirish' }).click();
    await expect(page).toHaveURL(/search=Veb-dasturlash/);
    await expect(page.getByRole('link', { name: DEMO_COURSE.title }).first()).toBeVisible();

    await page.getByRole('link', { name: DEMO_COURSE.title }).first().click();
    await expect(page).toHaveURL(new RegExp(`/courses/${DEMO_COURSE.slug}$`));
    await expect(page.getByRole('heading', { level: 1, name: DEMO_COURSE.title })).toBeVisible();
    await expect(page.getByText('Kurs dasturi')).toBeVisible();
    await expect(page.getByText('HTML asoslari').first()).toBeVisible();
    await expect(page.getByTestId('course-cta')).toBeVisible();
  });

  test('a search with no match shows the empty state', async ({ page }) => {
    await gotoReady(page, '/courses?search=zzzz-hech-narsa-yoq');
    await expect(
      page.getByText("So'rovingiz bo'yicha kurs topilmadi. Filtrlarni o'zgartirib ko'ring."),
    ).toBeVisible();
  });

  test('a course can be read by id too (GET /courses/:slugOrId); no price', async ({ request }) => {
    const demo = await call(request, 'GET', `/courses/${DEMO_COURSE.slug}`);
    const byId = await call(request, 'GET', `/courses/${demo.id}`);
    expect(byId.slug).toBe(DEMO_COURSE.slug);
    expect(byId).not.toHaveProperty('price');
  });
});
