import {
  PRACTICES_PER_LESSON,
  QUESTIONS_PER_PRACTICE,
  QuestionType,
  validateQuestionShape,
} from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import { DEMO_COURSES, DEMO_DIRECTIONS, DEMO_STUDENTS, DEMO_TEACHERS } from './seed-demo-data';
import { buildPractices } from './seed-data';

describe('demo seed data', () => {
  const topics = DEMO_COURSES.flatMap((c) => c.modules.flatMap((m) => m.lessons));

  it('every lesson topic has exactly 6 terms and 3 wrong ones', () => {
    for (const topic of topics) {
      expect(topic.terms, topic.title).toHaveLength(6);
      expect(topic.fakeTerms, topic.title).toHaveLength(3);
    }
  });

  it('builds 4 practices × 6 valid questions covering all 5 types for every lesson', () => {
    for (const topic of topics) {
      const practices = buildPractices(topic);
      expect(practices).toHaveLength(PRACTICES_PER_LESSON);
      const questions = practices.flatMap((p) => p.questions);
      expect(questions).toHaveLength(PRACTICES_PER_LESSON * QUESTIONS_PER_PRACTICE);
      expect([...new Set(questions.map((q) => q.type))].sort()).toEqual(
        Object.values(QuestionType).sort(),
      );
      for (const q of questions) {
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
        expect(problems, `${topic.title}: ${q.prompt}`).toEqual([]);
      }
    }
  });

  it('uses unique slugs, emails and phones, and only known directions and teachers', () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unique(DEMO_COURSES.map((c) => c.slug))).toBe(true);
    expect(unique(DEMO_STUDENTS.map((s) => s.email))).toBe(true);
    expect(unique(DEMO_STUDENTS.map((s) => s.phone))).toBe(true);
    const directions = new Set(DEMO_DIRECTIONS.map((d) => d.slug));
    const teachers = new Set([...DEMO_TEACHERS.map((t) => t.slug), 'aziz-karimov']);
    for (const c of DEMO_COURSES) {
      expect(directions.has(c.direction), c.slug).toBe(true);
      for (const t of c.teachers) expect(teachers.has(t), `${c.slug}: ${t}`).toBe(true);
    }
  });

  it('has free and paid, every level and every course status', () => {
    expect(DEMO_COURSES.some((c) => c.priceSom === 0)).toBe(true);
    expect(DEMO_COURSES.some((c) => c.priceSom > 0)).toBe(true);
    expect(new Set(DEMO_COURSES.map((c) => c.level)).size).toBe(3);
    expect(new Set(DEMO_COURSES.map((c) => c.status))).toEqual(
      new Set(['PUBLISHED', 'DRAFT', 'HIDDEN']),
    );
  });

  it('uses Uzbek phone numbers in +998 format', () => {
    for (const s of DEMO_STUDENTS) expect(s.phone).toMatch(/^\+998\d{9}$/);
  });
});
