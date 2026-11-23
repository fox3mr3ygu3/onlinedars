import { QuestionType } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import {
  correctAnswerOf,
  type GradableQuestion,
  gradeAll,
  gradeQuestion,
  isAnswerCorrect,
  normalizeText,
  percentOf,
} from './grading';

const opt = (id: string, text: string, extra: Partial<GradableQuestion['options'][0]> = {}) => ({
  id,
  text,
  isCorrect: false,
  matchText: null,
  blankIndex: null,
  ...extra,
});

const single: GradableQuestion = {
  id: 'q-single',
  type: QuestionType.MULTIPLE_CHOICE,
  prompt: 'HTML nima?',
  isMultiple: false,
  points: 1,
  options: [
    opt('a', 'Belgilash tili', { isCorrect: true }),
    opt('b', 'Dasturlash tili'),
    opt('c', 'DB'),
  ],
};

const multi: GradableQuestion = {
  id: 'q-multi',
  type: QuestionType.MULTIPLE_CHOICE,
  prompt: 'Qaysilari teg?',
  isMultiple: true,
  points: 2,
  options: [
    opt('a', '<p>', { isCorrect: true }),
    opt('b', '<div>', { isCorrect: true }),
    opt('c', 'color'),
    opt('d', 'margin'),
  ],
};

const trueFalse: GradableQuestion = {
  id: 'q-tf',
  type: QuestionType.TRUE_FALSE,
  prompt: 'CSS — uslublar tili',
  isMultiple: false,
  points: 1,
  options: [opt('t', "To'g'ri", { isCorrect: true }), opt('f', "Noto'g'ri")],
};

const matching: GradableQuestion = {
  id: 'q-match',
  type: QuestionType.MATCHING,
  prompt: 'Moslang',
  isMultiple: false,
  points: 3,
  options: [
    opt('m1', 'p', { matchText: 'Paragraf' }),
    opt('m2', 'a', { matchText: 'Havola' }),
    opt('m3', 'img', { matchText: 'Rasm' }),
  ],
};

const fill: GradableQuestion = {
  id: 'q-fill',
  type: QuestionType.FILL_BLANK,
  prompt: 'Element {{0}} ichida joylashadi, {{1}} esa tashqarida.',
  isMultiple: false,
  points: 2,
  options: [
    opt('f0a', 'padding', { blankIndex: 0 }),
    opt('f0b', 'ichki chegara', { blankIndex: 0 }),
    opt('f1', 'Margin', { blankIndex: 1 }),
  ],
};

const image: GradableQuestion = {
  id: 'q-img',
  type: QuestionType.IMAGE_BASED,
  prompt: 'Rasmda qaysi element?',
  isMultiple: false,
  points: 1,
  options: [opt('i1', 'button', { isCorrect: true }), opt('i2', 'input')],
};

const imageMulti: GradableQuestion = {
  ...image,
  id: 'q-img-m',
  isMultiple: true,
  options: [
    opt('i1', 'button', { isCorrect: true }),
    opt('i2', 'input', { isCorrect: true }),
    opt('i3', 'span'),
  ],
};

const ans = (questionId: string, a: Record<string, unknown> = {}) => ({ questionId, ...a });

describe('normalizeText', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeText('  Box   Model \n')).toBe('box model');
  });
  it('unifies Uzbek apostrophe variants', () => {
    expect(normalizeText('Oʻzbek')).toBe(normalizeText("o'zbek"));
    expect(normalizeText('o‘zbek')).toBe("o'zbek");
    expect(normalizeText('o’zbek')).toBe("o'zbek");
  });
  it('applies Unicode NFC', () => {
    expect(normalizeText('é')).toBe('é');
  });
});

