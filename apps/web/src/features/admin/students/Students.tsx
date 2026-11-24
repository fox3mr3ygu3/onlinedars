'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listCourses } from '@/lib/api/admin/content';
import {
  getStudent,
  grantEnrollment,
  listStudents,
  revokeEnrollment,
} from '@/lib/api/admin/management';
import { ConfirmButton, Pagination } from '../common/controls';
import { formatDate, formatDateTime } from '../common/format';
import { useApiErrorMessage } from '../common/useApiErrorMessage';
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  NativeSelect,
  PageHeader,
  Section,
  TableWrap,
} from '../common/ui';

const PAGE_SIZE = 20;

export function StudentsList() {
  const t = useTranslations('admin');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin', 'students', { search, page }],
    queryFn: () => listStudents({ search, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title={t('students.title')} />
      <Input
        type="search"
        className="mb-4 sm:max-w-sm"
        aria-label={t('common.search')}
        placeholder={t('students.searchPlaceholder')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>{t('students.fields.fullName')}</th>
                <th>{t('students.fields.phone')}</th>
                <th>{t('students.fields.email')}</th>
                <th>{t('students.fields.enrollments')}</th>
                <th>{t('students.fields.createdAt')}</th>
                <th>{t('students.fields.lastLoginAt')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {s.fullName}
                    </Link>{' '}
                    {!s.isActive && <Badge tone="danger">{t('students.blocked')}</Badge>}
                  </td>
                  <td>{s.phone ?? '—'}</td>
                  <td>{s.email ?? '—'}</td>
                  <td className="tabular-nums">{s.enrollments}</td>
                  <td>{formatDate(s.createdAt)}</td>
                  <td>{formatDateTime(s.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted h-2 w-24 overflow-hidden rounded-full"
      >
        <div className="bg-primary h-full" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs tabular-nums">{v}%</span>
    </div>
  );
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const t = useTranslations('admin');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const key = ['admin', 'student', studentId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => getStudent(studentId) });
  const courses = useQuery({
    queryKey: ['admin', 'courses', { all: true }],
    queryFn: () => listCourses({ pageSize: 100 }),
  });
  const [courseId, setCourseId] = useState('');
  const [granting, setGranting] = useState(false);

  if (q.isPending) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  // GET /admin/students/:id answers { student, enrollments, results, certificates, practiceStats }.
  const { student: s, enrollments, results, certificates } = q.data;
  const activeIds = new Set(enrollments.filter((e) => !e.revokedAt).map((e) => e.courseId));

  return (
    <>
      <PageHeader
        title={s.fullName}
        back={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin/students">
              <ArrowLeft aria-hidden />
              {t('students.title')}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6">
        <Section title={t('students.profile')}>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">{t('students.fields.phone')}</dt>
            <dd>{s.phone ?? '—'}</dd>
            <dt className="text-muted-foreground">{t('students.fields.email')}</dt>
            <dd>{s.email ?? '—'}</dd>
            <dt className="text-muted-foreground">{t('students.fields.createdAt')}</dt>
            <dd>{formatDateTime(s.createdAt)}</dd>
            <dt className="text-muted-foreground">{t('students.fields.lastLoginAt')}</dt>
            <dd>{formatDateTime(s.lastLoginAt)}</dd>
            <dt className="text-muted-foreground">{t('students.fields.status')}</dt>
            <dd>
              <Badge tone={s.isActive ? 'success' : 'danger'}>
                {s.isActive ? t('common.active') : t('students.blocked')}
              </Badge>
            </dd>
          </dl>
        </Section>

        <Section title={t('students.enrollments')}>
          <form
            className="mb-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!courseId) return;
              setGranting(true);
              try {
                await grantEnrollment(studentId, courseId);
                setCourseId('');
                await qc.invalidateQueries({ queryKey: key });
                toast.success(t('students.granted'));
              } catch (err) {
                toast.error(errMsg(err));
              } finally {
                setGranting(false);
              }
            }}
          >
            <NativeSelect
              aria-label={t('students.grantSelect')}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="sm:max-w-sm"
            >
              <option value="">{t('students.grantSelect')}</option>
              {(courses.data?.items ?? [])
                .filter((c) => !activeIds.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </NativeSelect>
            <Button type="submit" disabled={!courseId || granting}>
              {granting && <Loader2 className="animate-spin" aria-hidden />}
              {t('students.grant')}
            </Button>
          </form>
          {enrollments.length === 0 ? (
            <EmptyState>{t('students.noEnrollments')}</EmptyState>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>{t('common.course')}</th>
                  <th>{t('students.fields.createdAt')}</th>
                  <th>{t('students.progress')}</th>
                  <th className="text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.courseId}>
                    <td>
                      <div className="font-medium">{e.courseTitle}</div>
                      <div className="text-muted-foreground text-xs">
                        {t(`students.sources.${e.source}`)}
                        {e.revokedAt &&
                          ` · ${t('students.revokedAt', { date: formatDate(e.revokedAt) })}`}
                      </div>
                    </td>
                    <td>{formatDate(e.enrolledAt)}</td>
                    <td>
                      <ProgressBar
                        value={e.progress.percent}
                        label={`${t('students.progress')}: ${e.courseTitle}`}
                      />
                    </td>
                    <td className="text-right">
                      {!e.revokedAt && (
                        <ConfirmButton
                          variant="outline"
                          message={t('students.revokeConfirm', { course: e.courseTitle })}
                          onConfirm={async () => {
                            await revokeEnrollment(studentId, e.courseId);
                            await qc.invalidateQueries({ queryKey: key });
                            toast.success(t('students.revoked'));
                          }}
                        >
                          {t('students.revoke')}
                        </ConfirmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Section>

        <Section title={t('students.results')}>
          {results.length === 0 ? (
            <EmptyState>{t('students.noResults')}</EmptyState>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>{t('common.course')}</th>
                  <th>{t('students.fields.resultTitle')}</th>
                  <th className="text-right">{t('students.fields.score')}</th>
                  <th>{t('students.fields.status')}</th>
                  <th>{t('common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.attemptId}>
                    <td>{r.courseTitle}</td>
                    <td>
                      <Badge tone="info">{t('students.resultKinds.EXAM')}</Badge> {r.examTitle}
                    </td>
                    <td className="text-right tabular-nums">
                      {r.percent === null ? '—' : `${Math.round(r.percent)}%`}
                    </td>
                    <td>
                      <Badge tone={r.passed ? 'success' : 'danger'}>
                        {r.passed ? t('students.passed') : t('students.failed')}
                      </Badge>
                    </td>
                    <td>{formatDateTime(r.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Section>

        {certificates && certificates.length > 0 && (
          <Section title={t('students.certificates')}>
            <ul className="grid gap-2 text-sm">
              {certificates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.courseTitle}</span>
                  <span className="text-muted-foreground">{formatDate(c.issuedAt)}</span>
                  <Link
                    href={`/verify/${c.publicId}`}
                    className="text-primary font-mono text-xs hover:underline"
                  >
                    {c.publicId}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
