import type { Role } from '@onlinedars/shared';
import { cookies } from 'next/headers';
import { parseRole, ROLE_COOKIE } from './routes';

/**
 * Server Components / route handlers: the role *hint* from the `od_role` cookie. It is not proof of
 * identity (the user can edit it) — use it only to choose what to render; the API still checks
 * every request. Server code cannot call authenticated endpoints, because the refresh cookie is
 * scoped to /api/v1/auth and the access token lives only in browser memory.
 */
export async function getServerRoleHint(): Promise<Role | null> {
  const store = await cookies();
  return parseRole(store.get(ROLE_COOKIE)?.value);
}
