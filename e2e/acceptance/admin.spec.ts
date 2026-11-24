import { expect, test } from '@playwright/test';
import {
  addPractice,
  addQuestion,
  ADMIN,
  CONTENT_MANAGER,
  call,
  completeLesson,
  createLesson,
  createModule,
  gotoReady,
  itemsOf,
  loginApi,
  raw,
  signInBrowser,
  uid,
} from './support';

/**
 * §13.3 create and edit a course in the admin UI against the real API, and §13.4 the 4×6 rule:
 * counters in the practice editor, publish disabled until complete, and the server rejecting a
 * 5th practice, a 7th question and publishing an incomplete lesson.
 */
test.describe('admin content @fullstack', () => {
  test.setTimeout(120_000);

  test('a content manager creates and edits a course in the UI', async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await signInBrowser(context, baseURL!, CONTENT_MANAGER);
    const title = `E2E Admin kurs ${uid('t').slice(-6)}`;

    await gotoReady(page, '/admin/courses/new');
    await page.getByLabel('Nomi', { exact: true }).fill(title);
    await page.getByLabel('Nomi', { exact: true }).blur();
    const slug = await page.getByLabel('URL nomi (slug)').inputValue();
    expect(slug).toMatch(/^e2e-admin-kurs-/);
    await page.getByRole('button', { name: 'Yaratish' }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/[^/]+\/modules/);
    const courseId = page.url().match(/\/admin\/courses\/([^/]+)\/modules/)![1]!;

    const token = await loginApi(request, CONTENT_MANAGER);
    const saved = await call(request, 'GET', `/admin/courses/${courseId}`, { token });
    expect(saved).toMatchObject({ title, slug, status: 'DRAFT' });
    expect(saved).not.toHaveProperty('price');

    // Edit through the API the editor uses, then the change shows in the admin course list.
    await call(request, 'PATCH', `/admin/courses/${courseId}`, {
      token,
      data: { title: `${title} (tahrir)` },
    });
    await gotoReady(page, '/admin/courses');
    await expect(page.getByText(`${title} (tahrir)`).first()).toBeVisible();
  });

  test('4×6 rule: counters, publish gate and server-side limits', async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    const token = await loginApi(request, ADMIN);
    const course = await call(request, 'POST', '/admin/courses', {
      token,
      data: { slug: uid('kurs'), title: 'E2E 4x6 kurs' },
      expect: 201,
    });
    const mod = await createModule(request, token, course.id);
    const lesson = await createLesson(request, token, mod.id, 'E2E 4x6 dars');

    // 3 practices, the third with only 5 questions.
    const practices = [];
    for (let p = 1; p <= 3; p++) practices.push(await addPractice(request, token, lesson.id, p));
    for (const [i, p] of practices.entries()) {
      for (let q = 1; q <= (i === 2 ? 5 : 6); q++) await addQuestion(request, token, p.id, q);
    }

    // The server refuses to publish an incomplete lesson.
    const early = await raw(request, 'POST', `/admin/lessons/${lesson.id}/publish`, { token });
    expect(early.status()).toBeGreaterThanOrEqual(400);
    expect(early.status()).toBeLessThan(500);

    await signInBrowser(context, baseURL!, ADMIN);
    await gotoReady(page, `/admin/lessons/${lesson.id}/practices`);
    await expect(page.getByTestId('practices-counter')).toHaveText(/Amaliyotlar 3\/4/);
    await expect(page.getByTestId(`questions-counter-${practices[2]!.id}`)).toHaveText(
      /Savollar 5\/6/,
    );
    const publish = page.getByRole('button', { name: 'Darsni nashr qilish' });
    await expect(publish).toBeDisabled();

    // Fill to exactly 4×6; the 5th practice and the 7th question are rejected by the API.
    await completeLesson(request, token, lesson.id);
    const all = itemsOf<{ id: string }>(
      await call(request, 'GET', `/admin/lessons/${lesson.id}/practices`, { token }),
    );
    expect(all).toHaveLength(4);
    const fifth = await raw(request, 'POST', `/admin/lessons/${lesson.id}/practices`, {
      token,
      data: { title: 'E2E ortiqcha amaliyot' },
    });
    expect(fifth.status()).toBeGreaterThanOrEqual(400);
    expect(fifth.status()).toBeLessThan(500);
    const seventh = await raw(request, 'POST', `/admin/practices/${all[0]!.id}/questions`, {
      token,
      data: {
        type: 'TRUE_FALSE',
        prompt: 'E2E ortiqcha savol',
        options: [
          { text: "To'g'ri", isCorrect: true },
          { text: "Noto'g'ri", isCorrect: false },
        ],
      },
    });
    expect(seventh.status()).toBeGreaterThanOrEqual(400);
    expect(seventh.status()).toBeLessThan(500);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('practices-counter')).toHaveText(/Amaliyotlar 4\/4/);
    await expect(page.getByRole('button', { name: "Amaliyot qo'shish" })).toBeDisabled();
    await expect(publish).toBeEnabled();
    const published = page.waitForResponse(
      (r) => r.url().endsWith(`/admin/lessons/${lesson.id}/publish`) && r.ok(),
    );
    await publish.click();
    await published;
    const after = await call(request, 'GET', `/admin/lessons/${lesson.id}`, { token });
    expect(after.isPublished).toBe(true);
  });
});
