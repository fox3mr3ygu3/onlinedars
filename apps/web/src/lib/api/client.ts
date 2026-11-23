import { type ApiErrorBody, ErrorCode } from '@onlinedars/shared';

/**
 * Minimal typed fetch wrapper for the OnlineDars API.
 * - Browser: relative base (`/api/v1`) — Next.js rewrites it to the API, so the refresh cookie works.
 * - Server components: absolute `API_URL`.
 * Errors are thrown as ApiError with the API's stable `code`; map it with t(`errors.${code}`)
 * (see `errorMessageKey`).
 *
 * `apiFetch` never refreshes tokens by itself. For authenticated browser calls use `authFetch`
 * from `@/lib/auth`, which attaches the access token and retries once after `/auth/refresh` on 401.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  accessToken?: string | null;
}

export type QueryValue = string | number | boolean | null | undefined;

/** `{ a: 1, b: undefined, c: '' }` → `?a=1`. Empty values are skipped. */
export function buildQuery(params: Record<string, QueryValue>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, accessToken, headers, ...rest } = options;
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Network failure / API down: surface it with the generic code instead of a bare TypeError.
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, ErrorCode.INTERNAL_ERROR, e instanceof Error ? e.message : 'network');
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      res.status,
      err.code ?? (res.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.INTERNAL_ERROR),
      err.message ?? res.statusText,
      err.details,
    );
  }
  return data as T;
}

const CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * i18n key for any thrown value: `errors.<CODE>` for API errors (also codes newer than this
 * build's ErrorCode list), `errors.INTERNAL_ERROR` otherwise. Callers should fall back to
 * INTERNAL_ERROR when the key has no message (`t.has`), see `useApiErrorMessage`.
 */
export function errorMessageKey(e: unknown): string {
  if (isApiError(e) && typeof e.code === 'string' && CODE_RE.test(e.code)) {
    return `errors.${e.code}`;
  }
  return `errors.${ErrorCode.INTERNAL_ERROR}`;
}
