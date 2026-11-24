import type {
  CourseAccessState,
  CreateAccessRequestInput,
  MyAccessRequest,
} from '@onlinedars/shared';
import { authFetch } from '../auth/session';

/*
 * Course access (students). Courses are never bought or self-enrolled: the student asks and an
 * admin approves or rejects. The server decides everything; these calls only read and ask.
 */

/** Enrolled, or the state of the student's own request for this course. */
export function getCourseAccess(
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseAccessState> {
  return authFetch<CourseAccessState>(`/me/course-access/${encodeURIComponent(courseId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function requestCourseAccess(input: CreateAccessRequestInput): Promise<MyAccessRequest> {
  return authFetch<MyAccessRequest>('/access-requests', { method: 'POST', body: input });
}

export function listMyAccessRequests(): Promise<MyAccessRequest[]> {
  return authFetch<MyAccessRequest[]>('/me/access-requests', { cache: 'no-store' });
}
