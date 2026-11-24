import { ErrorCode, Role } from '@onlinedars/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { PrismaService } from '../../prisma/prisma.service';
import { createMemoryDb, type MemoryDb } from '../../testing/memory-db';
import type { EmailSender, NotificationSmsSender } from '../notifications/channels';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessRequestsService, accessRequestWhere } from './access-requests.service';

async function expectCode(p: Promise<unknown>, code: string, status: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
  expect((err as AppException).getStatus()).toBe(status);
}

const meta = { actorId: 'admin1', ip: '1.2.3.4', userAgent: 'vitest' };
const page = { page: 1, pageSize: 20 };

let db: MemoryDb;
let svc: AccessRequestsService;
let student: { id: string; role: typeof Role.STUDENT; sessionId: string };
let courseId: string;

beforeEach(async () => {
  db = createMemoryDb();
  const notifications = new NotificationsService(
    db as unknown as PrismaService,
    { send: vi.fn(async () => undefined) } as unknown as EmailSender,
    { send: vi.fn(async () => undefined) } as unknown as NotificationSmsSender,
  );
  svc = new AccessRequestsService(db as unknown as PrismaService, notifications);
  const u = (await db.user.create({ data: { fullName: 'Ali Valiyev', email: 'ali@x.uz' } })) as {
    id: string;
  };
  await db.user.create({ data: { id: 'admin1', fullName: 'Admin', role: 'ADMIN' } });
  student = { id: u.id, role: Role.STUDENT, sessionId: 's' };
  const c = (await db.course.create({ data: { title: 'Python', slug: 'python' } })) as {
    id: string;
  };
  courseId = c.id;
});

describe('student requests access', () => {
  it('creates a PENDING request with an optional message', async () => {
    const r = await svc.request(student, { courseId, message: '  Iltimos  ' });
    expect(r).toMatchObject({
      courseId,
      courseTitle: 'Python',
      courseSlug: 'python',
      status: 'PENDING',
      message: 'Iltimos',
      decisionReason: null,
    });
    const state = await svc.courseAccess(student, courseId);
    expect(state.enrolled).toBe(false);
    expect(state.request?.status).toBe('PENDING');
  });

  it('409 ACCESS_REQUEST_PENDING when asking twice', async () => {
    await svc.request(student, { courseId });
    await expectCode(svc.request(student, { courseId }), ErrorCode.ACCESS_REQUEST_PENDING, 409);
    expect(db.accessRequest.rows).toHaveLength(1);
  });

  it('409 ALREADY_ENROLLED when the student already has the course', async () => {
    await db.enrollment.create({ data: { userId: student.id, courseId, source: 'ADMIN' } });
    await expectCode(svc.request(student, { courseId }), ErrorCode.ALREADY_ENROLLED, 409);
  });

  it('only published courses can be requested; unknown course → 404', async () => {
    const draft = (await db.course.create({
      data: { title: 'Draft', slug: 'draft', status: 'DRAFT' },
    })) as { id: string };
    await expectCode(
      svc.request(student, { courseId: draft.id }),
      ErrorCode.COURSE_NOT_AVAILABLE,
      400,
    );
    await expectCode(svc.request(student, { courseId: 'nope' }), ErrorCode.NOT_FOUND, 404);
  });

  it('asking again after a rejection reopens the same row', async () => {
    const r = await svc.request(student, { courseId });
    await svc.reject(r.id, { reason: "Guruh to'ldi" }, meta);
    const again = await svc.request(student, { courseId, message: 'Yana' });
    expect(again).toMatchObject({ id: r.id, status: 'PENDING', decisionReason: null });
    expect(db.accessRequest.rows).toHaveLength(1);
  });

  it('a student sees only their own requests', async () => {
    const other = (await db.user.create({ data: { fullName: 'Other' } })) as { id: string };
    await svc.request(student, { courseId });
    await svc.request({ ...student, id: other.id }, { courseId });
    const mine = await svc.listOwn(student);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.courseId).toBe(courseId);
  });
});

