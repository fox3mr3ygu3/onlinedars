'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { learningApi } from '@/lib/api/learning';
import { useMe } from '../profile/useMe';
import { CourseCard } from './CourseCard';
import { cabinetRoutes, qk } from './routes';
import { EmptyState, formatDate, PageHeader, ProgressBar, QueryBoundary } from './ui';

export function Dashboard() {
  const t = useTranslations('cabinet.dashboard');
  const me = useMe();
  const query = useQuery({ queryKey: qk.dashboard, queryFn: learningApi.dashboard });

  return (
    <div>
      <PageHeader title={me.data ? t('greeting', { name: me.data.fullName }) : t('greetingAnon')} />
      <QueryBoundary query={query}>
        {(d) => (
          <div className="space-y-8">
            <section className="bg-card rounded-xl border p-5">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-medium">{t('overallProgress')}</h2>
                <span className="text-3xl font-bold" data-testid="overall-progress">
                  {Math.round(d.stats.overallProgress)}%
                </span>
              </div>
              <ProgressBar
                value={d.stats.overallProgress}
                label={t('overallProgress')}
                className="mt-3"
              />
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
                {(
                  [
                    ['enrolledCourses', d.stats.enrolledCourses],
                    ['completedCourses', d.stats.completedCourses],
                    ['completedLessons', d.stats.completedLessons],
                    ['practiceAttempts', d.stats.practiceAttempts],
                    ['certificates', d.stats.certificates],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground text-xs">{t(key)}</dt>
                    <dd className="text-xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h2 className="mb-3 font-medium">{t('lastActivity')}</h2>
              {d.lastActivity ? (
                <Link
                  href={
                    d.lastActivity.lessonId
                      ? cabinetRoutes.lesson(d.lastActivity.courseId, d.lastActivity.lessonId)
                      : cabinetRoutes.course(d.lastActivity.courseId)
                  }
                  className="bg-card hover:border-primary flex items-center gap-3 rounded-xl border p-4 transition-colors"
                >
                  <Activity className="text-primary size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.lastActivity.title}</span>
                    <span className="text-muted-foreground block text-sm">
                      {t(`activity.${d.lastActivity.type}`)} · {d.lastActivity.courseTitle} ·{' '}
                      {formatDate(d.lastActivity.at, true)}
                    </span>
                  </span>
                </Link>
              ) : (
                <p className="text-muted-foreground text-sm">{t('noActivity')}</p>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">{t('myCourses')}</h2>
                {d.courses.length > 0 ? (
                  <Link
                    href={cabinetRoutes.courses}
                    className="text-primary text-sm hover:underline"
                  >
                    {t('allCourses')}
                  </Link>
                ) : null}
              </div>
              {d.courses.length === 0 ? (
                <EmptyState>
                  <p>{t('noCourses')}</p>
                  <Button asChild className="mt-4">
                    <Link href="/courses">{t('browseCatalog')}</Link>
                  </Button>
                </EmptyState>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {d.courses.slice(0, 6).map((c) => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
