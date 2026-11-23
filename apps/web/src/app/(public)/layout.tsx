import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/layout/public-footer';
import { PublicHeader } from '@/components/layout/public-header';
import { siteUrl } from '@/features/catalog/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: 'OnlineDars', locale: 'uz_UZ', type: 'website' },
};

/** Public site shell: sticky header, content, footer. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
