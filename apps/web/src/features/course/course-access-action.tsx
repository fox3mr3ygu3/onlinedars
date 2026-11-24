'use client';

import { AccessRequestStatus, ErrorCode } from '@onlinedars/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FormAlert, useApiErrorMessage } from '@/features/auth/form-bits';
import { formatDate } from '@/features/admin/common/format';
import { cabinetRoutes } from '@/features/cabinet/routes';
import { getCourseAccess, requestCourseAccess } from '@/lib/api/access';
import { isApiError } from '@/lib/api/client';
import { isStaff, loginRedirect, useSession } from '@/lib/auth';
import { StaffEnrolNotice } from './student-only';

export const courseAccessKey = (courseId: string) => ['me', 'course-access', courseId] as const;

/**
 * The course page action. Anonymous → sign in to request; staff → notice (they can't enrol);
 * student → "Kirish so'rash", or the state of their request, or "Kursni ochish" when enrolled.
 * Access itself is only ever granted by an admin on the server.
 */
export function CourseAccessAction({
  courseId,
  courseSlug,
}: {
  courseId: string;
  courseSlug: string;
}) {
  const t = useTranslations('course.access');
  const { user, status } = useSession();
  const apiMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const isStudent = status === 'authenticated' && user && !isStaff(user.role);

  const state = useQuery({
    queryKey: courseAccessKey(courseId),
    queryFn: ({ signal }) => getCourseAccess(courseId, signal),
    enabled: Boolean(isStudent),
  });

  const ask = useMutation({
    mutationFn: () => requestCourseAccess({ courseId }),
    onSuccess: (request) => {
      queryClient.setQueryData(courseAccessKey(courseId), { enrolled: false, request });
    },
    onError: (err) => {
      // Someone else's tab (or an admin) already changed the state: show the real one.
      if (
        isApiError(err) &&
        (err.code === ErrorCode.ACCESS_REQUEST_PENDING || err.code === ErrorCode.ALREADY_ENROLLED)
      ) {
        void queryClient.invalidateQueries({ queryKey: courseAccessKey(courseId) });
      }
    },
  });

  if (status === 'idle' || status === 'loading') {
    return <Placeholder />;
  }
  if (!user) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={loginRedirect(`/courses/${courseSlug}`)} data-testid="course-cta">
          {t('request')}
        </Link>
      </Button>
    );
  }
  if (isStaff(user.role)) return <StaffEnrolNotice />;
  if (state.isPending) return <Placeholder />;
  if (state.isError) {
    return <FormAlert>{t('loadError')}</FormAlert>;
  }

  const { enrolled, request } = state.data;
  if (enrolled) {
    return (
      <div className="space-y-3" data-testid="course-access-enrolled">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {t('enrolledTitle')}
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href={cabinetRoutes.course(courseId)} data-testid="course-cta">
            {t('openCourse')}
          </Link>
        </Button>
      </div>
    );
  }

  if (request?.status === AccessRequestStatus.PENDING) {
    return (
      <div
        role="status"
        data-testid="course-access-pending"
        className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
      >
        <p className="flex items-center gap-2 font-medium">
          <Clock className="size-4 text-amber-600" aria-hidden />
          {t('pendingTitle')}
        </p>
        <p className="text-muted-foreground">{t('pendingText')}</p>
        <p className="text-muted-foreground text-xs">
          {t('pendingSince', { date: formatDate(request.createdAt) })}
        </p>
      </div>
    );
  }

  const rejected = request?.status === AccessRequestStatus.REJECTED;
  return (
    <div className="space-y-3">
      {rejected && (
        <div
          role="status"
          data-testid="course-access-rejected"
          className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
        >
          <p className="flex items-center gap-2 font-medium">
            <XCircle className="size-4 text-red-600" aria-hidden />
            {t('rejectedTitle')}
          </p>
          {request.decisionReason && (
            <p className="text-muted-foreground">
              {t('rejectedReason', { reason: request.decisionReason })}
            </p>
          )}
        </div>
      )}
      {ask.isError && <FormAlert>{apiMessage(ask.error)}</FormAlert>}
      <Button
        size="lg"
        className="w-full"
        data-testid="course-cta"
        disabled={ask.isPending}
        onClick={() => ask.mutate()}
      >
        {ask.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {ask.isPending ? t('requesting') : rejected ? t('requestAgain') : t('request')}
      </Button>
    </div>
  );
}

function Placeholder() {
  return <div className="bg-muted h-10 w-full animate-pulse rounded-md" aria-hidden />;
}
