import { ArrowRight, Compass } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Direction } from '@/lib/api/public';
import { catalogHref } from './catalog-params';

export function DirectionList({
  directions,
  compact,
}: {
  directions: Direction[];
  compact?: boolean;
}) {
  const t = useTranslations('teachers');
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {directions.map((d) => (
        <li key={d.id}>
          <Link
            href={catalogHref({ directionId: d.id })}
            className="bg-card surface-interactive group flex h-full flex-col gap-3 rounded-xl border p-5"
          >
            <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <Compass className="size-5" aria-hidden />
            </span>
            <span className="text-base font-semibold">{d.name}</span>
            {!compact && d.description && (
              <span className="text-muted-foreground line-clamp-3 text-sm">{d.description}</span>
            )}
            <span className="text-primary mt-auto flex items-center gap-1 text-sm font-medium">
              {typeof d.courseCount === 'number'
                ? t('directionCourses', { count: d.courseCount })
                : t('directionOpen')}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
