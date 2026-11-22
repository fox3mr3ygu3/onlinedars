import {
  PRACTICES_PER_LESSON,
  QUESTIONS_PER_PRACTICE,
  QuestionType,
  validateQuestionShape,
} from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import { buildDemoModules, buildExamQuestions } from './seed-data';

describe('seed data', () => {
  const modules = buildDemoModules();
  const lessons = modules.flatMap((m) => m.lessons);

  it('has at least one module with lessons', () => {
    expect(modules.length).toBeGreaterThan(0);
    expect(lessons.length).toBeGreaterThan(0);
  });

  it('gives every lesson exactly 4 practices × 6 questions (rule 2)', () => {
    for (const lesson of lessons) {
      expect(lesson.practices).toHaveLength(PRACTICES_PER_LESSON);
      for (const p of lesson.practices) expect(p.questions).toHaveLength(QUESTIONS_PER_PRACTICE);
    }
  });

  it('covers all 5 question types in every lesson', () => {
    for (const lesson of lessons) {
      const types = new Set(lesson.practices.flatMap((p) => p.questions.map((q) => q.type)));
      expect([...types].sort()).toEqual(Object.values(QuestionType).sort());
    }
  });

  it('includes a multi-select multiple-choice question', () => {
    const all = lessons.flatMap((l) => l.practices.flatMap((p) => p.questions));
    expect(all.some((q) => q.type === QuestionType.MULTIPLE_CHOICE && q.isMultiple)).toBe(true);
  });

  it('produces only structurally valid questions', () => {
    const all = [
      ...lessons.flatMap((l) => l.practices.flatMap((p) => p.questions)),
      ...buildExamQuestions(),
    ];
    for (const q of all) {
      const problems = validateQuestionShape({
        type: q.type,
        prompt: q.prompt,
        imageUrl: q.imageUrl ?? null,
        isMultiple: q.isMultiple ?? false,
        options: q.options.map((o) => ({
          isCorrect: o.isCorrect ?? false,
          matchText: o.matchText ?? null,
          blankIndex: o.blankIndex ?? null,
        })),
      });
      expect(problems, `${q.type}: ${q.prompt}`).toEqual([]);
    }
  });

  it('has enough exam questions for the configured question count (10)', () => {
    expect(buildExamQuestions().length).toBeGreaterThanOrEqual(10);
  });
});
