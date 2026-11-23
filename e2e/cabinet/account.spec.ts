import { expect, test } from '@playwright/test';
import { baseHandlers, me, mockApi, page1 } from './mock-api';

const cert = {
  id: 'cert1',
  publicId: 'OD-2026-000001',
  courseId: 'c1',
  courseTitle: 'HTML asoslari',
  fullName: me.fullName,
  issuedAt: '2026-11-22T10:00:00.000Z',
  verifyUrl: '/verify/OD-2026-000001',
  pdfReady: true,
};

test.describe('results, certificates, payments, notifications, profile @smoke', () => {
  test('results list', async ({ page }) => {
    await mockApi(page, [
      ...baseHandlers,
      {
        method: 'GET',
        path: /^\/me\/results$/,
        body: page1([
          {
            attemptId: 'att1',
            status: 'SUBMITTED',
            startedAt: '2026-11-22T10:00:00.000Z',
            submittedAt: '2026-11-22T10:10:00.000Z',
            score: 3,
            maxScore: 3,
            percent: 100,
            passed: true,
            courseId: 'c1',
            courseTitle: 'HTML asoslari',
            examTitle: 'Yakuniy imtihon',
            passScore: 60,
          },
        ]),
      },
    ]);
    await page.goto('/cabinet/results');
    await expect(page.getByRole('heading', { name: 'Natijalar' })).toBeVisible();
    await expect(page.getByText("O'tdi").filter({ visible: true }).first()).toBeVisible();
  });

  test('certificate PDF download sends the request and saves a file', async ({ page }) => {
    await mockApi(page, [
      ...baseHandlers,
      { method: 'GET', path: /^\/me\/certificates$/, body: page1([cert]) },
    ]);
    await page.route('**/api/v1/me/certificates/cert1/pdf', (route) =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 test' }),
    );
    await page.goto('/cabinet/certificates');
    await expect(page.getByText('ID: OD-2026-000001')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tekshirish sahifasi' })).toHaveAttribute(
      'href',
      '/verify/OD-2026-000001',
    );
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF yuklab olish' }).click();
    expect((await download).suggestedFilename()).toBe('sertifikat-OD-2026-000001.pdf');
  });

  test('payment history shows amount in so‘m and status', async ({ page }) => {
    await mockApi(page, [
      ...baseHandlers,
      {
        method: 'GET',
        path: /^\/me\/orders$/,
        body: page1([
          {
            orderId: 'ord1',
            number: 1001,
            status: 'PAID',
            courseId: 'c1',
            courseTitle: 'HTML asoslari',
            courseSlug: 'html-asoslari',
            amount: 49_900_000,
            currency: 'UZS',
            provider: 'PAYME',
            enrolled: true,
            paidAt: '2026-11-20T10:00:00.000Z',
            cancelledAt: null,
            expiresAt: null,
            createdAt: '2026-11-20T09:59:00.000Z',
          },
        ]),
      },
    ]);
    await page.goto('/cabinet/payments');
    await expect(page.getByText("499 000 so'm").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("To'langan").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Payme').filter({ visible: true }).first()).toBeVisible();
  });

  test('notifications: mark as read', async ({ page }) => {
    let read = false;
    const log = await mockApi(page, [
      { method: 'GET', path: /^\/auth\/me$/, body: me },
      {
        method: 'GET',
        path: /^\/me\/notifications$/,
        body: () => ({
          items: [
            {
              id: 'n1',
              type: 'PAYMENT_SUCCESS',
              title: "To'lov qabul qilindi",
              body: 'HTML asoslari kursi ochildi',
              data: null,
              readAt: read ? '2026-11-22T10:00:00.000Z' : null,
              createdAt: '2026-11-22T09:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
          unreadCount: read ? 0 : 1,
        }),
      },
      {
        method: 'POST',
        path: /^\/me\/notifications\/n1\/read$/,
        body: () => {
          read = true;
          return { id: 'n1' };
        },
      },
    ]);
    await page.goto('/cabinet/notifications');
    await expect(page.getByTestId('notification-n1')).toHaveAttribute('data-unread', 'true');
    await page.getByRole('button', { name: "O'qilgan deb belgilash" }).click();
    await expect(page.getByTestId('notification-n1')).toHaveAttribute('data-unread', 'false');
    expect(log.calls.some((c) => c.path === '/me/notifications/n1/read')).toBe(true);
  });

  test('profile: edit full name sends only the changed field', async ({ page }) => {
    const log = await mockApi(page, [
      ...baseHandlers,
      {
        method: 'PATCH',
        path: /^\/users\/me$/,
        body: (req) => ({ ...me, ...(req.postDataJSON() as object) }),
      },
    ]);
    await page.goto('/cabinet/profile');
    const name = page.getByLabel("To'liq ism");
    await expect(name).toHaveValue(me.fullName);
    await name.fill('Ali Valiyev Jr');
    await page.getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByText('Profil saqlandi')).toBeVisible();
    const patch = log.calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ fullName: 'Ali Valiyev Jr' });
  });
});
