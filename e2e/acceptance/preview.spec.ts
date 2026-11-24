import { expect, test } from '@playwright/test';
import { ADMIN, call, createPublishedCourse, gotoReady, loginApi, signInBrowser } from './support';

const VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

/**
 * Course intro video + free preview lessons (docs/TASKS.md backlog): an admin sets both in the
 * admin UI; a visitor who is not signed in watches the intro and opens the preview lesson, then
 * is pointed to enrol. A lesson that is not a preview has no public page.
 */
test.describe('course preview @fullstack', () => {
  test.setTimeout(120_000);

  test('admin sets intro video + preview lesson; a visitor watches before enrolling', async ({
    page,
    context,
    baseURL,
    browser,
    request,
  }) => {
    const admin = await loginApi(request, ADMIN);
    const course = await createPublishedCourse(request, admin);

    // ── admin UI: intro video on the course form, "free preview" on the lesson editor ──
    await signInBrowser(context, baseURL!, ADMIN);
    await gotoReady(page, `/admin/courses/${course.id}`);
    await page.getByLabel('Tanishtiruv videosi').fill(VIDEO);
    const savedCourse = page.waitForResponse(
      (r) => r.url().endsWith(`/admin/courses/${course.id}`) && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Saqlash' }).click();
    expect((await savedCourse).ok()).toBe(true);

    await gotoReady(page, `/admin/lessons/${course.lessonId}`);
    await page.getByLabel(/^Bepul ko'rish/).check();
    const savedLesson = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/admin/lessons/${course.lessonId}`) && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Saqlash' }).first().click();
    expect((await savedLesson).ok()).toBe(true);

    const detail = await call(request, 'GET', `/courses/${course.slug}`);
    expect(detail.introVideoUrl).toBe(VIDEO);

    // ── a visitor (no session) ──
    const visitorContext = await browser.newContext({ baseURL });
    const visitor = await visitorContext.newPage();
    await gotoReady(visitor, `/courses/${course.slug}`);
    await expect(visitor.getByRole('heading', { name: 'Kurs bilan tanishing' })).toBeVisible();
    await expect(visitor.getByTestId('course-intro-video').locator('video')).toHaveAttribute(
      'src',
      VIDEO,
    );
    await visitor.getByTestId('lesson-preview-link').click();
    await expect(visitor).toHaveURL(
      new RegExp(`/courses/${course.slug}/preview/${course.lessonId}$`),
    );
    await expect(visitor.getByText("Bepul ko'rish darsi")).toBeVisible();
    await expect(visitor.getByTestId('preview-materials')).toContainText('E2E dars matni');
    await expect(visitor.getByTestId('preview-cta').getByRole('link')).toHaveAttribute(
      'href',
      `/courses/${course.slug}`,
    );

    // A lesson that is not a preview has no public page (API rules: apps/api/test/preview.e2e-spec.ts).
    const res = await visitor.goto(`/courses/${course.slug}/preview/not-a-preview-lesson`);
    expect(res?.status()).toBe(404);
    await visitorContext.close();
  });
});
