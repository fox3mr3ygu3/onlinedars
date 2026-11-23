import type {
  AdminPaymentStatusChange,
  CertificateTemplateInput,
  DirectionInput,
  ExamConfigInput,
  FaqInput,
  PaymentProvider,
  PaymentStatus,
  QuestionInput,
  TeacherInput,
} from '@onlinedars/shared';
import { itemsOf } from './content';
import { adminFetch, qs } from './http';
import type {
  ActivityReportRow,
  AdminAuditLog,
  AdminCertificateTemplate,
  AdminDashboardStats,
  AdminDirection,
  AdminExam,
  AdminFaq,
  AdminMe,
  AdminPayment,
  AdminQuestion,
  AdminSettings,
  AdminStudentDetail,
  AdminStudentListItem,
  AdminTeacher,
  CourseReportRow,
  ExamReportRow,
  Paginated,
} from './types';

export const getMe = () => adminFetch<AdminMe>('/auth/me');

// ---------- directions / teachers / faq ----------
function crud<T, I>(base: string) {
  return {
    list: async () =>
      itemsOf(await adminFetch<T[] | Paginated<T>>(`${base}${qs({ pageSize: 100 })}`)),
    create: (body: I) => adminFetch<T>(base, { method: 'POST', body }),
    update: (id: string, body: Partial<I>) =>
      adminFetch<T>(`${base}/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => adminFetch<void>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const directionsApi = crud<AdminDirection, DirectionInput>('/admin/directions');
export const teachersApi = crud<AdminTeacher, TeacherInput>('/admin/teachers');
export const faqApi = crud<AdminFaq, FaqInput>('/admin/faq');

// ---------- settings (ADMIN only) ----------
export const getSettings = () => adminFetch<AdminSettings>('/admin/settings');
export const updateSettings = (body: AdminSettings) =>
  adminFetch<AdminSettings>('/admin/settings', { method: 'PATCH', body });

// ---------- exams ----------
/** Returns null when the course has no exam yet (404). */
export async function getExam(courseId: string): Promise<AdminExam | null> {
  try {
    return await adminFetch<AdminExam>(`/admin/courses/${courseId}/exam`);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}
export const saveExam = (courseId: string, body: ExamConfigInput) =>
  adminFetch<AdminExam>(`/admin/courses/${courseId}/exam`, { method: 'PUT', body });
export const listExamQuestions = async (courseId: string) =>
  itemsOf(
    await adminFetch<AdminQuestion[] | Paginated<AdminQuestion>>(
      `/admin/courses/${courseId}/exam/questions${qs({ pageSize: 100 })}`,
    ),
  );
export const createExamQuestion = (courseId: string, body: QuestionInput) =>
  adminFetch<AdminQuestion>(`/admin/courses/${courseId}/exam/questions`, { method: 'POST', body });
export const updateExamQuestion = (courseId: string, id: string, body: QuestionInput) =>
  adminFetch<AdminQuestion>(`/admin/courses/${courseId}/exam/questions/${id}`, {
    method: 'PATCH',
    body,
  });
export const deleteExamQuestion = (courseId: string, id: string) =>
  adminFetch<void>(`/admin/courses/${courseId}/exam/questions/${id}`, { method: 'DELETE' });

// ---------- certificate templates ----------
export const certificateTemplatesApi = {
  ...crud<AdminCertificateTemplate, CertificateTemplateInput>('/admin/certificate-templates'),
  get: (id: string) => adminFetch<AdminCertificateTemplate>(`/admin/certificate-templates/${id}`),
};

// ---------- dashboard & reports ----------
export const getDashboard = () => adminFetch<AdminDashboardStats>('/admin/dashboard');

export interface ReportRange {
  from?: string;
  to?: string;
}
export const getCoursesReport = async (r: ReportRange = {}) =>
  itemsOf(
    await adminFetch<CourseReportRow[] | Paginated<CourseReportRow>>(
      `/admin/reports/courses${qs({ ...r })}`,
    ),
  );
export const getExamsReport = async (r: ReportRange = {}) =>
  itemsOf(
    await adminFetch<ExamReportRow[] | Paginated<ExamReportRow>>(
      `/admin/reports/exams${qs({ ...r })}`,
    ),
  );
export const getActivityReport = async (r: ReportRange = {}) =>
  itemsOf(
    await adminFetch<ActivityReportRow[] | Paginated<ActivityReportRow>>(
      `/admin/reports/activity${qs({ ...r })}`,
    ),
  );

// ---------- students ----------
export const listStudents = (q: { search?: string; page?: number; pageSize?: number } = {}) =>
  adminFetch<Paginated<AdminStudentListItem>>(`/admin/students${qs({ ...q })}`);
export const getStudent = (id: string) => adminFetch<AdminStudentDetail>(`/admin/students/${id}`);
export const grantEnrollment = (studentId: string, courseId: string) =>
  adminFetch<void>(`/admin/students/${studentId}/enrollments`, {
    method: 'POST',
    body: { courseId },
  });
export const revokeEnrollment = (studentId: string, courseId: string) =>
  adminFetch<void>(`/admin/students/${studentId}/enrollments/${courseId}`, { method: 'DELETE' });

// ---------- payments ----------
export interface PaymentListQuery {
  status?: PaymentStatus | '';
  provider?: PaymentProvider | '';
  courseId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
export const listPayments = (q: PaymentListQuery = {}) =>
  adminFetch<Paginated<AdminPayment>>(`/admin/payments${qs({ ...q })}`);
export const changePaymentStatus = (id: string, body: AdminPaymentStatusChange) =>
  adminFetch<AdminPayment>(`/admin/payments/${id}/status`, { method: 'PATCH', body });

// ---------- audit ----------
export interface AuditQuery {
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
export const listAuditLogs = (q: AuditQuery = {}) =>
  adminFetch<Paginated<AdminAuditLog>>(`/admin/audit-logs${qs({ ...q })}`);
