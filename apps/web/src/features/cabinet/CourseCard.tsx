'use client';

import { Award, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { StudentCourseItem } from '@/lib/api/learning-types';
import { cabinetRoutes } from './routes';
import { formatDate, ProgressBar } from './ui';

export function CourseCard({ course }: { course: StudentCourseItem }) {
  const t = useTranslations('cabinet.courses');
  const { progress } = course;
  const done = progress.percent >= 100;
  const continueHref = course.nextLessonId
    ? cabinetRoutes.lesson(course.id, course.nextLessonId)
    : cabinetRoutes.course(course.id);

  return (
    <article className="bg-card flex flex-col overflow-hidden rounded-xl border">
      {course.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.coverImageUrl} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <div className="bg-primary/10 text-primary flex aspect-video items-center justify-center">
          <BookOpen className="size-10" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-semibold">
          <Link href={cabinetRoutes.course(course.id)} className="hover:underline">
            {course.title}
          </Link>
        </h3>
        <div className="space-y-1">
          <ProgressBar
            value={progress.percent}
            label={t('progress', { percent: progress.percent })}
          />
          <p className="text-muted-foreground flex justify-between text-xs">
            <span>{t('progress', { percent: Math.round(progress.percent) })}</span>
            <span>
              {t('lessons', { done: progress.completedLessons, total: progress.totalLessons })}
            </span>
          </p>
        </div>
        {course.lastActivityAt ? (
          <p className="text-muted-foreground text-xs">
            {t('lastActivity', { date: formatDate(course.lastActivityAt) })}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {done ? (
            <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
              {t('completed')}
            </span>
          ) : null}
          {course.certificateId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={cabinetRoutes.certificates}>
                <Award aria-hidden="true" />
                {t('certificate')}
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" className="ml-auto">
            <Link href={done ? cabinetRoutes.course(course.id) : continueHref}>
              {done ? t('open') : t('continue')}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
