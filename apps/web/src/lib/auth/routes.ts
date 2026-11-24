import { Role, STAFF_ROLES } from '@onlinedars/shared';

/** Non-sensitive hint cookie that tells middleware which panel to allow. The API enforces access. */
export const ROLE_COOKIE = 'od_role';
/** Same lifetime as the refresh token (30 days). */
export const ROLE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export const LOGIN_PATH = '/login';

const ROLES = new Set<string>(Object.values(Role));

export function parseRole(value: string | null | undefined): Role | null {
  return value && ROLES.has(value) ? (value as Role) : null;
}

export function isStaff(role: Role | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly Role[]).includes(role);
}

/** Where a user lands after login when there is no `next`. */
export function roleHome(role: Role): string {
  return isStaff(role) ? '/admin' : '/cabinet';
}

/**
 * Only allow same-site relative paths as `?next=` (no `//evil.com`, no `https://…`, no `/\…`).
 * Returns null when the value is unsafe or empty.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return null;
  }
  if (/[\r\n\t]/.test(next)) return null;
  return next;
}

export function loginRedirect(pathWithSearch: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(pathWithSearch)}`;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Role-based route rules used by `src/middleware.ts`. Returns the path to redirect to, or null
 * to let the request through.
 * - `/cabinet/**`  → STUDENT (staff are sent to /admin)
 * - `/admin/**`    → ADMIN | CONTENT_MANAGER (students are sent to /cabinet)
 * - no / unknown role on a protected path → `/login?next=<path>`
 */
export function resolveRouteAccess(
  pathname: string,
  search: string,
  roleValue: string | null | undefined,
): string | null {
  const role = parseRole(roleValue);
  const isCabinet = under(pathname, '/cabinet');
  const isAdmin = under(pathname, '/admin');
  if (!isCabinet && !isAdmin) return null;

  if (!role) return loginRedirect(`${pathname}${search}`);
  if (isCabinet && isStaff(role)) return '/admin';
  if (isAdmin && !isStaff(role)) return '/cabinet';
  return null;
}
