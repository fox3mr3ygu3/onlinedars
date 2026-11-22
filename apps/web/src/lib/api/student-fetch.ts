import { ErrorCode } from '@onlinedars/shared';
import { ApiError, apiBaseUrl, apiFetch, type ApiRequestOptions } from './client';

/**
 * Transport used by the student API functions (`learning.ts`, `me.ts`).
 *
 * The auth layer (`@/lib/auth`, owned by frontend-public) provides `authFetch` (attaches the
 * in-memory access token and refreshes once on 401) and `getSession()`. It is built in parallel,
 * so this seam keeps the cabinet independent of it: the default is plain `apiFetch` (cookies
 * only), and `configureStudentAuth({ fetch: authFetch, getAccessToken })` switches every student
 * call to the authenticated transport.
 *
 * TODO(merge): once `@/lib/auth` is on main, wire it in `features/profile/CabinetAuthBridge.tsx`.
 */
export type StudentFetcher = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

interface StudentAuthConfig {
  fetch: StudentFetcher;
  getAccessToken: () => Promise<string | null>;
}

let config: StudentAuthConfig = {
  fetch: apiFetch,
  getAccessToken: async () => null,
};

export function configureStudentAuth(next: Partial<StudentAuthConfig>): void {
  config = { ...config, ...next };
}

export function studentFetch<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return config.fetch<T>(path, options);
}

/** `{ a: 1, b: undefined }` → `?a=1` */
export function toQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * Downloads a binary file (e.g. certificate PDF) with the student's session and saves it.
 * Accepts either a binary body or JSON `{ url }` (presigned link), whichever the API returns.
 */
export async function studentDownload(path: string, filename: string): Promise<void> {
  const token = await config.getAccessToken();
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      code?: ErrorCode;
      message?: string;
    } | null;
    throw new ApiError(
      res.status,
      body?.code ?? (res.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.INTERNAL_ERROR),
      body?.message ?? res.statusText,
    );
  }
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const { url } = (await res.json()) as { url?: string };
    if (!url) throw new ApiError(500, ErrorCode.INTERNAL_ERROR, 'missing url');
    window.open(url, '_blank', 'noopener');
    return;
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
