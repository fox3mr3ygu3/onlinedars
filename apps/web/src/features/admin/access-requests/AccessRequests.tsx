'use client';

import {
  type AdminAccessRequest,
  AccessRequestStatus,
  rejectAccessRequestSchema,
} from '@onlinedars/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listCourses } from '@/lib/api/admin/content';
import {
  type AccessRequestListQuery,
  approveAccessRequest,
  listAccessRequests,
  rejectAccessRequest,
} from '@/lib/api/admin/management';
import { Pagination } from '../common/controls';
import { formatDateTime } from '../common/format';
import { useApiErrorMessage } from '../common/useApiErrorMessage';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  NativeSelect,
  PageHeader,
  TableWrap,
  Textarea,
} from '../common/ui';

const PAGE_SIZE = 20;

const TONES: Record<AccessRequestStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export function AccessStatusBadge({ status }: { status: AccessRequestStatus }) {
  const t = useTranslations('admin.accessRequests.statuses');
  return (
    <Badge tone={TONES[status]} data-status={status}>
      {t(status)}
    </Badge>
  );
}

/** Client-side check before POST …/reject (the API validates and audits again). */
export function validateRejectReason(reason: string): string | null {
  const r = rejectAccessRequestSchema.safeParse({ reason });
  return r.success ? r.data.reason : null;
}

function parseStatus(v: string | null): AccessRequestStatus | '' {
  return v && v in AccessRequestStatus ? (v as AccessRequestStatus) : '';
}

/**
 * ADMIN-only queue of course access requests. Approving grants the course; rejecting needs a
 * reason the student sees. Both are audited and notify the student (server side).
 */
export function AccessRequestsList() {
  const t = useTranslations('admin');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const params = useSearchParams();
  const [status, setStatus] = useState<AccessRequestStatus | ''>(
    () => parseStatus(params.get('status')) || AccessRequestStatus.PENDING,
  );
  const [courseId, setCourseId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<AdminAccessRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query: AccessRequestListQuery = {
    status,
    courseId,
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const q = useQuery({
    queryKey: ['admin', 'access-requests', query],
    queryFn: () => listAccessRequests(query),
    placeholderData: keepPreviousData,
  });
  const courses = useQuery({
    queryKey: ['admin', 'courses', { all: true }],
    queryFn: () => listCourses({ pageSize: 100 }),
  });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'access-requests'] }),
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      qc.invalidateQueries({ queryKey: ['admin', 'students'] }),
    ]);

  const approve = async (r: AdminAccessRequest) => {
    setBusyId(r.id);
    try {
      await approveAccessRequest(r.id);
      toast.success(t('accessRequests.approved'));
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={t('accessRequests.title')}
        description={
          <>
            {t('accessRequests.subtitle')}
            {q.data && q.data.pendingCount > 0 && (
              <span className="ml-2 font-medium" data-testid="pending-count">
                {t('accessRequests.pending', { count: q.data.pendingCount })}
              </span>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="search"
          aria-label={t('common.search')}
          placeholder={t('accessRequests.searchPlaceholder')}
          value={search}
          onChange={(e) => reset(() => setSearch(e.target.value))}
          className="lg:col-span-2"
        />
        <NativeSelect
          aria-label={t('accessRequests.fields.status')}
          value={status}
          onChange={(e) => reset(() => setStatus(e.target.value as AccessRequestStatus | ''))}
        >
          <option value="">
            {t('accessRequests.fields.status')}: {t('common.all')}
          </option>
          {Object.values(AccessRequestStatus).map((s) => (
            <option key={s} value={s}>
              {t(`accessRequests.statuses.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t('accessRequests.fields.course')}
          value={courseId}
          onChange={(e) => reset(() => setCourseId(e.target.value))}
        >
          <option value="">{t('accessRequests.allCourses')}</option>
          {courses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </NativeSelect>
      </div>

      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState>{t('accessRequests.empty')}</EmptyState>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>{t('accessRequests.fields.student')}</th>
                <th>{t('accessRequests.fields.course')}</th>
                <th>{t('accessRequests.fields.createdAt')}</th>
                <th>{t('accessRequests.fields.status')}</th>
                <th>{t('accessRequests.fields.decision')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id} data-testid={`access-request-${r.id}`}>
                  <td>
                    <div className="font-medium">{r.student.fullName}</div>
                    <div className="text-muted-foreground text-xs">
                      {[r.student.phone, r.student.email].filter(Boolean).join(' · ')}
                    </div>
                    {r.message && (
                      <div className="text-muted-foreground mt-1 max-w-xs text-xs italic">
                        «{r.message}»
                      </div>
                    )}
                  </td>
                  <td>{r.courseTitle}</td>
                  <td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td>
                    <AccessStatusBadge status={r.status} />
                  </td>
                  <td>
                    {r.status === AccessRequestStatus.PENDING ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => void approve(r)}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="animate-spin" aria-hidden />
                          ) : (
                            <Check aria-hidden />
                          )}
                          {t('accessRequests.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => setRejecting(r)}
                        >
                          <X aria-hidden />
                          {t('accessRequests.reject')}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-xs">
                        {r.decidedBy && r.decidedAt
                          ? t('accessRequests.decidedBy', {
                              name: r.decidedBy.fullName,
                              date: formatDateTime(r.decidedAt),
                            })
                          : r.decidedAt
                            ? formatDateTime(r.decidedAt)
                            : '—'}
                        {r.decisionReason && <div className="mt-1">{r.decisionReason}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />
        </>
      )}

      <RejectDialog
        request={rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        onSubmit={async (id, reason) => {
          await rejectAccessRequest(id, reason);
          toast.success(t('accessRequests.rejected'));
          await refresh();
        }}
      />
    </>
  );
}

function RejectDialog({
  request,
  onOpenChange,
  onSubmit,
}: {
  request: AdminAccessRequest | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, reason: string) => Promise<unknown>;
}) {
  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      {request && (
        <RejectForm request={request} onDone={() => onOpenChange(false)} onSubmit={onSubmit} />
      )}
    </Dialog>
  );
}

function RejectForm({
  request,
  onDone,
  onSubmit,
}: {
  request: AdminAccessRequest;
  onDone: () => void;
  onSubmit: (id: string, reason: string) => Promise<unknown>;
}) {
  const t = useTranslations('admin.accessRequests');
  const tc = useTranslations('admin.common');
  const errMsg = useApiErrorMessage();
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = validateRejectReason(reason);
    if (!value) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setServerError(null);
    setBusy(true);
    try {
      await onSubmit(request.id, value);
      onDone();
    } catch (e) {
      setServerError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent closeLabel={tc('close')}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('rejectTitle')}</DialogTitle>
          <DialogDescription>
            {t('rejectText', { course: request.courseTitle, student: request.student.fullName })}
          </DialogDescription>
        </DialogHeader>
        <Field label={t('reason')} error={invalid ? t('reasonRequired') : undefined}>
          {(id, describedBy) => (
            <Textarea
              id={id}
              required
              aria-describedby={describedBy}
              aria-invalid={invalid}
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
        {serverError && (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc('cancel')}
          </Button>
          <Button type="submit" variant="destructive" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {t('reject')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
