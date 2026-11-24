/**
 * Helpers for the full-stack acceptance specs (`@fullstack`, spec §13).
 * They talk to the real API (E2E_API=1 starts it on :4000 with a migrated + seeded Postgres).
 * Every spec creates its own users/courses with a per-run unique suffix, so specs are independent.
 */
import {
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
  expect,
} from '@playwright/test';

export const API = (process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

/** Seeded accounts (apps/api/prisma/seed.ts; password = SEED_PASSWORD or the dev default). */
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Parol12345!';
export const ADMIN = { email: 'admin@onlinedars.uz', password: SEED_PASSWORD };
export const CONTENT_MANAGER = { email: 'content@onlinedars.uz', password: SEED_PASSWORD };
export const DEMO_COURSE = { slug: 'veb-dasturlash-asoslari', title: 'Veb-dasturlash asoslari' };

/** Test-only Payme key from the CI job env (never a real key). */

let seq = 0;
/** Unique, slug-safe suffix per call (worker + time + counter). */
export function uid(prefix = 'e2e'): string {
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return `${prefix}-${Date.now().toString(36)}-${worker}${(seq++).toString(36)}`;
}

export interface CallOptions {
  token?: string;
  data?: unknown;
  headers?: Record<string, string>;
  /** Expected HTTP status; the call fails with the response body when it differs. */
  expect?: number;
}

/** JSON call to the API; asserts the status (default: any 2xx) and returns the parsed body. */
export async function call<T = any>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: CallOptions = {},
): Promise<T> {
  const res = await raw(request, method, path, opts);
  const text = await res.text();
  const info = `${method} ${path} → ${res.status()} ${text.slice(0, 500)}`;
  if (opts.expect !== undefined) expect(res.status(), info).toBe(opts.expect);
  else expect(res.ok(), info).toBe(true);
  return (text ? JSON.parse(text) : undefined) as T;
}

