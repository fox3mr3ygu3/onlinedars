import { expect, test } from '@playwright/test';
import { json, signInAsStudent } from './helpers';

const order = (status: string) => ({
  orderId: 'o1',
  status,
  courseId: 'c1',
  amount: 49_900_000,
  currency: 'UZS',
});

test.describe('checkout return page polls the order @smoke', () => {
  test('PENDING → PAID shows success only after the server confirms', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAsStudent(context, page, baseURL!);
    let calls = 0;
    await page.route('**/api/v1/orders/o1', (r) => {
      calls++;
      return json(r, 200, order(calls < 3 ? 'PENDING' : 'PAID'));
    });
    // Provider-style redirect params must not matter.
    await page.goto('/checkout/result?orderId=o1&status=success');
    await expect(page.getByTestId('status-checking')).toBeVisible();
    await expect(page.getByTestId('status-paid')).toBeVisible({ timeout: 15_000 });
    expect(calls).toBeGreaterThanOrEqual(3);
    await expect(page.getByRole('link', { name: "Kursga o'tish" })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1',
    );
  });

  test('provider return URL /checkout/{courseId}?orderId= polls too', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAsStudent(context, page, baseURL!);
    let calls = 0;
    await page.route('**/api/v1/orders/o1', (r) => {
      calls++;
      return json(r, 200, order(calls < 2 ? 'PENDING' : 'PAID'));
    });
    await page.goto('/checkout/c1?orderId=o1');
    await expect(page.getByTestId('status-paid')).toBeVisible({ timeout: 15_000 });
  });

  test('FAILED shows failure and a retry link', async ({ page, context, baseURL }) => {
    await signInAsStudent(context, page, baseURL!);
    await page.route('**/api/v1/orders/o1', (r) => json(r, 200, order('FAILED')));
    await page.goto('/checkout/result?orderId=o1');
    await expect(page.getByTestId('status-failed')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Qayta urinish' })).toHaveAttribute(
      'href',
      '/checkout/c1',
    );
  });
});
