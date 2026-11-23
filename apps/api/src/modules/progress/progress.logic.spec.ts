import { describe, expect, it } from 'vitest';
import {
  computeCourseProgress,
  computeLocks,
  flattenLessons,
  isExamUnlocked,
  isLessonComplete,
  isPracticePassed,
  nextLessonId,
  type TreeModule,
} from './progress.logic';

const l = (id: string, isCompleted = false, isRequired = true) => ({ id, isCompleted, isRequired });

const course = (...mods: [string, ReturnType<typeof l>[]][]): TreeModule[] =>
  mods.map(([id, lessons]) => ({ id, lessons }));

describe('computeLocks', () => {
  it('sequential: only the first lesson is open at the start', () => {
    const tree = course(['m1', [l('a'), l('b')]], ['m2', [l('c')]]);
    const { lessonLocked, moduleLocked } = computeLocks(tree, true);
    expect(lessonLocked.get('a')).toBe(false);
    expect(lessonLocked.get('b')).toBe(true);
    expect(lessonLocked.get('c')).toBe(true);
    expect(moduleLocked.get('m1')).toBe(false);
    expect(moduleLocked.get('m2')).toBe(true);
  });

  it('sequential: completing a lesson opens the next one, across modules', () => {
    const tree = course(['m1', [l('a', true), l('b', true)]], ['m2', [l('c'), l('d')]]);
    const { lessonLocked, moduleLocked } = computeLocks(tree, true);
    expect(lessonLocked.get('c')).toBe(false);
    expect(lessonLocked.get('d')).toBe(true);
    expect(moduleLocked.get('m2')).toBe(false);
  });

  it('sequential: optional lessons never block', () => {
    const tree = course(['m1', [l('a', true), l('opt', false, false), l('b')]]);
    const { lessonLocked } = computeLocks(tree, true);
    expect(lessonLocked.get('opt')).toBe(false);
    expect(lessonLocked.get('b')).toBe(false);
  });

  it('non-sequential: everything is open', () => {
    const tree = course(['m1', [l('a'), l('b')]], ['m2', [l('c')]]);
    const { lessonLocked, moduleLocked } = computeLocks(tree, false);
    expect([...lessonLocked.values()].every((v) => v === false)).toBe(true);
    expect([...moduleLocked.values()].every((v) => v === false)).toBe(true);
  });

  it('an empty module is locked only while earlier content blocks', () => {
    expect(computeLocks(course(['m1', [l('a')]], ['m2', []]), true).moduleLocked.get('m2')).toBe(
      true,
    );
    expect(
      computeLocks(course(['m1', [l('a', true)]], ['m2', []]), true).moduleLocked.get('m2'),
    ).toBe(false);
  });
});

describe('computeCourseProgress', () => {
  it('percent is based on required lessons, floored', () => {
    const p = computeCourseProgress([l('a', true), l('b'), l('c'), l('x', true, false)]);
    expect(p).toEqual({
      completedLessons: 2,
      totalLessons: 4,
      completedRequired: 1,
      totalRequired: 3,
      percent: 33,
    });
  });
  it('falls back to all lessons if none are required', () => {
    expect(computeCourseProgress([l('a', true, false), l('b', false, false)]).percent).toBe(50);
  });
  it('0 for an empty course, 100 when all done', () => {
    expect(computeCourseProgress([]).percent).toBe(0);
    expect(computeCourseProgress([l('a', true), l('b', true)]).percent).toBe(100);
  });
});

describe('isExamUnlocked (rule 5)', () => {
  it('locked until every required lesson is complete', () => {
    expect(isExamUnlocked([l('a', true), l('b')])).toBe(false);
    expect(isExamUnlocked([l('a', true), l('b', true)])).toBe(true);
  });
  it('optional lessons do not gate the exam', () => {
    expect(isExamUnlocked([l('a', true), l('opt', false, false)])).toBe(true);
  });
  it('vacuously unlocked without required lessons', () => {
    expect(isExamUnlocked([])).toBe(true);
  });
});

describe('lesson completion (rule 4)', () => {
  it('needs material viewed AND all required practices passed', () => {
    const passedAll = [
      { isRequired: true, passed: true },
      { isRequired: true, passed: true },
    ];
    expect(isLessonComplete(true, passedAll)).toBe(true);
    expect(isLessonComplete(false, passedAll)).toBe(false);
    expect(isLessonComplete(true, [{ isRequired: true, passed: false }])).toBe(false);
  });
  it('optional practices are not needed', () => {
    expect(isLessonComplete(true, [{ isRequired: false, passed: false }])).toBe(true);
  });
  it('practice passed when percent >= passScore; 0 = any submission', () => {
    expect(isPracticePassed(0, 0)).toBe(true);
    expect(isPracticePassed(59, 60)).toBe(false);
    expect(isPracticePassed(60, 60)).toBe(true);
  });
});

describe('nextLessonId', () => {
  it('first open, not completed lesson', () => {
    const tree = course(['m1', [l('a', true), l('b')]], ['m2', [l('c')]]);
    expect(nextLessonId(tree, computeLocks(tree, true))).toBe('b');
  });
  it('null when all done', () => {
    const tree = course(['m1', [l('a', true)]]);
    expect(nextLessonId(tree, computeLocks(tree, true))).toBeNull();
  });
  it('flattenLessons keeps order', () => {
    expect(flattenLessons(course(['m1', [l('a')]], ['m2', [l('b')]])).map((x) => x.id)).toEqual([
      'a',
      'b',
    ]);
  });
});
