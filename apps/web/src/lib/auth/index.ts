/**
 * OnlineDars web auth layer (owned by frontend-public; used by all three panels).
 *
 * How it works
 * - The API sets the refresh token as the httpOnly cookie `od_refresh` (path /api/v1/auth). The
 *   browser reaches the API same-origin through the `/api/v1/*` rewrite, so JS never sees it.
 * - The access token (15 min) is kept **in memory only** (`session.ts`). On a page load it is
 *   recovered with `POST /auth/refresh`; refreshes are single-flight per tab and serialised across
 *   tabs with the Web Locks API (the API revokes a session if two refreshes race).
 * - A non-sensitive `od_role` cookie (role name only, not httpOnly) is set on login/refresh and
 *   cleared on logout/failed refresh. `src/middleware.ts` uses it for role redirects. It is only a
 *   hint: the API authorises every request.
 *
 * Client components
 * - `useSession()` → `{ status, user, accessToken, isAuthenticated, isLoading }`
 *   (`status`: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'). First use triggers
 *   the refresh. Visitors without the `od_role` cookie resolve to 'unauthenticated' with no request.
 * - `useRequireSession(roles?)` → same result; redirects to `/login?next=…` when signed out and
 *   to the user's own panel when the role does not match. Use it in cabinet/admin layouts.
 * - `authFetch<T>(path, options)` → like `apiFetch` but attaches the token and, on 401, refreshes
 *   once and retries. Throws `ApiError(401, 'UNAUTHORIZED')` when signed out.
 *   Example: `useQuery({ queryKey: ['me'], queryFn: () => authFetch<AuthUser>('/auth/me') })`.
 * - `getSession()` → `Promise<Session | null>` (`{ accessToken, user, expiresAt }`), refreshing
 *   if the token is missing/near expiry. Returns null on the server.
 * - Actions: `login({ login, password })`, `register(RegisterInput)` → `AuthUser`;
 *   `logout()` (best-effort API call, always clears locally). Callers navigate afterwards
 *   (`roleHome(user.role)` or a validated `safeNextPath(next)`).
 *
 * Server components: `getServerRoleHint()` from `@/lib/auth/server` (role hint only — server code
 * cannot make authenticated API calls).
 *
 * Routing helpers: `resolveRouteAccess`, `roleHome`, `safeNextPath`, `loginRedirect`, `ROLE_COOKIE`.
 */
export {
  isStaff,
  LOGIN_PATH,
  loginRedirect,
  parseRole,
  resolveRouteAccess,
  ROLE_COOKIE,
  roleHome,
  safeNextPath,
} from './routes';
export { clearRoleHint, readRoleHint, setRoleHint } from './role-cookie';
export {
  applyAuthResponse,
  authFetch,
  clearSession,
  getSession,
  getSessionState,
  login,
  logout,
  refreshSession,
  register,
  type Session,
  type SessionState,
  type SessionStatus,
  subscribeSession,
} from './session';
export { useRequireSession, useSession, type UseSessionResult } from './use-session';
