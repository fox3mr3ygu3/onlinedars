import { EXAM_SUBMIT_GRACE_SECONDS } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import {
  attemptsLeft,
  computeExpiresAt,
  drawQuestionIds,
  isExamPassed,
  isWithinDeadline,
  parseQuestionIds,
} from './exam.logic';

describe('drawQuestionIds', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  it('takes the first N in order when not shuffling', () => {
    expect(drawQuestionIds(pool, 3, false)).toEqual(['a', 'b', 'c']);
  });
  it('takes a random distinct subset of size N when shuffling', () => {
    const ids = drawQuestionIds(pool, 3, true);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(pool).toContain(id));
  });
  it('a pool smaller than N yields the whole pool', () => {
    expect(drawQuestionIds(['a', 'b'], 10, false)).toEqual(['a', 'b']);
    expect(drawQuestionIds([], 10, true)).toEqual([]);
  });
});

describe('timing (server-side)', () => {
  const start = new Date('2026-11-23T10:00:00Z');
  const expires = computeExpiresAt(start, 20);

  it('expiresAt = start + time limit', () => {
    expect(expires.toISOString()).toBe('2026-11-23T10:20:00.000Z');
  });
  it('accepts submit before the deadline and within the grace period', () => {
    expect(isWithinDeadline(new Date('2026-11-23T10:19:59Z'), expires)).toBe(true);
    expect(
      isWithinDeadline(new Date(expires.getTime() + EXAM_SUBMIT_GRACE_SECONDS * 1000), expires),
    ).toBe(true);
  });
  it('rejects submit after deadline + grace', () => {
    expect(
      isWithinDeadline(new Date(expires.getTime() + EXAM_SUBMIT_GRACE_SECONDS * 1000 + 1), expires),
    ).toBe(false);
    expect(isWithinDeadline(new Date('2026-11-23T11:00:00Z'), expires)).toBe(false);
  });
  it('grace is small (≤ 60 s)', () => {
    expect(EXAM_SUBMIT_GRACE_SECONDS).toBeGreaterThan(0);
    expect(EXAM_SUBMIT_GRACE_SECONDS).toBeLessThanOrEqual(60);
  });
});

describe('attempts and pass', () => {
  it('attemptsLeft', () => {
    expect(attemptsLeft(null, 99)).toBeNull();
    expect(attemptsLeft(3, 1)).toBe(2);
    expect(attemptsLeft(3, 5)).toBe(0);
  });
  it('isExamPassed: percent >= passScore', () => {
    expect(isExamPassed(59, 60)).toBe(false);
    expect(isExamPassed(60, 60)).toBe(true);
  });
  it('parseQuestionIds is defensive', () => {
    expect(parseQuestionIds(['a', 1, 'b'])).toEqual(['a', 'b']);
    expect(parseQuestionIds(null)).toEqual([]);
  });
});
