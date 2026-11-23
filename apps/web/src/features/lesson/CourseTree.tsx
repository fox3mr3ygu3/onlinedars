'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Circle,
  CircleDot,
  GraduationCap,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { learningApi } from '@/lib/api/learning';
import type { LessonNode, ModuleNode, StudentCourseTree } from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { cabinetRoutes, qk } from '../cabinet/routes';
import { ProgressBar, QueryBoundary } from '../cabinet/ui';

export function CourseTreeScreen({ courseId }: { courseId: string }) {
  const t = useTranslations('cabinet.tree');
  const query = useQuery({
    queryKey: qk.course(courseId),
    queryFn: () => learningApi.course(courseId),
  });
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={cabinetRoutes.courses}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('backToCourses')}
      </Link>
      <QueryBoundary query={query}>{(tree) => <CourseTree tree={tree} />}</QueryBoundary>
    </div>
  );
}

/** Course → modules → lessons with lock icons and progress (lock state comes from the server). */
export function CourseTree({ tree }: { tree: StudentCourseTree }) {
  const t = useTranslations('cabinet.tree');
  const { progress } = tree;

  return (
    <div className="space-y-6">
      <header className="bg-card space-y-3 rounded-xl border p-5">
        <h1 className="text-2xl font-semibold">{tree.title}</h1>
        <div className="flex items-center justify-between text-sm">
          <span>{t('progress')}</span>
          <span className="font-semibold">{Math.round(progress.percent)}%</span>
        </div>
        <ProgressBar value={progress.percent} label={t('progress')} />
        <p className="text-muted-foreground text-sm">
          {t('lessonsDone', { done: progress.completedLessons, total: progress.totalLessons })}
          {tree.sequentialUnlock ? ` · ${t('sequential')}` : ''}
        </p>
        {tree.nextLessonId ? (
          <Button asChild>
            <Link href={cabinetRoutes.lesson(tree.id, tree.nextLessonId)}>{t('continue')}</Link>
          </Button>
        ) : null}
      </header>

      <ol className="space-y-4">
        {tree.modules.map((m) => (
          <ModuleItem key={m.id} courseId={tree.id} module={m} />
        ))}
      </ol>

      <ExamCard tree={tree} />
    </div>
  );
}

function ModuleItem({ courseId, module: m }: { courseId: string; module: ModuleNode }) {
  const t = useTranslations('cabinet.tree');
  return (
    <li
      className={cn('bg-card rounded-xl border', m.isLocked && 'opacity-75')}
      data-testid={`module-${m.id}`}
      data-locked={m.isLocked}
    >
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <p className="text-muted-foreground text-xs">{t('module', { position: m.position })}</p>
          <h2 className="flex items-center gap-2 font-semibold">
            {m.isLocked ? <Lock className="size-4" aria-label={t('locked')} /> : null}
            {m.title}
          </h2>
          {m.description ? (
            <p className="text-muted-foreground mt-1 text-sm">{m.description}</p>
          ) : null}
        </div>
        <span className="text-muted-foreground shrink-0 text-sm">
          {t('moduleLessons', { done: m.completedLessons, total: m.totalLessons })}
        </span>
      </div>
      <ol className="divide-y">
        {m.lessons.map((l) => (
          <LessonRow key={l.id} courseId={courseId} lesson={l} moduleLocked={m.isLocked} />
        ))}
      </ol>
    </li>
  );
}

function LessonRow({
  courseId,
  lesson: l,
  moduleLocked,
}: {
  courseId: string;
  lesson: LessonNode;
  moduleLocked: boolean;
}) {
  const t = useTranslations('cabinet.tree');
  const locked = l.isLocked || moduleLocked;
  const status = locked
    ? 'locked'
    : l.isCompleted
      ? 'completed'
      : l.materialViewed || l.practicesPassed > 0
        ? 'inProgress'
        : 'notStarted';
  const Icon = { locked: Lock, completed: CheckCircle2, inProgress: CircleDot, notStarted: Circle }[
    status
  ];

  const content = (
    <>
      <Icon
        className={cn(
          'size-5 shrink-0',
          status === 'completed' && 'text-green-600',
          status === 'inProgress' && 'text-primary',
          status === 'locked' && 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{l.title}</span>
        <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
          <span>{t(status)}</span>
          <span>{t('practices', { passed: l.practicesPassed, total: l.practicesTotal })}</span>
          {l.durationMinutes ? <span>{t('duration', { minutes: l.durationMinutes })}</span> : null}
          {!l.isRequired ? <span>{t('optional')}</span> : null}
        </span>
      </span>
    </>
  );

  return (
    <li data-testid={`lesson-${l.id}`} data-locked={locked} data-status={status}>
      {locked ? (
        <div
          className="text-muted-foreground flex cursor-not-allowed items-center gap-3 p-4"
          aria-disabled="true"
          title={t('lockedHint')}
        >
          {content}
          <span className="sr-only">{t('lockedHint')}</span>
        </div>
      ) : (
        <Link
          href={cabinetRoutes.lesson(courseId, l.id)}
          className="hover:bg-accent flex items-center gap-3 p-4 transition-colors"
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function ExamCard({ tree }: { tree: StudentCourseTree }) {
  const t = useTranslations('cabinet.tree');
  if (!tree.exam.exists) return null;
  const { exam } = tree;
  return (
    <section
      className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-5"
      data-testid="exam-card"
      data-locked={exam.isLocked}
    >
      {exam.isLocked ? (
        <Lock className="text-muted-foreground size-6" aria-hidden="true" />
      ) : (
        <GraduationCap className="text-primary size-6" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{t('exam')}</h2>
        <p className="text-muted-foreground text-sm">
          {exam.passed ? t('examPassed') : exam.isLocked ? t('examLocked') : t('examOpen')}
        </p>
      </div>
      {tree.certificate ? (
        <Button asChild variant="outline">
          <Link href={cabinetRoutes.certificates}>
            <Award aria-hidden="true" />
            {t('certificate')}
          </Link>
        </Button>
      ) : null}
      {!exam.isLocked ? (
        <Button asChild>
          <Link href={cabinetRoutes.exam(tree.id)}>{t('goToExam')}</Link>
        </Button>
      ) : (
        <Button disabled aria-disabled="true">
          <Lock aria-hidden="true" />
          {t('locked')}
        </Button>
      )}
    </section>
  );
}
