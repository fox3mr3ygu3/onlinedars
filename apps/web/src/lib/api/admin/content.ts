import {
  type CourseInput,
  type CourseStatus,
  type LessonInput,
  type LessonMaterialInput,
  type ModuleInput,
  PRACTICES_PER_LESSON,
  type PracticeInput,
  QUESTIONS_PER_PRACTICE,
  type QuestionInput,
} from '@onlinedars/shared';
import { adminFetch, adminUpload, qs } from './http';
import type {
  AdminCourse,
  AdminLesson,
  AdminMaterial,
  AdminModule,
  AdminPractice,
  AdminQuestion,
  Completeness,
  Paginated,
  UploadedFile,
} from './types';

/** Some list endpoints may return a bare array; accept both. */
export function itemsOf<T>(r: T[] | Paginated<T>): T[] {
  return Array.isArray(r) ? r : r.items;
}

// ---------- courses ----------
export interface CourseListQuery {
  search?: string;
  status?: CourseStatus | '';
  page?: number;
  pageSize?: number;
}

export const listCourses = (q: CourseListQuery = {}) =>
  adminFetch<Paginated<AdminCourse>>(`/admin/courses${qs({ ...q })}`);
export const getCourse = (id: string) => adminFetch<AdminCourse>(`/admin/courses/${id}`);
export const createCourse = (body: CourseInput) =>
  adminFetch<AdminCourse>('/admin/courses', { method: 'POST', body });
export const updateCourse = (id: string, body: Partial<CourseInput>) =>
  adminFetch<AdminCourse>(`/admin/courses/${id}`, { method: 'PATCH', body });
export const deleteCourse = (id: string) =>
  adminFetch<void>(`/admin/courses/${id}`, { method: 'DELETE' });
export const setCourseStatus = (id: string, status: CourseStatus) =>
  adminFetch<AdminCourse>(`/admin/courses/${id}/status`, { method: 'POST', body: { status } });

// ---------- modules ----------
export const listModules = async (courseId: string) =>
  itemsOf(
    await adminFetch<AdminModule[] | Paginated<AdminModule>>(`/admin/courses/${courseId}/modules`),
  );
export const createModule = (courseId: string, body: ModuleInput) =>
  adminFetch<AdminModule>(`/admin/courses/${courseId}/modules`, { method: 'POST', body });
export const reorderModules = (courseId: string, ids: string[]) =>
  adminFetch<void>(`/admin/courses/${courseId}/modules/reorder`, {
    method: 'PATCH',
    body: { ids },
  });
export const updateModule = (id: string, body: Partial<ModuleInput>) =>
  adminFetch<AdminModule>(`/admin/modules/${id}`, { method: 'PATCH', body });
export const deleteModule = (id: string) =>
  adminFetch<void>(`/admin/modules/${id}`, { method: 'DELETE' });

// ---------- lessons ----------
export const listLessons = async (moduleId: string) =>
  itemsOf(
    await adminFetch<AdminLesson[] | Paginated<AdminLesson>>(`/admin/modules/${moduleId}/lessons`),
  );
export const createLesson = (moduleId: string, body: LessonInput) =>
  adminFetch<AdminLesson>(`/admin/modules/${moduleId}/lessons`, { method: 'POST', body });
export const reorderLessons = (moduleId: string, ids: string[]) =>
  adminFetch<void>(`/admin/modules/${moduleId}/lessons/reorder`, {
    method: 'PATCH',
    body: { ids },
  });
export const getLesson = (id: string) => adminFetch<AdminLesson>(`/admin/lessons/${id}`);
export const updateLesson = (id: string, body: Partial<LessonInput>) =>
  adminFetch<AdminLesson>(`/admin/lessons/${id}`, { method: 'PATCH', body });
export const deleteLesson = (id: string) =>
  adminFetch<void>(`/admin/lessons/${id}`, { method: 'DELETE' });
export const publishLesson = (id: string) =>
  adminFetch<AdminLesson>(`/admin/lessons/${id}/publish`, { method: 'POST' });
export const unpublishLesson = (id: string) =>
  adminFetch<AdminLesson>(`/admin/lessons/${id}/unpublish`, { method: 'POST' });

