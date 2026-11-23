import { describe, expect, it } from 'vitest';
import { publicCourseListQuerySchema } from './catalog';
import {
  courseUpdateSchema,
  lessonUpdateSchema,
  practiceUpdateSchema,
  questionUpdateSchema,
  toPatchSchema,
} from './content-admin';
import { courseInputSchema } from './content';
import { PLATFORM_SETTINGS_DEFAULTS, platformSettingsUpdateSchema } from './settings';
import { uploadFieldsSchema } from './files';

describe('toPatchSchema', () => {
  it('makes every field optional and does NOT apply create defaults', () => {
    expect(courseUpdateSchema.parse({})).toEqual({});
    expect(courseUpdateSchema.parse({ title: 'Yangi nom' })).toEqual({ title: 'Yangi nom' });
    expect(lessonUpdateSchema.parse({})).toEqual({});
    expect(practiceUpdateSchema.parse({ passScore: 50 })).toEqual({ passScore: 50 });
    // the create schema still applies its defaults
    expect(
      courseInputSchema.parse({ slug: 'ab', title: 'Kurs', isFree: true }).sequentialUnlock,
    ).toBe(true);
  });

  it('still validates field types', () => {
    expect(practiceUpdateSchema.safeParse({ passScore: 101 }).success).toBe(false);
    expect(courseUpdateSchema.safeParse({ slug: 'Bad Slug' }).success).toBe(false);
  });

  it('course PATCH checks price vs isFree when both are sent', () => {
    expect(courseUpdateSchema.safeParse({ isFree: true, price: 100 }).success).toBe(false);
    expect(courseUpdateSchema.safeParse({ isFree: false, price: 0 }).success).toBe(false);
    expect(courseUpdateSchema.safeParse({ isFree: false, price: 100 }).success).toBe(true);
  });

  it('question PATCH accepts partial options without the per-type refinement', () => {
    expect(questionUpdateSchema.safeParse({ prompt: 'Yangi savol' }).success).toBe(true);
    expect(questionUpdateSchema.safeParse({ points: 0 }).success).toBe(false);
  });

  it('works on a plain shape', async () => {
    const { z } = await import('zod');
    const s = toPatchSchema({ a: z.number().default(1), b: z.string() });
    expect(s.parse({})).toEqual({});
  });
});

describe('catalog query', () => {
  it('coerces paging and booleans; search + q alias', () => {
    const q = publicCourseListQuerySchema.parse({
      page: '2',
      pageSize: '10',
      isFree: 'true',
      search: 'py',
    });
    expect(q).toMatchObject({ page: 2, pageSize: 10, isFree: true, search: 'py', sort: 'newest' });
    expect(publicCourseListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('settings & files schemas', () => {
  it('has defaults for every setting and a strict PATCH', () => {
    expect(PLATFORM_SETTINGS_DEFAULTS.platformName).toBe('OnlineDars');
    expect(PLATFORM_SETTINGS_DEFAULTS.refundPolicy).toBe('REVOKE_ACCESS');
    expect(platformSettingsUpdateSchema.safeParse({ unknownKey: 1 }).success).toBe(false);
    expect(platformSettingsUpdateSchema.safeParse({ orderTtlMinutes: 1 }).success).toBe(false);
  });

  it('upload purpose defaults to FILE', () => {
    expect(uploadFieldsSchema.parse({})).toEqual({ purpose: 'FILE' });
    expect(uploadFieldsSchema.safeParse({ purpose: 'VIDEO' }).success).toBe(false);
  });
});
