/**
 * Course access is admin-only: a student asks for a course, an admin approves (the student gets
 * the course) or rejects (with a reason). Payments and self-enrolment no longer exist.
 * Uses the seeded demo course; every user it creates is removed afterwards.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCode, Role } from '@onlinedars/shared';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_COURSE } from '../prisma/seed-data';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `acr${Date.now()}`;
const email = (name: string) => `${name}.${RUN}@test.onlinedars.uz`;
const PASSWORD = 'Parol12345!';

describe.skipIf(!hasDb)('access requests e2e', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let courseId = '';
  const tokens: Record<'s1' | 's2' | 'admin' | 'manager', string> = {
    s1: '',
    s2: '',
    admin: '',
    manager: '',
  };
  const ids: Record<string, string> = {};
  const auth = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    const course = await prisma.course.findUniqueOrThrow({ where: { slug: DEMO_COURSE.slug } });
    courseId = course.id;

    for (const who of ['s1', 's2', 'admin', 'manager'] as const) {
      const res = await http
        .post('/api/v1/auth/register')
        .send({ fullName: `Test ${who}`, email: email(who), password: PASSWORD })
        .expect(201);
      ids[who] = res.body.user.id;
    }
    await prisma.user.update({ where: { id: ids.admin }, data: { role: Role.ADMIN } });
    await prisma.user.update({
      where: { id: ids.manager },
      data: { role: Role.CONTENT_MANAGER },
    });
    // Log in again so the tokens carry the new roles.
    for (const who of ['s1', 's2', 'admin', 'manager'] as const) {
      const res = await http
        .post('/api/v1/auth/login')
        .send({ login: email(who), password: PASSWORD })
        .expect(200);
      tokens[who] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    const userIds = Object.values(ids);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app?.close();
  });

  it('payment and self-enrolment endpoints are gone', async () => {
    await http.post('/api/v1/orders').set(auth('s1')).send({ courseId }).expect(404);
    await http.get('/api/v1/me/orders').set(auth('s1')).expect(404);
    await http.get('/api/v1/admin/payments').set(auth('admin')).expect(404);
    await http.post('/api/v1/payments/payme').send({}).expect(404);
  });

  it('public course data has no price', async () => {
    const res = await http.get(`/api/v1/courses/${DEMO_COURSE.slug}`).expect(200);
    expect(res.body).not.toHaveProperty('price');
    expect(res.body).not.toHaveProperty('isFree');
  });

  it('a student requests access; a second request is refused while pending', async () => {
    await http.post('/api/v1/access-requests').send({ courseId }).expect(401);
    const res = await http
      .post('/api/v1/access-requests')
      .set(auth('s1'))
      .send({ courseId, message: 'Iltimos' })
      .expect(201);
    expect(res.body).toMatchObject({ courseId, status: 'PENDING', message: 'Iltimos' });

    const again = await http
      .post('/api/v1/access-requests')
      .set(auth('s1'))
      .send({ courseId })
      .expect(409);
    expect(again.body.code).toBe(ErrorCode.ACCESS_REQUEST_PENDING);

    const state = await http
      .get(`/api/v1/me/course-access/${courseId}`)
      .set(auth('s1'))
      .expect(200);
    expect(state.body).toMatchObject({ enrolled: false, request: { status: 'PENDING' } });
    // Still no access to the course itself.
    await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s1')).expect(403);
  });

  it('staff cannot request; only ADMIN sees and decides the queue', async () => {
    await http.post('/api/v1/access-requests').set(auth('admin')).send({ courseId }).expect(403);
    await http.get('/api/v1/admin/access-requests').set(auth('s1')).expect(403);
    await http.get('/api/v1/admin/access-requests').set(auth('manager')).expect(403);
    const list = await http
      .get(`/api/v1/admin/access-requests?status=PENDING&search=${RUN}`)
      .set(auth('admin'))
      .expect(200);
    expect(list.body.pendingCount).toBeGreaterThanOrEqual(1);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      courseId,
      student: { id: ids.s1 },
      status: 'PENDING',
    });
    await http
      .post(`/api/v1/admin/access-requests/${list.body.items[0].id}/approve`)
      .set(auth('manager'))
      .expect(403);
  });

  it('approve grants the course, audits, notifies; cannot decide twice', async () => {
    const list = await http
      .get(`/api/v1/admin/access-requests?status=PENDING&search=${RUN}`)
      .set(auth('admin'))
      .expect(200);
    const id = list.body.items[0].id as string;
    const res = await http
      .post(`/api/v1/admin/access-requests/${id}/approve`)
      .set(auth('admin'))
      .expect(200);
    expect(res.body).toMatchObject({ status: 'APPROVED', decidedBy: { id: ids.admin } });

    await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s1')).expect(200);
    const enr = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: ids.s1!, courseId } },
    });
    expect(enr.source).toBe('ACCESS_REQUEST');
    expect(
      await prisma.auditLog.count({
        where: { action: 'ACCESS_REQUEST_APPROVED', entityId: id, actorId: ids.admin },
      }),
    ).toBe(1);
    const notes = await http.get('/api/v1/me/notifications').set(auth('s1')).expect(200);
    expect(notes.body.items[0]).toMatchObject({ type: 'ACCESS_GRANTED' });

    const twice = await http
      .post(`/api/v1/admin/access-requests/${id}/approve`)
      .set(auth('admin'))
      .expect(409);
    expect(twice.body.code).toBe(ErrorCode.ACCESS_REQUEST_DECIDED);

    const enrolled = await http
      .post('/api/v1/access-requests')
      .set(auth('s1'))
      .send({ courseId })
      .expect(409);
    expect(enrolled.body.code).toBe(ErrorCode.ALREADY_ENROLLED);
  });

  it('reject needs a reason, which the student sees; they may ask again', async () => {
    const created = await http
      .post('/api/v1/access-requests')
      .set(auth('s2'))
      .send({ courseId })
      .expect(201);
    const id = created.body.id as string;
    await http
      .post(`/api/v1/admin/access-requests/${id}/reject`)
      .set(auth('admin'))
      .send({})
      .expect(400);
    await http
      .post(`/api/v1/admin/access-requests/${id}/reject`)
      .set(auth('admin'))
      .send({ reason: "Guruh to'ldi" })
      .expect(200);

    const mine = await http.get('/api/v1/me/access-requests').set(auth('s2')).expect(200);
    expect(mine.body[0]).toMatchObject({
      id,
      status: 'REJECTED',
      decisionReason: "Guruh to'ldi",
    });
    await http.get(`/api/v1/me/courses/${courseId}`).set(auth('s2')).expect(403);

    const again = await http
      .post('/api/v1/access-requests')
      .set(auth('s2'))
      .send({ courseId })
      .expect(201);
    expect(again.body).toMatchObject({ id, status: 'PENDING', decisionReason: null });
  });

  it("a student never sees another student's requests", async () => {
    const mine = await http.get('/api/v1/me/access-requests').set(auth('s1')).expect(200);
    expect(mine.body.every((r: { id: string }) => typeof r.id === 'string')).toBe(true);
    const s2 = await prisma.accessRequest.findFirstOrThrow({ where: { userId: ids.s2 } });
    expect(mine.body.map((r: { id: string }) => r.id)).not.toContain(s2.id);
  });

  it('a direct admin grant closes the open request', async () => {
    await http
      .post(`/api/v1/admin/students/${ids.s2}/enrollments`)
      .set(auth('admin'))
      .send({ courseId, reason: 'e2e' })
      .expect(201);
    const req = await prisma.accessRequest.findFirstOrThrow({ where: { userId: ids.s2 } });
    expect(req.status).toBe('APPROVED');
    let mine = await http.get('/api/v1/me/access-requests').set(auth('s2')).expect(200);
    expect(mine.body[0]).toMatchObject({ status: 'APPROVED', hasAccess: true });

    // Revoked later: the request stays APPROVED but reports no access, and the student may ask again.
    await http
      .delete(`/api/v1/admin/students/${ids.s2}/enrollments/${courseId}`)
      .set(auth('admin'))
      .expect(204);
    mine = await http.get('/api/v1/me/access-requests').set(auth('s2')).expect(200);
    expect(mine.body[0]).toMatchObject({ status: 'APPROVED', hasAccess: false });
    await http.post('/api/v1/access-requests').set(auth('s2')).send({ courseId }).expect(201);
  });
});
