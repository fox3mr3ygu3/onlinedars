'use client';

import { Role } from '@onlinedars/shared';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { isStaff, useSession } from '@/lib/auth';

/**
 * Admin-only enrolment: course access is granted by an admin (Admin → Students), so there is no
 * buy/start button. Guests are asked to register; students are sent to their courses.
 */
export function AdminAccessNotice({ courseSlug }: { courseSlug: string }) {
  const t = useTranslations('course.adminAccess');
  const { user, isLoading } = useSession();

  return (
    <div className="space-y-3" data-testid="admin-access-notice">
      <p className="flex items-center gap-2 font-semibold">
        <KeyRound className="text-primary size-5" aria-hidden />
        {t('title')}
      </p>
      {isLoading ? null : !user ? (
        <>
          <p className="text-muted-foreground text-sm">{t('guest')}</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/register">{t('register')}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`}>
              {t('login')}
            </Link>
          </Button>
        </>
      ) : isStaff(user.role) ? (
        <>
          <p className="text-muted-foreground text-sm">{t('staff')}</p>
          {user.role === Role.ADMIN ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/students">{t('toStudents')}</Link>
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">{t('student')}</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/cabinet/courses">{t('myCourses')}</Link>
          </Button>
        </>
      )}
    </div>
  );
}
