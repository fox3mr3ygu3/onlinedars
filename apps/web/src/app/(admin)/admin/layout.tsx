import type { ReactNode } from 'react';

/** Admin panel shell (/admin/*). frontend-admin adds the sidebar. The API enforces roles. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh w-full flex-col px-4 py-6">{children}</div>;
}
