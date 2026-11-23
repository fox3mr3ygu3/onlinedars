'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { learningApi } from '@/lib/api/learning';
import { CourseCard } from './CourseCard';
import { Pager } from './Pager';
import { qk } from './routes';
import { EmptyState, PageHeader, QueryBoundary } from './ui';

const PAGE_SIZE = 12;

export function MyCourses() {
  const t = useTranslations('cabinet');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: qk.courses(page),
    queryFn: () => learningApi.courses({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title={t('courses.title')} />
      <QueryBoundary query={query}>
        {(list) =>
          list.items.length === 0 ? (
            <EmptyState>
              <p>{t('dashboard.noCourses')}</p>
              <Button asChild className="mt-4">
                <Link href="/courses">{t('dashboard.browseCatalog')}</Link>
              </Button>
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.items.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
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
