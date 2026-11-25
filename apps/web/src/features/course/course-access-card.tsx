import { Award, CheckCircle2, ClipboardCheck, KeyRound, ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CourseDetail } from '@/lib/api/public';
import { CourseAccessAction } from './course-access-action';

/** Sticky side card on the course page: how access works + the request action. */
export function CourseAccessCard({ course }: { course: CourseDetail }) {
  const t = useTranslations('course');
  const modules = course.moduleCount ?? course.modules.length;

  return (
    <aside className="bg-card space-y-5 rounded-xl border p-5 lg:sticky lg:top-24">
      <div className="space-y-2">
        <p className="flex items-center gap-2 font-semibold">
          <KeyRound className="text-primary size-4" aria-hidden />
          {t('access.title')}
        </p>
        <p className="text-muted-foreground text-sm">{t('access.note')}</p>
      </div>
      <CourseAccessAction courseId={course.id} courseSlug={course.slug} />
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
