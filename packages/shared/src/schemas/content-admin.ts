/**
 * Admin content API (backend-content): PATCH bodies, list queries and response shapes for
 * /admin/courses, /admin/modules, /admin/lessons, /admin/materials, /admin/practices,
 * /admin/questions, /admin/directions, /admin/teachers, /admin/faq.
 * Create bodies are the `*InputSchema`s in ./content.ts.
 * Admin responses DO contain correct answers (isCorrect, matchText, blank answers).
 */
import { z } from 'zod';
import { PRACTICES_PER_LESSON, QUESTIONS_PER_PRACTICE } from '../constants';
import {
  CourseLevel,
  CourseStatus,
  type LessonMaterialType,
  type QuestionType,
} from '../enums';
import { idSchema, paginationQuerySchema } from './common';
import {
  courseInputSchema,
  directionInputSchema,
  faqInputSchema,
  lessonInputSchema,
  lessonMaterialInputSchema,
  moduleInputSchema,
  practiceInputSchema,
  questionInputSchema,
  teacherInputSchema,
} from './content';

type Unwrapped<T> = T extends z.ZodDefault<infer I> ? I : T;
type PatchShape<S extends z.ZodRawShape> = { [K in keyof S]: z.ZodOptional<Unwrapped<S[K]>> };

/**
 * Builds a PATCH schema from a create schema's shape: every field optional and **defaults
 * removed**, so omitted fields stay untouched instead of being reset to their default.
 * Cross-field refinements of the create schema are not copied (services re-check merged values).
 */
export function toPatchSchema<S extends z.ZodRawShape>(shape: S): z.ZodObject<PatchShape<S>> {
  const out: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(shape)) {
    const inner = field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field;
    out[key] = (inner as z.ZodType).optional();
  }
  return z.object(out) as unknown as z.ZodObject<PatchShape<S>>;
}

// ---------- list queries ----------
export const adminCourseListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(CourseStatus).optional(),
  directionId: idSchema.optional(),
  level: z.enum(CourseLevel).optional(),
});
export type AdminCourseListQuery = z.infer<typeof adminCourseListQuerySchema>;

export const adminListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

// ---------- PATCH bodies ----------
export const courseUpdateSchema = toPatchSchema(courseInputSchema.shape).superRefine((v, ctx) => {
  if (v.isFree === true && v.price !== undefined && v.price !== 0) {
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'validation.freeCoursePrice' });
  }
  if (v.isFree === false && v.price !== undefined && v.price <= 0) {
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'validation.paidCoursePrice' });
  }
});
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

export const moduleUpdateSchema = toPatchSchema(moduleInputSchema.shape);
export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;

export const lessonUpdateSchema = toPatchSchema(lessonInputSchema.shape);
export type LessonUpdateInput = z.infer<typeof lessonUpdateSchema>;

/** The merged material is re-validated against lessonMaterialInputSchema by the API. */
export const lessonMaterialUpdateSchema = toPatchSchema(lessonMaterialInputSchema.shape);
export type LessonMaterialUpdateInput = z.infer<typeof lessonMaterialUpdateSchema>;

export const practiceUpdateSchema = toPatchSchema(practiceInputSchema.shape);
export type PracticeUpdateInput = z.infer<typeof practiceUpdateSchema>;

/**
 * PATCH /admin/questions/:id. When `options` is sent it **replaces** all options.
 * The merged question is re-validated with validateQuestionShape by the API.
 */
export const questionUpdateSchema = toPatchSchema(questionInputSchema.shape);
export type QuestionUpdateInput = z.infer<typeof questionUpdateSchema>;

export const directionUpdateSchema = toPatchSchema(directionInputSchema.shape);
export type DirectionUpdateInput = z.infer<typeof directionUpdateSchema>;

export const teacherUpdateSchema = toPatchSchema(teacherInputSchema.shape);
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;

export const faqUpdateSchema = toPatchSchema(faqInputSchema.shape);
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;

// ---------- 4×6 completeness ----------
export const practiceCompletenessSchema = z.object({
  practiceId: z.string(),
  title: z.string(),
  position: z.number().int(),
  questions: z.number().int(),
  required: z.number().int(),
  ready: z.boolean(),
});
export type PracticeCompleteness = z.infer<typeof practiceCompletenessSchema>;

/**
 * GET /admin/lessons/:id/completeness — drives the "Practices 3/4", "Questions 5/6" counters.
 * `ready` = exactly 4 practices with exactly 6 questions each (the lesson may be published).
 */
export const lessonCompletenessResponseSchema = z.object({
  lessonId: z.string(),
  isPublished: z.boolean(),
  practices: z.number().int(),
  required: z.literal(PRACTICES_PER_LESSON),
  questionsRequired: z.literal(QUESTIONS_PER_PRACTICE),
  questionsPerPractice: z.array(practiceCompletenessSchema),
  totalQuestions: z.number().int(),
  ready: z.boolean(),
});
export type LessonCompletenessResponse = z.infer<typeof lessonCompletenessResponseSchema>;

// ---------- admin response shapes ----------
export interface AdminDirection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  isActive: boolean;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTeacher {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  position: number;
  isActive: boolean;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCourseListItem {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  level: CourseLevel;
  isFree: boolean;
  price: number;
  currency: string;
  sequentialUnlock: boolean;
  coverImageUrl: string | null;
  direction: { id: string; slug: string; name: string } | null;
  moduleCount: number;
  lessonCount: number;
  publishedLessonCount: number;
  enrollmentCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLessonSummary {
  id: string;
  moduleId: string;
  title: string;
  summary: string | null;
  durationMinutes: number | null;
  position: number;
  isRequired: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  practiceCount: number;
  questionCount: number;
  /** 4×6 complete */
  ready: boolean;
}

export interface AdminModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  lessons: AdminLessonSummary[];
}

export interface AdminCourseDetail extends AdminCourseListItem {
  shortDescription: string;
  description: string;
  goals: string[];
  directionId: string | null;
  certificateTemplateId: string | null;
  teachers: { id: string; slug: string; fullName: string }[];
  modules: AdminModule[];
}

export interface AdminLessonMaterial {
  id: string;
  lessonId: string;
  type: LessonMaterialType;
  title: string | null;
  content: string | null;
  fileKey: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  videoUrl: string | null;
  position: number;
}

export interface AdminQuestionOption {
  id: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  matchText: string | null;
  blankIndex: number | null;
  position: number;
}

export interface AdminQuestion {
  id: string;
  practiceId: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  explanation: string | null;
  isMultiple: boolean;
  points: number;
  position: number;
  options: AdminQuestionOption[];
}

export interface AdminPractice {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  position: number;
  isRequired: boolean;
  passScore: number;
  questionCount: number;
  questionsRequired: number;
}

export interface AdminPracticeDetail extends AdminPractice {
  questions: AdminQuestion[];
}

export interface AdminLessonDetail extends AdminLessonSummary {
  courseId: string;
  materials: AdminLessonMaterial[];
  practices: AdminPractice[];
  completeness: LessonCompletenessResponse;
}
