import type { Page, Request } from '@playwright/test';

/**
 * API mock for cabinet specs: intercepts every `/api/v1/*` call in the browser so the specs run
 * without the API, DB or auth. Handlers are matched by method + path regex, first match wins.
 */
export interface MockHandler {
  method?: string;
  path: RegExp;
  status?: number;
  body: unknown | ((req: Request, match: RegExpMatchArray) => unknown);
}

export interface MockLog {
  calls: { method: string; path: string; body: unknown }[];
}

/** `od_role` hint cookie the web middleware needs, or every /cabinet page redirects to /login. */
async function setStudentRoleCookie(page: Page) {
  const base = new URL(
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}`,
  );
  await page
    .context()
    .addCookies([{ name: 'od_role', value: 'STUDENT', domain: base.hostname, path: '/' }]);
}

export async function mockApi(page: Page, handlers: MockHandler[]): Promise<MockLog> {
  const log: MockLog = { calls: [] };
  await setStudentRoleCookie(page);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const isRefresh = req.method() === 'POST' && path === '/auth/refresh';
    // The web session layer gets its access token from /auth/refresh before other calls. Answer it
    // (unlogged) unless a spec mocks it itself, e.g. a catch-all 401 for the logged-out case.
    if (
      isRefresh &&
      !handlers.some((h) => (!h.method || h.method === 'POST') && h.path.test(path))
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'e2e-token', expiresIn: 900, user: me }),
      });
    }
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    log.calls.push({ method: req.method(), path: path + url.search, body });
    for (const h of handlers) {
      if (h.method && h.method !== req.method()) continue;
      const m = path.match(h.path);
      if (!m) continue;
      const payload = typeof h.body === 'function' ? h.body(req, m) : h.body;
      return route.fulfill({
        status: h.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 404, code: 'NOT_FOUND', message: `no mock for ${path}` }),
    });
  });
  return log;
}

// ───────────── data ─────────────

export const me = {
  id: 'u1',
  email: 'student@example.test',
  phone: '+998901234567',
  fullName: 'Ali Valiyev',
  role: 'STUDENT',
  avatarUrl: null,
  phoneVerified: true,
  createdAt: '2026-11-01T08:00:00.000Z',
};

const progress = (done: number, total: number) => ({
  completedLessons: done,
  totalLessons: total,
  completedRequired: done,
  totalRequired: total,
  percent: Math.round((done / total) * 100),
});

export const courseItem = {
  id: 'c1',
  slug: 'html-asoslari',
  title: 'HTML asoslari',
  coverImageUrl: null,
  enrolledAt: '2026-11-02T08:00:00.000Z',
  progress: progress(1, 3),
  lastActivityAt: '2026-11-21T08:00:00.000Z',
  nextLessonId: 'l2',
  examPassed: false,
  certificateId: null,
};

export const dashboard = {
  stats: {
    enrolledCourses: 1,
    completedCourses: 0,
    completedLessons: 1,
    practiceAttempts: 4,
    certificates: 0,
    overallProgress: 33,
  },
  courses: [courseItem],
  lastActivity: {
    type: 'PRACTICE_SUBMITTED',
    at: '2026-11-21T08:00:00.000Z',
    courseId: 'c1',
    courseTitle: 'HTML asoslari',
    lessonId: 'l1',
    title: '4-amaliyot',
  },
};

const lessonNode = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Dars ${id}`,
  position: 1,
  durationMinutes: 10,
  isRequired: true,
  isLocked: false,
  materialViewed: false,
  isCompleted: false,
  completedAt: null,
  practicesTotal: 4,
  practicesPassed: 0,
  ...over,
});

export const courseTree = {
  id: 'c1',
  slug: 'html-asoslari',
  title: 'HTML asoslari',
  coverImageUrl: null,
  sequentialUnlock: true,
  progress: progress(1, 3),
  modules: [
    {
      id: 'm1',
      title: 'Kirish',
      description: null,
      position: 1,
      isLocked: false,
      completedLessons: 1,
      totalLessons: 2,
      lessons: [
        lessonNode('l1', { isCompleted: true, materialViewed: true, practicesPassed: 4 }),
        lessonNode('l2'),
      ],
    },
    {
      id: 'm2',
      title: 'Teglar',
      description: null,
      position: 2,
      isLocked: true,
      completedLessons: 0,
      totalLessons: 1,
      lessons: [lessonNode('l3', { isLocked: true })],
    },
  ],
  exam: { exists: true, isLocked: true, passed: false },
  certificate: null,
  nextLessonId: 'l2',
};

const practiceSummary = (n: number) => ({
  id: `p${n}`,
  title: `${n}-amaliyot`,
  description: null,
  position: n,
  isRequired: true,
  passScore: 50,
  questionCount: 6,
  attempts: 0,
  bestPercent: null,
  passed: false,
});

export const lesson = {
  id: 'l2',
  title: 'Dars l2',
  summary: 'Matn teglari',
  durationMinutes: 10,
  courseId: 'c1',
  moduleId: 'm1',
  materials: [
    {
      id: 'mt1',
      type: 'TEXT',
      title: null,
      content: '# Paragraf\n\n**p** tegi paragraf uchun ishlatiladi.',
      fileUrl: null,
      mimeType: null,
      sizeBytes: null,
      videoUrl: null,
      position: 1,
    },
  ],
  practices: [1, 2, 3, 4].map(practiceSummary),
  progress: {
    lessonId: 'l2',
    materialViewed: false,
    isCompleted: false,
    completedAt: null,
    requiredPractices: 4,
    passedRequiredPractices: 0,
  },
  prevLessonId: 'l1',
  nextLessonId: null,
};

