/**
 * Public catalog API (backend-content): query params and response shapes for
 * GET /courses, /courses/:slug, /directions, /teachers, /faq.
 * These responses never contain practice questions or answers.
 */
import { z } from 'zod';
import { CourseLevel } from '../enums';
import { idSchema, paginated, paginationQuerySchema } from './common';

/** GET /courses query. `search` is the documented name; `q` is accepted as an alias. */
export const publicCourseListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  directionId: idSchema.optional(),
  /** Direction slug, alternative to directionId (handy for /directions/[slug] pages). */
  direction: z.string().trim().max(120).optional(),
  teacherId: idSchema.optional(),
  level: z.enum(CourseLevel).optional(),
  sort: z.enum(['newest', 'popular', 'title']).default('newest'),
});
export type PublicCourseListQuery = z.infer<typeof publicCourseListQuerySchema>;

/** GET /directions, /teachers, /faq: optional paging (defaults to everything active, max 100). */
export const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;

export const publicDirectionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  position: z.number().int(),
  /** Number of PUBLISHED courses in this direction. */
  courseCount: z.number().int(),
});
export type PublicDirection = z.infer<typeof publicDirectionSchema>;
export const publicDirectionListSchema = paginated(publicDirectionSchema);

export const publicTeacherSchema = z.object({
  id: z.string(),
  slug: z.string(),
  fullName: z.string(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  position: z.number().int(),
  /** Number of PUBLISHED courses taught. */
  courseCount: z.number().int(),
});
export type PublicTeacher = z.infer<typeof publicTeacherSchema>;
export const publicTeacherListSchema = paginated(publicTeacherSchema);

export const publicFaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  position: z.number().int(),
});
export type PublicFaq = z.infer<typeof publicFaqSchema>;
export const publicFaqListSchema = paginated(publicFaqSchema);

const directionRef = z.object({ id: z.string(), slug: z.string(), name: z.string() });
const teacherRef = z.object({
  id: z.string(),
  slug: z.string(),
  fullName: z.string(),
  title: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

/** Catalog card. `lessonCount` counts published lessons only. */
export const publicCourseCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  coverImageUrl: z.string().nullable(),
  level: z.enum(CourseLevel),
  direction: directionRef.nullable(),
  teachers: z.array(teacherRef),
  moduleCount: z.number().int(),
  lessonCount: z.number().int(),
  /** Sum of published lessons' durationMinutes (0 when unknown). */
  durationMinutes: z.number().int(),
  publishedAt: z.string().nullable(),
});
export type PublicCourseCard = z.infer<typeof publicCourseCardSchema>;
export const publicCourseListSchema = paginated(publicCourseCardSchema);

export const publicLessonOutlineSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  position: z.number().int(),
  /** Free preview lesson: materials open without enrolling. */
  isPreview: z.boolean(),
});

export const publicModuleOutlineSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  lessons: z.array(publicLessonOutlineSchema),
});

/** Course page: description, goals, program (modules → published lessons). */
export const publicCourseDetailSchema = publicCourseCardSchema.extend({
  description: z.string(),
  goals: z.array(z.string()),
  sequentialUnlock: z.boolean(),
  hasExam: z.boolean(),
  /** Promo video (YouTube / Vimeo / direct link) or null. */
  introVideoUrl: z.string().nullable(),
  modules: z.array(publicModuleOutlineSchema),
});
export type PublicCourseDetail = z.infer<typeof publicCourseDetailSchema>;

/** GET /courses/:slugOrId/lessons/:lessonId/preview — materials of a free preview lesson. */
export const publicLessonPreviewSchema = z.object({
  course: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  }),
  lesson: z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    durationMinutes: z.number().int().nullable(),
  }),
  materials: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string().nullable(),
      content: z.string().nullable(),
      fileUrl: z.string().nullable(),
      mimeType: z.string().nullable(),
      sizeBytes: z.number().int().nullable(),
      videoUrl: z.string().nullable(),
      position: z.number().int(),
    }),
  ),
});
export type PublicLessonPreview = z.infer<typeof publicLessonPreviewSchema>;
