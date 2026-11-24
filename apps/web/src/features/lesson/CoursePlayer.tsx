'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  GraduationCap,
  Lock,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { learningApi } from '@/lib/api/learning';
import type {
  LessonNode,
  ModuleNode,
  StudentCourseTree,
  StudentLessonView,
} from '@/lib/api/learning-types';
import { cn } from '@/lib/utils';
import { cabinetRoutes, qk } from '../cabinet/routes';
import { ProgressBar, QueryBoundary } from '../cabinet/ui';
import { isPlayableVideo, LessonVideo } from './LessonMaterials';
import { LessonView } from './LessonScreen';
import {
  type LessonStatus,
  lessonStatus,
  moduleMinutes,
  moduleOfLesson,
  numberLessons,
  splitMinutes,
} from './player';

/**
 * Lesson page as a course player: the lesson (video stage + body) on the left and the
 * "course content" sidebar with every section and lesson on the right (below on mobile).
 * Lock and completion state come from the server; the sidebar only displays them.
 */
export function CoursePlayer({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const t = useTranslations('cabinet.player');
  const tl = useTranslations('lesson');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const lessonQuery = useQuery({
    queryKey: qk.lesson(lessonId),
    queryFn: () => learningApi.lesson(lessonId),
  });
  const treeQuery = useQuery({
    queryKey: qk.course(courseId),
    queryFn: () => learningApi.course(courseId),
  });

  return (
    <div className="flex flex-col lg:flex-row" data-testid="course-player">
      <div className="min-w-0 flex-1">
        <div className="flex min-h-11 items-center gap-3 bg-zinc-950 px-4 py-2 text-sm text-zinc-200">
          <Link
            href={cabinetRoutes.course(courseId)}
            className="inline-flex shrink-0 items-center gap-1 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {tl('back')}
          </Link>
          {treeQuery.data ? (
            <p className="min-w-0 flex-1 truncate border-l border-zinc-700 pl-3 font-medium text-white">
              {treeQuery.data.title}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          {!sidebarOpen ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-controls="course-content"
              aria-expanded={false}
              className="hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 hover:bg-zinc-800 hover:text-white lg:inline-flex"
            >
              <PanelRightOpen className="size-4" aria-hidden="true" />
              {t('open')}
            </button>
          ) : null}
        </div>
        <QueryBoundary query={lessonQuery}>
          {(lesson) => <PlayerBody lesson={lesson} />}
        </QueryBoundary>
      </div>

      <aside
        id="course-content"
        aria-labelledby="course-content-title"
        className={cn(
          'bg-background border-t lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-96 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0',
          !sidebarOpen && 'lg:hidden',
        )}
      >
        <div className="bg-background sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 id="course-content-title" className="font-semibold">
            {t('title')}
          </h2>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-controls="course-content"
            aria-expanded
            aria-label={t('close')}
            className="hover:bg-accent hidden rounded-md p-1.5 lg:inline-flex"
          >
            <PanelRightClose className="size-4" aria-hidden="true" />
          </button>
        </div>
        <QueryBoundary query={treeQuery}>
          {(tree) => <CourseContent tree={tree} currentLessonId={lessonId} />}
        </QueryBoundary>
      </aside>
    </div>
  );
}

function PlayerBody({ lesson }: { lesson: StudentLessonView }) {
  const t = useTranslations('cabinet.player');
  const stageVideo = useMemo(
    () => [...lesson.materials].sort((a, b) => a.position - b.position).find(isPlayableVideo),
    [lesson.materials],
  );
  const tabs = [
    { href: '#lesson-overview', label: t('tabOverview') },
    { href: '#lesson-practices', label: t('tabPractices') },
  ];

  return (
    <>
      {stageVideo ? (
        <div className="bg-zinc-950" data-testid="player-stage">
          <div className="mx-auto max-w-5xl">
            <LessonVideo material={stageVideo} />
          </div>
        </div>
      ) : null}
      <nav
        aria-label={t('sectionsNav')}
        className="bg-background sticky top-14 z-20 flex gap-1 overflow-x-auto border-b px-4"
      >
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="text-muted-foreground hover:text-foreground hover:border-foreground shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium"
          >
            {tab.label}
          </a>
        ))}
        <a
          href="#course-content"
          className="text-muted-foreground hover:text-foreground hover:border-foreground shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium lg:hidden"
        >
          {t('title')}
        </a>
      </nav>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <LessonView lesson={lesson} stageMaterialId={stageVideo?.id ?? null} />
      </div>
    </>
  );
}

function useDuration() {
  const t = useTranslations('cabinet.player');
  return (total: number) => {
    const { hours, minutes } = splitMinutes(total);
    if (hours && minutes) return t('hoursMinutes', { hours, minutes });
    if (hours) return t('hours', { hours });
    return t('minutes', { minutes });
  };
}

