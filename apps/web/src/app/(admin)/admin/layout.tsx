import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AdminShell } from '@/features/admin/layout/AdminShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Admin panel shell (/admin/*): sidebar + role-aware menu. The API enforces roles on every call. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
