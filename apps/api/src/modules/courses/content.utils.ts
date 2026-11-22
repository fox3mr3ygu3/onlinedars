/**
 * Helpers shared by the content modules (courses, modules, lessons, practices, questions,
 * directions, teachers, faq): Prisma/DB-trigger error mapping, list envelopes, reorder checks,
 * and the 4×6 completeness calculation.
 */
import { HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  type LessonCompletenessResponse,
  type Paginated,
  PRACTICES_PER_LESSON,
  QUESTIONS_PER_PRACTICE,
} from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';

/** Error codes raised by the 4×6 triggers in migration 0001_init (message prefix). */
const TRIGGER_CODES = [
  ErrorCode.LESSON_PRACTICE_LIMIT,
  ErrorCode.PRACTICE_QUESTION_LIMIT,
  ErrorCode.LESSON_INCOMPLETE,
] as const;

function errorText(e: unknown): string {
  if (!e || typeof e !== 'object') return '';
  const parts: string[] = [];
  const err = e as { message?: unknown; meta?: unknown };
  if (typeof err.message === 'string') parts.push(err.message);
  if (err.meta && typeof err.meta === 'object') {
    for (const v of Object.values(err.meta as Record<string, unknown>)) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  return parts.join(' ');
}

/**
 * Maps a Postgres `check_violation` raised by a 4×6 trigger to its ErrorCode, or null.
 * Prisma surfaces trigger errors as Known/Unknown request errors whose message contains
 * the RAISE text, e.g. "LESSON_PRACTICE_LIMIT: lesson … already has 4 practices".
 */
export function triggerErrorCode(e: unknown): (typeof TRIGGER_CODES)[number] | null {
  const text = errorText(e);
  if (!text) return null;
  for (const code of TRIGGER_CODES) {
    if (new RegExp(`\\b${code}:`).test(text)) return code;
  }
  return null;
}

/**
 * Converts known database errors into AppExceptions and rethrows everything else unchanged.
 * - 4×6 trigger violations → 409 with the same ErrorCode
 * - P2002 unique violation on `slug` → 409 SLUG_TAKEN, other unique → 409 CONFLICT
 * - P2025 record not found → 404 NOT_FOUND
 * - P2003 foreign key → 400 VALIDATION_FAILED (e.g. unknown directionId)
 */
export function rethrowContentError(e: unknown): never {
  if (e instanceof AppException) throw e;
  const code = triggerErrorCode(e);
  if (code) throw new AppException(code, HttpStatus.CONFLICT);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const target = (e.meta?.target ?? []) as string[] | string;
      const fields = Array.isArray(target) ? target : [target];
      if (fields.some((f) => String(f).includes('slug'))) {
        throw AppException.conflict(ErrorCode.SLUG_TAKEN);
      }
      throw AppException.conflict();
    }
    if (e.code === 'P2025') throw AppException.notFound();
    if (e.code === 'P2003') {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Referenced record not found', {
        field: e.meta?.field_name,
      });
    }
  }
  throw e;
}

/** Wraps an async operation so DB errors come out as AppExceptions. */
export async function withContentErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    rethrowContentError(e);
  }
}

/** Unpaginated child lists still use the shared list envelope. */
export function listOf<T>(items: T[]): Paginated<T> {
  return { items, total: items.length, page: 1, pageSize: Math.max(items.length, 1) };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize };
}

/** Throws REORDER_MISMATCH unless `ids` is exactly a permutation of `currentIds`. */
export function assertSamePermutation(currentIds: string[], ids: string[]): void {
  const unique = new Set(ids);
  const same =
    unique.size === ids.length &&
    ids.length === currentIds.length &&
    currentIds.every((id) => unique.has(id));
  if (!same) {
    throw AppException.badRequest(
      ErrorCode.REORDER_MISMATCH,
      'ids must list every child exactly once',
    );
  }
}

/** Next 1-based position after the current maximum. */
export function nextPosition(max: number | null | undefined): number {
  return (max ?? 0) + 1;
}

export interface PracticeCountRow {
  id: string;
  title: string;
  position: number;
  _count: { questions: number };
}

/** The 4×6 rule as data: exactly 4 practices, each with exactly 6 questions. */
export function computeCompleteness(lesson: {
  id: string;
  isPublished: boolean;
  practices: PracticeCountRow[];
}): LessonCompletenessResponse {
  const practices = [...lesson.practices].sort((a, b) => a.position - b.position);
  const questionsPerPractice = practices.map((p) => ({
    practiceId: p.id,
    title: p.title,
    position: p.position,
    questions: p._count.questions,
    required: QUESTIONS_PER_PRACTICE,
    ready: p._count.questions === QUESTIONS_PER_PRACTICE,
  }));
  return {
    lessonId: lesson.id,
    isPublished: lesson.isPublished,
    practices: practices.length,
    required: PRACTICES_PER_LESSON,
    questionsRequired: QUESTIONS_PER_PRACTICE,
    questionsPerPractice,
    totalQuestions: questionsPerPractice.reduce((s, p) => s + p.questions, 0),
    ready:
      practices.length === PRACTICES_PER_LESSON && questionsPerPractice.every((p) => p.ready),
  };
}

/** Prisma `select` that loads what computeCompleteness needs. */
export const completenessSelect = {
  id: true,
  isPublished: true,
  practices: {
    select: { id: true, title: true, position: true, _count: { select: { questions: true } } },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.LessonSelect;

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
