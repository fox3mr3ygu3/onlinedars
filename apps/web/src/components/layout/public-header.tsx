'use client';

import { GraduationCap, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TeacherAvatar } from '@/features/course/teacher-avatar';
import { isStaff, logout, useSession } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/courses', key: 'courses' },
  { href: '/directions', key: 'directions' },
  { href: '/teachers', key: 'teachers' },
  { href: '/faq', key: 'faq' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeader() {
  const t = useTranslations('publicLayout');
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useSession();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigation.
  useEffect(() => setOpen(false), [pathname]);

  async function onLogout() {
    await logout();
    router.push('/');
    router.refresh();
  }

  const accountLinks = user ? (
    <>
      <Link
        href={isStaff(user.role) ? '/admin' : '/cabinet/profile'}
        title={user.fullName}
        aria-label={t('profile', { name: user.fullName })}
        data-testid="header-profile"
        className="hover:bg-accent flex items-center gap-2 rounded-full p-0.5 pr-3 text-sm font-medium transition-colors"
      >
        <TeacherAvatar name={user.fullName} photoUrl={user.avatarUrl} className="size-8 text-xs" />
        <span className="max-w-32 truncate">{user.fullName.split(/\s+/)[0]}</span>
      </Link>
      <Button asChild variant="outline" size="sm">
        <Link href={isStaff(user.role) ? '/admin' : '/cabinet'}>
          {isStaff(user.role) ? t('admin') : t('cabinet')}
        </Link>
      </Button>
      <Button variant="ghost" size="sm" onClick={onLogout}>
        {t('logout')}
      </Button>
    </>
  ) : (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">{t('login')}</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">{t('register')}</Link>
      </Button>
    </>
  );

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-2"
      >
        {t('skipToContent')}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          {t('brand')}
        </Link>

        <nav aria-label={t('mainNav')} className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  className={cn(
                    'hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(pathname, item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={cn(
            'ml-auto hidden items-center gap-2 md:flex',
            isLoading && 'pointer-events-none opacity-0',
          )}
        >
          {accountLinks}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t('closeMenu') : t('openMenu')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t md:hidden">
          <nav aria-label={t('mainNav')} className="mx-auto max-w-6xl px-4 py-3">
            <ul className="grid gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                    className="hover:bg-accent block rounded-md px-3 py-2.5 text-base font-medium"
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">{accountLinks}</div>
          </nav>
        </div>
      )}
    </header>
  );
}
