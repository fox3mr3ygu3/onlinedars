import { expect, test } from '@playwright/test';
import {
  ADMIN,
  call,
  createPublishedCourse,
  gotoReady,
  loginApi,
  payme,
  paymeTxId,
  registerStudent,
  signInBrowser,
} from './support';

const PRICE = 15_000_000; // tiyin = 150 000 so'm

/**
 * §13.9 paid course with Payme: the checkout UI creates the order and sends the browser to Payme
 * (intercepted here). The "success" return URL alone grants nothing; access comes only from
 * Payme's server-to-server calls (CheckPerform → Create → Perform), and a repeated Perform is
 * idempotent (one payment → one enrollment).
 */
test.describe('payment @fullstack', () => {
  test.setTimeout(120_000);

  test('Payme checkout: access only after the provider callback, exactly once', async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    const admin = await loginApi(request, ADMIN);
    const course = await createPublishedCourse(request, admin, { price: PRICE });
    const student = await registerStudent(request, 'Xaridor');
    const token = student.token;
    await signInBrowser(context, baseURL!, student);

    // The browser is sent to Payme's checkout; we stop it there.
    let paymeUrl = '';
    await page.route('https://checkout.test.paycom.uz/**', (route) => {
      paymeUrl = route.request().url();
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Payme</h1>' });
    });

    await gotoReady(page, `/checkout/${course.id}`);
    await expect(page.getByTestId('checkout-course-title')).toHaveText(course.title);
    await page.getByRole('radio', { name: /Payme/ }).check();
    await page.getByRole('button', { name: "To'lovga o'tish" }).click();
    await expect.poll(() => paymeUrl).toMatch(/^https:\/\/checkout\.test\.paycom\.uz\//);

    const orders = await call(request, 'GET', '/me/orders', { token });
    const order = orders.items.find((o: { courseId: string }) => o.courseId === course.id);
    expect(order).toMatchObject({ status: 'PENDING', amount: PRICE });
    const { orderId, number } = { orderId: order.id ?? order.orderId, number: order.number };

    // A forged "success" return grants nothing.
    await gotoReady(page, `/checkout/result?orderId=${orderId}&status=success`);
    await expect(page.getByText("To'lov tasdiqlandi")).toHaveCount(0);
    expect(await call(request, 'GET', `/orders/${orderId}`, { token })).toMatchObject({
      status: 'PENDING',
      enrolled: false,
    });
    const before = await call(request, 'GET', '/me/courses', { token });
    expect(JSON.stringify(before)).not.toContain(course.id);

    // Payme's server calls (amount comes from the DB; a wrong amount is refused).
    const account = { order_id: String(number) };
    const wrong = await payme(request, 'CheckPerformTransaction', { amount: PRICE - 1, account });
    expect(wrong.error?.code).toBe(-31001);
    const check = await payme(request, 'CheckPerformTransaction', { amount: PRICE, account });
    expect(check.result).toEqual({ allow: true });
    const txId = paymeTxId();
    const created = await payme(request, 'CreateTransaction', {
      id: txId,
      time: Date.now(),
      amount: PRICE,
      account,
    });
    expect(created.result?.state).toBe(1);
    const performed = await payme(request, 'PerformTransaction', { id: txId });
    expect(performed.result?.state).toBe(2);
    const again = await payme(request, 'PerformTransaction', { id: txId });
    expect(again.result).toEqual(performed.result);

    // The result page (still polling) now shows the payment as confirmed.
    await expect(page.getByText("To'lov tasdiqlandi")).toBeVisible({ timeout: 15_000 });
    expect(await call(request, 'GET', `/orders/${orderId}`, { token })).toMatchObject({
      status: 'PAID',
      enrolled: true,
    });

    // Exactly one enrollment, and the course opens in the cabinet.
    const mine = await call(request, 'GET', '/me/courses', { token });
    const items = (Array.isArray(mine) ? mine : mine.items) as { id?: string; courseId?: string }[];
    expect(items.filter((c) => (c.courseId ?? c.id) === course.id)).toHaveLength(1);
    await call(request, 'GET', `/me/courses/${course.id}`, { token });
    await gotoReady(page, '/cabinet/payments');
    await expect(page.getByText("150 000 so'm").filter({ visible: true }).first()).toBeVisible();
  });
});
