/**
 * Pure lock / progress rules (CLAUDE.md rules 4, 5). No DB access, unit-tested.
 *
 * - Lesson complete = material viewed AND every required practice passed.
 * - Sequential unlock (per course): a lesson unlocks when every earlier required lesson
 *   (in module → lesson order) is complete. Optional lessons never block. The first lesson
 *   is always open. With sequentialUnlock off, everything is open.
 * - Course percent = completed required lessons / required lessons (all lessons if none are
 *   required), floored.
 * - The final exam unlocks when every required lesson is complete.
 */
import type { CourseProgress } from '@onlinedars/shared';

export interface TreeLesson {
  id: string;
  isRequired: boolean;
  /** LessonProgress.completedAt is set. */
  isCompleted: boolean;
}

export interface TreeModule {
  id: string;
  lessons: TreeLesson[];
}

export interface LockState {
  lessonLocked: Map<string, boolean>;
  moduleLocked: Map<string, boolean>;
}

/** Modules and lessons must already be sorted by position. */
export function computeLocks(modules: readonly TreeModule[], sequentialUnlock: boolean): LockState {
  const lessonLocked = new Map<string, boolean>();
  const moduleLocked = new Map<string, boolean>();
  let blocked = false;
  for (const m of modules) {
    for (const l of m.lessons) {
      lessonLocked.set(l.id, sequentialUnlock && blocked);
      if (l.isRequired && !l.isCompleted) blocked = true;
    }
    const anyOpen = m.lessons.some((l) => !lessonLocked.get(l.id));
    // A module without lessons is locked only if the previous content is still blocking.
    moduleLocked.set(m.id, m.lessons.length === 0 ? sequentialUnlock && blocked : !anyOpen);
  }
  return { lessonLocked, moduleLocked };
}

export function computeCourseProgress(lessons: readonly TreeLesson[]): CourseProgress {
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((l) => l.isCompleted).length;
  const required = lessons.filter((l) => l.isRequired);
  const totalRequired = required.length;
  const completedRequired = required.filter((l) => l.isCompleted).length;
  const [num, den] =
    totalRequired > 0 ? [completedRequired, totalRequired] : [completedLessons, totalLessons];
  const percent = den === 0 ? 0 : Math.floor((num * 100) / den);
  return { completedLessons, totalLessons, completedRequired, totalRequired, percent };
}

/** Exam gate: all required lessons complete (vacuously true for a course without them). */
export function isExamUnlocked(lessons: readonly TreeLesson[]): boolean {
  return lessons.filter((l) => l.isRequired).every((l) => l.isCompleted);
}

/** First unlocked, not completed lesson in order (where the student should continue). */
export function nextLessonId(modules: readonly TreeModule[], locks: LockState): string | null {
  for (const m of modules) {
    for (const l of m.lessons) {
      if (!l.isCompleted && !locks.lessonLocked.get(l.id)) return l.id;
    }
  }
  return null;
}

export interface PracticeOutcome {
  isRequired: boolean;
  passed: boolean;
}

/** Practice passed when percent ≥ passScore (passScore 0 = any submission passes). */
export function isPracticePassed(percent: number, passScore: number): boolean {
  return percent >= passScore;
}

export function isLessonComplete(
  materialViewed: boolean,
  practices: readonly PracticeOutcome[],
): boolean {
  return materialViewed && practices.filter((p) => p.isRequired).every((p) => p.passed);
}

export function flattenLessons(modules: readonly TreeModule[]): TreeLesson[] {
  return modules.flatMap((m) => m.lessons);
}
