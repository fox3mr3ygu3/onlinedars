import { expect, test } from '@playwright/test';
import {
  ADMIN,
  call,
  createPublishedCourse,
  DEMO_COURSE,
  gotoReady,
  loginApi,
  raw,
  registerStudent,
  signInBrowser,
  uid,
} from './support';

/** §13.1 register, login, view profile · §13.11 a student cannot access another user's data. */
test.describe('accounts @fullstack', () => {
  test('register with email in the UI, land in the cabinet, see the profile', async ({ page }) => {
    const fullName = `E2E Yangi ${uid('n').slice(-5)}`;
    const email = `${uid('reg')}@test.onlinedars.uz`;
    await gotoReady(page, '/register');
    await page.getByRole('button', { name: 'Email orqali' }).click();
    await page.getByLabel("To'liq ism").fill(fullName);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Parol', { exact: true }).fill('Parol12345!');
    await page.getByRole('button', { name: "Ro'yxatdan o'tish" }).click();
    await expect(page).toHaveURL(/\/cabinet$/);
    await expect(page.getByRole('heading', { name: `Xush kelibsiz, ${fullName}!` })).toBeVisible();

    await gotoReady(page, '/cabinet/profile');
    await expect(page.getByLabel("To'liq ism")).toHaveValue(fullName);
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  });

  test('login with the form; wrong password is rejected by the API', async ({ page, request }) => {
    const user = await registerStudent(request, 'Kirish');
    await gotoReady(page, '/login');
    await page.getByLabel('Email yoki telefon raqam').fill(user.email);
    await page.getByLabel('Parol', { exact: true }).fill('notmypassword1');
    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page.locator('form [role=alert]')).toContainText("Login yoki parol noto'g'ri");

    await page.getByLabel('Parol', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page).toHaveURL(/\/cabinet$/);
    await expect(
      page.getByRole('heading', { name: `Xush kelibsiz, ${user.fullName}!` }),
    ).toBeVisible();
    const me = await call(request, 'GET', '/auth/me', { token: user.token });
    expect(me).toMatchObject({ email: user.email, role: 'STUDENT' });
  });

  test('a student cannot read another user’s data or staff routes (server-side)', async ({
    request,
    context,
    page,
    baseURL,
  }) => {
    const admin = await loginApi(request, ADMIN);
    const course = await createPublishedCourse(request, admin);
    const owner = await registerStudent(request, 'Egasi');
    const intruder = await registerStudent(request, 'Begona');

    const asked = await call(request, 'POST', '/access-requests', {
      token: owner.token,
      data: { courseId: course.id },
      expect: 201,
    });

    // Another student's request never shows up in "my" requests, and only admins decide.
    const mine = await call(request, 'GET', '/me/access-requests', { token: intruder.token });
    expect(mine).toEqual([]);
    const approve = await raw(request, 'POST', `/admin/access-requests/${asked.id}/approve`, {
      token: intruder.token,
    });
    expect(approve.status()).toBe(403);

    // Not enrolled → no course tree, no lessons.
    const demo = await call(request, 'GET', `/courses/${DEMO_COURSE.slug}`);
    const tree = await raw(request, 'GET', `/me/courses/${demo.id}`, { token: intruder.token });
    expect(tree.status()).toBe(403);
    expect((await tree.json()).code).toBe('NOT_ENROLLED');
    const lesson = await raw(request, 'GET', `/me/lessons/${demo.modules[0].lessons[0].id}`, {
      token: intruder.token,
    });
    expect(lesson.status()).toBe(403);

    // Admin routes about other users → 403 for a student; anonymous → 401.
    for (const path of [
      '/admin/students',
      `/admin/students/${owner.id}`,
      '/admin/access-requests',
    ]) {
      expect((await raw(request, 'GET', path, { token: intruder.token })).status(), path).toBe(403);
    }
    expect((await raw(request, 'GET', '/me/dashboard')).status()).toBe(401);
    expect((await raw(request, 'GET', '/auth/me')).status()).toBe(401);

    // UI: the middleware keeps a student out of /admin (the API above is the real guard).
    await signInBrowser(context, baseURL!, intruder);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/cabinet/);
  });

  test('staff cannot enrol: the UI shows a notice and the API answers 403', async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    const demo = await call(request, 'GET', `/courses/${DEMO_COURSE.slug}`);
    const admin = await loginApi(request, ADMIN);
    await call(request, 'POST', '/access-requests', {
      token: admin,
      data: { courseId: demo.id },
      expect: 403,
    });
    await signInBrowser(context, baseURL!, ADMIN);
    await gotoReady(page, `/courses/${DEMO_COURSE.slug}`);
    await expect(page.getByTestId('staff-enrol-notice')).toBeVisible();
    await expect(page.getByTestId('course-cta')).toHaveCount(0);
  });
});
