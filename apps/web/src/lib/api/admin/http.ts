import { ErrorCode } from '@onlinedars/shared';
import { ApiError, type ApiRequestOptions, apiBaseUrl } from '@/lib/api/client';
import { authFetch, getSession, refreshSession } from '@/lib/auth';

/**
 * HTTP helpers for the admin panel. JSON calls go through the shared auth layer's `authFetch`
 * (src/lib/auth): it attaches the in-memory access token and refreshes once on 401, serialised
 * per tab and across tabs, so admin calls can't race the cabinet/public refresh.
 *
 * `setAdminAccessTokenProvider` stays as a test seam; by default the token comes from
 * `getSession()`.
 */
export type AccessTokenProvider = () => Promise<string | null> | string | null;

const sessionToken: AccessTokenProvider = async () => (await getSession())?.accessToken ?? null;
let tokenProvider: AccessTokenProvider = sessionToken;

export function setAdminAccessTokenProvider(provider: AccessTokenProvider | null): void {
  tokenProvider = provider ?? sessionToken;
}

/** Test/logout helper: drop any custom provider. */
export function resetAdminAccessToken(): void {
  tokenProvider = sessionToken;
}

/** apiFetch with the admin's session (token + one refresh-and-retry after a 401). */
export function adminFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return authFetch<T>(path, options);
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
  let res = await send(await tokenProvider());
  if (res.status === 401) {
    const fresh = await refreshSession();
    if (fresh) res = await send(fresh.accessToken);
  }
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
