/**
 * Domain enums shared by web and api. Values MUST match the Prisma enums in
 * apps/api/prisma/schema.prisma (a unit test in apps/api checks this).
 */

export const Role = {
  ADMIN: 'ADMIN',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  STUDENT: 'STUDENT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Roles that may manage course content (courses, modules, lessons, practices, questions). */
export const CONTENT_ROLES = [Role.ADMIN, Role.CONTENT_MANAGER] as const;
/** Roles that may access the admin panel at all. */
export const STAFF_ROLES = [Role.ADMIN, Role.CONTENT_MANAGER] as const;

export const CourseStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const CourseLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
} as const;
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const QuestionType = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  MATCHING: 'MATCHING',
  FILL_BLANK: 'FILL_BLANK',
  IMAGE_BASED: 'IMAGE_BASED',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const LessonMaterialType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
  VIDEO: 'VIDEO',
} as const;
export type LessonMaterialType = (typeof LessonMaterialType)[keyof typeof LessonMaterialType];

export const EnrollmentSource = {
  /** Granted directly by an admin (Talabalar -> Kursga kirish berish). */
  ADMIN: 'ADMIN',
  /** An admin approved the student's access request. */
  ACCESS_REQUEST: 'ACCESS_REQUEST',
} as const;
export type EnrollmentSource = (typeof EnrollmentSource)[keyof typeof EnrollmentSource];

export const AccessRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type AccessRequestStatus = (typeof AccessRequestStatus)[keyof typeof AccessRequestStatus];

export const ExamAttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  EXPIRED: 'EXPIRED',
} as const;
export type ExamAttemptStatus = (typeof ExamAttemptStatus)[keyof typeof ExamAttemptStatus];

export const OtpPurpose = {
  REGISTER: 'REGISTER',
  RESET_PASSWORD: 'RESET_PASSWORD',
  VERIFY_PHONE: 'VERIFY_PHONE',
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const NotificationType = {
  ACCESS_GRANTED: 'ACCESS_GRANTED',
  ACCESS_REJECTED: 'ACCESS_REJECTED',
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
