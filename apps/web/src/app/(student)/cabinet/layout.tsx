import type { ReactNode } from 'react';

/** Student cabinet shell (/cabinet/*). frontend-student adds the sidebar. The API enforces access. */
export default function CabinetLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-6">{children}</div>
  );
}
