'use client';

import { AccessRequestStatus, type MyAccessRequest } from '@onlinedars/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { listMyAccessRequests } from '@/lib/api/access';
import { cn } from '@/lib/utils';
import { cabinetRoutes, qk } from './routes';
import { EmptyState, formatDate, PageHeader, QueryBoundary } from './ui';

/** What the student sees: an approved request whose access was later revoked shows as REVOKED. */
export type ShownRequestStatus = AccessRequestStatus | 'REVOKED';

export function shownStatus(r: Pick<MyAccessRequest, 'status' | 'hasAccess'>): ShownRequestStatus {
  return r.status === AccessRequestStatus.APPROVED && !r.hasAccess ? 'REVOKED' : r.status;
}

const STATUS_STYLE: Record<ShownRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  REVOKED: 'bg-secondary text-muted-foreground',
};

export function AccessStatusBadge({ status }: { status: ShownRequestStatus }) {
  const t = useTranslations('cabinet.requests.statuses');
  return (
    <span
      className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status])}
      data-status={status}
    >
      {t(status)}
    </span>
  );
}

function RequestAction({ r }: { r: MyAccessRequest }) {
  const t = useTranslations('cabinet.requests');
  const shown = shownStatus(r);
  if (shown === AccessRequestStatus.APPROVED) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={cabinetRoutes.course(r.courseId)}>{t('openCourse')}</Link>
      </Button>
    );
  }
  if (shown === AccessRequestStatus.REJECTED || shown === 'REVOKED') {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/courses/${r.courseSlug}`}>{t('requestAgain')}</Link>
      </Button>
    );
  }
  return null;
}

/** The student's own access requests (GET /me/access-requests). Admins decide; this only shows. */
export function AccessRequestsList() {
  const t = useTranslations('cabinet.requests');
  const query = useQuery({ queryKey: qk.accessRequests, queryFn: listMyAccessRequests });

  return (
    <div>
      <PageHeader title={t('title')} />
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">{t('subtitle')}</p>
      <QueryBoundary query={query}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState>
              <p>{t('empty')}</p>
              <Button asChild className="mt-4">
                <Link href="/courses">{t('toCatalog')}</Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {items.map((r) => (
                <li
                  key={r.id}
                  className="bg-card flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
                  data-testid={`access-request-${r.id}`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/courses/${r.courseSlug}`}
                        className="font-medium hover:underline"
                      >
                        {r.courseTitle}
                      </Link>
                      <AccessStatusBadge status={shownStatus(r)} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t('sentAt')}: {formatDate(r.createdAt, true)}
                      {r.decidedAt && <> · {t('decidedAt', { date: formatDate(r.decidedAt) })}</>}
                    </p>
                    {r.status === AccessRequestStatus.REJECTED && r.decisionReason && (
                      <p className="text-sm">{t('reason', { reason: r.decisionReason })}</p>
                    )}
                    {shownStatus(r) === 'REVOKED' && (
                      <p className="text-muted-foreground text-sm">{t('revokedNote')}</p>
                    )}
                  </div>
                  <RequestAction r={r} />
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </div>
  );
}
