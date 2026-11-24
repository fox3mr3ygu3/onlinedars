// @vitest-environment jsdom
import type { AuthResponse } from '@onlinedars/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/render';
import { readRoleHint, setRoleHint } from './role-cookie';
import {
  authFetch,
  getSession,
  getSessionState,
  login,
  logout,
  refreshSession,
  resetSessionForTests,
} from './session';

function authBody(token: string, role: AuthResponse['user']['role'] = 'STUDENT'): AuthResponse {
  return {
    accessToken: token,
    expiresIn: 900,
    user: {
      id: 'u1',
      email: 'a@b.uz',
      phone: null,
      fullName: 'Ali Valiyev',
      role,
      avatarUrl: null,
      phoneVerified: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

function useFetch(handler: Handler) {
  fetchMock = vi.fn(async (url: string, init: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', fetchMock);
}

function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}

function clearCookies() {
  document.cookie = 'od_role=; Path=/; Max-Age=0';
}

beforeEach(() => {
  resetSessionForTests();
  clearCookies();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session bootstrap', () => {
  it('resolves anonymous visitors (no od_role hint) without calling the API', async () => {
    useFetch(() => jsonResponse(500));
    expect(await getSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSessionState().status).toBe('unauthenticated');
  });

  it('recovers the session via /auth/refresh when the hint cookie exists', async () => {
    setRoleHint('STUDENT');
    useFetch((url) =>
      url.endsWith('/auth/refresh') ? jsonResponse(200, authBody('t1')) : jsonResponse(404),
    );
    const s = await getSession();
    expect(s?.accessToken).toBe('t1');
    expect(getSessionState().status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('runs concurrent refreshes as one request (single flight)', async () => {
    setRoleHint('STUDENT');
    useFetch(() => jsonResponse(200, authBody('t1')));
    const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), getSession()]);
    expect(a?.accessToken).toBe('t1');
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the role hint when the refresh token is rejected', async () => {
    setRoleHint('ADMIN');
    useFetch(() => jsonResponse(401, { code: 'REFRESH_TOKEN_INVALID', message: 'x' }));
    expect(await getSession()).toBeNull();
    expect(readRoleHint()).toBeNull();
    expect(getSessionState().status).toBe('unauthenticated');
  });

  it('keeps the role hint on a network error', async () => {
    setRoleHint('STUDENT');
    useFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await getSession()).toBeNull();
    expect(readRoleHint()).toBe('STUDENT');
  });
});

describe('login / logout', () => {
  it('login stores the token and sets the od_role hint', async () => {
    useFetch(() => jsonResponse(200, authBody('t1', 'CONTENT_MANAGER')));
    const user = await login({ login: 'a@b.uz', password: 'secret123' });
    expect(user.role).toBe('CONTENT_MANAGER');
    expect(readRoleHint()).toBe('CONTENT_MANAGER');
    expect((await getSession())?.accessToken).toBe('t1');
  });

  it('logout clears the session even if the API call fails', async () => {
    useFetch((url) =>
      url.endsWith('/auth/login') ? jsonResponse(200, authBody('t1')) : jsonResponse(500),
    );
    await login({ login: 'a@b.uz', password: 'secret123' });
    await logout();
    expect(readRoleHint()).toBeNull();
    expect(getSessionState().session).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('authFetch', () => {
  it('throws UNAUTHORIZED when signed out', async () => {
    useFetch(() => jsonResponse(200, {}));
    await expect(authFetch('/me/access-requests')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('attaches the bearer token', async () => {
    useFetch((url) =>
      url.endsWith('/auth/login')
        ? jsonResponse(200, authBody('t1'))
        : jsonResponse(200, { ok: true }),
    );
    await login({ login: 'a@b.uz', password: 'secret123' });
    await expect(authFetch('/me')).resolves.toEqual({ ok: true });
    expect(authHeader(fetchMock.mock.calls[1]![1])).toBe('Bearer t1');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    let refreshes = 0;
    useFetch((url, init) => {
      if (url.endsWith('/auth/login')) return jsonResponse(200, authBody('old'));
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        return jsonResponse(200, authBody('new'));
      }
      return authHeader(init) === 'Bearer new'
        ? jsonResponse(200, { status: 'APPROVED' })
        : jsonResponse(401, { code: 'UNAUTHORIZED', message: 'expired' });
    });
    await login({ login: 'a@b.uz', password: 'secret123' });
    await expect(authFetch('/me/access-requests')).resolves.toEqual({ status: 'APPROVED' });
    expect(refreshes).toBe(1);
    expect(getSessionState().session?.accessToken).toBe('new');
  });

  it('parallel 401s share one refresh', async () => {
    let refreshes = 0;
    useFetch((url, init) => {
      if (url.endsWith('/auth/login')) return jsonResponse(200, authBody('old'));
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        return jsonResponse(200, authBody('new'));
      }
      return authHeader(init) === 'Bearer new'
        ? jsonResponse(200, { ok: url })
        : jsonResponse(401, { code: 'UNAUTHORIZED' });
    });
    await login({ login: 'a@b.uz', password: 'secret123' });
    const results = await Promise.all([authFetch('/a'), authFetch('/b'), authFetch('/c')]);
    expect(results).toHaveLength(3);
    expect(refreshes).toBe(1);
  });

  it('gives up (rethrows 401) and clears the session when the refresh fails', async () => {
    useFetch((url) => {
      if (url.endsWith('/auth/login')) return jsonResponse(200, authBody('old'));
      if (url.endsWith('/auth/refresh')) return jsonResponse(401, { code: 'REFRESH_TOKEN_REUSED' });
      return jsonResponse(401, { code: 'UNAUTHORIZED' });
    });
    await login({ login: 'a@b.uz', password: 'secret123' });
    await expect(authFetch('/me/access-requests')).rejects.toMatchObject({ status: 401 });
    expect(readRoleHint()).toBeNull();
    expect(getSessionState().status).toBe('unauthenticated');
  });

  it('does not refresh on 403', async () => {
    useFetch((url) =>
      url.endsWith('/auth/login')
        ? jsonResponse(200, authBody('t1'))
        : jsonResponse(403, { code: 'FORBIDDEN' }),
    );
    await login({ login: 'a@b.uz', password: 'secret123' });
    await expect(authFetch('/admin/x')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/auth/refresh'))).toBe(false);
  });
});