// ---------- materials ----------
export const listMaterials = async (lessonId: string) =>
  itemsOf(
    await adminFetch<AdminMaterial[] | Paginated<AdminMaterial>>(
      `/admin/lessons/${lessonId}/materials`,
    ),
  );
export const createMaterial = (lessonId: string, body: LessonMaterialInput) =>
  adminFetch<AdminMaterial>(`/admin/lessons/${lessonId}/materials`, { method: 'POST', body });
export const updateMaterial = (id: string, body: Partial<LessonMaterialInput>) =>
  adminFetch<AdminMaterial>(`/admin/materials/${id}`, { method: 'PATCH', body });
export const deleteMaterial = (id: string) =>
  adminFetch<void>(`/admin/materials/${id}`, { method: 'DELETE' });

// ---------- completeness (4 × 6) ----------
interface RawCompleteness {
  practices?: number;
  required?: number;
  practicesRequired?: number;
  questionsPerPractice?: (number | { practiceId?: string; questions: number; required?: number })[];
  ready?: boolean;
  isComplete?: boolean;
}

/**
 * Accepts both the contract shape `{practices, required, questionsPerPractice[], ready}` and the
 * shared schema shape `{practices, practicesRequired, questionsPerPractice[{practiceId,questions}], isComplete}`.
 */
export function normalizeCompleteness(raw: RawCompleteness): Completeness {
  const required = raw.required ?? raw.practicesRequired ?? PRACTICES_PER_LESSON;
  const qpp = (raw.questionsPerPractice ?? []).map((q, i) =>
    typeof q === 'number'
      ? { practiceId: String(i), questions: q }
      : { practiceId: q.practiceId ?? String(i), questions: q.questions },
  );
  const questionsRequired =
    (raw.questionsPerPractice ?? []).find(
      (q): q is { questions: number; required: number } =>
        typeof q === 'object' && typeof q.required === 'number',
    )?.required ?? QUESTIONS_PER_PRACTICE;
  const practices = raw.practices ?? qpp.length;
  const computed =
    practices === required &&
    qpp.length === required &&
    qpp.every((q) => q.questions === questionsRequired);
  return {
    practices,
    required,
    questionsRequired,
    questionsPerPractice: qpp,
    // The server decides; fall back to computing it if the flag is missing.
    ready: raw.ready ?? raw.isComplete ?? computed,
  };
}

export const getCompleteness = async (lessonId: string) =>
  normalizeCompleteness(
    await adminFetch<RawCompleteness>(`/admin/lessons/${lessonId}/completeness`),
  );

// ---------- practices & questions ----------
export const listPractices = async (lessonId: string) =>
  itemsOf(
    await adminFetch<AdminPractice[] | Paginated<AdminPractice>>(
      `/admin/lessons/${lessonId}/practices`,
    ),
  );
export const createPractice = (lessonId: string, body: PracticeInput) =>
  adminFetch<AdminPractice>(`/admin/lessons/${lessonId}/practices`, { method: 'POST', body });
export const getPractice = (id: string) => adminFetch<AdminPractice>(`/admin/practices/${id}`);
export const updatePractice = (id: string, body: Partial<PracticeInput>) =>
  adminFetch<AdminPractice>(`/admin/practices/${id}`, { method: 'PATCH', body });
export const deletePractice = (id: string) =>
  adminFetch<void>(`/admin/practices/${id}`, { method: 'DELETE' });

export const listQuestions = async (practiceId: string) =>
  itemsOf(
    await adminFetch<AdminQuestion[] | Paginated<AdminQuestion>>(
      `/admin/practices/${practiceId}/questions`,
    ),
  );
export const createQuestion = (practiceId: string, body: QuestionInput) =>
  adminFetch<AdminQuestion>(`/admin/practices/${practiceId}/questions`, { method: 'POST', body });
export const updateQuestion = (id: string, body: QuestionInput) =>
  adminFetch<AdminQuestion>(`/admin/questions/${id}`, { method: 'PATCH', body });
export const deleteQuestion = (id: string) =>
  adminFetch<void>(`/admin/questions/${id}`, { method: 'DELETE' });

// ---------- files ----------
export function uploadFile(file: File, purpose?: string): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  if (purpose) form.append('purpose', purpose);
  return adminUpload<UploadedFile>('/admin/files', form);
}
