import { describe, expect, it } from 'vitest';
import { fillBlank, matching, mcMulti, mcSingle, sixQuestions } from '@/test/fixtures';
import {
  countUnanswered,
  isAnswered,
  removeMatch,
  selectOption,
  setBlank,
  setMatch,
  splitBlankPrompt,
  toSubmission,
} from './answers';

describe('answers', () => {
  it('single choice replaces the selection, multi toggles', () => {
    let a = selectOption({ questionId: 'q1' }, 'o1', false);
    a = selectOption(a, 'o2', false);
    expect(a.selectedOptionIds).toEqual(['o2']);
    let m = selectOption({ questionId: 'q2' }, 'm1', true);
    m = selectOption(m, 'm2', true);
    m = selectOption(m, 'm1', true);
    expect(m.selectedOptionIds).toEqual(['m2']);
  });

  it('matching uses each target once and requires every left item', () => {
    let a = setMatch({ questionId: 'q4' }, 'l1', 'Rasm');
    a = setMatch(a, 'l2', 'Rasm'); // moves the target
    expect(a.matches).toEqual([{ optionId: 'l2', matchText: 'Rasm' }]);
    expect(isAnswered(matching, a)).toBe(false);
    a = setMatch(a, 'l1', 'Havola');
    expect(isAnswered(matching, a)).toBe(true);
    expect(isAnswered(matching, removeMatch(a, 'l1'))).toBe(false);
  });

  it('fill blank needs every blank filled', () => {
    let a = setBlank({ questionId: 'q5' }, 1, 'p', 2);
    expect(a.blanks).toEqual(['', 'p']);
    expect(isAnswered(fillBlank, a)).toBe(false);
    a = setBlank(a, 0, ' h1 ', 2);
    expect(isAnswered(fillBlank, a)).toBe(true);
  });

  it('counts unanswered and builds one submission entry per question', () => {
    const answers = { q1: { questionId: 'q1', selectedOptionIds: ['o1'] } };
    expect(countUnanswered(sixQuestions, answers)).toBe(5);
    const sub = toSubmission([mcSingle, mcMulti, fillBlank], {
      ...answers,
      q5: { questionId: 'q5', blanks: [' h1 ', 'p '] },
    });
    expect(sub).toEqual([
      { questionId: 'q1', selectedOptionIds: ['o1'] },
      { questionId: 'q2' },
      { questionId: 'q5', blanks: ['h1', 'p'] },
    ]);
  });

  it('splits a blank prompt', () => {
    expect(splitBlankPrompt('a {{0}} b {{1}}')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'blank', index: 0 },
      { kind: 'text', text: ' b ' },
      { kind: 'blank', index: 1 },
    ]);
  });
});
