import type { Role } from '@onlinedars/shared';
import { parseRole, ROLE_COOKIE, ROLE_COOKIE_MAX_AGE } from './routes';

/* Browser-only helpers for the `od_role` hint cookie (readable by middleware, not httpOnly). */

function hasDocument(): boolean {
  return typeof document !== 'undefined';
}

export function setRoleHint(role: Role): void {
  if (!hasDocument()) return;
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ROLE_COOKIE}=${role}; Path=/; Max-Age=${ROLE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearRoleHint(): void {
  if (!hasDocument()) return;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readRoleHint(): Role | null {
  if (!hasDocument()) return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ROLE_COOKIE}=`));
  return parseRole(match?.slice(ROLE_COOKIE.length + 1));
}
