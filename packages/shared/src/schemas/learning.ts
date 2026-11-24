/**
 * Learning domain (backend-learning): student progress, practice results, final exams,
 * certificates, admin reports, admin students. Request schemas validate input; the
 * response types document what the API returns (they are not used for runtime parsing).
 *
 * Student-facing question shapes come from `publicQuestionSchema` in ./content and never
 * contain correct answers.
 */
import { z } from 'zod';
import type { ExamAttemptStatus, QuestionType } from '../enums';
import { idSchema, paginationQuerySchema } from './common';
import type { PublicQuestion, QuestionAnswer } from './content';

/** Seconds a late exam submit is still accepted after `expiresAt` (network latency). */
export const EXAM_SUBMIT_GRACE_SECONDS = 30;

// ───────────── requests ─────────────

export const courseIdParamSchema = z.object({ courseId: idSchema });
export const lessonIdParamSchema = z.object({ lessonId: idSchema });
export const practiceIdParamSchema = z.object({ practiceId: idSchema });
export const attemptIdParamSchema = z.object({ attemptId: idSchema });

/** Autosave of an in-progress exam attempt (replaces all saved answers). */
export const examAutosaveSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: idSchema,
        selectedOptionIds: z.array(idSchema).max(12).optional(),
        matches: z
          .array(z.object({ optionId: idSchema, matchText: z.string().max(1000) }))
          .max(12)
          .optional(),
        blanks: z.array(z.string().max(500)).max(20).optional(),
      }),
    )
    .max(200),
});
export type ExamAutosaveInput = z.infer<typeof examAutosaveSchema>;

export const adminStudentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
});
export type AdminStudentsQuery = z.infer<typeof adminStudentsQuerySchema>;

export const grantEnrollmentSchema = z.object({
  courseId: idSchema,
  reason: z.string().trim().max(500).optional(),
});
export type GrantEnrollmentInput = z.infer<typeof grantEnrollmentSchema>;

export const reportRangeQuerySchema = z.object({
  /** ISO date (inclusive). Defaults to 30 days ago. */
  from: z.iso.date().optional(),
  /** ISO date (inclusive). Defaults to today. */
  to: z.iso.date().optional(),
  courseId: idSchema.optional(),
});
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;

export const certificateTemplatePreviewSchema = z.object({
  html: z.string().min(1).max(500000),
  backgroundImageUrl: z.url().max(2048).nullable().optional(),
});
export type CertificateTemplatePreviewInput = z.infer<typeof certificateTemplatePreviewSchema>;

// ───────────── responses: course tree & lessons ─────────────

export interface LessonNode {
  id: string;
  title: string;
  position: number;
  durationMinutes: number | null;
  isRequired: boolean;
  isLocked: boolean;
  materialViewed: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  practicesTotal: number;
  practicesPassed: number;
}

export interface ModuleNode {
  id: string;
  title: string;
  description: string | null;
  position: number;
  isLocked: boolean;
  completedLessons: number;
  totalLessons: number;
  lessons: LessonNode[];
}

export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  /** Required lessons only (they gate the exam). */
  completedRequired: number;
  totalRequired: number;
  /** 0–100, based on required lessons (all lessons if none are required). */
  percent: number;
}

export interface ExamSummary {
  exists: boolean;
  isLocked: boolean;
  passed: boolean;
}

export interface StudentCourseTree {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  sequentialUnlock: boolean;
  progress: CourseProgress;
  modules: ModuleNode[];
  exam: ExamSummary;
  certificate: { id: string; publicId: string } | null;
  nextLessonId: string | null;
}

export interface LessonMaterialView {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  videoUrl: string | null;
  position: number;
}

export interface PracticeSummary {
  id: string;
  title: string;
  description: string | null;
  position: number;
  isRequired: boolean;
  passScore: number;
  questionCount: number;
  attempts: number;
  bestPercent: number | null;
  passed: boolean;
}

export interface LessonProgressState {
  lessonId: string;
  materialViewed: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  requiredPractices: number;
  passedRequiredPractices: number;
}

