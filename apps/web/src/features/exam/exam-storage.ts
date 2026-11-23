import type { QuestionAnswer } from '@onlinedars/shared';
import type { AnswerMap } from '../practice/answers';

/**
 * Local autosave of in-progress exam answers (per attempt, this device only).
 * Every storage access is wrapped: private mode / blocked storage / quota errors must never
 * break the exam — the answers simply stay in memory.
 */
const PREFIX = 'od.exam.';

interface Stored {
  v: 1;
  savedAt: number;
  answers: QuestionAnswer[];
}

export function examStorageKey(attemptId: string): string {
  return `${PREFIX}${attemptId}`;
}

export function loadExamAnswers(attemptId: string): AnswerMap | null {
  try {
    const raw = window.localStorage.getItem(examStorageKey(attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed?.v !== 1 || !Array.isArray(parsed.answers)) return null;
    const map: AnswerMap = {};
    for (const a of parsed.answers) {
      if (a && typeof a.questionId === 'string') map[a.questionId] = a;
    }
    return map;
  } catch {
    return null;
  }
}

export function saveExamAnswers(attemptId: string, answers: AnswerMap): boolean {
  try {
    const data: Stored = { v: 1, savedAt: Date.now(), answers: Object.values(answers) };
    window.localStorage.setItem(examStorageKey(attemptId), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearExamAnswers(attemptId: string): void {
  try {
    window.localStorage.removeItem(examStorageKey(attemptId));
  } catch {
    // ignore
  }
}