describe('MULTIPLE_CHOICE (single)', () => {
  it('accepts the one correct option', () => {
    expect(isAnswerCorrect(single, ans(single.id, { selectedOptionIds: ['a'] }))).toBe(true);
  });
  it('rejects a wrong option', () => {
    expect(isAnswerCorrect(single, ans(single.id, { selectedOptionIds: ['b'] }))).toBe(false);
  });
  it('rejects selecting several options on a single-choice question', () => {
    expect(isAnswerCorrect(single, ans(single.id, { selectedOptionIds: ['a', 'b'] }))).toBe(false);
  });
  it('rejects empty / missing answers and unknown option ids', () => {
    expect(isAnswerCorrect(single, undefined)).toBe(false);
    expect(isAnswerCorrect(single, ans(single.id, { selectedOptionIds: [] }))).toBe(false);
    expect(isAnswerCorrect(single, ans(single.id, { selectedOptionIds: ['zzz'] }))).toBe(false);
  });
  it('treats a duplicated correct id as one selection', () => {
    expect(isAnswerCorrect(single, ans(single.id, { selectedOptionIds: ['a', 'a'] }))).toBe(true);
  });
});

describe('MULTIPLE_CHOICE (multi)', () => {
  it('needs exactly all correct options, in any order', () => {
    expect(isAnswerCorrect(multi, ans(multi.id, { selectedOptionIds: ['b', 'a'] }))).toBe(true);
  });
  it('rejects a partial selection (all-or-nothing)', () => {
    expect(isAnswerCorrect(multi, ans(multi.id, { selectedOptionIds: ['a'] }))).toBe(false);
  });
  it('rejects an extra wrong option', () => {
    expect(isAnswerCorrect(multi, ans(multi.id, { selectedOptionIds: ['a', 'b', 'c'] }))).toBe(
      false,
    );
  });
  it('rejects selecting everything', () => {
    expect(isAnswerCorrect(multi, ans(multi.id, { selectedOptionIds: ['a', 'b', 'c', 'd'] }))).toBe(
      false,
    );
  });
});

describe('TRUE_FALSE', () => {
  it('grades true / false', () => {
    expect(isAnswerCorrect(trueFalse, ans(trueFalse.id, { selectedOptionIds: ['t'] }))).toBe(true);
    expect(isAnswerCorrect(trueFalse, ans(trueFalse.id, { selectedOptionIds: ['f'] }))).toBe(false);
  });
  it('rejects both selected even if isMultiple was set by mistake', () => {
    const q = { ...trueFalse, isMultiple: true };
    expect(isAnswerCorrect(q, ans(q.id, { selectedOptionIds: ['t', 'f'] }))).toBe(false);
  });
});

describe('MATCHING', () => {
  const all = [
    { optionId: 'm1', matchText: 'Paragraf' },
    { optionId: 'm2', matchText: 'Havola' },
    { optionId: 'm3', matchText: 'Rasm' },
  ];
  it('accepts all pairs right (order irrelevant, text normalised)', () => {
    const shuffled = [all[2], { optionId: 'm1', matchText: '  paragraf ' }, all[1]];
    expect(isAnswerCorrect(matching, ans(matching.id, { matches: shuffled }))).toBe(true);
  });
  it('rejects a swapped pair', () => {
    const swapped = [
      { optionId: 'm1', matchText: 'Havola' },
      { optionId: 'm2', matchText: 'Paragraf' },
      all[2],
    ];
    expect(isAnswerCorrect(matching, ans(matching.id, { matches: swapped }))).toBe(false);
  });
  it('rejects a missing pair', () => {
    expect(isAnswerCorrect(matching, ans(matching.id, { matches: all.slice(0, 2) }))).toBe(false);
  });
  it('rejects the same option matched twice', () => {
    const dup = [...all, { optionId: 'm1', matchText: 'Rasm' }];
    expect(isAnswerCorrect(matching, ans(matching.id, { matches: dup }))).toBe(false);
  });
  it('rejects no answer', () => {
    expect(isAnswerCorrect(matching, ans(matching.id))).toBe(false);
  });
});

