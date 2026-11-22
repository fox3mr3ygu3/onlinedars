import { PRACTICES_PER_LESSON, QUESTIONS_PER_PRACTICE } from '@onlinedars/shared';
import type { Completeness } from '@/lib/api/admin/types';

/**
 * UI rules for the 4 × 6 invariant. The server enforces them too (and the DB has triggers);
 * these only drive counters and disabled states in the admin panel.
 */
export function canAddPractice(practiceCount: number, required = PRACTICES_PER_LESSON): boolean {
  return practiceCount < required;
}

export function canAddQuestion(questionCount: number, required = QUESTIONS_PER_PRACTICE): boolean {
  return questionCount < required;
}

export function questionsFor(c: Completeness | undefined, practiceId: string): number {
  return c?.questionsPerPractice.find((q) => q.practiceId === practiceId)?.questions ?? 0;
}

/** Publish is allowed only when the server says the lesson is complete. */
export function canPublish(c: Completeness | undefined): boolean {
  return !!c?.ready;
}

export type CounterState = 'complete' | 'incomplete' | 'over';

export function counterState(count: number, required: number): CounterState {
  if (count === required) return 'complete';
  return count > required ? 'over' : 'incomplete';
}

/** Total questions in a lesson vs the 24 required. */
export function lessonQuestionTotals(c: Completeness | undefined): { have: number; need: number } {
  const need = (c?.required ?? PRACTICES_PER_LESSON) * (c?.questionsRequired ?? QUESTIONS_PER_PRACTICE);
  const have = (c?.questionsPerPractice ?? []).reduce(
    (s, q) => s + Math.min(q.questions, c?.questionsRequired ?? QUESTIONS_PER_PRACTICE),
    0,
  );
  return { have, need };
}