describe('admin decides', () => {
  it('approve grants the enrollment (source ACCESS_REQUEST), audits and notifies', async () => {
    const r = await svc.request(student, { courseId });
    const decided = await svc.approve(r.id, meta);
    expect(decided).toMatchObject({
      status: 'APPROVED',
      decidedBy: { id: 'admin1', fullName: 'Admin' },
      student: { id: student.id, fullName: 'Ali Valiyev' },
    });
    expect(db.enrollment.rows).toEqual([
      expect.objectContaining({
        userId: student.id,
        courseId,
        source: 'ACCESS_REQUEST',
        revokedAt: null,
      }),
    ]);
    expect(db.auditLog.rows[0]).toMatchObject({
      actorId: 'admin1',
      action: 'ACCESS_REQUEST_APPROVED',
      entityType: 'AccessRequest',
      entityId: r.id,
      ip: '1.2.3.4',
    });
    expect(db.notification.rows[0]).toMatchObject({
      userId: student.id,
      type: 'ACCESS_GRANTED',
    });
    expect((await svc.courseAccess(student, courseId)).enrolled).toBe(true);
  });

  it('hasAccess follows the enrollment: true after approval, false once access is revoked', async () => {
    const r = await svc.request(student, { courseId });
    expect(r.hasAccess).toBe(false);
    expect((await svc.approve(r.id, meta)).hasAccess).toBe(true);
    expect((await svc.listOwn(student))[0]).toMatchObject({ status: 'APPROVED', hasAccess: true });

    await db.enrollment.updateMany({
      where: { userId: student.id, courseId },
      data: { revokedAt: new Date() },
    });
    expect((await svc.listOwn(student))[0]).toMatchObject({ status: 'APPROVED', hasAccess: false });
    expect((await svc.list({ ...page })).items[0]?.hasAccess).toBe(false);
    expect(await svc.courseAccess(student, courseId)).toMatchObject({
      enrolled: false,
      request: { status: 'APPROVED', hasAccess: false },
    });
  });

  it('approve restores a revoked enrollment', async () => {
    await db.enrollment.create({
      data: { userId: student.id, courseId, source: 'ADMIN', revokedAt: new Date() },
    });
    const r = await svc.request(student, { courseId });
    await svc.approve(r.id, meta);
    expect(db.enrollment.rows).toHaveLength(1);
    expect(db.enrollment.rows[0]).toMatchObject({ revokedAt: null, source: 'ACCESS_REQUEST' });
  });

  it('reject stores the reason, audits and notifies; no enrollment', async () => {
    const r = await svc.request(student, { courseId });
    const decided = await svc.reject(r.id, { reason: "  Guruh to'ldi " }, meta);
    expect(decided).toMatchObject({ status: 'REJECTED', decisionReason: "Guruh to'ldi" });
    expect(db.enrollment.rows).toHaveLength(0);
    expect(db.auditLog.rows[0]).toMatchObject({
      action: 'ACCESS_REQUEST_REJECTED',
      reason: "Guruh to'ldi",
    });
    expect(db.notification.rows[0]).toMatchObject({
      type: 'ACCESS_REJECTED',
      data: expect.objectContaining({ reason: "Guruh to'ldi" }),
    });
  });

  it('a decided request cannot be decided again (409); unknown id → 404', async () => {
    const r = await svc.request(student, { courseId });
    await svc.approve(r.id, meta);
    await expectCode(svc.approve(r.id, meta), ErrorCode.ACCESS_REQUEST_DECIDED, 409);
    await expectCode(
      svc.reject(r.id, { reason: 'kech' }, meta),
      ErrorCode.ACCESS_REQUEST_DECIDED,
      409,
    );
    await expectCode(svc.approve('nope', meta), ErrorCode.ACCESS_REQUEST_NOT_FOUND, 404);
    expect(db.auditLog.rows).toHaveLength(1);
  });

  it('list returns the queue with the pending count', async () => {
    const other = (await db.user.create({ data: { fullName: 'Other' } })) as { id: string };
    const r1 = await svc.request(student, { courseId });
    await svc.request({ ...student, id: other.id }, { courseId });
    await svc.approve(r1.id, meta);
    const pending = await svc.list({ ...page, status: 'PENDING' });
    expect(pending.total).toBe(1);
    expect(pending.pendingCount).toBe(1);
    expect(pending.items[0]?.student.fullName).toBe('Other');
    const all = await svc.list(page);
    expect(all.total).toBe(2);
  });

  it('closeOpenRequest marks a pending request approved (direct grant)', async () => {
    const r = await svc.request(student, { courseId });
    await AccessRequestsService.closeOpenRequest(
      db as unknown as Parameters<typeof AccessRequestsService.closeOpenRequest>[0],
      student.id,
      courseId,
      'admin1',
    );
    expect(db.accessRequest.rows[0]).toMatchObject({
      id: r.id,
      status: 'APPROVED',
      decidedById: 'admin1',
    });
  });
});

describe('accessRequestWhere', () => {
  it('filters by status and course; search covers student and course', () => {
    expect(accessRequestWhere({ ...page })).toEqual({});
    expect(accessRequestWhere({ ...page, status: 'PENDING', courseId: 'c1' })).toEqual({
      status: 'PENDING',
      courseId: 'c1',
    });
    const w = accessRequestWhere({ ...page, search: 'Ali' });
    expect(w.OR).toHaveLength(4);
  });
});
