import { cache } from 'react';
import { isApiError } from '@/lib/api/client';
import { type CourseDetail, getCourse } from '@/lib/api/public';

export type CourseLoad =
  | { kind: 'ok'; course: CourseDetail }
  | { kind: 'notFound' }
  | { kind: 'error' };

/** Server-side course load shared by generateMetadata and the page (deduped per request). */
export const loadCourse = cache(async (slugOrId: string): Promise<CourseLoad> => {
  try {
    return { kind: 'ok', course: await getCourse(slugOrId) };
  } catch (e) {
    if (isApiError(e) && e.status === 404) return { kind: 'notFound' };
    return { kind: 'error' };
  }
});
