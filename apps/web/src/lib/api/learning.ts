/**
 * Typed client for the student learning API (`/me/*`, backend-learning).
 * Correct answers never come from these endpoints before a submission.
 */
import type { Paginated, PracticeSubmitInput, QuestionAnswer } from '@onlinedars/shared';
import type {
  ExamAttemptView,
  ExamSubmitResult,
  LessonViewedResult,
  PracticeResult,
  StudentCertificateItem,
  StudentCourseItem,
  StudentCourseTree,
  StudentDashboard,
  StudentExamStatus,
  StudentLessonView,
  StudentPracticeView,
  StudentResultItem,
} from './learning-types';
import { studentFetch, toQuery } from './student-fetch';

export * from './learning-types';

const enc = encodeURIComponent;

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export const learningApi = {
  dashboard: () => studentFetch<StudentDashboard>('/me/dashboard'),

  courses: (q: PageQuery = {}) =>
    studentFetch<Paginated<StudentCourseItem>>(`/me/courses${toQuery({ ...q })}`),

  course: (courseId: string) => studentFetch<StudentCourseTree>(`/me/courses/${enc(courseId)}`),

  lesson: (lessonId: string) => studentFetch<StudentLessonView>(`/me/lessons/${enc(lessonId)}`),

  markViewed: (lessonId: string) =>
    studentFetch<LessonViewedResult>(`/me/lessons/${enc(lessonId)}/viewed`, { method: 'POST' }),

  practice: (practiceId: string) =>
    studentFetch<StudentPracticeView>(`/me/practices/${enc(practiceId)}`),

  submitPractice: (practiceId: string, answers: QuestionAnswer[]) =>
    studentFetch<PracticeResult>(`/me/practices/${enc(practiceId)}/attempts`, {
      method: 'POST',
      body: { answers } satisfies PracticeSubmitInput,
    }),

  examStatus: (courseId: string) =>
    studentFetch<StudentExamStatus>(`/me/courses/${enc(courseId)}/exam`),

  /** Starts a new attempt, or returns the active one (the server owns the deadline). */
  startExam: (courseId: string) =>
    studentFetch<ExamAttemptView>(`/me/courses/${enc(courseId)}/exam/attempts`, {
      method: 'POST',
    }),

  submitExam: (attemptId: string, answers: QuestionAnswer[]) =>
    studentFetch<ExamSubmitResult>(`/me/exam-attempts/${enc(attemptId)}/submit`, {
      method: 'POST',
      body: { answers },
    }),

  results: (q: PageQuery = {}) =>
    studentFetch<Paginated<StudentResultItem>>(`/me/results${toQuery({ ...q })}`),

  certificates: (q: PageQuery = {}) =>
    studentFetch<Paginated<StudentCertificateItem>>(`/me/certificates${toQuery({ ...q })}`),
};

/** Path of the certificate PDF (served by the API; the browser downloads it with the session). */
export const certificatePdfPath = (certificateId: string) =>
  `/me/certificates/${enc(certificateId)}/pdf`;
