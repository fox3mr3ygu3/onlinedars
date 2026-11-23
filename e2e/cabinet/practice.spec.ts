import { expect, test } from '@playwright/test';
import { baseHandlers, mockApi, practice, practiceResult } from './mock-api';

test.describe('practice player @smoke', () => {
  test('answers all 5 question types, submits and shows the graded result', async ({ page }) => {
    const log = await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/practices\/p1$/, body: practice },
      { method: 'POST', path: /^\/me\/practices\/p1\/attempts$/, body: practiceResult },
    ]);
    await page.goto('/cabinet/courses/c1/lessons/l2/practice/p1');
    await expect(page.getByRole('heading', { name: '1-amaliyot' })).toBeVisible();
    const next = page.getByRole('button', { name: 'Keyingi' });

    // 1. single choice
    await page.getByLabel('Belgilash tili').check();
    await next.click();
    // 2. multi choice
    await page.getByLabel('Chrome').check();
    await page.getByLabel('Firefox').check();
    await next.click();
    // 3. true / false
    await page.getByLabel("To'g'ri", { exact: true }).check();
    await next.click();
    // 4. matching: click-to-pair for the first, drag for the second
    await page.getByRole('button', { name: '<a> — juftlash uchun tanlash' }).click();
    await page.getByRole('button', { name: 'Havola javobini tanlash' }).click();
    await page
      .getByRole('button', { name: 'Rasm javobini tanlash' })
      .dragTo(page.getByTestId('match-left-l2'));
    await expect(page.getByTestId('match-value-l1')).toHaveText('Havola');
    await expect(page.getByTestId('match-value-l2')).toHaveText('Rasm');
    await next.click();
    // 5. fill blank
    await page.getByRole('textbox', { name: "1-bo'sh joy" }).fill('p');
    await next.click();
    // 6. image based
    await expect(page.getByRole('img', { name: 'Savol rasmi' })).toBeVisible();
    await page.getByLabel("Qizg'ish").check();

    await page.getByRole('button', { name: 'Javoblarni topshirish' }).click();
    await expect(page.getByTestId('practice-percent')).toHaveText('100%');
    await expect(page.getByText('<a> havola, <img> rasm uchun.')).toBeVisible();

    const submit = log.calls.find((c) => c.method === 'POST');
    const answers = (submit?.body as { answers: Record<string, unknown>[] }).answers;
    expect(answers).toHaveLength(6);
    expect(answers[0]).toEqual({ questionId: 'q1', selectedOptionIds: ['o1'] });
    expect(answers[1]).toEqual({ questionId: 'q2', selectedOptionIds: ['m1', 'm2'] });
    expect(answers[3]).toEqual({
      questionId: 'q4',
      matches: [
        { optionId: 'l1', matchText: 'Havola' },
        { optionId: 'l2', matchText: 'Rasm' },
      ],
    });
    expect(answers[4]).toEqual({ questionId: 'q5', blanks: ['p'] });
    expect(JSON.stringify(answers)).not.toContain('isCorrect');
  });

  test('warns about unanswered questions before submitting', async ({ page }) => {
    await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/practices\/p1$/, body: practice },
      { method: 'POST', path: /^\/me\/practices\/p1\/attempts$/, body: practiceResult },
    ]);
    await page.goto('/cabinet/courses/c1/lessons/l2/practice/p1');
    await page.getByLabel('Belgilash tili').check();
    await page.getByRole('button', { name: 'Javoblarni topshirish' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('5 ta savolga javob berilmagan');
    await dialog.getByRole('button', { name: 'Bekor qilish' }).click();
    await expect(dialog).toBeHidden();
  });
});
