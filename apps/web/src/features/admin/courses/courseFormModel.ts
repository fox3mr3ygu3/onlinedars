import { type CourseInput, CourseLevel } from '@onlinedars/shared';
import type { AdminCourse } from '@/lib/api/admin/types';

/** Course editor form state. Courses have no price: access is granted by admins. */
export interface CourseFormValues {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  goalsText: string;
  coverImageUrl: string;
  introVideoUrl: string;
  level: CourseLevel;
  sequentialUnlock: boolean;
  directionId: string;
  teacherIds: string[];
  certificateTemplateId: string;
}

export const emptyCourseForm: CourseFormValues = {
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  goalsText: '',
  coverImageUrl: '',
  introVideoUrl: '',
  level: CourseLevel.BEGINNER,
  sequentialUnlock: true,
  directionId: '',
  teacherIds: [],
  certificateTemplateId: '',
};

export function toCourseInput(v: CourseFormValues): CourseInput {
  return {
    title: v.title.trim(),
    slug: v.slug.trim(),
    shortDescription: v.shortDescription.trim(),
    description: v.description,
    goals: v.goalsText
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean),
    coverImageUrl: v.coverImageUrl || null,
    introVideoUrl: v.introVideoUrl.trim() || null,
    level: v.level,
    sequentialUnlock: v.sequentialUnlock,
    directionId: v.directionId || null,
    teacherIds: v.teacherIds,
    certificateTemplateId: v.certificateTemplateId || null,
  };
}

export function fromCourse(c: AdminCourse): CourseFormValues {
  return {
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription ?? '',
    description: c.description ?? '',
    goalsText: (c.goals ?? []).join('\n'),
    coverImageUrl: c.coverImageUrl ?? '',
    introVideoUrl: c.introVideoUrl ?? '',
    level: c.level,
    sequentialUnlock: c.sequentialUnlock,
    directionId: c.directionId ?? c.direction?.id ?? '',
    teacherIds: c.teacherIds ?? c.teachers?.map((t) => t.id) ?? [],
    certificateTemplateId: c.certificateTemplateId ?? '',
  };
}

/** Maps a CourseInput issue path back to the form field. */
export function courseFieldFor(path: PropertyKey[]): string {
  const k = String(path[0] ?? 'root');
  if (k === 'goals') return 'goalsText';
  return k;
}

/** Suggests a slug from the title (Uzbek Latin → ascii). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
