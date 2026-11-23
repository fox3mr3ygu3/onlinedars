'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getActivityReport, getCoursesReport, getExamsReport } from '@/lib/api/admin/management';
import { cn } from '@/lib/utils';
import { dateInputToIso, formatDate } from '../common/format';
import { EmptyState, ErrorState, LoadingState, PageHeader, TableWrap } from '../common/ui';

type Tab = 'courses' | 'exams' | 'activity';

/** Horizontal bar for a 0..100 value, with the number shown next to it. */
function Bar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="bg-muted hidden h-2 w-24 overflow-hidden rounded-full sm:block" aria-hidden>
        <div className="bg-primary h-full" style={{ width: `${v}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums">{v}%</span>
    </div>
  );
}

function QueryTable<T>({
  q,
  head,
  row,
}: {
  q: { isPending: boolean; error: unknown; data?: T[]; refetch: () => unknown };
  head: ReactNode;
  row: (r: T, i: number) => ReactNode;
}) {
  if (q.isPending) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data || q.data.length === 0) return <EmptyState />;
  return (
    <TableWrap>
      <thead>{head}</thead>
      <tbody>{q.data.map(row)}</tbody>
    </TableWrap>
  );
}

export function Reports() {
  const t = useTranslations('admin');
  const [tab, setTab] = useState<Tab>('courses');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { from: dateInputToIso(from), to: dateInputToIso(to, true) };
  const courses = useQuery({
    queryKey: ['admin', 'reports', 'courses', range],
    queryFn: () => getCoursesReport(range),
    enabled: tab === 'courses',
  });
  const exams = useQuery({
    queryKey: ['admin', 'reports', 'exams', range],
    queryFn: () => getExamsReport(range),
    enabled: tab === 'exams',
  });
  const activity = useQuery({
    queryKey: ['admin', 'reports', 'activity', range],
    queryFn: () => getActivityReport(range),
    enabled: tab === 'activity',
  });
  const f = (k: string) => t(`reports.fields.${k}`);

  return (
    <>
      <PageHeader title={t('reports.title')} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div
          role="tablist"
          aria-label={t('reports.title')}
          className="flex gap-1 overflow-x-auto border-b"
        >
          {(['courses', 'exams', 'activity'] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                'whitespace-nowrap px-3 py-2 text-sm',
                tab === k
                  ? 'border-primary text-primary -mb-px border-b-2 font-medium'
                  : 'text-muted-foreground',
              )}
            >
              {t(`reports.${k}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('common.dateFrom')}</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('common.dateTo')}</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>
      <div role="tabpanel">
        {tab === 'courses' && (
          <QueryTable
            q={courses}
            head={
              <tr>
                <th>{f('course')}</th>
                <th className="text-right">{f('enrolled')}</th>
                <th className="text-right">{f('completed')}</th>
                <th className="text-right">{f('completionRate')}</th>
              </tr>
            }
            row={(r) => (
              <tr key={r.courseId}>
                <td>{r.title}</td>
                <td className="text-right tabular-nums">{r.enrollments}</td>
                {/* finished = earned the certificate */}
                <td className="text-right tabular-nums">{r.certificates}</td>
                <td>
                  <Bar value={r.completionRate} />
                </td>
              </tr>
            )}
          />
        )}
        {tab === 'exams' && (
          <QueryTable
            q={exams}
            head={
              <tr>
                <th>{f('course')}</th>
                <th className="text-right">{f('attempts')}</th>
                <th className="text-right">{f('passed')}</th>
                <th className="text-right">{f('averageScore')}</th>
              </tr>
            }
            row={(r) => (
              <tr key={r.examId}>
                <td>{r.courseTitle}</td>
                <td className="text-right tabular-nums">{r.attempts}</td>
                <td className="text-right tabular-nums">{r.passed}</td>
                <td>
                  <Bar value={r.avgPercent ?? 0} />
                </td>
              </tr>
            )}
          />
        )}
        {tab === 'activity' && (
          <QueryTable
            q={activity}
            head={
              <tr>
                <th>{f('date')}</th>
                <th className="text-right">{f('newStudents')}</th>
                <th className="text-right">{f('enrollments')}</th>
                <th className="text-right">{f('lessonsCompleted')}</th>
                <th className="text-right">{f('practiceAttempts')}</th>
                <th className="text-right">{f('examAttempts')}</th>
              </tr>
            }
            row={(r) => (
              <tr key={r.date}>
                <td>{formatDate(r.date)}</td>
                <td className="text-right tabular-nums">{r.newStudents}</td>
                <td className="text-right tabular-nums">{r.enrollments}</td>
                <td className="text-right tabular-nums">{r.lessonsCompleted}</td>
                <td className="text-right tabular-nums">{r.practiceAttempts}</td>
                <td className="text-right tabular-nums">{r.examAttempts}</td>
              </tr>
            )}
          />
        )}
      </div>
    </>
  );
}
