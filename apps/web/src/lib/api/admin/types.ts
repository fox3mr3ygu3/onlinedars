import type {
  CourseLevel,
  CourseStatus,
  EnrollmentSource,
  LessonMaterialType,
  PaymentProvider,
  PaymentStatus,
  QuestionType,
  Role,
} from '@onlinedars/shared';

/**
 * Response types of the admin API, written against the agreed contract while the backend is
 * built in parallel. TODO: replace with shared zod response schemas once packages/shared has them.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminMe {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
}

export interface Ref {
  id: string;
  name: string;
}

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  goals: string[];
  coverImageUrl: string | null;
  level: CourseLevel;
  status: CourseStatus;
  isFree: boolean;
  /** tiyin */
  price: number;
  sequentialUnlock: boolean;
  directionId: string | null;
  direction?: { id: string; name: string } | null;
  teacherIds?: string[];
  teachers?: { id: string; fullName: string }[];
  certificateTemplateId: string | null;
  modulesCount?: number;
  lessonsCount?: number;
  enrollmentsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  lessonsCount?: number;
}

export interface AdminLesson {
  id: string;
  moduleId: string;
  courseId?: string;
  title: string;
  summary: string | null;
  durationMinutes: number | null;
  position: number;
  isRequired: boolean;
  isPublished: boolean;
}

export interface AdminMaterial {
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

export interface AdminPractice {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  position: number;
  isRequired: boolean;
  passScore: number;
  questionsCount?: number;
}

export interface AdminQuestionOption {
  id?: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  matchText: string | null;
  blankIndex: number | null;
  position?: number;
}

export interface AdminQuestion {
  id: string;
  practiceId?: string;
  examId?: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  explanation: string | null;
  isMultiple: boolean;
  points: number;
  position: number;
  options: AdminQuestionOption[];
}

/** Normalised completeness counters (see normalizeCompleteness in content.ts). */
export interface Completeness {
  practices: number;
  required: number;
  questionsRequired: number;
  questionsPerPractice: { practiceId: string; questions: number }[];
  ready: boolean;
}

export interface UploadedFile {
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AdminDirection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  isActive: boolean;
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
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  position: number;
  isActive: boolean;
}

export interface AdminExam {
  id: string;
  courseId: string;
  title: string;
  questionCount: number;
  timeLimitMinutes: number;
  passScore: number;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  isActive: boolean;
  questionsCount?: number;
}

export interface AdminCertificateTemplate {
  id: string;
  name: string;
  html: string;
  backgroundImageUrl: string | null;
  isDefault: boolean;
  updatedAt?: string;
}

export interface AdminStudentListItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  enrollmentsCount?: number;
}

export interface AdminStudentEnrollment {
  courseId: string;
  courseTitle: string;
  source: EnrollmentSource;
  enrolledAt: string;
  completedAt: string | null;
  revokedAt: string | null;
  /** 0..100 */
  progressPercent: number;
}

export interface AdminStudentResult {
  id: string;
  kind: 'PRACTICE' | 'EXAM';
  title: string;
  courseTitle: string;
  scorePercent: number;
  passed: boolean;
  submittedAt: string;
}

export interface AdminStudentDetail extends AdminStudentListItem {
  avatarUrl: string | null;
  phoneVerified?: boolean;
  enrollments: AdminStudentEnrollment[];
  results: AdminStudentResult[];
  certificates?: { id: string; publicId: string; courseTitle: string; issuedAt: string }[];
}

export interface AdminPayment {
  id: string;
  orderId: string;
  orderNumber?: number;
  student: { id: string; fullName: string; phone?: string | null; email?: string | null };
  course: { id: string; title: string };
  /** tiyin */
  amount: number;
  currency: string;
  provider: PaymentProvider | null;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminAuditLog {
  id: string;
  actor: { id: string; fullName: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminDashboardStats {
  students: number;
  activeCourses: number;
  completedLessons: number;
  examsTaken: number;
  examsPassed: number;
  certificatesIssued?: number;
  revenue?: number;
  recentPayments?: AdminPayment[];
}

export interface CourseReportRow {
  courseId: string;
  courseTitle: string;
  enrolled: number;
  completed: number;
  completionRate: number;
}

export interface ExamReportRow {
  courseId: string;
  courseTitle: string;
  attempts: number;
  passed: number;
  averageScore: number;
}

export interface ActivityReportRow {
  date: string;
  activeStudents: number;
  lessonsCompleted: number;
  practicesSubmitted: number;
}

export type AdminSettings = Record<string, unknown>;
