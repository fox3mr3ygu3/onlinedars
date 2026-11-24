import { expect, test } from '@playwright/test';
import {
  ADMIN,
  createPublishedCourse,
  gotoReady,
  loginApi,
  raw,
  registerStudent,
  signInBrowser,
} from './support';

/**
 * Course access is admin-only (decided 2026-11-24, replaces payments): a student asks for a course
 * on its page, an admin approves or rejects it in the admin panel, and only an approved student
 * can open the course. No price, checkout or payment appears anywhere.
 */
test.describe('course access by admin approval @fullstack', () => {
  test.setTimeout(120_000);

  test('student requests → admin approves in the UI → student studies', async ({
    page,
    context,
    baseURL,
    browser,
    request,
  }) => {
    const admin = await loginApi(request, ADMIN);
    const course = await createPublishedCourse(request, admin);
    const student = await registerStudent(request, "So'rovchi");

    // ── student: course page shows "Kirish so'rash", no price ──
    await signInBrowser(context, baseURL!, student);
    await gotoReady(page, `/courses/${course.slug}`);
    await expect(page.getByText(/so'm|Sotib olish|Payme|Click/)).toHaveCount(0);
    await page.getByRole('button', { name: "Kirish so'rash" }).click();
    await expect(page.getByTestId('course-access-pending')).toContainText("So'rov yuborildi");

    // Not enrolled yet: the server refuses the course.
    const before = await raw(request, 'GET', `/me/courses/${course.id}`, { token: student.token });
    expect(before.status()).toBe(403);

    // ── admin: the request is in the queue; approve it ──
    const adminContext = await browser.newContext({ baseURL });
    const adminPage = await adminContext.newPage();
    await signInBrowser(adminContext, baseURL!, ADMIN);
    await gotoReady(adminPage, '/admin/access-requests');
    await adminPage
      .getByPlaceholder('Talaba (ism, telefon, email) yoki kurs nomi')
      .fill(student.fullName);
    const row = adminPage.locator('tr', { hasText: student.fullName });
    await expect(row).toContainText(course.title);
    const approved = adminPage.waitForResponse(
      (r) => r.url().includes('/admin/access-requests/') && r.url().endsWith('/approve'),
    );
    await row.getByRole('button', { name: 'Tasdiqlash' }).click();
    expect((await approved).ok()).toBe(true);
    await adminContext.close();

    // ── student: the course opens ──
    await gotoReady(page, `/courses/${course.slug}`);
    await page.getByRole('link', { name: 'Kursni ochish' }).click();
    await expect(page).toHaveURL(new RegExp(`/cabinet/courses/${course.id}$`));
    await expect(page.getByRole('link', { name: 'E2E dars' })).toBeVisible();
    await gotoReady(page, '/cabinet/requests');
    await expect(page.locator('li', { hasText: course.title })).toContainText('Tasdiqlangan');
  });

  test('admin rejects with a reason; the student sees it and may ask again', async ({
    page,
    context,
    baseURL,
    browser,
    request,
  }) => {
    const admin = await loginApi(request, ADMIN);
    const course = await createPublishedCourse(request, admin);
    const student = await registerStudent(request, 'Rad');

    await signInBrowser(context, baseURL!, student);
    await gotoReady(page, `/courses/${course.slug}`);
    await page.getByRole('button', { name: "Kirish so'rash" }).click();
    await expect(page.getByTestId('course-access-pending')).toBeVisible();

    const adminContext = await browser.newContext({ baseURL });
    const adminPage = await adminContext.newPage();
    await signInBrowser(adminContext, baseURL!, ADMIN);
    await gotoReady(adminPage, '/admin/access-requests');
    await adminPage
      .getByPlaceholder('Talaba (ism, telefon, email) yoki kurs nomi')
      .fill(student.fullName);
    const row = adminPage.locator('tr', { hasText: student.fullName });
    await row.getByRole('button', { name: 'Rad etish' }).click();
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByLabel('Sabab').fill("Guruh to'lgan, keyingi oqimda");
    await dialog.getByRole('button', { name: 'Rad etish' }).click();
    await expect(dialog).toBeHidden();
    await adminContext.close();

    await gotoReady(page, `/courses/${course.slug}`);
    await expect(page.getByTestId('course-access-rejected')).toContainText(
      "Sabab: Guruh to'lgan, keyingi oqimda",
    );
    await page.getByRole('button', { name: "Qayta so'rash" }).click();
    await expect(page.getByTestId('course-access-pending')).toBeVisible();
  });
});
