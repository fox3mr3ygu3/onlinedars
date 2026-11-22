/**
 * API e2e for backend-content: role checks, admin CRUD, the 4×6 rule through the HTTP API
 * (service checks + DB triggers), publish rules, answer stripping on public routes, uploads
 * and settings. Needs a migrated Postgres at DATABASE_URL; skipped when it is not set.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCode, Role } from '@onlinedars/shared';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `c${Date.now()}`;
const email = (name: string) => `${name}.${RUN}@test.onlinedars.uz`;
const slug = (name: string) => `${name}-${RUN}`;
const PASSWORD = 'Parol12345!';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

function collectKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      collectKeys(x, out);
    }
  }
  return out;
}

const tf = (n: number) => ({
  type: 'TRUE_FALSE',
  prompt: `Savol ${n}: 2 + 2 = 4?`,
  explanation: 'Ha, 4',
  options: [
    { text: "To'g'ri", isCorrect: true },
    { text: "Noto'g'ri", isCorrect: false },
  ],
});

describe.skipIf(!hasDb)('content e2e', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  const tokens: Record<'student' | 'manager' | 'admin', string> = {
    student: '',
    manager: '',
    admin: '',
  };
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    for (const [name, role] of [
      ['student', Role.STUDENT],
      ['manager', Role.CONTENT_MANAGER],
      ['admin', Role.ADMIN],
    ] as const) {
      await http
        .post('/api/v1/auth/register')
        .send({ fullName: `Kontent ${name}`, email: email(name), password: PASSWORD })
        .expect(201);
      if (role !== Role.STUDENT) {
        await prisma.user.update({ where: { email: email(name) }, data: { role } });
      }
      const login = await http
        .post('/api/v1/auth/login')
        .send({ login: email(name), password: PASSWORD })
        .expect(200);
      tokens[name] = login.body.accessToken;
    }
  });

  afterAll(async () => {
    await prisma.course.deleteMany({ where: { slug: { endsWith: RUN } } });
    await prisma.direction.deleteMany({ where: { slug: { endsWith: RUN } } });
    await prisma.teacher.deleteMany({ where: { slug: { endsWith: RUN } } });
    await prisma.faq.deleteMany({ where: { question: { endsWith: RUN } } });
    await prisma.setting.deleteMany({ where: { key: 'tagline' } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${RUN}@test.onlinedars.uz` } } });
    await prisma.$disconnect();
    await app?.close();
  });

  describe('authorization', () => {
    it('anonymous → 401, student → 403 on admin content routes', async () => {
      await http.get('/api/v1/admin/courses').expect(401);
      const res = await http.get('/api/v1/admin/courses').set(auth('student')).expect(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      await http.post('/api/v1/admin/files').set(auth('student')).expect(403);
    });

    it('content manager may manage content but not settings', async () => {
      await http.get('/api/v1/admin/courses').set(auth('manager')).expect(200);
      await http.get('/api/v1/admin/settings').set(auth('manager')).expect(403);
      await http.get('/api/v1/admin/settings').set(auth('admin')).expect(200);
    });

    it('public catalog routes need no token', async () => {
      for (const path of ['/courses', '/directions', '/teachers', '/faq', '/settings/public']) {
        const res = await http.get(`/api/v1${path}`).expect(200);
        if (path !== '/settings/public') {
          expect(res.body).toMatchObject({ items: expect.any(Array), page: 1 });
        }
      }
    });
  });

  describe('course → module → lesson → 4 practices × 6 questions', () => {
    let courseId = '';
    let lessonId = '';
    const practiceIds: string[] = [];
    let firstQuestionId = '';

    it('creates direction, teacher and a paid DRAFT course; duplicate slug → SLUG_TAKEN', async () => {
      const dir = await http
        .post('/api/v1/admin/directions')
        .set(auth('manager'))
        .send({ slug: slug('it'), name: 'Dasturlash' })
        .expect(201);
      const teacher = await http
        .post('/api/v1/admin/teachers')
        .set(auth('manager'))
        .send({ slug: slug('ali'), fullName: 'Ali Valiyev' })
        .expect(201);
      const body = {
        slug: slug('python'),
        title: `Python asoslari ${RUN}`,
        shortDescription: 'Python tilini noldan',
        isFree: false,
        price: 199_000_00,
        directionId: dir.body.id,
        teacherIds: [teacher.body.id],
      };
      const course = await http
        .post('/api/v1/admin/courses')
        .set(auth('manager'))
        .send(body)
        .expect(201);
      expect(course.body).toMatchObject({
        status: 'DRAFT',
        price: 199_000_00,
        sequentialUnlock: true,
      });
      courseId = course.body.id;
      const dup = await http
        .post('/api/v1/admin/courses')
        .set(auth('manager'))
        .send(body)
        .expect(409);
      expect(dup.body.code).toBe(ErrorCode.SLUG_TAKEN);
    });

    it('rejects a free course with a price', async () => {
      await http
        .patch(`/api/v1/admin/courses/${courseId}`)
        .set(auth('manager'))
        .send({ isFree: true, price: 100 })
        .expect(400);
    });

    it('creates a module and a lesson; incomplete lesson cannot be published', async () => {
      const mod = await http
        .post(`/api/v1/admin/courses/${courseId}/modules`)
        .set(auth('manager'))
        .send({ title: 'Kirish' })
        .expect(201);
      expect(mod.body.position).toBe(1);
      const lesson = await http
        .post(`/api/v1/admin/modules/${mod.body.id}/lessons`)
        .set(auth('manager'))
        .send({ title: 'Birinchi dars', durationMinutes: 15 })
        .expect(201);
      lessonId = lesson.body.id;
      expect(lesson.body).toMatchObject({ isPublished: false, ready: false });
      const res = await http
        .post(`/api/v1/admin/lessons/${lessonId}/publish`)
        .set(auth('manager'))
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.LESSON_INCOMPLETE);
      expect(res.body.details).toMatchObject({ practices: 0, required: 4, ready: false });
    });

    it('allows exactly 4 practices (5th → LESSON_PRACTICE_LIMIT)', async () => {
      for (let i = 1; i <= 4; i++) {
        const p = await http
          .post(`/api/v1/admin/lessons/${lessonId}/practices`)
          .set(auth('manager'))
          .send({ title: `Amaliyot ${i}` })
          .expect(201);
        expect(p.body.position).toBe(i);
        practiceIds.push(p.body.id);
      }
      const res = await http
        .post(`/api/v1/admin/lessons/${lessonId}/practices`)
        .set(auth('manager'))
        .send({ title: 'Amaliyot 5' })
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.LESSON_PRACTICE_LIMIT);
    });

    it('allows exactly 6 questions per practice (7th → PRACTICE_QUESTION_LIMIT)', async () => {
      for (const pid of practiceIds) {
        for (let n = 1; n <= 6; n++) {
          const q = await http
            .post(`/api/v1/admin/practices/${pid}/questions`)
            .set(auth('manager'))
            .send(tf(n))
            .expect(201);
          firstQuestionId ||= q.body.id;
          // Admin responses include the answer key.
          expect(q.body.options[0].isCorrect).toBe(true);
        }
      }
      const res = await http
        .post(`/api/v1/admin/practices/${practiceIds[0]}/questions`)
        .set(auth('manager'))
        .send(tf(7))
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.PRACTICE_QUESTION_LIMIT);
    });

    it('validates question shape per type', async () => {
      const bad = await http
        .patch(`/api/v1/admin/questions/${firstQuestionId}`)
        .set(auth('manager'))
        .send({ options: [{ text: 'faqat bitta', isCorrect: true }] })
        .expect(400);
      expect(bad.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('completeness counters say ready; course cannot publish before the lesson', async () => {
      const c = await http
        .get(`/api/v1/admin/lessons/${lessonId}/completeness`)
        .set(auth('manager'))
        .expect(200);
      expect(c.body).toMatchObject({ practices: 4, required: 4, totalQuestions: 24, ready: true });
      expect(c.body.questionsPerPractice).toHaveLength(4);
      const res = await http
        .post(`/api/v1/admin/courses/${courseId}/status`)
        .set(auth('manager'))
        .send({ status: 'PUBLISHED' })
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.COURSE_INCOMPLETE);
    });

    it('publishes the lesson, then the course; it shows up in the public catalog', async () => {
      await http.post(`/api/v1/admin/lessons/${lessonId}/publish`).set(auth('manager')).expect(200);
      const course = await http
        .post(`/api/v1/admin/courses/${courseId}/status`)
        .set(auth('manager'))
        .send({ status: 'PUBLISHED' })
        .expect(200);
      expect(course.body.status).toBe('PUBLISHED');

      const list = await http.get(`/api/v1/courses?search=${RUN}&isFree=false`).expect(200);
      expect(list.body.items.map((c: { id: string }) => c.id)).toContain(courseId);
      expect(list.body.items[0]).toMatchObject({ lessonCount: 1, durationMinutes: 15 });
    });

    it('public course page never exposes practices, questions or answers', async () => {
      const res = await http.get(`/api/v1/courses/${slug('python')}`).expect(200);
      expect(res.body.modules[0].lessons[0].id).toBe(lessonId);
      const keys = collectKeys(res.body);
      for (const k of [
        'practices',
        'questions',
        'options',
        'isCorrect',
        'matchText',
        'explanation',
      ]) {
        expect(keys.has(k)).toBe(false);
      }
      expect(JSON.stringify(res.body)).not.toContain('Savol 1');
    });

    it('deleting a question of a published lesson unpublishes it atomically', async () => {
      const res = await http
        .delete(`/api/v1/admin/questions/${firstQuestionId}`)
        .set(auth('manager'))
        .expect(200);
      expect(res.body).toEqual({ deleted: true, lessonUnpublished: true });
      const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
      expect(lesson.isPublished).toBe(false);
      // The course page no longer lists the now-unpublished lesson.
      const page = await http.get(`/api/v1/courses/${slug('python')}`).expect(200);
      expect(page.body.lessonCount).toBe(0);
    });

    it('hidden/draft courses are not public', async () => {
      await http
        .post(`/api/v1/admin/courses/${courseId}/status`)
        .set(auth('manager'))
        .send({ status: 'HIDDEN' })
        .expect(200);
      await http.get(`/api/v1/courses/${slug('python')}`).expect(404);
    });

    it('deletes an untouched course', async () => {
      await http.delete(`/api/v1/admin/courses/${courseId}`).set(auth('admin')).expect(204);
      await http.get(`/api/v1/admin/courses/${courseId}`).set(auth('admin')).expect(404);
    });
  });

  describe('files', () => {
    it('uploads an image (memory driver under test) and serves it back', async () => {
      const res = await http
        .post('/api/v1/admin/files')
        .set(auth('manager'))
        .field('purpose', 'IMAGE')
        .attach('file', PNG, { filename: 'rasm.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body).toMatchObject({ mimeType: 'image/png', sizeBytes: PNG.length });
      const path = new URL(res.body.url).pathname;
      const file = await http.get(path).buffer(true).expect(200);
      expect(file.headers['content-type']).toBe('image/png');
    });

    it('rejects a disguised file and a missing file', async () => {
      const bad = await http
        .post('/api/v1/admin/files')
        .set(auth('manager'))
        .attach('file', Buffer.from('<html></html>'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(bad.body.code).toBe(ErrorCode.FILE_TYPE_NOT_ALLOWED);
      const none = await http.post('/api/v1/admin/files').set(auth('manager')).expect(400);
      expect(none.body.code).toBe(ErrorCode.FILE_REQUIRED);
    });
  });

  describe('settings', () => {
    it('admin updates a setting; the change is audit-logged', async () => {
      const res = await http
        .patch('/api/v1/admin/settings')
        .set(auth('admin'))
        .send({ tagline: `Bilim ${RUN}` })
        .expect(200);
      expect(res.body.tagline).toBe(`Bilim ${RUN}`);
      const pub = await http.get('/api/v1/settings/public').expect(200);
      expect(pub.body.tagline).toBe(`Bilim ${RUN}`);
      expect(pub.body).not.toHaveProperty('refundPolicy');
      const log = await prisma.auditLog.findFirst({
        where: { action: 'settings.update', entityId: 'tagline' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.after).toEqual({ tagline: `Bilim ${RUN}` });
      await http.patch('/api/v1/admin/settings').set(auth('admin')).send({ nope: 1 }).expect(400);
    });
  });

  describe('faq', () => {
    it('CRUD and public listing of active entries only', async () => {
      const created = await http
        .post('/api/v1/admin/faq')
        .set(auth('manager'))
        .send({ question: `Qanday to'layman? ${RUN}`, answer: 'Payme yoki Click orqali' })
        .expect(201);
      await http
        .patch(`/api/v1/admin/faq/${created.body.id}`)
        .set(auth('manager'))
        .send({ isActive: false })
        .expect(200);
      const pub = await http.get('/api/v1/faq').expect(200);
      expect(pub.body.items.map((f: { id: string }) => f.id)).not.toContain(created.body.id);
      await http.delete(`/api/v1/admin/faq/${created.body.id}`).set(auth('manager')).expect(204);
    });
  });
});
