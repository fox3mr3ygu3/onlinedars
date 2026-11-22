'use client';

import type { AuthUser, Role } from '@onlinedars/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { loginRedirect, roleHome } from './routes';
import {
  getServerSessionState,
  getSession,
  getSessionState,
  type SessionStatus,
  subscribeSession,
} from './session';

export interface UseSessionResult {
  status: SessionStatus;
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** true until the first refresh attempt has finished */
  isLoading: boolean;
}

/** Reactive session for client components. Triggers the initial refresh on first use. */
export function useSession(): UseSessionResult {
  const state = useSyncExternalStore(subscribeSession, getSessionState, getServerSessionState);
  useEffect(() => {
    if (state.status === 'idle') void getSession();
  }, [state.status]);
  return {
    status: state.status,
    user: state.session?.user ?? null,
    accessToken: state.session?.accessToken ?? null,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'idle' || state.status === 'loading',
  };
}

/**
 * Client-side guard (middleware only sees the role hint): sends signed-out users to
 * `/login?next=<current>` and users with the wrong role to their own panel.
 */
export function useRequireSession(roles?: readonly Role[]): UseSessionResult {
  const result = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = result.user?.role;
  useEffect(() => {
    if (result.status === 'unauthenticated') {
      const qs = searchParams.toString();
      router.replace(loginRedirect(`${pathname}${qs ? `?${qs}` : ''}`));
    } else if (role && roles && !roles.includes(role)) {
      router.replace(roleHome(role));
    }
  }, [result.status, role, roles, router, pathname, searchParams]);
  return result;
}