describe('FILL_BLANK', () => {
  it('accepts any accepted answer per blank, normalised (trim/case/whitespace)', () => {
    expect(isAnswerCorrect(fill, ans(fill.id, { blanks: ['  PADDING ', 'margin'] }))).toBe(true);
    expect(isAnswerCorrect(fill, ans(fill.id, { blanks: ['Ichki   chegara', ' MARGIN'] }))).toBe(
      true,
    );
  });
  it('rejects a wrong blank', () => {
    expect(isAnswerCorrect(fill, ans(fill.id, { blanks: ['padding', 'border'] }))).toBe(false);
  });
  it('rejects answers in the wrong blank', () => {
    expect(isAnswerCorrect(fill, ans(fill.id, { blanks: ['margin', 'padding'] }))).toBe(false);
  });
  it('rejects missing or whitespace-only blanks', () => {
    expect(isAnswerCorrect(fill, ans(fill.id, { blanks: ['padding'] }))).toBe(false);
    expect(isAnswerCorrect(fill, ans(fill.id, { blanks: ['padding', '   '] }))).toBe(false);
    expect(isAnswerCorrect(fill, undefined)).toBe(false);
  });
  it('treats Uzbek apostrophe variants as equal', () => {
    const q: GradableQuestion = {
      ...fill,
      prompt: '{{0}} tili',
      options: [opt('x', "o'zbek", { blankIndex: 0 })],
    };
    expect(isAnswerCorrect(q, ans(q.id, { blanks: ['Oʻzbek'] }))).toBe(true);
  });
  it('a question without blanks can never be answered correctly', () => {
    const q: GradableQuestion = { ...fill, prompt: 'no blanks', options: [] };
    expect(isAnswerCorrect(q, ans(q.id, { blanks: ['x'] }))).toBe(false);
  });
});

describe('IMAGE_BASED', () => {
  it('grades like multiple choice (single)', () => {
    expect(isAnswerCorrect(image, ans(image.id, { selectedOptionIds: ['i1'] }))).toBe(true);
    expect(isAnswerCorrect(image, ans(image.id, { selectedOptionIds: ['i2'] }))).toBe(false);
  });
  it('grades like multiple choice (multi)', () => {
    expect(
      isAnswerCorrect(imageMulti, ans(imageMulti.id, { selectedOptionIds: ['i2', 'i1'] })),
    ).toBe(true);
    expect(isAnswerCorrect(imageMulti, ans(imageMulti.id, { selectedOptionIds: ['i1'] }))).toBe(
      false,
    );
  });
});

describe('gradeQuestion / gradeAll', () => {
  it('awards full points or zero', () => {
    expect(gradeQuestion(multi, ans(multi.id, { selectedOptionIds: ['a', 'b'] }))).toMatchObject({
      isCorrect: true,
      pointsAwarded: 2,
      points: 2,
    });
    expect(gradeQuestion(multi, ans(multi.id, { selectedOptionIds: ['a'] })).pointsAwarded).toBe(0);
  });

  it('sums score, counts unanswered as wrong, ignores answers to foreign questions', () => {
    const questions = [single, multi, trueFalse, matching, fill, image];
    const r = gradeAll(questions, [
      ans(single.id, { selectedOptionIds: ['a'] }), // 1
      ans(trueFalse.id, { selectedOptionIds: ['f'] }), // 0
      ans(fill.id, { blanks: ['padding', 'margin'] }), // 2
      ans('not-in-practice', { selectedOptionIds: ['a'] }),
    ]);
    expect(r.score).toBe(3);
    expect(r.maxScore).toBe(1 + 2 + 1 + 3 + 2 + 1);
    expect(r.correctCount).toBe(2);
    expect(r.totalCount).toBe(6);
    expect(r.percent).toBe(30);
    expect(r.questions.map((q) => q.questionId)).toEqual(questions.map((q) => q.id));
  });

  it('the last answer for a question wins', () => {
    const r = gradeAll(
      [single],
      [ans(single.id, { selectedOptionIds: ['b'] }), ans(single.id, { selectedOptionIds: ['a'] })],
    );
    expect(r.correctCount).toBe(1);
  });

  it('percentOf floors and handles 0 max', () => {
    expect(percentOf(2, 3)).toBe(66);
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(6, 6)).toBe(100);
  });
});

describe('correctAnswerOf (revealed after submit only)', () => {
  it('choice → correct option ids', () => {
    expect(correctAnswerOf(multi)).toEqual({ selectedOptionIds: ['a', 'b'] });
    expect(correctAnswerOf(trueFalse)).toEqual({ selectedOptionIds: ['t'] });
  });
  it('matching → pairs', () => {
    expect(correctAnswerOf(matching).matches).toHaveLength(3);
  });
  it('fill blank → accepted answers per blank', () => {
    expect(correctAnswerOf(fill)).toEqual({ blanks: [['padding', 'ichki chegara'], ['Margin']] });
  });
});
