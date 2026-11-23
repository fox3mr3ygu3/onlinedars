'use client';

import type { Role } from '@onlinedars/shared';
import {
  Award,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileClock,
  Compass,
  HelpCircle,
  LayoutDashboard,
  type LucideIcon,
  BarChart3,
  Settings,
  UserSquare2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { type NavGroup, type NavKey, visibleNavItems } from './nav';

const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  courses: BookOpen,
  exams: ClipboardCheck,
  certificates: Award,
  directions: Compass,
  teachers: UserSquare2,
  faq: HelpCircle,
  students: Users,
  payments: CreditCard,
  reports: BarChart3,
  settings: Settings,
  audit: FileClock,
};

const GROUPS: NavGroup[] = ['content', 'management'];

/** Sidebar navigation filtered by role. */
export function AdminNav({
  role,
  activeKey,
  onNavigate,
}: {
  role: Role | null | undefined;
  activeKey: NavKey | null;
  onNavigate?: () => void;
}) {
  const t = useTranslations('admin');
  const items = visibleNavItems(role);
  return (
    <nav aria-label={t('title')} className="grid gap-4">
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="grid gap-1">
            <p className="text-muted-foreground px-3 text-xs font-medium uppercase tracking-wide">
              {t(`shell.groups.${group}`)}
            </p>
            <ul className="grid gap-0.5">
              {groupItems.map((item) => {
                const Icon = ICONS[item.key];
                const active = item.key === activeKey;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {t(`nav.${item.key}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
