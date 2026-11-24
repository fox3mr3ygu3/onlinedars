import type { LessonNode, ModuleNode } from '@/lib/api/learning-types';

/** Whole-hours / leftover-minutes split for "1 soat 32 daq" style labels. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/** Sum of the lessons' durations; lessons without a duration count as 0. */
export function moduleMinutes(module: Pick<ModuleNode, 'lessons'>): number {
  return module.lessons.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);
}

/** Course-wide lesson numbers (1, 2, 3 … across modules), in the order the server sends them. */
export function numberLessons(modules: Pick<ModuleNode, 'lessons'>[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 0;
  for (const m of modules) for (const l of m.lessons) numbers.set(l.id, ++n);
  return numbers;
}

/** Id of the module that contains the lesson, or null if it is not in the tree. */
export function moduleOfLesson(
  modules: Pick<ModuleNode, 'id' | 'lessons'>[],
  lessonId: string,
): string | null {
  return modules.find((m) => m.lessons.some((l) => l.id === lessonId))?.id ?? null;
}

export type LessonStatus = 'locked' | 'completed' | 'inProgress' | 'notStarted';

export function lessonStatus(
  lesson: Pick<LessonNode, 'isLocked' | 'isCompleted' | 'materialViewed' | 'practicesPassed'>,
  moduleLocked: boolean,
): LessonStatus {
  if (lesson.isLocked || moduleLocked) return 'locked';
  if (lesson.isCompleted) return 'completed';
  if (lesson.materialViewed || lesson.practicesPassed > 0) return 'inProgress';
  return 'notStarted';
}

/** The lesson page is a full-width player (no cabinet side nav); practice/exam pages are not. */
export function isPlayerRoute(pathname: string): boolean {
  return /^\/cabinet\/courses\/[^/]+\/lessons\/[^/]+\/?$/.test(pathname);
}
