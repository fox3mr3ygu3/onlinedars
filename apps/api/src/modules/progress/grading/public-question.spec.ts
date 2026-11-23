import { QuestionType } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import { shuffle, type StoredQuestion, toPublicQuestion } from './public-question';

const base = {
  imageUrl: null,
  explanation: 'secret explanation',
  isMultiple: false,
  points: 1,
  position: 1,
};
const o = (id: string, text: string, extra: Partial<StoredQuestion['options'][0]> = {}) => ({
  id,
  text,
  imageUrl: null,
  isCorrect: false,
  matchText: null,
  blankIndex: null,
  position: 1,
  ...extra,
});

/** Every key anywhere in the object tree. */
function keysDeep(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysDeep(x, out);
    }
  }
  return out;
}

describe('toPublicQuestion — never leaks answers (rule 9)', () => {
  it('choice: no isCorrect, no explanation', () => {
    const q: StoredQuestion = {
      ...base,
      id: 'q',
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: 'p',
      options: [o('a', 'A', { isCorrect: true, position: 2 }), o('b', 'B', { position: 1 })],
    };
    const pub = toPublicQuestion(q);
    const keys = keysDeep(pub);
    expect(keys.has('isCorrect')).toBe(false);
    expect(keys.has('explanation')).toBe(false);
    expect(pub.options.map((x) => x.id)).toEqual(['b', 'a']); // position order
  });

  it('matching: left items without matchText, targets shuffled separately', () => {
    const q: StoredQuestion = {
      ...base,
      id: 'q',
      type: QuestionType.MATCHING,
      prompt: 'p',
      options: [
        o('1', 'p', { matchText: 'Paragraf', position: 1 }),
        o('2', 'a', { matchText: 'Havola', position: 2 }),
        o('3', 'img', { matchText: 'Rasm', position: 3 }),
      ],
    };
    const pub = toPublicQuestion(q);
    expect(keysDeep(pub.options).has('matchText')).toBe(false);
    expect([...(pub.matchTargets ?? [])].sort()).toEqual(['Havola', 'Paragraf', 'Rasm']);
  });

  it('fill blank: accepted answers are not sent at all', () => {
    const q: StoredQuestion = {
      ...base,
      id: 'q',
      type: QuestionType.FILL_BLANK,
      prompt: '{{0}} va {{1}}',
      options: [o('x', 'padding', { blankIndex: 0 }), o('y', 'margin', { blankIndex: 1 })],
    };
    const pub = toPublicQuestion(q);
    expect(pub.options).toEqual([]);
    expect(pub.blankCount).toBe(2);
    expect(JSON.stringify(pub)).not.toContain('padding');
    expect(JSON.stringify(pub)).not.toContain('margin');
  });

  it('true/false is never multi-select', () => {
    const q: StoredQuestion = {
      ...base,
      id: 'q',
      isMultiple: true,
      type: QuestionType.TRUE_FALSE,
      prompt: 'p',
      options: [o('t', 'T', { isCorrect: true }), o('f', 'F')],
    };
    expect(toPublicQuestion(q).isMultiple).toBe(false);
  });
});

describe('shuffle', () => {
  it('is a permutation and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
  it('uses the injected random source', () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});