export function raw(
  request: APIRequestContext,
  method: string,
  path: string,
  opts: CallOptions = {},
): Promise<APIResponse> {
  return request.fetch(`${API}${path}`, {
    method,
    headers: {
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    data: opts.data,
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  fullName: string;
  token: string;
}

export async function registerStudent(
  request: APIRequestContext,
  name = 'Talaba',
): Promise<TestUser> {
  const email = `${uid('st')}@test.onlinedars.uz`;
  const password = 'Parol12345!';
  const fullName = `E2E ${name} ${uid('n').slice(-4)}`;
  const body = await call(request, 'POST', '/auth/register', {
    data: { fullName, email, password },
    expect: 201,
  });
  return { id: body.user.id, email, password, fullName, token: body.accessToken };
}

export async function loginApi(
  request: APIRequestContext,
  who: { email: string; password: string },
): Promise<string> {
  const body = await call(request, 'POST', '/auth/login', {
    data: { login: who.email, password: who.password },
  });
  return body.accessToken as string;
}

/**
 * Signs the browser in without the login form: logs in through the web's same-origin
 * `/api/v1` proxy (so the httpOnly refresh cookie lands in this browser context) and sets the
 * `od_role` hint cookie the middleware reads. Pages then recover the session via /auth/refresh.
 */
export async function signInBrowser(
  context: BrowserContext,
  baseURL: string,
  who: { email: string; password: string },
): Promise<void> {
  const res = await context.request.post(`${baseURL}/api/v1/auth/login`, {
    data: { login: who.email, password: who.password },
  });
  expect(res.ok(), `browser login ${res.status()} ${await res.text()}`).toBe(true);
  const { user } = (await res.json()) as { user: { role: string } };
  await context.addCookies([{ name: 'od_role', value: user.role, url: baseURL }]);
}

// ---------------------------------------------------------------- content building (admin API)

interface AdminOption {
  id: string;
  text: string;
  isCorrect: boolean;
  matchText: string | null;
  blankIndex: number | null;
}
export interface AdminQuestionRow {
  id: string;
  type: string;
  options: AdminOption[];
}

/** The correct answer for a question, built from the admin (answer-bearing) view. */
export function perfectAnswer(q: AdminQuestionRow): Record<string, unknown> {
  switch (q.type) {
    case 'MATCHING':
      return {
        questionId: q.id,
        matches: q.options
          .filter((o) => o.matchText)
          .map((o) => ({ optionId: o.id, matchText: o.matchText })),
      };
    case 'FILL_BLANK': {
      const blanks: string[] = [];
      for (const o of q.options) if (o.blankIndex != null) blanks[o.blankIndex] ??= o.text;
      return { questionId: q.id, blanks };
    }
    default:
      return {
        questionId: q.id,
        selectedOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      };
  }
}

/** Lists may be bare arrays or `{items}`; normalise. */
export function itemsOf<T>(body: T[] | { items: T[] }): T[] {
  return Array.isArray(body) ? body : body.items;
}

export const trueFalse = (n: number) => ({
  type: 'TRUE_FALSE',
  prompt: `E2E savol ${n}: HTML belgilash tilimi?`,
  options: [
    { text: "To'g'ri", isCorrect: true },
    { text: "Noto'g'ri", isCorrect: false },
  ],
});

export async function createCourse(
  request: APIRequestContext,
  token: string,
  input: { title?: string } = {},
): Promise<{ id: string; slug: string; title: string }> {
  const slug = uid('kurs');
  const title = input.title ?? `E2E kurs ${slug.slice(-6)}`;
  const body = await call(request, 'POST', '/admin/courses', {
    token,
    data: {
      slug,
      title,
      shortDescription: 'Avtomatik test kursi',
      sequentialUnlock: true,
    },
    expect: 201,
  });
  return { id: body.id, slug, title };
}

export async function createModule(request: APIRequestContext, token: string, courseId: string) {
  return call<{ id: string }>(request, 'POST', `/admin/courses/${courseId}/modules`, {
    token,
    data: { title: 'E2E modul' },
    expect: 201,
  });
}

export async function createLesson(
  request: APIRequestContext,
  token: string,
  moduleId: string,
  title = 'E2E dars',
) {
  const lesson = await call<{ id: string }>(request, 'POST', `/admin/modules/${moduleId}/lessons`, {
    token,
    data: { title },
    expect: 201,
  });
  await call(request, 'POST', `/admin/lessons/${lesson.id}/materials`, {
    token,
    data: { type: 'TEXT', title: 'Matn', content: '<p>E2E dars matni</p>' },
    expect: 201,
  });
  return lesson;
}

export async function addPractice(
  request: APIRequestContext,
  token: string,
  lessonId: string,
  n: number,
) {
  return call<{ id: string }>(request, 'POST', `/admin/lessons/${lessonId}/practices`, {
    token,
    data: { title: `E2E amaliyot ${n}` },
    expect: 201,
  });
}

export async function addQuestion(
  request: APIRequestContext,
  token: string,
  practiceId: string,
  n: number,
) {
  return call<{ id: string }>(request, 'POST', `/admin/practices/${practiceId}/questions`, {
    token,
    data: trueFalse(n),
    expect: 201,
  });
}

/** Fills a lesson up to exactly 4 practices × 6 questions (skips what already exists). */
export async function completeLesson(
  request: APIRequestContext,
  token: string,
  lessonId: string,
): Promise<string[]> {
  const practices = itemsOf<{ id: string }>(
    await call(request, 'GET', `/admin/lessons/${lessonId}/practices`, { token }),
  );
  for (let p = practices.length; p < 4; p++) {
    practices.push(await addPractice(request, token, lessonId, p + 1));
  }
  for (const p of practices) {
    const qs = itemsOf<{ id: string }>(
      await call(request, 'GET', `/admin/practices/${p.id}/questions`, { token }),
    );
    for (let q = qs.length; q < 6; q++) await addQuestion(request, token, p.id, q + 1);
  }
  return practices.map((p) => p.id);
}

/** A published course with one module and one complete, published lesson. */
export async function createPublishedCourse(
  request: APIRequestContext,
  token: string,
  input: { title?: string } = {},
) {
  const course = await createCourse(request, token, input);
  const mod = await createModule(request, token, course.id);
  const lesson = await createLesson(request, token, mod.id);
  await completeLesson(request, token, lesson.id);
  await call(request, 'POST', `/admin/lessons/${lesson.id}/publish`, { token });
  await call(request, 'POST', `/admin/courses/${course.id}/status`, {
    token,
    data: { status: 'PUBLISHED' },
  });
  return { ...course, moduleId: mod.id, lessonId: lesson.id };
}

// ---------------------------------------------------------------- course access

/**
 * Gives a student a course the only way the platform allows: the student asks
 * (POST /access-requests) and an admin approves it. Returns the request id.
 */
export async function grantAccess(
  request: APIRequestContext,
  studentToken: string,
  courseId: string,
): Promise<string> {
  const req = await call<{ id: string }>(request, 'POST', '/access-requests', {
    token: studentToken,
    data: { courseId },
    expect: 201,
  });
  const admin = await loginApi(request, ADMIN);
  await call(request, 'POST', `/admin/access-requests/${req.id}/approve`, { token: admin });
  return req.id;
}

/** Waits for the page to settle enough for client components (session refresh, queries). */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
