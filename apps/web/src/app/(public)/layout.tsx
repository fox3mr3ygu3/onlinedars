import type { ReactNode } from 'react';

/** Public site shell. frontend-public adds the header/footer in components/layout/public-*. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
