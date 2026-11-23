'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Bell,
  BookOpen,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { cabinetRoutes, qk } from '@/features/cabinet/routes';
import { useMe } from '@/features/profile/useMe';
import { meApi } from '@/lib/api/me';
import { cn } from '@/lib/utils';

type NavKey =
  'dashboard' | 'courses' | 'results' | 'certificates' | 'payments' | 'notifications' | 'profile';

const NAV: { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: 'dashboard', href: cabinetRoutes.dashboard, icon: LayoutDashboard },
  { key: 'courses', href: cabinetRoutes.courses, icon: BookOpen },
  { key: 'results', href: cabinetRoutes.results, icon: GraduationCap },
  { key: 'certificates', href: cabinetRoutes.certificates, icon: Award },
  { key: 'payments', href: cabinetRoutes.payments, icon: CreditCard },
  { key: 'notifications', href: cabinetRoutes.notifications, icon: Bell },
  { key: 'profile', href: cabinetRoutes.profile, icon: User },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === cabinetRoutes.dashboard) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useUnreadCount() {
  const q = useQuery({
    queryKey: qk.notifications(true),
    queryFn: () => meApi.notifications({ unreadOnly: true, pageSize: 1 }),
    refetchInterval: 60_000,
    retry: false,
  });
  return q.data?.unreadCount ?? 0;
}

function NavLinks({
  pathname,
  unread,
  onNavigate,
}: {
  pathname: string;
  unread: number;
  onNavigate?: () => void;
}) {
  const t = useTranslations('cabinet.nav');
  return (
    <ul className="space-y-1">
      {NAV.map(({ key, href, icon: Icon }) => {
        const active = isNavActive(pathname, href);
        return (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="flex-1">{t(key)}</span>
              {key === 'notifications' && unread > 0 ? (
                <span className="bg-primary text-primary-foreground rounded-full px-2 text-xs">
                  {unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Student cabinet layout: sidebar on ≥ lg, top bar + slide-over menu on mobile. */
export function CabinetShell({ children }: { children: ReactNode }) {
  const t = useTranslations('cabinet');
  const tn = useTranslations('notifications');
  const tc = useTranslations('common');
  const pathname = usePathname() ?? cabinetRoutes.dashboard;
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const me = useMe();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="bg-muted/30 min-h-dvh">
      <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4">
        <button
          type="button"
          className="hover:bg-accent -ml-2 rounded-md p-2 lg:hidden"
          aria-label={t('nav.menu')}
          aria-expanded={open}
          aria-controls="cabinet-mobile-nav"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="text-primary font-semibold">
          {tc('appName')}
        </Link>
        <span className="text-muted-foreground hidden text-sm sm:inline">/ {t('title')}</span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={cabinetRoutes.notifications}
            className="hover:bg-accent relative rounded-md p-2"
            aria-label={tn('bell', { count: unread })}
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 ? (
              <span
                className="bg-destructive absolute right-1 top-1 size-2 rounded-full"
                aria-hidden="true"
              />
            ) : null}
          </Link>
          <Link
            href={cabinetRoutes.profile}
            className="hover:bg-accent flex items-center gap-2 rounded-md p-2 text-sm"
          >
            <User className="size-5" aria-hidden="true" />
            <span className="hidden max-w-40 truncate sm:inline">
              {me.data?.fullName ?? t('nav.profile')}
            </span>
          </Link>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <nav
            id="cabinet-mobile-nav"
            aria-label={t('nav.mainNav')}
            className="bg-background absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">{t('title')}</span>
              <button
                type="button"
                className="hover:bg-accent rounded-md p-2"
                aria-label={t('nav.closeMenu')}
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} unread={unread} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav aria-label={t('nav.mainNav')} className="sticky top-20">
            <NavLinks pathname={pathname} unread={unread} />
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
