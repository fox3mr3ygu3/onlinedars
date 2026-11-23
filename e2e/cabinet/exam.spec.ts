import { expect, test } from '@playwright/test';
import {
  baseHandlers,
  examAttempt,
  examResultPassed,
  examStatusLocked,
  examStatusOpen,
  mockApi,
} from './mock-api';

test.describe('final exam @smoke', () => {
  test('locked exam shows the reason and no start button', async ({ page }) => {
    await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/courses\/c1\/exam$/, body: examStatusLocked },
    ]);
    await page.goto('/cabinet/courses/c1/exam');
    await expect(page.getByTestId('exam-status')).toHaveAttribute('data-locked', 'true');
    await expect(
      page.getByText("Imtihon barcha majburiy darslar tugagandan so'ng ochiladi"),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imtihonni boshlash' })).toHaveCount(0);
  });

  test('start → answer → reload keeps answers → submit → result', async ({ page }) => {
    const attempt = examAttempt(30 * 60);
    const log = await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/courses\/c1\/exam$/, body: examStatusOpen },
      { method: 'POST', path: /^\/me\/courses\/c1\/exam\/attempts$/, body: attempt },
      { method: 'POST', path: /^\/me\/exam-attempts\/att1\/submit$/, body: examResultPassed },
    ]);
    await page.goto('/cabinet/courses/c1/exam');
    await page.getByRole('button', { name: 'Imtihonni boshlash' }).click();
    await expect(page.getByTestId('exam-timer')).toHaveText(/^(30:00|29:5\d)$/);
    await page.getByLabel('Belgilash tili').check();
    await page.getByLabel('Chrome').check();

    // reload: the attempt is resumed (POST returns the active attempt), answers come from localStorage
    await page.reload();
    await page.getByRole('button', { name: 'Imtihonni boshlash' }).click();
    await expect(page.getByLabel('Belgilash tili')).toBeChecked();
    await expect(page.getByLabel('Chrome')).toBeChecked();
    await expect(page.getByTestId('exam-answered')).toHaveText('2/3 javob berildi');

    await page.getByRole('button', { name: 'Imtihonni topshirish' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('1 ta savolga javob berilmagan');
    await dialog.getByRole('button', { name: 'Ha, topshirish' }).click();

    await expect(page.getByTestId('exam-result')).toHaveAttribute('data-passed', 'true');
    await expect(page.getByText("Tabriklaymiz! Siz imtihondan o'tdingiz")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sertifikatlarim' })).toBeVisible();

    const submit = log.calls.find((c) => c.path === '/me/exam-attempts/att1/submit');
    expect((submit?.body as { answers: unknown[] }).answers).toHaveLength(3);
    // local autosave is cleared after a successful submit
    expect(await page.evaluate(() => localStorage.getItem('od.exam.att1'))).toBeNull();
  });

  test('auto-submits when the server deadline is reached', async ({ page }) => {
    const log = await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/courses\/c1\/exam$/, body: examStatusOpen },
      {
        method: 'POST',
        path: /^\/me\/courses\/c1\/exam\/attempts$/,
        body: () => examAttempt(3),
      },
      {
        method: 'POST',
        path: /^\/me\/exam-attempts\/att1\/submit$/,
        body: {
          ...examResultPassed,
          passed: false,
          percent: 33,
          correctCount: 1,
          certificate: null,
        },
      },
    ]);
    await page.goto('/cabinet/courses/c1/exam');
    await page.getByRole('button', { name: 'Imtihonni boshlash' }).click();
    await page.getByLabel('Belgilash tili').check();
    await expect(page.getByTestId('exam-result')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Vaqt tugadi. Javoblaringiz avtomatik topshirildi.')).toBeVisible();
    expect(log.calls.filter((c) => c.path === '/me/exam-attempts/att1/submit')).toHaveLength(1);
  });
});
