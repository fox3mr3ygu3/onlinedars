import type { BrowserContext, Page, Route } from '@playwright/test';

/** Tiny in-test API mock for /api/v1/* (no backend needed). */
export type Handler = (route: Route, body: unknown) => unknown | Promise<unknown>;

export interface MockApi {
  calls: { method: string; path: string; body: unknown }[];
  on: (method: string, path: string | RegExp, handler: Handler | unknown) => void;
}

export async function mockApi(
  page: Page,
  role: 'ADMIN' | 'CONTENT_MANAGER' = 'ADMIN',
): Promise<MockApi> {
  const routes: { method: string; path: string | RegExp; handler: Handler | unknown }[] = [];
  const api: MockApi = {
    calls: [],
    on: (method, path, handler) => routes.unshift({ method, path, handler }),
  };
  const user = {
    id: 'u-staff',
    email: 'staff@onlinedars.test',
    phone: null,
    fullName: role === 'ADMIN' ? 'Admin Adminov' : 'Kontent Menejer',
    role,
    avatarUrl: null,
    phoneVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  api.on('POST', '/auth/refresh', { accessToken: 'test-access-token', expiresIn: 900, user });
  api.on('GET', '/auth/me', user);

  await setRoleCookie(page.context(), role);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const body = req.postDataJSON?.() ?? null;
    api.calls.push({ method: req.method(), path: `${path}${url.search}`, body });
    const match = routes.find(
      (r) =>
        r.method === req.method() &&
        (typeof r.path === 'string' ? r.path === path : r.path.test(path)),
    );
    if (!match) {
      return route.fulfill({
        status: 404,
        json: { statusCode: 404, code: 'NOT_FOUND', message: path },
      });
    }
    const result =
      typeof match.handler === 'function'
        ? await (match.handler as Handler)(route, body)
        : match.handler;
    if (result === undefined) return; // handler fulfilled the route itself
    return route.fulfill({ status: 200, json: result });
  });
  return api;
}

/** `od_role` hint cookie used by the web middleware (frontend-public) for /admin redirects. */
async function setRoleCookie(context: BrowserContext, role: string) {
  const base = new URL(
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}`,
  );
  await context.addCookies([{ name: 'od_role', value: role, domain: base.hostname, path: '/' }]);
}

export const page1 = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
