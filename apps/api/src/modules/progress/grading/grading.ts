/**
 * Server-side grading for all question types (CLAUDE.md rules 3, 5, 9). Pure functions, no DB.
 * Used by practices (progress module) and final exams (exams module).
 *
 * Scoring is all-or-nothing per question: full `points` when the answer is exactly right,
 * otherwise 0. Multi-select needs exactly the set of correct options (no extra, none missing).
 */
import {
  blankIndexesIn,
  type CorrectAnswer,
  type GradedQuestion,
  type QuestionAnswer,
  QuestionType,
} from '@onlinedars/shared';

export interface GradableOption {
  id: string;
  text: string;
  isCorrect: boolean;
  matchText: string | null;
  blankIndex: number | null;
}

export interface GradableQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  isMultiple: boolean;
  points: number;
  options: GradableOption[];
}

/** Apostrophe-like characters Uzbek Latin texts use interchangeably (o‘, oʻ, o’, o`). */
const APOSTROPHES = /[‘’ʻʼ`´]/g;

/**
 * Normalises free-text answers: Unicode NFC, unify apostrophes, trim, collapse whitespace,
 * lower-case. "  Box   Model " and "box model" compare equal.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

function gradeChoice(q: GradableQuestion, answer: QuestionAnswer | undefined): boolean {
  const selected = [...new Set(answer?.selectedOptionIds ?? [])];
  if (selected.length === 0) return false;
  const validIds = new Set(q.options.map((o) => o.id));
  if (selected.some((id) => !validIds.has(id))) return false;
  const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id);
  if (correct.length === 0) return false;
  const single = q.type === QuestionType.TRUE_FALSE || !q.isMultiple;
  if (single && selected.length !== 1) return false;
  return sameSet(selected, correct);
}

function gradeMatching(q: GradableQuestion, answer: QuestionAnswer | undefined): boolean {
  const pairs = q.options.filter((o) => o.matchText != null);
  if (pairs.length === 0) return false;
  const given = new Map<string, string>();
  for (const m of answer?.matches ?? []) {
    if (given.has(m.optionId)) return false; // one option matched twice — ambiguous
    given.set(m.optionId, m.matchText);
  }
  return pairs.every((o) => {
    const chosen = given.get(o.id);
    return chosen != null && normalizeText(chosen) === normalizeText(o.matchText ?? '');
  });
}

/** Blank indexes used by the question: from the prompt, falling back to the options. */
function blankIndexes(q: GradableQuestion): number[] {
  const fromPrompt = blankIndexesIn(q.prompt);
  if (fromPrompt.length > 0) return fromPrompt;
  const fromOptions = q.options.map((o) => o.blankIndex).filter((b): b is number => b != null);
  return [...new Set(fromOptions)].sort((a, b) => a - b);
}

function acceptedByBlank(q: GradableQuestion): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const o of q.options) {
    if (o.blankIndex == null) continue;
    const list = map.get(o.blankIndex) ?? [];
    list.push(o.text);
    map.set(o.blankIndex, list);
  }
  return map;
}

function gradeFillBlank(q: GradableQuestion, answer: QuestionAnswer | undefined): boolean {
  const indexes = blankIndexes(q);
  if (indexes.length === 0) return false;
  const accepted = acceptedByBlank(q);
  const blanks = answer?.blanks ?? [];
  return indexes.every((idx) => {
    const given = blanks[idx];
    if (given == null || normalizeText(given) === '') return false;
    const ok = (accepted.get(idx) ?? []).map(normalizeText);
    return ok.includes(normalizeText(given));
  });
}

/** True when `answer` is exactly right for `q`. */
export function isAnswerCorrect(q: GradableQuestion, answer: QuestionAnswer | undefined): boolean {
  switch (q.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.TRUE_FALSE:
    case QuestionType.IMAGE_BASED:
      return gradeChoice(q, answer);
    case QuestionType.MATCHING:
      return gradeMatching(q, answer);
    case QuestionType.FILL_BLANK:
      return gradeFillBlank(q, answer);
    default:
      return false;
  }
}

export function gradeQuestion(
  q: GradableQuestion,
  answer: QuestionAnswer | undefined,
): GradedQuestion {
  const isCorrect = isAnswerCorrect(q, answer);
  return {
    questionId: q.id,
    type: q.type,
    isCorrect,
    pointsAwarded: isCorrect ? q.points : 0,
    points: q.points,
  };
}

export interface GradeSummary {
  questions: GradedQuestion[];
  score: number;
  maxScore: number;
  correctCount: number;
  totalCount: number;
  /** floor(score / maxScore × 100); 0 when maxScore is 0. */
  percent: number;
}

export function percentOf(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.floor((score * 100) / maxScore);
}

/** Indexes answers by questionId; the last answer for a question wins; unknown ids are dropped. */
export function indexAnswers(
  questions: readonly { id: string }[],
  answers: readonly QuestionAnswer[],
): Map<string, QuestionAnswer> {
  const ids = new Set(questions.map((q) => q.id));
  const map = new Map<string, QuestionAnswer>();
  for (const a of answers) if (ids.has(a.questionId)) map.set(a.questionId, a);
  return map;
}

/** Grades every question; unanswered questions count as wrong. */
export function gradeAll(
  questions: readonly GradableQuestion[],
  answers: readonly QuestionAnswer[],
): GradeSummary {
  const byId = indexAnswers(questions, answers);
  const graded = questions.map((q) => gradeQuestion(q, byId.get(q.id)));
  const score = graded.reduce((s, g) => s + g.pointsAwarded, 0);
  const maxScore = graded.reduce((s, g) => s + g.points, 0);
  return {
    questions: graded,
    score,
    maxScore,
    correctCount: graded.filter((g) => g.isCorrect).length,
    totalCount: graded.length,
    percent: percentOf(score, maxScore),
  };
}

/** The correct answer, revealed to the student only after submitting (practices only). */
export function correctAnswerOf(q: GradableQuestion): CorrectAnswer {
  switch (q.type) {
    case QuestionType.MATCHING:
      return {
        matches: q.options
          .filter((o) => o.matchText != null)
          .map((o) => ({ optionId: o.id, matchText: o.matchText as string })),
      };
    case QuestionType.FILL_BLANK: {
      const accepted = acceptedByBlank(q);
      return { blanks: blankIndexes(q).map((idx) => accepted.get(idx) ?? []) };
    }
    default:
      return { selectedOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id) };
  }
}
