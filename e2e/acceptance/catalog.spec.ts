import { expect, test } from '@playwright/test';
import { call, DEMO_COURSE, gotoReady, registerStudent, signInBrowser } from './support';

/** §13.2 browse the catalog, open a course page (server-rendered from the real API). */
test.describe('catalog @fullstack', () => {
  test('search the catalog and open the course page', async ({ page }) => {
    await gotoReady(page, '/courses');
    await expect(page.getByRole('link', { name: DEMO_COURSE.title }).first()).toBeVisible();

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

  test('checkout opens by course id (GET /courses/:slugOrId)', async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    const demo = await call(request, 'GET', `/courses/${DEMO_COURSE.slug}`);
    const byId = await call(request, 'GET', `/courses/${demo.id}`);
    expect(byId.slug).toBe(DEMO_COURSE.slug);

    const user = await registerStudent(request, 'Checkout');
    await signInBrowser(context, baseURL!, user);
    await gotoReady(page, `/checkout/${demo.id}`);
    await expect(page.getByTestId('checkout-course-title')).toHaveText(DEMO_COURSE.title);
  });
});