/** Sections (modules) with their lessons, the current lesson highlighted, and the exam row. */
export function CourseContent({
  tree,
  currentLessonId,
}: {
  tree: StudentCourseTree;
  currentLessonId: string;
}) {
  const t = useTranslations('cabinet.player');
  const numbers = useMemo(() => numberLessons(tree.modules), [tree.modules]);
  const currentModuleId = moduleOfLesson(tree.modules, currentLessonId);
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(currentModuleId ? [currentModuleId] : tree.modules.slice(0, 1).map((m) => m.id)),
  );
  const listRef = useRef<HTMLOListElement>(null);

  // Opening another lesson from the sidebar keeps its section expanded.
  useEffect(() => {
    if (!currentModuleId) return;
    setOpenIds((prev) => (prev.has(currentModuleId) ? prev : new Set(prev).add(currentModuleId)));
  }, [currentModuleId]);

  // On desktop, bring the current lesson into view inside the scrolling sidebar.
  useEffect(() => {
    const scroller = listRef.current?.closest('aside');
    const row = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !row || !window.matchMedia?.('(min-width: 1024px)').matches) return;
    const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (top < 0 || top > scroller.clientHeight - row.offsetHeight) {
      scroller.scrollTop += top - scroller.clientHeight / 3;
    }
  }, [currentLessonId]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="space-y-2 border-b px-4 py-3">
        <ProgressBar value={tree.progress.percent} label={t('progressLabel')} />
        <p className="text-muted-foreground text-xs">
          {t('progress', {
            percent: Math.round(tree.progress.percent),
            done: tree.progress.completedLessons,
            total: tree.progress.totalLessons,
          })}
        </p>
      </div>
      <ol ref={listRef}>
        {tree.modules.map((m) => (
          <SectionItem
            key={m.id}
            courseId={tree.id}
            module={m}
            open={openIds.has(m.id)}
            onToggle={() => toggle(m.id)}
            numbers={numbers}
            currentLessonId={currentLessonId}
          />
        ))}
      </ol>
      {tree.exam.exists ? <ExamRow tree={tree} /> : null}
    </div>
  );
}

function SectionItem({
  courseId,
  module: m,
  open,
  onToggle,
  numbers,
  currentLessonId,
}: {
  courseId: string;
  module: ModuleNode;
  open: boolean;
  onToggle: () => void;
  numbers: Map<string, number>;
  currentLessonId: string;
}) {
  const t = useTranslations('cabinet.player');
  const duration = useDuration();
  const minutes = moduleMinutes(m);
  const panelId = `section-${m.id}`;
  return (
    <li className="border-b" data-testid={`player-section-${m.id}`}>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="bg-muted/50 hover:bg-muted flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {t('section', { position: m.position, title: m.title })}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              {t('sectionLessons', { done: m.completedLessons, total: m.totalLessons })}
              {minutes > 0 ? ` | ${duration(minutes)}` : ''}
            </span>
          </span>
          {m.isLocked ? (
            <Lock className="text-muted-foreground mt-0.5 size-4" aria-label={t('locked')} />
          ) : null}
          <ChevronDown
            className={cn('mt-0.5 size-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h3>
      {open ? (
        <ol id={panelId}>
          {m.lessons.map((l) => (
            <LessonItem
              key={l.id}
              courseId={courseId}
              lesson={l}
              number={numbers.get(l.id) ?? l.position}
              moduleLocked={m.isLocked}
              current={l.id === currentLessonId}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function StatusBox({ status }: { status: LessonStatus }) {
  if (status === 'locked') {
    return <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border-2',
        status === 'completed'
          ? 'border-primary bg-primary text-primary-foreground'
          : status === 'inProgress'
            ? 'border-primary'
            : 'border-muted-foreground/60',
      )}
    >
      {status === 'completed' ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function LessonItem({
  courseId,
  lesson: l,
  number,
  moduleLocked,
  current,
}: {
  courseId: string;
  lesson: LessonNode;
  number: number;
  moduleLocked: boolean;
  current: boolean;
}) {
  const t = useTranslations('cabinet.player');
  const tt = useTranslations('cabinet.tree');
  const duration = useDuration();
  const status = lessonStatus(l, moduleLocked);

  const content = (
    <>
      <StatusBox status={status} />
      <span className="min-w-0 flex-1">
        <span className="block">
          {number}. {l.title}
        </span>
        <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {l.durationMinutes ? (
            <span className="inline-flex items-center gap-1">
              <MonitorPlay className="size-3.5" aria-hidden="true" />
              {duration(l.durationMinutes)}
            </span>
          ) : null}
          <span>
            {t('lessonPractices', { passed: l.practicesPassed, total: l.practicesTotal })}
          </span>
          {!l.isRequired ? <span>{tt('optional')}</span> : null}
          <span className="sr-only">{tt(status)}</span>
        </span>
      </span>
    </>
  );

  return (
    <li data-testid={`player-lesson-${l.id}`} data-status={status} data-current={current}>
      {status === 'locked' ? (
        <div
          className="text-muted-foreground flex cursor-not-allowed items-start gap-3 px-4 py-3 text-sm"
          aria-disabled="true"
          title={tt('lockedHint')}
        >
          {content}
        </div>
      ) : (
        <Link
          href={cabinetRoutes.lesson(courseId, l.id)}
          aria-current={current ? 'page' : undefined}
          className={cn(
            'hover:bg-accent flex items-start gap-3 px-4 py-3 text-sm transition-colors',
            current && 'bg-primary/10 hover:bg-primary/15 font-medium',
          )}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function ExamRow({ tree }: { tree: StudentCourseTree }) {
  const tt = useTranslations('cabinet.tree');
  const { exam } = tree;
  const content = (
    <>
      {exam.isLocked ? (
        <Lock className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
      ) : (
        <GraduationCap className="text-primary size-5 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{tt('exam')}</span>
        <span className="text-muted-foreground block text-xs">
          {exam.passed ? tt('examPassed') : exam.isLocked ? tt('examLocked') : tt('examOpen')}
        </span>
      </span>
    </>
  );
  return exam.isLocked ? (
    <div
      className="text-muted-foreground flex items-center gap-3 px-4 py-4 text-sm"
      data-testid="player-exam"
      data-locked="true"
    >
      {content}
    </div>
  ) : (
    <Link
      href={cabinetRoutes.exam(tree.id)}
      className="hover:bg-accent flex items-center gap-3 px-4 py-4 text-sm transition-colors"
      data-testid="player-exam"
      data-locked="false"
    >
      {content}
    </Link>
  );
}
