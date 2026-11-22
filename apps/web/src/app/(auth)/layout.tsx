import { GraduationCap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export const metadata: Metadata = { robots: { index: false, follow: true } };

/** Centered card layout for /login, /register, /forgot-password. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('publicLayout');
  return (
    <main
      id="main"
      className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10"
    >
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        {t('brand')}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
