import {
  type CertificateVerify,
  type CourseLevel,
  type Paginated,
} from '@onlinedars/shared';
import { apiFetch, buildQuery, type ApiRequestOptions } from './client';

/*
 * Public (no auth) read endpoints. The response shapes are local types because
 * packages/shared has no response schemas for the catalog yet.
 * TODO(shared): replace with zod response schemas from @onlinedars/shared once backend-content
 * publishes them.
 */

export interface DirectionSummary {
  id: string;
  slug: string;
  name: string;
}

export interface Direction extends DirectionSummary {
  description: string | null;
  icon: string | null;
  courseCount?: number;
}

export interface TeacherSummary {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  photoUrl: string | null;
}

export interface Teacher extends TeacherSummary {
  bio: string | null;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  coverImageUrl: string | null;
  level: CourseLevel;
  isFree: boolean;
  /** tiyin */
  price: number;
  currency?: string;
  lessonCount: number;
  moduleCount?: number;
  direction?: DirectionSummary | null;
}

export interface CourseLessonOutline {
  id: string;
  title: string;
  durationMinutes: number | null;
}

export interface CourseModuleOutline {
  id: string;
  title: string;
  description: string | null;
  lessons: CourseLessonOutline[];
}

export interface CourseDetail extends CourseCard {
  description: string;
  goals: string[];
  modules: CourseModuleOutline[];
  teachers: TeacherSummary[];
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface CatalogParams {
  search?: string;
  directionId?: string;
  isFree?: boolean;
  page?: number;
  pageSize?: number;
}

/** Some list endpoints may return a bare array; accept both. */
export function toPaginated<T>(data: Paginated<T> | T[]): Paginated<T> {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, pageSize: data.length };
  }
  return data;
}

/** Public data is cached for a minute on the server (pages themselves render dynamically). */
const cached: ApiRequestOptions = { next: { revalidate: 60 } };

export const CATALOG_PAGE_SIZE = 12;

export async function getCourses(params: CatalogParams = {}): Promise<Paginated<CourseCard>> {
  const query = buildQuery({
    search: params.search,
    // The shared catalogQuerySchema names the search field `q`; send both until settled.
    q: params.search,
    directionId: params.directionId,
    isFree: params.isFree === undefined ? undefined : String(params.isFree),
    page: params.page ?? 1,
    pageSize: params.pageSize ?? CATALOG_PAGE_SIZE,
  });
  return toPaginated(await apiFetch<Paginated<CourseCard> | CourseCard[]>(`/courses${query}`, cached));
}

/** `slugOrId`: the course page uses the slug; checkout passes the slug too when it has it. */
export function getCourse(slugOrId: string): Promise<CourseDetail> {
  return apiFetch<CourseDetail>(`/courses/${encodeURIComponent(slugOrId)}`, cached);
}

export async function getDirections(): Promise<Direction[]> {
  return toPaginated(await apiFetch<Paginated<Direction> | Direction[]>('/directions', cached)).items;
}

export async function getTeachers(): Promise<Teacher[]> {
  return toPaginated(await apiFetch<Paginated<Teacher> | Teacher[]>('/teachers', cached)).items;
}

export async function getFaq(): Promise<Faq[]> {
  return toPaginated(await apiFetch<Paginated<Faq> | Faq[]>('/faq', cached)).items;
}

/** Never cached: a revoked certificate must show as invalid immediately. */
export function verifyCertificate(certificateCode: string): Promise<CertificateVerify> {
  return apiFetch<CertificateVerify>(
    `/certificates/verify/${encodeURIComponent(certificateCode)}`,
    { cache: 'no-store' },
  );
}

/** Runs a server-side fetch and returns null instead of throwing (API down, 404 …). */
export async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}
