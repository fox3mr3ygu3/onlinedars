import type { BrowserContext, Page, Route } from '@playwright/test';

export const student = {
  id: 'u1',
  email: null,
  phone: '+998901234567',
  fullName: 'Ali Valiyev',
  role: 'STUDENT',
  avatarUrl: null,
  phoneVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const authBody = { accessToken: 'e2e-token', expiresIn: 900, user: student };

export function json(route: Route, status: number, body?: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

/** Pretends the browser has a session: od_role hint cookie + /auth/refresh answering 200. */
export async function signInAsStudent(context: BrowserContext, page: Page, baseURL: string) {
  await context.addCookies([{ name: 'od_role', value: 'STUDENT', url: baseURL }]);
  await page.route('**/api/v1/auth/refresh', (r) => json(r, 200, authBody));
}
