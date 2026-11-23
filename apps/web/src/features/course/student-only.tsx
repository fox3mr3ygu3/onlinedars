'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { isStaff, useSession } from '@/lib/auth';

/** Notice shown to staff instead of enrol/buy actions (the API refuses them too). */
export function StaffEnrolNotice() {
  const t = useTranslations('course');
  return (
    <p
      role="note"
      data-testid="staff-enrol-notice"
      className="bg-muted/50 text-muted-foreground flex gap-2 rounded-lg p-3 text-sm"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t('staffCannotEnrol')}
    </p>
  );
}

/** Renders `children` (an enrol/buy action) for everyone except signed-in staff. */
export function StudentOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (isStaff(user?.role)) return <StaffEnrolNotice />;
  return <>{children}</>;
}
