import { expect, test } from '@playwright/test';
import { mockApi, page1 } from './mock-api';

// Same shape as GET /admin/dashboard (shared AdminDashboardStats).
const dashboard = {
  students: 120,
  newStudents30d: 12,
  activeCourses: 4,
  enrollments: 150,
  completedLessons: 860,
  practiceAttempts: 2400,
  examAttempts: 40,
  examsPassed: 30,
  certificates: 28,
  pendingAccessRequests: 3,
  recentResults: [],
};

const practice = (i: number) => ({
  id: `p${i}`,
  lessonId: 'l1',
  title: `Amaliyot ${i}`,
  description: null,
  position: i,
  isRequired: true,
  passScore: 0,
});

const lesson = {
  id: 'l1',
  moduleId: 'm1',
  courseId: 'c1',
  title: "O'zgaruvchilar",
  summary: null,
  durationMinutes: 15,
  position: 1,
  isRequired: true,
  isPublished: false,
};

test.describe('admin panel @smoke', () => {
  test('content manager sees content menu only', async ({ page, isMobile }) => {
    const api = await mockApi(page, 'CONTENT_MANAGER');
    api.on('GET', '/admin/dashboard', dashboard);
    await page.goto('/admin');
    if (isMobile) await page.getByRole('button', { name: 'Menyuni ochish' }).click();
    const nav = page.getByRole('navigation', { name: 'Boshqaruv paneli' }).last();
    await expect(nav.getByRole('link', { name: 'Kurslar' })).toBeVisible();
    await expect(nav.getByRole('link', { name: "Kirish so'rovlari" })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Sozlamalar' })).toHaveCount(0);
    await expect(page.getByText('Talabalar').first()).toBeVisible(); // dashboard stat, not a menu link
  });

  test('admin dashboard shows stats and full menu', async ({ page, isMobile }) => {
    const api = await mockApi(page, 'ADMIN');
    api.on('GET', '/admin/dashboard', dashboard);
    await page.goto('/admin');
    await expect(page.getByText('860')).toBeVisible();
    await expect(page.getByText('75%')).toBeVisible();
    await expect(page.getByTestId('dashboard-pending-requests')).toContainText('3');
    if (isMobile) await page.getByRole('button', { name: 'Menyuni ochish' }).click();
    await expect(page.getByRole('link', { name: "Kirish so'rovlari" }).last()).toBeVisible();
  });

  test('practice editor: counters, add disabled at 4/4, publish disabled until 4×6', async ({
    page,
  }) => {
    const api = await mockApi(page, 'CONTENT_MANAGER');
    let practices = [1, 2, 3].map(practice);
    let counts = [6, 6, 6];
    api.on('GET', '/admin/lessons/l1', lesson);
    api.on('GET', '/admin/lessons/l1/practices', () => practices);
    api.on('GET', '/admin/lessons/l1/completeness', () => ({
      practices: practices.length,
      required: 4,
      questionsPerPractice: counts.map((questions, i) => ({ practiceId: `p${i + 1}`, questions })),
      ready: practices.length === 4 && counts.every((c) => c === 6),
    }));
    api.on('POST', '/admin/lessons/l1/practices', (_r, body) => {
      const p = { ...practice(practices.length + 1), ...(body as object) };
      practices = [...practices, p];
      counts = [...counts, 5];
      return p;
    });

    await page.goto('/admin/lessons/l1/practices');
    await expect(page.getByTestId('practices-counter')).toHaveText(/Amaliyotlar 3\/4/);
    const publish = page.getByRole('button', { name: 'Darsni nashr qilish' });
    await expect(publish).toBeDisabled();

    await page.getByRole('button', { name: "Amaliyot qo'shish" }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByTestId('practices-counter')).toHaveText(/Amaliyotlar 4\/4/);
    await expect(page.getByRole('button', { name: "Amaliyot qo'shish" })).toBeDisabled();
    await expect(page.getByTestId('questions-counter-p4')).toHaveText(/Savollar 5\/6/);
    await expect(publish).toBeDisabled();

    counts = [6, 6, 6, 6];
    await page.reload();
    await expect(page.getByRole('button', { name: 'Darsni nashr qilish' })).toBeEnabled();
  });

  test('access requests: approve, and reject only with a reason', async ({ page }) => {
    const api = await mockApi(page, 'ADMIN');
    // Same shape as GET /admin/access-requests items (shared AdminAccessRequest).
    const req = {
      id: 'r1',
      courseId: 'c1',
      courseTitle: 'Python',
      courseSlug: 'python',
      status: 'PENDING',
      hasAccess: false,
      message: 'Iltimos',
      decisionReason: null,
      decidedAt: null,
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
      student: { id: 's1', fullName: 'Aliyev Vali', email: null, phone: '+998901234567' },
      decidedBy: null,
    };
    const req2 = { ...req, id: 'r2', courseTitle: 'SQL', courseId: 'c2' };
    api.on('GET', '/admin/access-requests', {
      ...page1([req, req2]),
      pendingCount: 2,
    });
    api.on('GET', '/admin/courses', page1([]));
    api.on('POST', '/admin/access-requests/r1/approve', { ...req, status: 'APPROVED' });
    api.on('POST', '/admin/access-requests/r2/reject', (_r, body) => ({
      ...req2,
      status: 'REJECTED',
      decisionReason: (body as { reason: string }).reason,
    }));

    await page.goto('/admin/access-requests');
    await expect(page.getByTestId('pending-count')).toHaveText("2 ta so'rov kutilmoqda");
    await page.getByTestId('access-request-r1').getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect.poll(() => api.calls.some((c) => c.path.endsWith('/r1/approve'))).toBe(true);

    await page.getByTestId('access-request-r2').getByRole('button', { name: 'Rad etish' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Rad etish' }).click();
    await expect(dialog.getByText('Sababni kiriting (kamida 3 ta belgi)')).toBeVisible();
    expect(api.calls.some((c) => c.path.endsWith('/reject'))).toBe(false);
    await dialog.getByLabel('Sabab').fill("Guruh to'lgan");
    await dialog.getByRole('button', { name: 'Rad etish' }).click();
    await expect(dialog).toBeHidden();
    const reject = api.calls.find((c) => c.path.endsWith('/r2/reject'));
    expect(reject?.body).toEqual({ reason: "Guruh to'lgan" });
  });

  test('settings page is hidden for content managers', async ({ page }) => {
    await mockApi(page, 'CONTENT_MANAGER');
    await page.goto('/admin/settings');
    await expect(page.getByText("Bu bo'lim faqat administratorlar uchun")).toBeVisible();
  });
});

test.describe('admin course editor', () => {
  test('creates a course without any price @smoke', async ({ page }) => {
    const api = await mockApi(page, 'ADMIN');
    api.on(
      'GET',
      '/admin/directions',
      page1([
        {
          id: 'd1',
          slug: 'it',
          name: 'IT',
          description: null,
          icon: null,
          position: 0,
          isActive: true,
        },
      ]),
    );
    api.on('GET', '/admin/teachers', page1([]));
    api.on('GET', '/admin/certificate-templates', page1([]));
    api.on('POST', '/admin/courses', (_r, body) => ({ id: 'c9', ...(body as object) }));
    api.on('GET', '/admin/courses/c9', { id: 'c9', title: 'Python', status: 'DRAFT' });
    api.on('GET', '/admin/courses/c9/modules', []);

    await page.goto('/admin/courses/new');
    await page.getByLabel('Nomi', { exact: true }).fill('Python asoslari');
    await page.getByLabel('Nomi', { exact: true }).blur();
    await expect(page.getByLabel('URL nomi (slug)')).toHaveValue('python-asoslari');
    await expect(page.getByLabel("Narxi (so'm)")).toHaveCount(0);
    await page.getByRole('button', { name: 'Yaratish' }).click();
    await expect(page).toHaveURL(/\/admin\/courses\/c9\/modules/);
    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/admin/courses');
    expect(post?.body).toMatchObject({
      title: 'Python asoslari',
      sequentialUnlock: true,
    });
    expect(post?.body).not.toHaveProperty('price');
  });
});
