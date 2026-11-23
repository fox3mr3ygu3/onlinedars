/**
 * Maps stored questions to what a student may see before submitting (CLAUDE.md rule 9):
 * no `isCorrect`, no MATCHING pairs (targets are shuffled separately), no FILL_BLANK answers.
 */
import { randomInt } from 'node:crypto';
import { blankIndexesIn, type PublicQuestion, QuestionType } from '@onlinedars/shared';

export interface StoredOption {
  id: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  matchText: string | null;
  blankIndex: number | null;
  position: number;
}

export interface StoredQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  explanation: string | null;
  isMultiple: boolean;
  points: number;
  position: number;
  options: StoredOption[];
}

/** Fisher–Yates with a CSPRNG (order must not leak the answer). Returns a new array. */
export function shuffle<T>(items: readonly T[], rand: (max: number) => number = randomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function toPublicQuestion(q: StoredQuestion): PublicQuestion {
  const options = [...q.options].sort((a, b) => a.position - b.position);
  const base = {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    isMultiple: q.type === QuestionType.TRUE_FALSE ? false : q.isMultiple,
    points: q.points,
  };
  switch (q.type) {
    case QuestionType.MATCHING:
      return {
        ...base,
        options: options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
        matchTargets: shuffle(
          options.map((o) => o.matchText).filter((t): t is string => t != null),
        ),
      };
    case QuestionType.FILL_BLANK:
      // Options of a FILL_BLANK question ARE the accepted answers — never send them.
      return { ...base, options: [], blankCount: blankIndexesIn(q.prompt).length };
    default:
      return {
        ...base,
        options: options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
      };
  }
}

/** Prisma `select` for questions with everything grading needs. */
export const questionWithOptionsSelect = {
  id: true,
  type: true,
  prompt: true,
  imageUrl: true,
  explanation: true,
  isMultiple: true,
  points: true,
  position: true,
  options: {
    select: {
      id: true,
      text: true,
      imageUrl: true,
      isCorrect: true,
      matchText: true,
      blankIndex: true,
      position: true,
    },
    orderBy: { position: 'asc' as const },
  },
} as const;
