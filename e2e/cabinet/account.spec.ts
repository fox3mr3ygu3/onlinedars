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

test.describe('results, certificates, access requests, notifications, profile @smoke', () => {
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

  test('access requests list shows status and the rejection reason', async ({ page }) => {
    const base = {
      courseId: 'c1',
      courseTitle: 'HTML asoslari',
      courseSlug: 'html-asoslari',
      message: null,
      decidedAt: null,
      createdAt: '2026-11-20T09:59:00.000Z',
      updatedAt: '2026-11-20T09:59:00.000Z',
    };
    await mockApi(page, [
      ...baseHandlers,
      {
        method: 'GET',
        path: /^\/me\/access-requests$/,
        body: [
          { ...base, id: 'r1', status: 'PENDING', hasAccess: false, decisionReason: null },
          {
            ...base,
            id: 'r2',
            courseId: 'c2',
            courseTitle: 'SQL',
            courseSlug: 'sql',
            status: 'REJECTED',
            hasAccess: false,
            decisionReason: "Guruh to'lgan",
            decidedAt: '2026-11-21T10:00:00.000Z',
          },
        ],
      },
    ]);
    await page.goto('/cabinet/requests');
    await expect(page.getByRole('heading', { name: "Kirish so'rovlari" })).toBeVisible();
    await expect(page.getByTestId('access-request-r1')).toContainText('Kutilmoqda');
    await expect(page.getByTestId('access-request-r2')).toContainText("Sabab: Guruh to'lgan");
    await expect(page.getByRole('link', { name: "Qayta so'rash" })).toHaveAttribute(
      'href',
      '/courses/sql',
    );
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
              type: 'ACCESS_GRANTED',
              title: 'Kursga kirish berildi',
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
