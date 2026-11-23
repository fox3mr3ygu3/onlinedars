/** Pure exam rules (CLAUDE.md rule 5): question draw, timing, attempts, pass. Unit-tested. */
import { randomInt } from 'node:crypto';
import { EXAM_SUBMIT_GRACE_SECONDS } from '@onlinedars/shared';
import { shuffle } from '../progress/grading/public-question';

/**
 * Picks `count` question ids from the pool (already sorted by position). With `randomize`
 * a uniform random subset in random order; otherwise the first `count` in position order.
 * A pool smaller than `count` yields the whole pool.
 */
export function drawQuestionIds(
  poolIds: readonly string[],
  count: number,
  randomize: boolean,
  rand: (max: number) => number = randomInt,
): string[] {
  const n = Math.max(0, Math.min(count, poolIds.length));
  return randomize ? shuffle(poolIds, rand).slice(0, n) : poolIds.slice(0, n);
}

export function computeExpiresAt(startedAt: Date, timeLimitMinutes: number): Date {
  return new Date(startedAt.getTime() + timeLimitMinutes * 60_000);
}

/** A submit is accepted until expiresAt + grace (network latency, slow clients). */
export function isWithinDeadline(
  now: Date,
  expiresAt: Date,
  graceSeconds: number = EXAM_SUBMIT_GRACE_SECONDS,
): boolean {
  return now.getTime() <= expiresAt.getTime() + graceSeconds * 1000;
}

/** null = unlimited. */
export function attemptsLeft(maxAttempts: number | null, used: number): number | null {
  if (maxAttempts == null) return null;
  return Math.max(0, maxAttempts - used);
}

export function isExamPassed(percent: number, passScore: number): boolean {
  return percent >= passScore;
}

/** Parses `ExamAttempt.questionIds` (Json) defensively. */
export function parseQuestionIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
