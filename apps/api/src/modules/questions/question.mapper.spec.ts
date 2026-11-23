import { QuestionType } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import { allKeys } from '../courses/testing/prisma-mock';
import { toPublicQuestion } from './question.mapper';

const opt = (id: string, text: string, extra: Record<string, unknown> = {}, position = 1) => ({
  id,
  text,
  imageUrl: null,
  isCorrect: false,
  matchText: null as string | null,
  blankIndex: null as number | null,
  position,
  ...extra,
});

const base = {
  id: 'q1',
  prompt: 'Savol',
  imageUrl: null,
  isMultiple: false,
  points: 1,
  explanation: 'Izoh — faqat topshirgandan keyin',
};

const FORBIDDEN = ['isCorrect', 'matchText', 'blankIndex', 'explanation'];

describe('toPublicQuestion (no answers before submission)', () => {
  it.each([QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.IMAGE_BASED])(
    '%s: options without isCorrect',
    (type) => {
      const q = toPublicQuestion({
        ...base,
        type,
        options: [opt('a', 'A', { isCorrect: true }, 2), opt('b', 'B', {}, 1)],
      });
      expect(q.options).toEqual([
        { id: 'b', text: 'B', imageUrl: null },
        { id: 'a', text: 'A', imageUrl: null },
      ]);
      for (const k of FORBIDDEN) expect(allKeys(q).has(k)).toBe(false);
    },
  );

  it('MATCHING: left items plus shuffled, unlinked right-hand targets', () => {
    const q = toPublicQuestion(
      {
        ...base,
        type: QuestionType.MATCHING,
        options: [
          opt('a', 'Olma', { matchText: 'apple' }, 1),
          opt('b', 'Non', { matchText: 'bread' }, 2),
          opt('c', 'Suv', { matchText: 'water' }, 3),
        ],
      },
      () => 0, // deterministic shuffle
    );
    expect(q.options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect([...(q.matchTargets ?? [])].sort()).toEqual(['apple', 'bread', 'water']);
    expect(q.matchTargets).not.toEqual(['apple', 'bread', 'water']);
    for (const k of FORBIDDEN) expect(allKeys(q).has(k)).toBe(false);
  });

  it('FILL_BLANK: no options at all (they are the answers), only the blank count', () => {
    const q = toPublicQuestion({
      ...base,
      type: QuestionType.FILL_BLANK,
      prompt: "O'zbekiston poytaxti {{0}}, eng uzun daryo {{1}}",
      options: [opt('a', 'Toshkent', { blankIndex: 0 }), opt('b', 'Amudaryo', { blankIndex: 1 })],
    });
    expect(q.options).toEqual([]);
    expect(q.blankCount).toBe(2);
    expect(JSON.stringify(q)).not.toContain('Toshkent');
    expect(JSON.stringify(q)).not.toContain('Amudaryo');
  });
});
