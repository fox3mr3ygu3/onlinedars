import {
  type AdminQuestion,
  blankIndexesIn,
  type PublicQuestion,
  QuestionType,
} from '@onlinedars/shared';
import type { Question, QuestionOption } from '@prisma/client';

export type QuestionRow = Question & { options: QuestionOption[] };

export const questionInclude = { options: { orderBy: { position: 'asc' } } } as const;

/** Admin view: includes correct answers. Only for ADMIN / CONTENT_MANAGER routes. */
export function toAdminQuestion(q: QuestionRow): AdminQuestion {
  return {
    id: q.id,
    practiceId: q.practiceId,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    explanation: q.explanation,
    isMultiple: q.isMultiple,
    points: q.points,
    position: q.position,
    options: [...q.options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        text: o.text,
        imageUrl: o.imageUrl,
        isCorrect: o.isCorrect,
        matchText: o.matchText,
        blankIndex: o.blankIndex,
        position: o.position,
      })),
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Student view **before submission** (CLAUDE.md rule 9): strips isCorrect, explanation,
 * MATCHING pairs (right-hand values are returned shuffled and unlinked in `matchTargets`)
 * and FILL_BLANK accepted answers (only `blankCount` is returned).
 * Works for practice questions and exam questions (same option shape).
 */
export function toPublicQuestion(
  q: Pick<Question, 'id' | 'type' | 'prompt' | 'imageUrl' | 'isMultiple' | 'points'> & {
    options: Pick<QuestionOption, 'id' | 'text' | 'imageUrl' | 'matchText' | 'position'>[];
  },
  random: () => number = Math.random,
): PublicQuestion {
  const ordered = [...q.options].sort((a, b) => a.position - b.position);
  const base = {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    isMultiple: q.isMultiple,
    points: q.points,
  };
  switch (q.type) {
    case QuestionType.FILL_BLANK:
      return { ...base, options: [], blankCount: blankIndexesIn(q.prompt).length };
    case QuestionType.MATCHING:
      return {
        ...base,
        options: ordered.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
        matchTargets: shuffle(
          ordered.map((o) => o.matchText ?? ''),
          random,
        ),
      };
    default:
      return {
        ...base,
        options: ordered.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
      };
  }
}
