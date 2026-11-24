import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { CourseCard as CourseCardData } from '@/lib/api/public';

/** Catalog card: cover, name, short description, lesson count, link to the course page. */
export function CourseCard({ course }: { course: CourseCardData }) {
  const t = useTranslations('catalog');
  return (
    <article className="bg-card group relative flex w-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
      <div className="bg-muted relative aspect-[16/9] overflow-hidden">
        {course.coverImageUrl ? (
          // Covers come from S3/MinIO on another host; plain <img> avoids next/image remote config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverImageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="from-primary/15 to-primary/5 text-primary flex size-full items-center justify-center bg-gradient-to-br">
            <BookOpen className="size-10" aria-hidden />
          </div>
        )}
        {course.direction && (
          <span className="bg-background/90 absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium">
            {course.direction.name}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link
            href={`/courses/${course.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {course.title}
          </Link>
        </h3>
        {course.shortDescription && (
          <p className="text-muted-foreground line-clamp-3 text-sm">{course.shortDescription}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
          <span className="text-muted-foreground" data-testid="lesson-count">
            {t('lessons', { count: course.lessonCount })}
          </span>
          <span className="text-primary font-medium">{t('more')}</span>
        </div>
      </div>
    </article>
  );
}

export function CourseGrid({ courses }: { courses: CourseCardData[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <li key={c.id} className="flex">
          <CourseCard course={c} />
        </li>
      ))}
    </ul>
  );
}
