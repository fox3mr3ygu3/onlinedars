import { expect, test } from '@playwright/test';
import {
  baseHandlers,
  courseItem,
  courseTree,
  dashboard,
  lesson,
  me,
  mockApi,
  page1,
} from './mock-api';

test.describe('cabinet shell, dashboard, courses @smoke', () => {
  test('dashboard shows greeting, overall progress, last activity and my courses', async ({
    page,
  }) => {
    await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/dashboard$/, body: dashboard },
    ]);
    await page.goto('/cabinet');
    await expect(
      page.getByRole('heading', { name: `Xush kelibsiz, ${me.fullName}!` }),
    ).toBeVisible();
    await expect(page.getByTestId('overall-progress')).toHaveText('33%');
    await expect(page.getByText('4-amaliyot')).toBeVisible();
    await expect(page.getByRole('link', { name: 'HTML asoslari', exact: true })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1',
    );
    await expect(page.getByRole('link', { name: 'Davom etish' })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1/lessons/l2',
    );
  });

  test('navigation works on mobile (menu) and desktop (sidebar)', async ({ page }, info) => {
    await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/dashboard$/, body: dashboard },
      { method: 'GET', path: /^\/me\/courses$/, body: page1([courseItem]) },
    ]);
    await page.goto('/cabinet');
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Menyuni ochish' }).click();
      const nav = page.locator('#cabinet-mobile-nav');
      await nav.getByRole('link', { name: 'Kurslarim' }).click();
    } else {
      await page.getByRole('complementary').getByRole('link', { name: 'Kurslarim' }).click();
    }
    await expect(page).toHaveURL(/\/cabinet\/courses$/);
    await expect(page.getByRole('heading', { name: 'Kurslarim' })).toBeVisible();
    // unread badge in the top bar comes from GET /me/notifications
    await expect(
      page.getByRole('link', { name: "Bildirishnomalar (2 ta o'qilmagan)" }),
    ).toBeVisible();
    // no horizontal scroll at this width
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('course tree renders locks; locked lessons are not links', async ({ page }) => {
    await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/courses\/c1$/, body: courseTree },
    ]);
    await page.goto('/cabinet/courses/c1');
    await expect(page.getByRole('heading', { name: 'HTML asoslari' })).toBeVisible();
    await expect(page.getByTestId('lesson-l1')).toHaveAttribute('data-status', 'completed');
    await expect(page.getByTestId('lesson-l3')).toHaveAttribute('data-locked', 'true');
    await expect(page.getByTestId('lesson-l3').getByRole('link')).toHaveCount(0);
    await expect(page.getByTestId('exam-card')).toHaveAttribute('data-locked', 'true');
    await page.getByTestId('lesson-l2').getByRole('link').click();
    await expect(page).toHaveURL(/\/cabinet\/courses\/c1\/lessons\/l2$/);
  });

  test('lesson page marks material as viewed and lists 4 practices', async ({ page }) => {
    const log = await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/lessons\/l2$/, body: lesson },
      { method: 'GET', path: /^\/me\/courses\/c1$/, body: courseTree },
      {
        method: 'POST',
        path: /^\/me\/lessons\/l2\/viewed$/,
        body: {
          lesson: { ...lesson.progress, materialViewed: true },
          course: courseTree.progress,
        },
      },
    ]);
    await page.goto('/cabinet/courses/c1/lessons/l2');
    await expect(page.getByRole('heading', { name: 'Paragraf' })).toBeVisible();
    for (const n of [1, 2, 3, 4]) await expect(page.getByTestId(`practice-p${n}`)).toBeVisible();
    await page.getByRole('button', { name: "Materialni ko'rdim" }).click();
    await expect(page.getByTestId('material-viewed')).toBeVisible();
    expect(log.calls.some((c) => c.method === 'POST' && c.path === '/me/lessons/l2/viewed')).toBe(
      true,
    );

    // Course player sidebar: every section, the current lesson highlighted, locked ones unlinked.
    const sidebar = page.getByRole('complementary', { name: 'Kurs mazmuni' });
    await expect(sidebar.getByRole('link', { name: /2\. Dars l2/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sidebar.getByTestId('player-lesson-l1')).toHaveAttribute(
      'data-status',
      'completed',
    );
    await sidebar.getByRole('button', { name: /2-bo'lim: Teglar/ }).click();
    await expect(sidebar.getByTestId('player-lesson-l3')).toHaveAttribute('data-status', 'locked');
    await expect(sidebar.getByTestId('player-lesson-l3').getByRole('link')).toHaveCount(0);
  });

  test('a 401 shows the login prompt', async ({ page }) => {
    await mockApi(page, [
      {
        method: 'GET',
        path: /^\/me\/dashboard$/,
        status: 401,
        body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      },
      { path: /.*/, status: 401, body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'x' } },
    ]);
    await page.goto('/cabinet');
    await expect(page.getByText('Davom etish uchun tizimga kiring')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kirish' })).toHaveAttribute(
      'href',
      '/login?next=/cabinet',
    );
  });
});
