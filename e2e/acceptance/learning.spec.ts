import { expect, test } from '@playwright/test';
import {
  ADMIN,
  type AdminQuestionRow,
  call,
  createCourse,
  createLesson,
  createModule,
  completeLesson,
  gotoReady,
  grantAccess,
  itemsOf,
  loginApi,
  perfectAnswer,
  raw,
  registerStudent,
  signInBrowser,
  trueFalse,
} from './support';

/**
 * §13.5–13.8 learning flow against the real API: material viewed + practices → lesson complete →
 * next lesson unlocks → exam unlocks → a failed and then a passed attempt → one certificate,
 * listed in the cabinet and valid on the public /verify page. Content is built through the admin
 * API; correct answers come from the admin (answer-bearing) views, never from student responses.
 */
test.describe('learning, exam and certificate @fullstack', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('lessons unlock in order, the exam unlocks last, a pass issues one certificate', async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    // ── content: 2 lessons (4×6 each), an exam with 3 questions, published ──
    const admin = await loginApi(request, ADMIN);
    const course = await createCourse(request, admin);
    const mod = await createModule(request, admin, course.id);
    const lessons = [
      await createLesson(request, admin, mod.id, 'E2E dars 1'),
      await createLesson(request, admin, mod.id, 'E2E dars 2'),
    ];
    const practiceIds: string[][] = [];
    for (const l of lessons) {
      practiceIds.push(await completeLesson(request, admin, l.id));
      await call(request, 'POST', `/admin/lessons/${l.id}/publish`, { token: admin });
    }
    await call(request, 'PUT', `/admin/courses/${course.id}/exam`, {
      token: admin,
      data: {
        title: 'E2E yakuniy imtihon',
        questionCount: 3,
        timeLimitMinutes: 15,
        passScore: 60,
        maxAttempts: 5,
        isActive: true,
      },
    });
    for (let n = 1; n <= 3; n++) {
      await call(request, 'POST', `/admin/courses/${course.id}/exam/questions`, {
        token: admin,
        data: trueFalse(100 + n),
        expect: 201,
      });
    }
    await call(request, 'POST', `/admin/courses/${course.id}/status`, {
      token: admin,
      data: { status: 'PUBLISHED' },
    });

    // ── student asks for the course; an admin approves (the only way in) ──
    const student = await registerStudent(request, "O'quvchi");
    const token = student.token;
    await grantAccess(request, token, course.id);

    // ── locks before any progress ──
    let tree = await call(request, 'GET', `/me/courses/${course.id}`, { token });
    let treeLessons = tree.modules.flatMap((m: { lessons: unknown[] }) => m.lessons);
    expect(treeLessons.map((l: { isLocked: boolean }) => l.isLocked)).toEqual([false, true]);
    expect(tree.progress.percent).toBe(0);
    expect(tree.exam.isLocked).toBe(true);
    expect((await raw(request, 'GET', `/me/lessons/${lessons[1]!.id}`, { token })).status()).toBe(
      403,
    );
    const early = await raw(request, 'POST', `/me/courses/${course.id}/exam/attempts`, { token });
    expect(early.status()).toBe(403);
    expect((await early.json()).code).toBe('EXAM_LOCKED');

    // ── the course tree in the UI shows the lock ──
    await signInBrowser(context, baseURL!, student);
    await gotoReady(page, `/cabinet/courses/${course.id}`);
    await expect(page.getByRole('link', { name: 'E2E dars 1' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E dars 2' })).toHaveCount(0);
    await expect(page.getByText('E2E dars 2')).toBeVisible();

    // ── lesson 1: material viewed in the UI, practices via the API ──
    const viewed = page.waitForResponse(
      (r) => r.url().endsWith(`/me/lessons/${lessons[0]!.id}/viewed`) && r.ok(),
    );
    await gotoReady(page, `/cabinet/courses/${course.id}/lessons/${lessons[0]!.id}`);
    await viewed;

    // Student practice view never carries the answers (rule 9).
    const studentPractice = await call(request, 'GET', `/me/practices/${practiceIds[0]![0]}`, {
      token,
    });
    expect(studentPractice.questions).toHaveLength(6);
    expect(JSON.stringify(studentPractice.questions)).not.toContain('isCorrect');

    for (const [i, lesson] of lessons.entries()) {
      if (i > 0) await call(request, 'POST', `/me/lessons/${lesson.id}/viewed`, { token });
      let last: { lesson: { isCompleted: boolean } } | undefined;
      for (const pid of practiceIds[i]!) {
        const qs = itemsOf<AdminQuestionRow>(
          await call(request, 'GET', `/admin/practices/${pid}/questions`, { token: admin }),
        );
        last = await call(request, 'POST', `/me/practices/${pid}/attempts`, {
          token,
          data: { answers: qs.map(perfectAnswer) },
          expect: 201,
        });
      }
      expect(last!.lesson.isCompleted).toBe(true);
      if (i === 0) {
        tree = await call(request, 'GET', `/me/courses/${course.id}`, { token });
        treeLessons = tree.modules.flatMap((m: { lessons: unknown[] }) => m.lessons);
        expect(treeLessons[1].isLocked).toBe(false);
        expect(tree.exam.isLocked).toBe(true);
      }
    }
    tree = await call(request, 'GET', `/me/courses/${course.id}`, { token });
    expect(tree.progress.percent).toBe(100);
    expect(tree.exam.isLocked).toBe(false);

    // ── exam: first attempt fails, second passes ──
    const pool = itemsOf<AdminQuestionRow>(
      await call(request, 'GET', `/admin/courses/${course.id}/exam/questions`, { token: admin }),
    );
    const first = await call(request, 'POST', `/me/courses/${course.id}/exam/attempts`, {
      token,
      expect: 201,
    });
    expect(JSON.stringify(first.questions)).not.toContain('isCorrect');
    const failed = await call(request, 'POST', `/me/exam-attempts/${first.id}/submit`, {
      token,
      data: { answers: [] },
      expect: 200,
    });
    expect(failed).toMatchObject({ passed: false });
    expect(failed.certificate ?? null).toBeNull();

    const second = await call(request, 'POST', `/me/courses/${course.id}/exam/attempts`, {
      token,
      expect: 201,
    });
    expect(second.id).not.toBe(first.id);
    const asked = new Set((second.questions as { id: string }[]).map((q) => q.id));
    const passed = await call(request, 'POST', `/me/exam-attempts/${second.id}/submit`, {
      token,
      data: { answers: pool.filter((q) => asked.has(q.id)).map(perfectAnswer) },
      expect: 200,
    });
    expect(passed).toMatchObject({ passed: true, percent: 100 });
    const publicId: string = passed.certificate.publicId;
    expect(publicId).toMatch(/^OD-/);

    // A pass blocks retakes and never issues a second certificate.
    const retake = await raw(request, 'POST', `/me/courses/${course.id}/exam/attempts`, { token });
    expect(retake.status()).toBe(409);
    const certs = await call(request, 'GET', '/me/certificates', { token });
    expect(certs.items.filter((c: { publicId: string }) => c.publicId === publicId)).toHaveLength(
      1,
    );
    expect(certs.total).toBe(1);

    // ── PDF: ready (200) or still rendering (409); other students get 404 ──
    const certId: string = certs.items[0].id;
    const pdf = await raw(request, 'GET', `/me/certificates/${certId}/pdf`, { token });
    expect([200, 409]).toContain(pdf.status());
    if (pdf.status() === 409) expect((await pdf.json()).code).toBe('CERTIFICATE_PDF_PENDING');
    const other = await registerStudent(request, 'Begona');
    const stolen = await raw(request, 'GET', `/me/certificates/${certId}/pdf`, {
      token: other.token,
    });
    expect(stolen.status()).toBe(404);

    // ── cabinet lists the certificate; the public verify page confirms it ──
    await gotoReady(page, '/cabinet/certificates');
    await expect(page.getByText(`ID: ${publicId}`)).toBeVisible();
    await gotoReady(page, `/verify/${publicId}`);
    await expect(page.getByText('Sertifikat haqiqiy')).toBeVisible();
    await expect(page.getByText(student.fullName)).toBeVisible();
    await expect(page.getByText(course.title)).toBeVisible();

    await gotoReady(page, '/verify/OD-0000-0000-0000');
    await expect(page.getByText('Sertifikat topilmadi')).toBeVisible();
  });
});