export interface StudentLessonView {
  id: string;
  title: string;
  summary: string | null;
  durationMinutes: number | null;
  courseId: string;
  moduleId: string;
  materials: LessonMaterialView[];
  practices: PracticeSummary[];
  progress: LessonProgressState;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface LessonViewedResult {
  lesson: LessonProgressState;
  course: CourseProgress;
}

// ───────────── responses: practices ─────────────

export interface StudentPracticeView {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  description: string | null;
  passScore: number;
  isRequired: boolean;
  questions: PublicQuestion[];
  attempts: PracticeAttemptSummary[];
}

export interface PracticeAttemptSummary {
  id: string;
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  submittedAt: string | null;
}

/** Revealed only after submission. */
export interface CorrectAnswer {
  selectedOptionIds?: string[];
  matches?: { optionId: string; matchText: string }[];
  /** Accepted answers per blank index. */
  blanks?: string[][];
}

export interface GradedQuestion {
  questionId: string;
  type: QuestionType;
  isCorrect: boolean;
  pointsAwarded: number;
  points: number;
}

export interface PracticeQuestionResult extends GradedQuestion {
  answer: QuestionAnswer | null;
  correctAnswer: CorrectAnswer;
  explanation: string | null;
}

export interface PracticeResult {
  attempt: PracticeAttemptSummary;
  questions: PracticeQuestionResult[];
  lesson: LessonProgressState;
  course: CourseProgress;
}

// ───────────── responses: exams ─────────────

export interface StudentExamConfig {
  id: string;
  title: string;
  questionCount: number;
  timeLimitMinutes: number;
  passScore: number;
  maxAttempts: number | null;
}

export interface ExamResultSummary {
  attemptId: string;
  status: ExamAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
}

export interface StudentExamStatus {
  courseId: string;
  exam: StudentExamConfig | null;
  isLocked: boolean;
  /** Why the exam can't be started: LESSONS_INCOMPLETE, NO_EXAM, ATTEMPTS_EXHAUSTED, PASSED. */
  lockReason: 'LESSONS_INCOMPLETE' | 'NO_EXAM' | 'ATTEMPTS_EXHAUSTED' | 'PASSED' | null;
  progress: CourseProgress;
  attemptsUsed: number;
  attemptsLeft: number | null;
  activeAttempt: { id: string; expiresAt: string } | null;
  lastResult: ExamResultSummary | null;
  passed: boolean;
  certificate: { id: string; publicId: string } | null;
}

export interface ExamAttemptView {
  id: string;
  examId: string;
  courseId: string;
  title: string;
  startedAt: string;
  expiresAt: string;
  /** Server time when the response was built, so the client can correct clock skew. */
  serverTime: string;
  timeLimitMinutes: number;
  questions: PublicQuestion[];
  savedAnswers: QuestionAnswer[];
}

export interface ExamSubmitResult extends ExamResultSummary {
  passScore: number;
  correctCount: number;
  totalCount: number;
  /** Per-question correctness only; correct answers of the exam pool are never revealed. */
  questions: GradedQuestion[];
  certificate: { id: string; publicId: string } | null;
}

export interface StudentResultItem extends ExamResultSummary {
  courseId: string;
  courseTitle: string;
  examTitle: string;
  passScore: number;
}

// ───────────── responses: certificates ─────────────

export interface StudentCertificateItem {
  id: string;
  publicId: string;
  courseId: string;
  courseTitle: string;
  fullName: string;
  issuedAt: string;
  verifyUrl: string;
  pdfReady: boolean;
}

export interface CertificateTemplateItem {
  id: string;
  name: string;
  html: string;
  backgroundImageUrl: string | null;
  isDefault: boolean;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}

// ───────────── responses: dashboards & reports ─────────────

export interface StudentCourseItem {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  enrolledAt: string;
  progress: CourseProgress;
  lastActivityAt: string | null;
  nextLessonId: string | null;
  examPassed: boolean;
  certificateId: string | null;
}

export interface StudentDashboard {
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    completedLessons: number;
    practiceAttempts: number;
    certificates: number;
    /** Average course percent over enrolled courses, 0–100. */
    overallProgress: number;
  };
  courses: StudentCourseItem[];
  lastActivity: {
    type: 'LESSON_VIEWED' | 'PRACTICE_SUBMITTED' | 'EXAM_SUBMITTED';
    at: string;
    courseId: string;
    courseTitle: string;
    lessonId: string | null;
    title: string;
  } | null;
}

export interface AdminDashboardStats {
  students: number;
  newStudents30d: number;
  activeCourses: number;
  enrollments: number;
  completedLessons: number;
  practiceAttempts: number;
  examAttempts: number;
  examsPassed: number;
  certificates: number;
  /** Access requests waiting for an admin decision. */
  pendingAccessRequests: number;
  recentResults: {
    attemptId: string;
    studentId: string;
    studentName: string;
    courseTitle: string;
    percent: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  }[];
}

export interface CourseReportRow {
  courseId: string;
  title: string;
  status: string;
  enrollments: number;
  activeEnrollments: number;
  requiredLessons: number;
  lessonCompletions: number;
  /** Average % of required lessons completed per active enrollment. */
  avgProgress: number;
  examPassed: number;
  certificates: number;
  /** certificates / active enrollments, 0–100. */
  completionRate: number;
}

export interface ExamReportRow {
  examId: string;
  courseId: string;
  courseTitle: string;
  title: string;
  attempts: number;
  finished: number;
  passed: number;
  passRate: number;
  avgPercent: number | null;
}

export interface ActivityReportDay {
  date: string;
  lessonsCompleted: number;
  practiceAttempts: number;
  examAttempts: number;
  enrollments: number;
  newStudents: number;
}

export interface AdminStudentListItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  enrollments: number;
  certificates: number;
}

export interface AdminStudentProfile {
  student: AdminStudentListItem;
  enrollments: {
    courseId: string;
    courseTitle: string;
    source: string;
    enrolledAt: string;
    revokedAt: string | null;
    completedAt: string | null;
    progress: CourseProgress;
  }[];
  results: StudentResultItem[];
  certificates: StudentCertificateItem[];
  practiceStats: { attempts: number; passed: number; avgPercent: number | null };
}
