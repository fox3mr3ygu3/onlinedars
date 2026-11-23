'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { learningApi } from '@/lib/api/learning';
import type { StudentResultItem } from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { Pager } from './Pager';
import { cabinetRoutes, qk } from './routes';
import { EmptyState, formatDate, PageHeader, QueryBoundary } from './ui';

const PAGE_SIZE = 20;

function Verdict({ r }: { r: StudentResultItem }) {
  const t = useTranslations('results');
  const te = useTranslations('exam');
  if (r.passed === null)
    return <span className="text-muted-foreground">{te(`status.${r.status}`)}</span>;
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-xs font-medium',
        r.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
      )}
    >
      {r.passed ? t('passed') : t('failed')}
    </span>
  );
}

export function ResultsList() {
  const t = useTranslations('results');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: qk.results(page),
    queryFn: () => learningApi.results({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title={t('title')} />
      <QueryBoundary query={query}>
        {(list) =>
          list.items.length === 0 ? (
            <EmptyState>{t('empty')}</EmptyState>
          ) : (
            <>
              {/* mobile: cards */}
              <ul className="space-y-3 md:hidden">
                {list.items.map((r) => (
                  <li key={r.attemptId} className="bg-card space-y-1 rounded-xl border p-4">
                    <Link
                      href={cabinetRoutes.course(r.courseId)}
                      className="font-medium hover:underline"
                    >
                      {r.courseTitle}
                    </Link>
                    <p className="text-muted-foreground text-sm">{r.examTitle}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {r.percent !== null
                          ? t('percent', { percent: Math.round(r.percent) })
                          : '—'}{' '}
                        · {formatDate(r.submittedAt ?? r.startedAt)}
                      </span>
                      <Verdict r={r} />
                    </div>
                  </li>
                ))}
              </ul>
              {/* ≥ md: table */}
              <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3 font-medium">{t('course')}</th>
                      <th className="p-3 font-medium">{t('exam')}</th>
                      <th className="p-3 font-medium">{t('date')}</th>
                      <th className="p-3 font-medium">{t('score')}</th>
                      <th className="p-3 font-medium">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {list.items.map((r) => (
                      <tr key={r.attemptId}>
                        <td className="p-3">
                          <Link href={cabinetRoutes.course(r.courseId)} className="hover:underline">
                            {r.courseTitle}
                          </Link>
                        </td>
                        <td className="p-3">{r.examTitle}</td>
                        <td className="p-3">{formatDate(r.submittedAt ?? r.startedAt, true)}</td>
                        <td className="p-3">
                          {r.percent !== null
                            ? t('percent', { percent: Math.round(r.percent) })
                            : '—'}
                          <span className="text-muted-foreground block text-xs">
                            {t('passScore', { score: r.passScore })}
                          </span>
                        </td>
                        <td className="p-3">
                          <Verdict r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                page={list.page}
                pageSize={list.pageSize}
                total={list.total}
                onPage={setPage}
              />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