const opt = (id: string, text: string) => ({ id, text, imageUrl: null });
const img =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#e44d26"/></svg>',
  );

export const questions = [
  {
    id: 'q1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'HTML nima?',
    imageUrl: null,
    isMultiple: false,
    points: 1,
    options: [opt('o1', 'Belgilash tili'), opt('o2', 'Dasturlash tili')],
  },
  {
    id: 'q2',
    type: 'MULTIPLE_CHOICE',
    prompt: 'Qaysilari brauzer?',
    imageUrl: null,
    isMultiple: true,
    points: 1,
    options: [opt('m1', 'Chrome'), opt('m2', 'Firefox'), opt('m3', 'Excel')],
  },
  {
    id: 'q3',
    type: 'TRUE_FALSE',
    prompt: 'CSS uslublar tili.',
    imageUrl: null,
    isMultiple: false,
    points: 1,
    options: [opt('t1', "To'g'ri"), opt('t2', "Noto'g'ri")],
  },
  {
    id: 'q4',
    type: 'MATCHING',
    prompt: 'Teglarni moslang',
    imageUrl: null,
    isMultiple: false,
    points: 1,
    options: [opt('l1', '<a>'), opt('l2', '<img>')],
    matchTargets: ['Rasm', 'Havola'],
  },
  {
    id: 'q5',
    type: 'FILL_BLANK',
    prompt: 'Paragraf tegi {{0}}.',
    imageUrl: null,
    isMultiple: false,
    points: 1,
    options: [],
    blankCount: 1,
  },
  {
    id: 'q6',
    type: 'IMAGE_BASED',
    prompt: 'Rasmda nima rang?',
    imageUrl: img,
    isMultiple: false,
    points: 1,
    options: [opt('i1', "Qizg'ish"), opt('i2', "Ko'k")],
  },
];

export const practice = {
  id: 'p1',
  lessonId: 'l2',
  courseId: 'c1',
  title: '1-amaliyot',
  description: null,
  passScore: 50,
  isRequired: true,
  questions,
  attempts: [],
};

export const practiceResult = {
  attempt: {
    id: 'a1',
    score: 6,
    maxScore: 6,
    percent: 100,
    correctCount: 6,
    totalCount: 6,
    passed: true,
    submittedAt: '2026-11-22T10:00:00.000Z',
  },
  questions: questions.map((q) => ({
    questionId: q.id,
    type: q.type,
    isCorrect: true,
    pointsAwarded: 1,
    points: 1,
    answer: null,
    correctAnswer:
      q.type === 'MATCHING'
        ? {
            matches: [
              { optionId: 'l1', matchText: 'Havola' },
              { optionId: 'l2', matchText: 'Rasm' },
            ],
          }
        : q.type === 'FILL_BLANK'
          ? { blanks: [['p']] }
          : { selectedOptionIds: [q.options[0]!.id] },
    explanation: q.id === 'q4' ? '<a> havola, <img> rasm uchun.' : null,
  })),
  lesson: { ...lesson.progress, materialViewed: true, passedRequiredPractices: 1 },
  course: progress(1, 3),
};

export const examConfig = {
  id: 'e1',
  title: 'Yakuniy imtihon',
  questionCount: 3,
  timeLimitMinutes: 30,
  passScore: 60,
  maxAttempts: 3,
};

export const examStatusOpen = {
  courseId: 'c1',
  exam: examConfig,
  isLocked: false,
  lockReason: null,
  progress: progress(3, 3),
  attemptsUsed: 0,
  attemptsLeft: 3,
  activeAttempt: null,
  lastResult: null,
  passed: false,
  certificate: null,
};

export const examStatusLocked = {
  ...examStatusOpen,
  isLocked: true,
  lockReason: 'LESSONS_INCOMPLETE',
  progress: progress(1, 3),
};

export function examAttempt(secondsLeft: number) {
  const now = Date.now();
  return {
    id: 'att1',
    examId: 'e1',
    courseId: 'c1',
    title: 'Yakuniy imtihon',
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + secondsLeft * 1000).toISOString(),
    serverTime: new Date(now).toISOString(),
    timeLimitMinutes: 30,
    questions: questions.slice(0, 3),
    savedAnswers: [],
  };
}

export const examResultPassed = {
  attemptId: 'att1',
  status: 'SUBMITTED',
  startedAt: '2026-11-22T10:00:00.000Z',
  submittedAt: '2026-11-22T10:10:00.000Z',
  score: 3,
  maxScore: 3,
  percent: 100,
  passed: true,
  passScore: 60,
  correctCount: 3,
  totalCount: 3,
  questions: questions
    .slice(0, 3)
    .map((q) => ({ questionId: q.id, type: q.type, isCorrect: true, pointsAwarded: 1, points: 1 })),
  certificate: { id: 'cert1', publicId: 'OD-2026-000001' },
};

export const page1 = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });

/** Handlers every cabinet page needs (shell: current user + unread counter). */
export const baseHandlers: MockHandler[] = [
  { method: 'GET', path: /^\/auth\/me$/, body: me },
  { method: 'GET', path: /^\/users\/me$/, body: me },
  {
    method: 'GET',
    path: /^\/me\/notifications$/,
    body: { items: [], total: 0, page: 1, pageSize: 1, unreadCount: 2 },
  },
];
