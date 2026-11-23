import type { AdminLessonMaterial, AdminLessonSummary } from '@onlinedars/shared';
import type { Lesson, LessonMaterial, Prisma } from '@prisma/client';
import { computeCompleteness, iso, type PracticeCountRow } from '../courses/content.utils';

/** Prisma select for a lesson summary row incl. what the 4×6 counters need. */
export const lessonSummarySelect = {
  id: true,
  moduleId: true,
  title: true,
  summary: true,
  durationMinutes: true,
  position: true,
  isRequired: true,
  isPublished: true,
  publishedAt: true,
  practices: {
    select: { id: true, title: true, position: true, _count: { select: { questions: true } } },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.LessonSelect;

export type LessonSummaryRow = Pick<
  Lesson,
  | 'id'
  | 'moduleId'
  | 'title'
  | 'summary'
  | 'durationMinutes'
  | 'position'
  | 'isRequired'
  | 'isPublished'
  | 'publishedAt'
> & { practices: PracticeCountRow[] };

export function toAdminLessonSummary(l: LessonSummaryRow): AdminLessonSummary {
  const completeness = computeCompleteness(l);
  return {
    id: l.id,
    moduleId: l.moduleId,
    title: l.title,
    summary: l.summary,
    durationMinutes: l.durationMinutes,
    position: l.position,
    isRequired: l.isRequired,
    isPublished: l.isPublished,
    publishedAt: iso(l.publishedAt),
    practiceCount: completeness.practices,
    questionCount: completeness.totalQuestions,
    ready: completeness.ready,
  };
}

export function toAdminMaterial(m: LessonMaterial): AdminLessonMaterial {
  return {
    id: m.id,
    lessonId: m.lessonId,
    type: m.type,
    title: m.title,
    content: m.content,
    fileKey: m.fileKey,
    fileUrl: m.fileUrl,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    videoUrl: m.videoUrl,
    position: m.position,
  };
}
