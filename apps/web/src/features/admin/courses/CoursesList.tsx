'use client';

import { CourseStatus } from '@onlinedars/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listCourses } from '@/lib/api/admin/content';
import { Pagination } from '../common/controls';
import { formatDate, formatMoney } from '../common/format';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NativeSelect,
  PageHeader,
  TableWrap,
} from '../common/ui';
import { CourseStatusBadge } from './CourseStatus';

const PAGE_SIZE = 20;

export function CoursesList() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CourseStatus | ''>('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin', 'courses', { search, status, page }],
    queryFn: () => listCourses({ search, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title={t('courses.title')}
        actions={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus aria-hidden />
              {t('courses.new')}
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          aria-label={t('common.search')}
          placeholder={t('common.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <NativeSelect
          aria-label={t('courses.fields.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CourseStatus | '');
            setPage(1);
          }}
          className="sm:w-48"
        >
          <option value="">{t('common.all')}</option>
          {Object.values(CourseStatus).map((s) => (
            <option key={s} value={s}>
              {t(`courses.status.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
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
                <th>{t('courses.fields.title')}</th>
                <th>{t('courses.fields.status')}</th>
                <th>{t('courses.fields.price_column')}</th>
                <th>{t('courses.fields.lessons')}</th>
                <th>{t('courses.fields.students')}</th>
                <th>{t('courses.fields.updatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <div className="text-muted-foreground text-xs">{c.direction?.name}</div>
                  </td>
                  <td>
                    <CourseStatusBadge status={c.status} />
                  </td>
                  <td className="tabular-nums">
                    {c.isFree ? tc('free') : formatMoney(c.price, t('common.som'))}
                  </td>
                  <td className="tabular-nums">{c.lessonsCount ?? '—'}</td>
                  <td className="tabular-nums">{c.enrollmentsCount ?? '—'}</td>
                  <td>{formatDate(c.updatedAt)}</td>
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
