import { ErrorCode } from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import {
  assertSamePermutation,
  computeCompleteness,
  listOf,
  nextPosition,
  rethrowContentError,
  triggerErrorCode,
  unpublishLessonIfPublished,
} from './content.utils';
import { createPrismaMock, errorOf } from './testing/prisma-mock';

const known = (code: string, message = 'x', meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.3', meta });
const unknown = (message: string) =>
  new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: '6.19.3' });

const practices = (counts: number[]) =>
  counts.map((n, i) => ({
    id: `p${i + 1}`,
    title: `P${i + 1}`,
    position: i + 1,
    _count: { questions: n },
  }));

describe('triggerErrorCode (DB 4×6 triggers → ErrorCode)', () => {
  it.each([
    [
      'LESSON_PRACTICE_LIMIT',
      'db error: ERROR: LESSON_PRACTICE_LIMIT: lesson c1 already has 4 practices',
    ],
    [
      'PRACTICE_QUESTION_LIMIT',
      'ERROR: PRACTICE_QUESTION_LIMIT: practice c2 already has 6 questions',
    ],
    ['LESSON_INCOMPLETE', 'LESSON_INCOMPLETE: lesson c3 needs 4 practices x 6 questions'],
  ])('maps %s from an unknown request error', (code, message) => {
    expect(triggerErrorCode(unknown(message))).toBe(code);
  });

  it('reads the database message from a known error meta (P2010 raw query failed)', () => {
    const e = known('P2010', 'Raw query failed', {
      message: 'ERROR: LESSON_PRACTICE_LIMIT: lesson x already has 4 practices',
    });
    expect(triggerErrorCode(e)).toBe(ErrorCode.LESSON_PRACTICE_LIMIT);
  });

  it('ignores unrelated errors', () => {
    expect(triggerErrorCode(new Error('connection reset'))).toBeNull();
    expect(triggerErrorCode(undefined)).toBeNull();
  });
});

describe('rethrowContentError', () => {
  it('turns a trigger violation into 409 with the same code', async () => {
    const e = await errorOf(() =>
      rethrowContentError(unknown('PRACTICE_QUESTION_LIMIT: practice p already has 6 questions')),
    );
    expect(e).toBeInstanceOf(AppException);
    expect(e.code).toBe(ErrorCode.PRACTICE_QUESTION_LIMIT);
    expect(e.getStatus?.()).toBe(409);
  });

  it('maps unique slug → SLUG_TAKEN, other unique → CONFLICT', async () => {
    expect(
      (await errorOf(() => rethrowContentError(known('P2002', 'u', { target: ['slug'] })))).code,
    ).toBe(ErrorCode.SLUG_TAKEN);
    expect(
      (await errorOf(() => rethrowContentError(known('P2002', 'u', { target: ['email'] })))).code,
    ).toBe(ErrorCode.CONFLICT);
  });

  it('maps not found and foreign key errors', async () => {
    const nf = await errorOf(() => rethrowContentError(known('P2025')));
    expect(nf.code).toBe(ErrorCode.NOT_FOUND);
    expect(nf.getStatus?.()).toBe(404);
    const fk = await errorOf(() =>
      rethrowContentError(known('P2003', 'fk', { field_name: 'directionId' })),
    );
    expect(fk.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(fk.getStatus?.()).toBe(400);
  });

  it('rethrows AppExceptions and unknown errors unchanged', async () => {
    const app = AppException.forbidden();
    expect(await errorOf(() => rethrowContentError(app))).toBe(app);
    const other = new Error('boom');
    expect(await errorOf(() => rethrowContentError(other))).toBe(other);
  });
});

describe('computeCompleteness (4×6 rule)', () => {
  it('is ready only with exactly 4 practices × 6 questions', () => {
    const c = computeCompleteness({
      id: 'l1',
      isPublished: false,
      practices: practices([6, 6, 6, 6]),
    });
    expect(c).toMatchObject({
      lessonId: 'l1',
      practices: 4,
      required: 4,
      questionsRequired: 6,
      totalQuestions: 24,
      ready: true,
    });
    expect(c.questionsPerPractice.every((p) => p.ready && p.required === 6)).toBe(true);
  });

  it.each([[[6, 6, 6]], [[6, 6, 6, 5]], [[]], [[6, 6, 6, 0]]])('is not ready for %j', (counts) => {
    const c = computeCompleteness({ id: 'l', isPublished: false, practices: practices(counts) });
    expect(c.ready).toBe(false);
    expect(c.practices).toBe(counts.length);
  });

  it('reports per-practice counters in position order', () => {
    const rows = practices([6, 3]).reverse();
    const c = computeCompleteness({ id: 'l', isPublished: true, practices: rows });
    expect(c.questionsPerPractice.map((p) => [p.position, p.questions, p.ready])).toEqual([
      [1, 6, true],
      [2, 3, false],
    ]);
    expect(c.isPublished).toBe(true);
  });
});

describe('small helpers', () => {
  it('assertSamePermutation accepts a permutation and rejects anything else', async () => {
    expect(() => assertSamePermutation(['a', 'b', 'c'], ['c', 'a', 'b'])).not.toThrow();
    for (const ids of [
      ['a', 'b'],
      ['a', 'b', 'b'],
      ['a', 'b', 'x'],
      ['a', 'b', 'c', 'd'],
    ]) {
      const e = await errorOf(() => assertSamePermutation(['a', 'b', 'c'], ids));
      expect(e.code).toBe(ErrorCode.REORDER_MISMATCH);
    }
  });

  it('nextPosition appends after the max', () => {
    expect(nextPosition(null)).toBe(1);
    expect(nextPosition(4)).toBe(5);
  });

  it('listOf wraps items in the list envelope', () => {
    expect(listOf([1, 2])).toEqual({ items: [1, 2], total: 2, page: 1, pageSize: 2 });
  });

  it('unpublishLessonIfPublished only touches a published lesson', async () => {
    const prisma = createPrismaMock();
    prisma.lesson.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await unpublishLessonIfPublished(prisma as never, 'l1')).toBe(true);
    expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
      where: { id: 'l1', isPublished: true },
      data: { isPublished: false, publishedAt: null },
    });
    prisma.lesson.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await unpublishLessonIfPublished(prisma as never, 'l1')).toBe(false);
  });
});
