'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api/admin/management';
import type { AdminMe } from '@/lib/api/admin/types';
import { ApiError } from '@/lib/api/client';

export const ADMIN_ME_KEY = ['admin', 'me'] as const;

/**
 * Current user for the admin panel (`GET /auth/me`). Used only to shape the UI (menu, admin-only
 * pages); every admin endpoint checks the role on the server.
 */
export function useAdminMe() {
  return useQuery<AdminMe, Error>({
    queryKey: ADMIN_ME_KEY,
    queryFn: getMe,
    staleTime: 5 * 60_000,
    retry: (count, e) =>
      !(e instanceof ApiError && (e.status === 401 || e.status === 403)) && count < 1,
  });
}
