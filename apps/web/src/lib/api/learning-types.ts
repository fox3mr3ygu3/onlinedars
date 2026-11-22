/**
 * Student learning response shapes (contract with backend-learning, `/me/*`).
 *
 * TODO(merge): backend-learning publishes these in `@onlinedars/shared` (`schemas/learning.ts`).
 * Once that lands on main, delete this file and re-export from the shared package instead.
 * Kept field-for-field identical to that contract.
 */
import type {
  ExamAttemptStatus,
  PublicQuestion,
  QuestionAnswer,
  QuestionType,
} from '@onlinedars/shared';

export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  completedRequired: number;
  totalRequired: number;
  /** 0–100 */
  percent: number;
}

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

export interface ExamSummary {
  exists: boolean;
  isLocked: boolean;
  passed: boolean;
}

export interface CertificateRef {
  id: string;
  publicId: string;
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
  certificate: CertificateRef | null;
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

export type ExamLockReason = 'LESSONS_INCOMPLETE' | 'NO_EXAM' | 'ATTEMPTS_EXHAUSTED' | 'PASSED';

export interface StudentExamStatus {
  courseId: string;
  exam: StudentExamConfig | null;
  isLocked: boolean;
  lockReason: ExamLockReason | null;
  progress: CourseProgress;
  attemptsUsed: number;
  attemptsLeft: number | null;
  activeAttempt: { id: string; expiresAt: string } | null;
  lastResult: ExamResultSummary | null;
  passed: boolean;
  certificate: CertificateRef | null;
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
  questions: GradedQuestion[];
  certificate: CertificateRef | null;
}

export interface StudentResultItem extends ExamResultSummary {
  courseId: string;
  courseTitle: string;
  examTitle: string;
  passScore: number;
}

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

export type ActivityType = 'LESSON_VIEWED' | 'PRACTICE_SUBMITTED' | 'EXAM_SUBMITTED';

export interface StudentDashboard {
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    completedLessons: number;
    practiceAttempts: number;
    certificates: number;
    overallProgress: number;
  };
  courses: StudentCourseItem[];
  lastActivity: {
    type: ActivityType;
    at: string;
    courseId: string;
    courseTitle: string;
    lessonId: string | null;
    title: string;
  } | null;
}
