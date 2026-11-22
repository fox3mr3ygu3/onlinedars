import { z } from 'zod';
import { CourseLevel, CourseStatus, LessonMaterialType, QuestionType } from '../enums';
import { idSchema, paginationQuerySchema, slugSchema, tiyinSchema } from './common';

const title = z.string().trim().min(2).max(200);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const urlOrNull = z.url().max(2048).nullable().optional();

// ---------- directions, teachers, faq ----------
export const directionInputSchema = z.object({
  slug: slugSchema,
  name: title,
  description: optionalText(2000),
  icon: optionalText(64),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type DirectionInput = z.infer<typeof directionInputSchema>;

export const teacherInputSchema = z.object({
  slug: slugSchema,
  fullName: title,
  title: optionalText(200),
  bio: optionalText(5000),
  photoUrl: urlOrNull,
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type TeacherInput = z.infer<typeof teacherInputSchema>;

export const faqInputSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(1).max(10000),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type FaqInput = z.infer<typeof faqInputSchema>;

// ---------- courses ----------
export const courseInputSchema = z
  .object({
    slug: slugSchema,
    title,
    shortDescription: z.string().trim().max(500).default(''),
    description: z.string().trim().max(50000).default(''),
    goals: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
    coverImageUrl: urlOrNull,
    level: z.enum(CourseLevel).default(CourseLevel.BEGINNER),
    isFree: z.boolean().default(false),
    /** Price in tiyin. Must be 0 for free courses and > 0 for paid ones. */
    price: tiyinSchema.default(0),
    sequentialUnlock: z.boolean().default(true),
    directionId: idSchema.nullable().optional(),
    teacherIds: z.array(idSchema).max(20).default([]),
    certificateTemplateId: idSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.isFree && v.price !== 0) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'validation.freeCoursePrice' });
    }
    if (!v.isFree && v.price <= 0) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'validation.paidCoursePrice' });
    }
  });
export type CourseInput = z.infer<typeof courseInputSchema>;

export const courseStatusChangeSchema = z.object({ status: z.enum(CourseStatus) });
export type CourseStatusChange = z.infer<typeof courseStatusChangeSchema>;

export const catalogQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  directionId: idSchema.optional(),
  level: z.enum(CourseLevel).optional(),
  isFree: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['newest', 'popular', 'priceAsc', 'priceDesc']).default('newest'),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

// ---------- modules & lessons ----------
export const moduleInputSchema = z.object({
  title,
  description: optionalText(2000),
});
export type ModuleInput = z.infer<typeof moduleInputSchema>;

export const lessonInputSchema = z.object({
  title,
  summary: optionalText(1000),
  durationMinutes: z.number().int().min(0).max(1000).nullable().optional(),
  isRequired: z.boolean().default(true),
});
export type LessonInput = z.infer<typeof lessonInputSchema>;

export const lessonMaterialInputSchema = z
  .object({
    type: z.enum(LessonMaterialType),
    title: optionalText(200),
    /** Rich text (sanitised HTML) for TEXT materials. */
    content: z.string().max(200000).nullable().optional(),
    fileKey: optionalText(512),
    fileUrl: urlOrNull,
    mimeType: optionalText(128),
    sizeBytes: z.number().int().min(0).nullable().optional(),
    videoUrl: urlOrNull,
  })
  .superRefine((v, ctx) => {
    if (v.type === LessonMaterialType.TEXT && !v.content) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'validation.required' });
    }
    if ((v.type === LessonMaterialType.IMAGE || v.type === LessonMaterialType.FILE) && !v.fileUrl) {
      ctx.addIssue({ code: 'custom', path: ['fileUrl'], message: 'validation.required' });
    }
    if (v.type === LessonMaterialType.VIDEO && !v.videoUrl) {
      ctx.addIssue({ code: 'custom', path: ['videoUrl'], message: 'validation.required' });
    }
  });
export type LessonMaterialInput = z.infer<typeof lessonMaterialInputSchema>;

// ---------- practices & questions ----------
export const practiceInputSchema = z.object({
  title,
  description: optionalText(2000),
  isRequired: z.boolean().default(true),
  /** Minimum percent to count the practice as passed; 0 = any submission counts. */
  passScore: z.number().int().min(0).max(100).default(0),
});
export type PracticeInput = z.infer<typeof practiceInputSchema>;

export const questionOptionInputSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  imageUrl: urlOrNull,
  isCorrect: z.boolean().default(false),
  /** MATCHING: the right-hand side paired with `text`. */
  matchText: optionalText(1000),
  /** FILL_BLANK: which blank (`{{0}}`, `{{1}}` …) this accepted answer belongs to. */
  blankIndex: z.number().int().min(0).max(20).nullable().optional(),
});
export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;

/** Placeholders for FILL_BLANK prompts: `{{0}}`, `{{1}}`, … */
export const BLANK_PLACEHOLDER_RE = /\{\{(\d+)\}\}/g;

/** Distinct blank indexes referenced in a FILL_BLANK prompt, ascending. */
export function blankIndexesIn(prompt: string): number[] {
  const found = [...prompt.matchAll(BLANK_PLACEHOLDER_RE)].map((m) => Number(m[1]));
  return [...new Set(found)].sort((a, b) => a - b);
}

export interface QuestionShape {
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  isMultiple: boolean;
  options: {
    isCorrect: boolean;
    matchText?: string | null;
    blankIndex?: number | null;
  }[];
}

export interface ShapeProblem {
  path: (string | number)[];
  message: string;
}

