import {
  type AuthResponse,
  type AuthUser,
  ErrorCode,
  type LoginInput,
  type RegisterInput,
} from '@onlinedars/shared';
import { postLogin, postLogout, postRefresh, postRegister } from '../api/auth';
import { ApiError, apiFetch, type ApiRequestOptions, isApiError } from '../api/client';
import { clearRoleHint, readRoleHint, setRoleHint } from './role-cookie';

/*
 * In-memory session store (browser only). The access token lives only in memory; on a page load
 * it is recovered with POST /auth/refresh, which uses the httpOnly `od_refresh` cookie.
 */

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface Session {
  accessToken: string;
  user: AuthUser;
  /** epoch ms when the access token expires */
  expiresAt: number;
}

export interface SessionState {
  status: SessionStatus;
  session: Session | null;
}

/** Refresh this long before the access token expires. */
const EXPIRY_SKEW_MS = 30_000;

const IDLE: SessionState = { status: 'idle', session: null };
let state: SessionState = IDLE;
const listeners = new Set<() => void>();
let refreshInFlight: Promise<Session | null> | null = null;

function setState(next: SessionState): void {
  state = next;
  for (const l of listeners) l();
}

export function getSessionState(): SessionState {
  return state;
}

export function getServerSessionState(): SessionState {
  return IDLE;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function fromResponse(res: AuthResponse): Session {
  return {
    accessToken: res.accessToken,
    user: res.user,
    expiresAt: Date.now() + res.expiresIn * 1000,
  };
}

/** Stores a login/register/refresh response and updates the `od_role` hint cookie. */
export function applyAuthResponse(res: AuthResponse): Session {
  const session = fromResponse(res);
  setRoleHint(session.user.role);
  setState({ status: 'authenticated', session });
  return session;
}

/** Forgets the session locally (no API call). */
export function clearSession(): void {
  clearRoleHint();
  setState({ status: 'unauthenticated', session: null });
}

/** Test helper: back to the initial state. */
export function resetSessionForTests(): void {
  refreshInFlight = null;
  state = IDLE;
  listeners.clear();
}

function isAuthFailure(e: unknown): boolean {
  return (
    isApiError(e) &&
    (e.status === 401 ||
      e.status === 403 ||
      e.code === ErrorCode.REFRESH_TOKEN_INVALID ||
      e.code === ErrorCode.REFRESH_TOKEN_REUSED ||
      e.code === ErrorCode.ACCOUNT_DISABLED)
  );
}

async function doRefresh(): Promise<Session | null> {
  try {
    return applyAuthResponse(await postRefresh());
  } catch (e) {
    if (isAuthFailure(e)) {
      clearSession();
    } else {
      // Network / server error: keep the role hint (we may still be logged in), report no session.
      setState({ status: 'unauthenticated', session: null });
    }
    return null;
  }
}

/**
 * POST /auth/refresh, single-flight within the tab and serialised across tabs with the Web Locks
 * API when available (the API revokes the session if two refreshes race with the same cookie).
 */
export function refreshSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (refreshInFlight) return refreshInFlight;
  if (state.status !== 'authenticated') setState({ status: 'loading', session: state.session });
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run: Promise<Session | null> = locks
    ? locks.request('od-auth-refresh', () => doRefresh()).then((s) => s)
    : doRefresh();
  const p = run.finally(() => {
    if (refreshInFlight === p) refreshInFlight = null;
  });
  refreshInFlight = p;
  return p;
}

/**
 * Current session, refreshing if needed. Returns null when signed out. Anonymous visitors (no
 * `od_role` hint cookie) are resolved without a network call.
 */
export async function getSession(): Promise<Session | null> {
  if (typeof window === 'undefined') return null;
  const { status, session } = state;
  if (status === 'authenticated' && session && session.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return session;
  }
  if (refreshInFlight) return refreshInFlight;
  if (status === 'unauthenticated') return null;
  if (status === 'idle' && !readRoleHint()) {
    setState({ status: 'unauthenticated', session: null });
    return null;
  }
  return refreshSession();
}

/**
 * Authenticated API call for client components. Attaches the access token; on 401 it refreshes
 * once and retries. Throws ApiError(401, UNAUTHORIZED) when there is no session.
 * Same signature as `apiFetch` (any `accessToken` passed in is ignored).
 */
export async function authFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const session = await getSession();
  if (!session) throw new ApiError(401, ErrorCode.UNAUTHORIZED, 'Not signed in');
  try {
    return await apiFetch<T>(path, { ...options, accessToken: session.accessToken });
  } catch (e) {
    if (!isApiError(e) || e.status !== 401) throw e;
    // Another request may already have rotated the token; only refresh if ours is still current.
    const current = state.session;
    const next =
      current && current.accessToken !== session.accessToken ? current : await refreshSession();
    if (!next) throw e;
    return apiFetch<T>(path, { ...options, accessToken: next.accessToken });
  }
}

export async function login(input: LoginInput): Promise<AuthUser> {
  return applyAuthResponse(await postLogin(input)).user;
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  return applyAuthResponse(await postRegister(input)).user;
}

/** Revokes the session on the API (best effort) and always clears it locally. */
export async function logout(): Promise<void> {
  try {
    await postLogout();
  } catch {
    // ignore: the local session is cleared regardless
  } finally {
    clearSession();
  }
}
