import { ErrorCode } from '@onlinedars/shared';
import { ApiError, type ApiRequestOptions, apiBaseUrl, apiFetch } from '@/lib/api/client';

/**
 * HTTP helpers for the admin panel. Every call goes through `apiFetch` (src/lib/api/client.ts).
 *
 * Access token: the auth layer (frontend-public, src/lib/auth) should register its getter with
 * `setAdminAccessTokenProvider`. Until it does, the admin panel falls back to a single-flight
 * `POST /auth/refresh` (refresh token is the httpOnly cookie) and keeps the access token in memory.
 */
export type AccessTokenProvider = () => Promise<string | null> | string | null;

let externalProvider: AccessTokenProvider | null = null;
let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

export function setAdminAccessTokenProvider(provider: AccessTokenProvider | null): void {
  externalProvider = provider;
  cached = null;
}

/** Test/logout helper: forget the in-memory token. */
export function resetAdminAccessToken(): void {
  cached = null;
  inflight = null;
}

async function refreshToken(): Promise<string | null> {
  // Serialise refresh calls: the API revokes a session when a rotated refresh secret is reused.
  if (!inflight) {
    inflight = apiFetch<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
    })
      .then((r) => {
        cached = { token: r.accessToken, expiresAt: Date.now() + (r.expiresIn - 30) * 1000 };
        return r.accessToken;
      })
      .catch(() => {
        cached = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function getToken(force = false): Promise<string | null> {
  if (externalProvider) return externalProvider();
  if (!force && cached && cached.expiresAt > Date.now()) return cached.token;
  return refreshToken();
}

/** apiFetch with the admin's access token and one retry after a 401. */
export async function adminFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = await getToken();
  try {
    return await apiFetch<T>(path, { ...options, accessToken: token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && !externalProvider) {
      const fresh = await getToken(true);
      if (fresh) return apiFetch<T>(path, { ...options, accessToken: fresh });
    }
    throw e;
  }
}

/** Multipart upload (apiFetch only sends JSON). Same auth handling as adminFetch. */
export async function adminUpload<T>(path: string, form: FormData): Promise<T> {
  const send = async (token: string | null) =>
    fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let res = await send(await getToken());
  if (res.status === 401 && !externalProvider) res = await send(await getToken(true));
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as { code?: ErrorCode; message?: string; details?: unknown };
    throw new ApiError(
      res.status,
      err.code ?? ErrorCode.INTERNAL_ERROR,
      err.message ?? res.statusText,
      err.details,
    );
  }
  return data as T;
}

/** Builds a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