/** Per-type structural rules for a question (used by zod schemas and by the seed). */
export function validateQuestionShape(q: QuestionShape): ShapeProblem[] {
  const problems: ShapeProblem[] = [];
  const correct = q.options.filter((o) => o.isCorrect).length;
  switch (q.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.IMAGE_BASED:
      if (q.type === QuestionType.IMAGE_BASED && !q.imageUrl) {
        problems.push({ path: ['imageUrl'], message: 'validation.imageRequired' });
      }
      if (q.options.length < 2) {
        problems.push({ path: ['options'], message: 'validation.minOptions' });
      }
      if (correct < 1) {
        problems.push({ path: ['options'], message: 'validation.noCorrectOption' });
      }
      if (!q.isMultiple && correct > 1) {
        problems.push({ path: ['options'], message: 'validation.singleCorrectOnly' });
      }
      break;
    case QuestionType.TRUE_FALSE:
      if (q.options.length !== 2 || correct !== 1) {
        problems.push({ path: ['options'], message: 'validation.trueFalseOptions' });
      }
      break;
    case QuestionType.MATCHING:
      if (q.options.length < 2) {
        problems.push({ path: ['options'], message: 'validation.minOptions' });
      }
      q.options.forEach((o, i) => {
        if (!o.matchText) {
          problems.push({ path: ['options', i, 'matchText'], message: 'validation.required' });
        }
      });
      break;
    case QuestionType.FILL_BLANK: {
      const blanks = blankIndexesIn(q.prompt);
      if (blanks.length === 0) {
        problems.push({ path: ['prompt'], message: 'validation.noBlanks' });
      }
      for (const b of blanks) {
        if (!q.options.some((o) => o.blankIndex === b)) {
          problems.push({ path: ['options'], message: 'validation.blankWithoutAnswer' });
        }
      }
      q.options.forEach((o, i) => {
        if (o.blankIndex == null || !blanks.includes(o.blankIndex)) {
          problems.push({ path: ['options', i, 'blankIndex'], message: 'validation.blankIndex' });
        }
      });
      break;
    }
  }
  return problems;
}

export const questionInputSchema = z
  .object({
    type: z.enum(QuestionType),
    prompt: z.string().trim().min(1).max(5000),
    imageUrl: urlOrNull,
    explanation: optionalText(5000),
    /** MULTIPLE_CHOICE / IMAGE_BASED: allow several correct options. */
    isMultiple: z.boolean().default(false),
    points: z.number().int().min(1).max(100).default(1),
    options: z.array(questionOptionInputSchema).min(1).max(12),
  })
  .superRefine((q, ctx) => {
    for (const p of validateQuestionShape(q)) {
      ctx.addIssue({ code: 'custom', path: p.path, message: p.message });
    }
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** Completeness counters for the admin UI ("Practices 3/4", "Questions 5/6"). */
export const lessonCompletenessSchema = z.object({
  lessonId: z.string(),
  practices: z.number().int(),
  practicesRequired: z.number().int(),
  questionsPerPractice: z.array(
    z.object({ practiceId: z.string(), questions: z.number().int(), required: z.number().int() }),
  ),
  isComplete: z.boolean(),
});
export type LessonCompleteness = z.infer<typeof lessonCompletenessSchema>;

// ---------- student-facing (no correct answers!) ----------
export const publicQuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  imageUrl: z.string().nullable(),
});

/** What the student sees before submitting: never contains isCorrect, pairs or blank answers. */
export const publicQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(QuestionType),
  prompt: z.string(),
  imageUrl: z.string().nullable(),
  isMultiple: z.boolean(),
  points: z.number().int(),
  options: z.array(publicQuestionOptionSchema),
  /** MATCHING only: shuffled right-hand values. */
  matchTargets: z.array(z.string()).optional(),
  /** FILL_BLANK only: number of blanks in the prompt. */
  blankCount: z.number().int().optional(),
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const questionAnswerSchema = z.object({
  questionId: idSchema,
  /** MULTIPLE_CHOICE / TRUE_FALSE / IMAGE_BASED */
  selectedOptionIds: z.array(idSchema).max(12).optional(),
  /** MATCHING: left option id → chosen right-hand text */
  matches: z
    .array(z.object({ optionId: idSchema, matchText: z.string().max(1000) }))
    .max(12)
    .optional(),
  /** FILL_BLANK: answers by blank index */
  blanks: z.array(z.string().max(500)).max(20).optional(),
});
export type QuestionAnswer = z.infer<typeof questionAnswerSchema>;

export const practiceSubmitSchema = z.object({
  answers: z.array(questionAnswerSchema).max(50),
});
export type PracticeSubmitInput = z.infer<typeof practiceSubmitSchema>;

// ---------- exams & certificates ----------
export const examConfigSchema = z.object({
  title,
  questionCount: z.number().int().min(1).max(200),
  timeLimitMinutes: z.number().int().min(1).max(600),
  passScore: z.number().int().min(1).max(100),
  maxAttempts: z.number().int().min(1).max(100).nullable().optional(),
  shuffleQuestions: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type ExamConfigInput = z.infer<typeof examConfigSchema>;

export const examSubmitSchema = z.object({
  answers: z.array(questionAnswerSchema).max(200),
});
export type ExamSubmitInput = z.infer<typeof examSubmitSchema>;

export const certificateTemplateInputSchema = z.object({
  name: title,
  html: z.string().min(1).max(500000),
  backgroundImageUrl: urlOrNull,
  isDefault: z.boolean().default(false),
});
export type CertificateTemplateInput = z.infer<typeof certificateTemplateInputSchema>;

export const certificateVerifySchema = z.object({
  certificateId: z.string(),
  fullName: z.string(),
  courseTitle: z.string(),
  issuedAt: z.string(),
  isValid: z.boolean(),
});
export type CertificateVerify = z.infer<typeof certificateVerifySchema>;

// ---------- settings ----------
export const settingUpdateSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.json(),
});
export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;
