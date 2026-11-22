import { type ApiErrorBody, ErrorCode } from '@onlinedars/shared';

/**
 * Minimal typed fetch wrapper for the OnlineDars API.
 * - Browser: relative base (`/api/v1`) — Next.js rewrites it to the API, so the refresh cookie works.
 * - Server components: absolute `API_URL`.
 * Errors are thrown as ApiError with the API's stable `code`; map it with t(`errors.${code}`).
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

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, accessToken, headers, ...rest } = options;
  const res = await fetch(`${apiBaseUrl()}${path}`, {
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

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      res.status,
      err.code ?? ErrorCode.INTERNAL_ERROR,
      err.message ?? res.statusText,
      err.details,
    );
  }
  return data as T;
}
