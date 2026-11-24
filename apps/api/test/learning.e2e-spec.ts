/**
 * API e2e for backend-learning business rules on the seeded demo course:
 * enrollment + lesson locks, practices graded on the server without leaking answers,
 * progress, exam unlock + timing, single certificate, public verify, ownership denial,
 * admin reports and access grant/revoke.
 * Needs a migrated + seeded Postgres at DATABASE_URL; skipped when it is not set.
 * Puppeteer and S3 are replaced by fakes; PDF jobs run inline.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ErrorCode,
  ExamAttemptStatus,
  type QuestionAnswer,
  QuestionType,
  Role,
} from '@onlinedars/shared';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_COURSE } from '../prisma/seed-data';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { CertificatePdfQueue, InlineCertificatePdfQueue } from '../src/jobs/certificate-pdf.queue';
import { CertificatePdfService } from '../src/modules/certificates/certificate-pdf.service';
import { PdfRenderer } from '../src/modules/certificates/pdf/pdf-renderer';
import {
  CertificateStorage,
  MemoryCertificateStorage,
} from '../src/modules/certificates/storage/certificate-storage';

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `lrn${Date.now()}`;
const email = (name: string) => `${name}.${RUN}@test.onlinedars.uz`;
const PASSWORD = 'Parol12345!';

class FakePdf extends PdfRenderer {
  async render(): Promise<Buffer> {
    return Buffer.from('%PDF-1.7 fake');
  }
}

type OptionRow = {
  id: string;
  text: string;
  isCorrect: boolean;
  matchText: string | null;
  blankIndex: number | null;
};
type QuestionRow = { id: string; type: string; options: OptionRow[] };

/** Builds the correct answer from DB rows (the test plays a perfect student). */
function perfect(q: QuestionRow): QuestionAnswer {
  switch (q.type) {
    case QuestionType.MATCHING:
      return {
        questionId: q.id,
        matches: q.options
          .filter((o) => o.matchText)
          .map((o) => ({ optionId: o.id, matchText: o.matchText! })),
      };
    case QuestionType.FILL_BLANK: {
      const blanks: string[] = [];
      for (const o of q.options)
        if (o.blankIndex != null) blanks[o.blankIndex] ??= ` ${o.text.toUpperCase()} `;
      return { questionId: q.id, blanks };
    }
    default:
      return {
        questionId: q.id,
        selectedOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      };
  }
}

const optionSelect = {
  select: { id: true, text: true, isCorrect: true, matchText: true, blankIndex: true },
} as const;

