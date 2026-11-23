import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CabinetShell } from '@/components/layout/student/CabinetShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cabinet');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Student cabinet shell (/cabinet/*). Data is fetched client-side with the student's session;
 * the API enforces auth/ownership on every call (hiding UI is not access control).
 */
export default function CabinetLayout({ children }: { children: ReactNode }) {
  return <CabinetShell>{children}</CabinetShell>;
}
