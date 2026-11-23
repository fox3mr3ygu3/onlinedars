import { Award, CheckCircle2, ClipboardCheck, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Price } from '@/features/catalog/price';
import type { CourseDetail } from '@/lib/api/public';

/** Sticky side card on the course page: price + Buy (paid) or Start (free). */
export function CoursePurchaseCard({ course }: { course: CourseDetail }) {
  const t = useTranslations('course');
  const free = course.isFree || course.price === 0;
  const href = `/checkout/${encodeURIComponent(course.id)}?course=${encodeURIComponent(course.slug)}`;
  const modules = course.moduleCount ?? course.modules.length;

  return (
    <aside className="bg-card space-y-5 rounded-xl border p-5 shadow-sm lg:sticky lg:top-24">
      <div>
        <p className="text-muted-foreground text-sm">{t('price')}</p>
        <Price isFree={free} price={course.price} className="text-2xl" />
      </div>
      <Button asChild size="lg" className="w-full">
        <Link href={href} data-testid="course-cta">
          {free ? t('start') : t('buy')}
        </Link>
      </Button>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-muted/50 rounded-lg p-3">
          <dt className="text-muted-foreground">{t('modules')}</dt>
          <dd className="text-lg font-semibold">{modules}</dd>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <dt className="text-muted-foreground">{t('lessons')}</dt>
          <dd className="text-lg font-semibold" data-testid="course-lesson-count">
            {course.lessonCount}
          </dd>
        </div>
      </dl>
      <div>
        <p className="mb-2 text-sm font-medium">{t('includes')}</p>
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <ListChecks className="text-primary size-4" aria-hidden />
            {t('includesPractice')}
          </li>
          <li className="flex items-center gap-2">
            <ClipboardCheck className="text-primary size-4" aria-hidden />
            {t('includesExam')}
          </li>
          <li className="flex items-center gap-2">
            <Award className="text-primary size-4" aria-hidden />
            {t('includesCertificate')}
          </li>
        </ul>
      </div>
    </aside>
  );
}

export function CourseGoals({ goals }: { goals: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {goals.map((g) => (
        <li key={g} className="flex gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <span>{g}</span>
        </li>
      ))}
    </ul>
  );
}
