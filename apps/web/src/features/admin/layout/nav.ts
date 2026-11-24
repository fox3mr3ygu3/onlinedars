import { Role } from '@onlinedars/shared';

/**
 * Admin sidebar items. Hiding an item is only UX — the API checks roles on every request.
 * CONTENT_MANAGER sees content items only; everything else is ADMIN only.
 */
export type NavKey =
  | 'dashboard'
  | 'courses'
  | 'exams'
  | 'certificates'
  | 'directions'
  | 'teachers'
  | 'faq'
  | 'students'
  | 'accessRequests'
  | 'reports'
  | 'settings'
  | 'audit';

export type NavGroup = 'content' | 'management';

export interface NavItem {
  key: NavKey;
  href: string;
  group: NavGroup;
  roles: readonly Role[];
}

const CONTENT = [Role.ADMIN, Role.CONTENT_MANAGER] as const;
const ADMIN_ONLY = [Role.ADMIN] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', href: '/admin', group: 'content', roles: CONTENT },
  { key: 'courses', href: '/admin/courses', group: 'content', roles: CONTENT },
  { key: 'exams', href: '/admin/exams', group: 'content', roles: CONTENT },
  { key: 'certificates', href: '/admin/certificates', group: 'content', roles: CONTENT },
  { key: 'directions', href: '/admin/directions', group: 'content', roles: CONTENT },
  { key: 'teachers', href: '/admin/teachers', group: 'content', roles: CONTENT },
  { key: 'faq', href: '/admin/faq', group: 'content', roles: CONTENT },
  {
    key: 'accessRequests',
    href: '/admin/access-requests',
    group: 'management',
    roles: ADMIN_ONLY,
  },
  { key: 'students', href: '/admin/students', group: 'management', roles: ADMIN_ONLY },
  { key: 'reports', href: '/admin/reports', group: 'management', roles: ADMIN_ONLY },
  { key: 'settings', href: '/admin/settings', group: 'management', roles: ADMIN_ONLY },
  { key: 'audit', href: '/admin/audit', group: 'management', roles: ADMIN_ONLY },
];

export function visibleNavItems(role: Role | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function canAccessAdmin(role: Role | null | undefined): boolean {
  return role === Role.ADMIN || role === Role.CONTENT_MANAGER;
}

/** Which nav item is active for a pathname (longest matching prefix wins). */
export function activeNavKey(pathname: string): NavKey | null {
  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    const match =
      item.href === '/admin'
        ? pathname === '/admin'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  if (!best && (pathname.startsWith('/admin/lessons') || pathname.startsWith('/admin/practices'))) {
    return 'courses';
  }
  return best?.key ?? null;
}