describe.skipIf(!hasDb)('learning e2e', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let courseId: string;
  const tokens: Record<'s1' | 's2' | 'admin', string> = { s1: '', s2: '', admin: '' };
  const ids: Record<'s1' | 's2', string> = { s1: '', s2: '' };
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PdfRenderer)
      .useValue(new FakePdf())
      .overrideProvider(CertificateStorage)
      .useValue(new MemoryCertificateStorage())
      .overrideProvider(CertificatePdfQueue)
      .useFactory({
        factory: (pdf: CertificatePdfService) => new InlineCertificatePdfQueue(pdf),
        inject: [CertificatePdfService],
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    const course = await prisma.course.findUnique({ where: { slug: DEMO_COURSE.slug } });
    if (!course) throw new Error('Demo course missing: run `pnpm db:seed` first');
    courseId = course.id;

    for (const who of ['s1', 's2', 'admin'] as const) {
      const res = await http
        .post('/api/v1/auth/register')
        .send({ fullName: `Test ${who}`, email: email(who), password: PASSWORD })
        .expect(201);
      tokens[who] = res.body.accessToken;
      if (who !== 'admin') ids[who] = res.body.user.id;
    }
    await prisma.user.update({ where: { email: email('admin') }, data: { role: Role.ADMIN } });
    await prisma.enrollment.create({ data: { userId: ids.s1, courseId, source: 'ADMIN' } });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: `${RUN}@test.onlinedars.uz` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.certificate.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app?.close();
  });

  it('a student who is not enrolled cannot open the course (403 NOT_ENROLLED)', async () => {
    const res = await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s2')).expect(403);
    expect(res.body.code).toBe(ErrorCode.NOT_ENROLLED);
  });

  it('staff cannot use student endpoints; anonymous gets 401', async () => {
    await http.get('/api/v1/me/dashboard').set(auth('admin')).expect(403);
    await http.get('/api/v1/me/dashboard').expect(401);
  });

  let lessonIds: string[] = [];

  it('course tree: sequential locks, 0% progress, exam locked', async () => {
    const res = await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s1')).expect(200);
    const lessons = (
      res.body.modules as { lessons: { id: string; isLocked: boolean }[] }[]
    ).flatMap((m) => m.lessons);
    lessonIds = lessons.map((l) => l.id);
    expect(lessons.length).toBeGreaterThan(1);
    expect(lessons[0]!.isLocked).toBe(false);
    expect(lessons[1]!.isLocked).toBe(true);
    expect(res.body.progress.percent).toBe(0);
    expect(res.body.exam.isLocked).toBe(true);
  });

  it('a locked lesson answers 403 LESSON_LOCKED', async () => {
    const res = await http.get(`/api/v1/me/lessons/${lessonIds[1]}`).set(auth('s1')).expect(403);
    expect(res.body.code).toBe(ErrorCode.LESSON_LOCKED);
  });

  it('the exam cannot be started before all lessons are complete', async () => {
    const res = await http
      .post(`/api/v1/me/courses/${courseId}/exam/attempts`)
      .set(auth('s1'))
      .expect(403);
    expect(res.body.code).toBe(ErrorCode.EXAM_LOCKED);
  });

  it('practice questions never contain correct answers', async () => {
    const lesson = await http.get(`/api/v1/me/lessons/${lessonIds[0]}`).set(auth('s1')).expect(200);
    expect(lesson.body.practices).toHaveLength(4);
    const practice = await http
      .get(`/api/v1/me/practices/${lesson.body.practices[0].id}`)
      .set(auth('s1'))
      .expect(200);
    expect(practice.body.questions).toHaveLength(6);
    const json = JSON.stringify(practice.body.questions);
    expect(json).not.toContain('isCorrect');
    expect(json).not.toContain('explanation');
    expect(json).not.toContain('blankIndex');
  });

  it('a wrong practice submission is graded 0 and stored', async () => {
    const lesson = await http.get(`/api/v1/me/lessons/${lessonIds[0]}`).set(auth('s1')).expect(200);
    const res = await http
      .post(`/api/v1/me/practices/${lesson.body.practices[0].id}/attempts`)
      .set(auth('s1'))
      .send({ answers: [] })
      .expect(201);
    expect(res.body.attempt.score).toBe(0);
    expect(res.body.questions[0].explanation).toBeDefined();
  });

  it('completing every lesson (viewed + 4 practices) unlocks the next one and finally the exam', async () => {
    for (const [i, lessonId] of lessonIds.entries()) {
      await http.post(`/api/v1/me/lessons/${lessonId}/viewed`).set(auth('s1')).expect(200);
      const practices = await prisma.practice.findMany({
        where: { lessonId },
        include: { questions: { include: { options: optionSelect } } },
      });
      let last: request.Response | undefined;
      for (const p of practices) {
        last = await http
          .post(`/api/v1/me/practices/${p.id}/attempts`)
          .set(auth('s1'))
          .send({ answers: p.questions.map(perfect) })
          .expect(201);
        expect(last.body.attempt.percent).toBe(100);
      }
      expect(last!.body.lesson.isCompleted).toBe(true);
      if (i + 1 < lessonIds.length) {
        await http
          .get(`/api/v1/me/lessons/${lessonIds[i + 1]}`)
          .set(auth('s1'))
          .expect(200);
      }
    }
    const tree = await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s1')).expect(200);
    expect(tree.body.progress.percent).toBe(100);
    expect(tree.body.exam.isLocked).toBe(false);
  });

  let attemptId = '';

  it('starts a timed exam attempt without answers; resumes instead of duplicating', async () => {
    const res = await http
      .post(`/api/v1/me/courses/${courseId}/exam/attempts`)
      .set(auth('s1'))
      .expect(201);
    attemptId = res.body.id;
    expect(Date.parse(res.body.expiresAt)).toBeGreaterThan(Date.now());
    expect(JSON.stringify(res.body.questions)).not.toContain('isCorrect');
    const again = await http
      .post(`/api/v1/me/courses/${courseId}/exam/attempts`)
      .set(auth('s1'))
      .expect(201);
    expect(again.body.id).toBe(attemptId);
  });

  it("another student cannot submit or read someone else's attempt (404)", async () => {
    await http
      .post(`/api/v1/me/exam-attempts/${attemptId}/submit`)
      .set(auth('s2'))
      .send({ answers: [] })
      .expect(404);
    await http.get(`/api/v1/me/exam-attempts/${attemptId}`).set(auth('s2')).expect(404);
  });

  let certificateId = '';
  let publicId = '';

  it('passing the exam auto-issues exactly one certificate with a PDF', async () => {
    const attempt = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const qIds = attempt.questionIds as string[];
    const questions = await prisma.examQuestion.findMany({
      where: { id: { in: qIds } },
      include: { options: optionSelect },
    });
    const res = await http
      .post(`/api/v1/me/exam-attempts/${attemptId}/submit`)
      .set(auth('s1'))
      .send({ answers: questions.map(perfect) })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'SUBMITTED', percent: 100, passed: true });
    expect(res.body.certificate.publicId).toMatch(/^OD-/);
    certificateId = res.body.certificate.id;
    publicId = res.body.certificate.publicId;

    await http
      .post(`/api/v1/me/exam-attempts/${attemptId}/submit`)
      .set(auth('s1'))
      .send({ answers: [] })
      .expect(409);
    const retake = await http
      .post(`/api/v1/me/courses/${courseId}/exam/attempts`)
      .set(auth('s1'))
      .expect(409);
    expect(retake.body.code).toBe(ErrorCode.EXAM_ALREADY_PASSED);
    expect(await prisma.certificate.count({ where: { userId: ids.s1, courseId } })).toBe(1);
  });

  it('public verify works without auth; unknown IDs are 404', async () => {
    const res = await http.get(`/api/v1/certificates/verify/${publicId.toLowerCase()}`).expect(200);
    expect(res.body).toMatchObject({ certificateId: publicId, fullName: 'Test s1', isValid: true });
    const missing = await http.get('/api/v1/certificates/verify/OD-0000-0000-0000').expect(404);
    expect(missing.body.code).toBe(ErrorCode.CERTIFICATE_NOT_FOUND);
  });

  it('owner lists and downloads the PDF; another student gets 404', async () => {
    const list = await http.get('/api/v1/me/certificates').set(auth('s1')).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].pdfReady).toBe(true);
    const pdf = await http
      .get(`/api/v1/me/certificates/${certificateId}/pdf`)
      .set(auth('s1'))
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    await http.get(`/api/v1/me/certificates/${certificateId}/pdf`).set(auth('s2')).expect(404);
    const other = await http.get('/api/v1/me/certificates').set(auth('s2')).expect(200);
    expect(other.body.total).toBe(0);
  });

  it('results and dashboard reflect the pass', async () => {
    const results = await http.get('/api/v1/me/results').set(auth('s1')).expect(200);
    expect(results.body.items[0]).toMatchObject({ passed: true, courseId });
    const dash = await http.get('/api/v1/me/dashboard').set(auth('s1')).expect(200);
    expect(dash.body.stats).toMatchObject({
      enrolledCourses: 1,
      completedCourses: 1,
      certificates: 1,
    });
  });

  it('admin: dashboard, reports, students, exam config; students are denied', async () => {
    await http.get('/api/v1/admin/dashboard').set(auth('s1')).expect(403);
    const dash = await http.get('/api/v1/admin/dashboard').set(auth('admin')).expect(200);
    expect(dash.body.certificates).toBeGreaterThanOrEqual(1);
    expect(dash.body).toHaveProperty('pendingAccessRequests');
    expect(dash.body).not.toHaveProperty('revenue');
    // A content manager sees the same dashboard (their admin home).
    await prisma.user.update({ where: { id: ids.s2 }, data: { role: Role.CONTENT_MANAGER } });
    const cm = await http.get('/api/v1/admin/dashboard').set(auth('s2')).expect(200);
    expect(cm.body).toMatchObject({ certificates: dash.body.certificates });
    await http.get('/api/v1/admin/reports/courses').set(auth('s2')).expect(403);
    await prisma.user.update({ where: { id: ids.s2 }, data: { role: Role.STUDENT } });
    await http.get('/api/v1/admin/reports/courses').set(auth('admin')).expect(200);
    await http.get('/api/v1/admin/reports/exams').set(auth('admin')).expect(200);
    const act = await http.get('/api/v1/admin/reports/activity').set(auth('admin')).expect(200);
    expect(act.body.days).toHaveLength(30);
    const exam = await http
      .get(`/api/v1/admin/courses/${courseId}/exam`)
      .set(auth('admin'))
      .expect(200);
    expect(exam.body.exam).not.toBeNull();
    const qs = await http
      .get(`/api/v1/admin/courses/${courseId}/exam/questions`)
      .set(auth('admin'))
      .expect(200);
    expect(qs.body.total).toBeGreaterThan(0);
    const list = await http
      .get(`/api/v1/admin/students?search=${RUN}`)
      .set(auth('admin'))
      .expect(200);
    expect(list.body.total).toBe(2);
    const profile = await http
      .get(`/api/v1/admin/students/${ids.s1}`)
      .set(auth('admin'))
      .expect(200);
    expect(profile.body.certificates).toHaveLength(1);
  });

  it('admin grants and revokes access (audited); a late exam submit is rejected', async () => {
    await http
      .post(`/api/v1/admin/students/${ids.s2}/enrollments`)
      .set(auth('admin'))
      .send({ courseId, reason: 'e2e' })
      .expect(201);
    expect(
      await prisma.auditLog.count({ where: { action: 'ENROLLMENT_GRANTED', reason: 'e2e' } }),
    ).toBe(1);
    await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s2')).expect(200);

    // Server-side timing: an attempt whose deadline passed long ago cannot be submitted.
    const exam = await prisma.exam.findUniqueOrThrow({ where: { courseId } });
    const old = new Date(Date.now() - 2 * 60 * 60_000);
    const late = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        userId: ids.s2,
        status: ExamAttemptStatus.IN_PROGRESS,
        questionIds: [],
        startedAt: old,
        expiresAt: new Date(old.getTime() + 60_000),
      },
    });
    const res = await http
      .post(`/api/v1/me/exam-attempts/${late.id}/submit`)
      .set(auth('s2'))
      .send({ answers: [] })
      .expect(409);
    expect(res.body.code).toBe(ErrorCode.EXAM_TIME_OVER);
    expect((await prisma.examAttempt.findUniqueOrThrow({ where: { id: late.id } })).status).toBe(
      'EXPIRED',
    );

    await http
      .delete(`/api/v1/admin/students/${ids.s2}/enrollments/${courseId}`)
      .set(auth('admin'))
      .expect(204);
    await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s2')).expect(403);
  });
});
