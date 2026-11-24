'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { learningApi } from '@/lib/api/learning';
import type { PracticeSummary, StudentLessonView } from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { cabinetRoutes, qk } from '../cabinet/routes';
import { EmptyState, ProgressBar, useErrorMessage } from '../cabinet/ui';
import { LessonMaterial } from './LessonMaterials';

/** Minimum time on the page before reaching the end of the material counts as "viewed". */
export const AUTO_VIEW_DWELL_MS = 5_000;

/**
 * Lesson body. `stageMaterialId` is a video already shown on the player stage, so it is not
 * repeated among the materials.
 */
export function LessonView({
  lesson,
  stageMaterialId,
}: {
  lesson: StudentLessonView;
  stageMaterialId?: string | null;
}) {
  const t = useTranslations('lesson');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const courseId = lesson.courseId;
  const viewed = lesson.progress.materialViewed;
  const sentinel = useRef<HTMLDivElement>(null);
  const requested = useRef(false);

  const markViewed = useMutation({
    mutationFn: () => learningApi.markViewed(lesson.id),
    onSuccess: (res) => {
      queryClient.setQueryData<StudentLessonView>(qk.lesson(lesson.id), (prev) =>
        prev ? { ...prev, progress: res.lesson } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: qk.course(courseId) });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
    onError: (e) => {
      requested.current = false;
      toast.error(errorMessage(e));
    },
  });

  const mark = markViewed.mutate;
  // Auto-mark once the student reaches the end of the material after a short dwell time.
  useEffect(() => {
    if (viewed || typeof IntersectionObserver === 'undefined' || !sentinel.current) return;
    const openedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      if (requested.current) return;
      requested.current = true;
      mark();
    };
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      const wait = AUTO_VIEW_DWELL_MS - (Date.now() - openedAt);
      if (wait <= 0) fire();
      else timer = setTimeout(fire, wait);
    });
    io.observe(sentinel.current);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [viewed, mark]);

  const { progress } = lesson;
  const practices = [...lesson.practices].sort((a, b) => a.position - b.position);
  const materials = [...lesson.materials]
    .sort((a, b) => a.position - b.position)
    .filter((m) => m.id !== stageMaterialId);

  return (
    <article className="space-y-8">
      <header id="lesson-overview" className="scroll-mt-20">
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        {lesson.summary ? <p className="text-muted-foreground mt-1">{lesson.summary}</p> : null}
      </header>

      <section
        aria-labelledby="materials-title"
        className="bg-card space-y-6 rounded-xl border p-4 sm:p-6"
      >
        <h2 id="materials-title" className="sr-only">
          {t('materials')}
        </h2>
        {lesson.materials.length === 0 ? (
          <p className="text-muted-foreground">{t('noMaterials')}</p>
        ) : (
          materials.map((m) => <LessonMaterial key={m.id} material={m} />)
        )}
        <div ref={sentinel} aria-hidden="true" />
        <div className="border-t pt-4">
          {viewed ? (
            <p
              className="flex items-center gap-2 font-medium text-green-700"
              data-testid="material-viewed"
            >
              <CheckCircle2 className="size-5" aria-hidden="true" />
              {t('viewed')}
            </p>
          ) : (
            <Button
              onClick={() => {
                requested.current = true;
                markViewed.mutate();
              }}
              disabled={markViewed.isPending}
            >
              {markViewed.isPending ? t('markingViewed') : t('markViewed')}
            </Button>
          )}
        </div>
      </section>

      <section
        id="lesson-practices"
        aria-labelledby="practices-title"
        className="scroll-mt-20 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="practices-title" className="text-lg font-semibold">
            {t('practices')}
          </h2>
          <span className="text-muted-foreground text-sm">
            {t('progress', {
              passed: progress.passedRequiredPractices,
              total: progress.requiredPractices,
            })}
          </span>
        </div>
        <ProgressBar
          value={
            progress.requiredPractices
              ? (progress.passedRequiredPractices / progress.requiredPractices) * 100
              : 0
          }
          label={t('practices')}
        />
        {practices.length === 0 ? (
          <EmptyState>{t('noPractices')}</EmptyState>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2">
            {practices.map((p) => (
              <PracticeCard key={p.id} courseId={courseId} lessonId={lesson.id} practice={p} />
            ))}
          </ol>
        )}
      </section>

      <div
        role="status"
        className={cn(
          'rounded-xl border p-4',
          progress.isCompleted ? 'border-green-600/40 bg-green-50 text-green-800' : 'bg-card',
        )}
      >
        {progress.isCompleted ? t('completed') : t('completeHint')}
      </div>

      <nav className="flex justify-between gap-3">
        {lesson.prevLessonId ? (
          <Button asChild variant="outline">
            <Link href={cabinetRoutes.lesson(courseId, lesson.prevLessonId)}>
              <ChevronLeft aria-hidden="true" />
              {t('prev')}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {lesson.nextLessonId ? (
          <Button asChild variant="outline">
            <Link href={cabinetRoutes.lesson(courseId, lesson.nextLessonId)}>
              {t('next')}
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </nav>
    </article>
  );
}

function PracticeCard({
  courseId,
  lessonId,
  practice: p,
}: {
  courseId: string;
  lessonId: string;
  practice: PracticeSummary;
}) {
  const t = useTranslations('lesson');
  return (
    <li
      className={cn(
        'bg-card flex flex-col gap-2 rounded-xl border p-4',
        p.passed && 'border-green-600/40',
      )}
      data-testid={`practice-${p.id}`}
    >
      <div className="flex items-start gap-2">
        <ClipboardList className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <h3 className="flex-1 font-medium">{p.title}</h3>
        {p.passed ? (
          <CheckCircle2 className="size-5 text-green-600" aria-label={t('practicePassed')} />
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {t('practiceCount', { count: p.questionCount })}
        {p.isRequired ? ` · ${t('practiceRequired')}` : ''}
        {p.passScore > 0 ? ` · ${t('passScore', { score: p.passScore })}` : ''}
      </p>
      <p className="text-sm">
        {p.bestPercent !== null
          ? t('practiceBest', { percent: Math.round(p.bestPercent) })
          : t('practiceNotStarted')}
      </p>
      <Button
        asChild
        size="sm"
        variant={p.attempts > 0 ? 'outline' : 'default'}
        className="mt-auto self-start"
      >
        <Link href={cabinetRoutes.practice(courseId, lessonId, p.id)}>
          {p.attempts > 0 ? t('practiceRetry') : t('practiceStart')}
        </Link>
      </Button>
    </li>
  );
}
