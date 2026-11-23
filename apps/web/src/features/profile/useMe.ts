'use client';

import { useQuery } from '@tanstack/react-query';
import { meApi } from '@/lib/api/me';
import { qk } from '../cabinet/routes';

/**
 * Current user for the cabinet (GET /auth/me). The auth layer (`@/lib/auth`, frontend-public)
 * also exposes the user via `useSession()`; this hook keeps the cabinet independent of it.
 */
export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: meApi.authMe, staleTime: 60_000, retry: false });
}
