'use client';

import { GraduationCap, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { ErrorState, LoadingState } from '../common/ui';
import { useAdminMe } from '../useAdminMe';
import { AdminNav } from './AdminNav';
import { activeNavKey, canAccessAdmin } from './nav';

/**
 * Admin panel chrome: fixed sidebar on lg+, slide-over drawer on smaller screens.
 * Role checks here are UX only; the API rejects non-staff users on every admin route.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname() ?? '/admin';
  const me = useAdminMe();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const role = me.data?.role;
  const activeKey = activeNavKey(pathname);

  let body: ReactNode = children;
  if (me.isPending) body = <LoadingState label={t('shell.loadingUser')} />;
  else if (me.error) {
    const unauth = me.error instanceof ApiError && me.error.status === 401;
    body = unauth ? (
      <div className="grid max-w-md gap-4 py-10">
        <p>{t('shell.notSignedIn')}</p>
        <Button asChild className="w-fit">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`}>{t('shell.signIn')}</Link>
        </Button>
      </div>
    ) : (
      <ErrorState error={me.error} onRetry={() => me.refetch()} />
    );
  } else if (!canAccessAdmin(role)) {
    body = <ErrorState error={new ApiError(403, 'FORBIDDEN', 'forbidden')} />;
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/admin" className="flex items-center gap-2 px-2 font-semibold">
        <GraduationCap className="text-primary size-6" aria-hidden />
        <span>OnlineDars</span>
      </Link>
      {canAccessAdmin(role) && (
        <AdminNav role={role} activeKey={activeKey} onNavigate={() => setOpen(false)} />
      )}
      <div className="mt-auto grid gap-2 border-t pt-4 text-sm">
        {me.data && (
          <div className="px-2">
            <p className="truncate font-medium">{me.data.fullName}</p>
            <p className="text-muted-foreground text-xs">{t(`shell.roles.${me.data.role}`)}</p>
          </div>
        )}
        <Link href="/" className="text-muted-foreground hover:text-foreground px-2">
          {t('shell.toSite')}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="bg-muted/30 min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#admin-main"
        className="bg-background sr-only z-50 rounded p-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        {t('shell.skipToContent')}
      </a>
      <aside className="bg-background sticky top-0 hidden h-dvh overflow-y-auto border-r lg:block">
        {sidebar}
      </aside>

      {/* mobile / tablet drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/40 transition-opacity',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          id="admin-drawer"
          className={cn(
            'bg-background absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto shadow-xl transition-transform',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
          inert={!open}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3"
            aria-label={t('shell.closeMenu')}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden />
          </Button>
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('shell.openMenu')}
            aria-expanded={open}
            aria-controls="admin-drawer"
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden />
          </Button>
          <span className="font-semibold">{t('title')}</span>
        </header>
        <main
          id="admin-main"
          className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8"
        >
          {body}
        </main>
      </div>
    </div>
  );
}

/** Wraps ADMIN-only pages (settings, payments, students, reports, audit). UX only. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const t = useTranslations('admin.shell');
  const me = useAdminMe();
  if (me.isPending) return <LoadingState />;
  if (me.data?.role !== 'ADMIN') {
    return (
      <p role="alert" className="text-muted-foreground py-10">
        {t('adminOnly')}
      </p>
    );
  }
  return <>{children}</>;
}
