import { describe, expect, it } from 'vitest';
import {
  isPlayerRoute,
  lessonStatus,
  moduleMinutes,
  moduleOfLesson,
  numberLessons,
  splitMinutes,
} from './player';

const l = (id: string, durationMinutes: number | null = null) => ({ id, durationMinutes });

describe('player helpers', () => {
  it('splits minutes into hours and minutes', () => {
    expect(splitMinutes(92)).toEqual({ hours: 1, minutes: 32 });
    expect(splitMinutes(47)).toEqual({ hours: 0, minutes: 47 });
    expect(splitMinutes(120)).toEqual({ hours: 2, minutes: 0 });
    expect(splitMinutes(-5)).toEqual({ hours: 0, minutes: 0 });
  });

  it('sums lesson durations, treating missing ones as 0', () => {
    expect(moduleMinutes({ lessons: [l('a', 10), l('b'), l('c', 5)] as never })).toBe(15);
  });

  it('numbers lessons across modules and finds the module of a lesson', () => {
    const modules = [
      { id: 'm1', lessons: [l('a'), l('b')] },
      { id: 'm2', lessons: [l('c')] },
    ] as never;
    expect([...numberLessons(modules).entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    expect(moduleOfLesson(modules, 'c')).toBe('m2');
    expect(moduleOfLesson(modules, 'x')).toBeNull();
  });

  it('derives lesson status, with a locked module locking its lessons', () => {
    const base = { isLocked: false, isCompleted: false, materialViewed: false, practicesPassed: 0 };
    expect(lessonStatus(base, false)).toBe('notStarted');
    expect(lessonStatus({ ...base, practicesPassed: 1 }, false)).toBe('inProgress');
    expect(lessonStatus({ ...base, isCompleted: true }, false)).toBe('completed');
    expect(lessonStatus({ ...base, isCompleted: true }, true)).toBe('locked');
    expect(lessonStatus({ ...base, isLocked: true }, false)).toBe('locked');
  });

  it('treats only the lesson page as a player route', () => {
    expect(isPlayerRoute('/cabinet/courses/c1/lessons/l1')).toBe(true);
    expect(isPlayerRoute('/cabinet/courses/c1/lessons/l1/practice/p1')).toBe(false);
    expect(isPlayerRoute('/cabinet/courses/c1')).toBe(false);
    expect(isPlayerRoute('/cabinet/courses/c1/exam')).toBe(false);
  });
});
