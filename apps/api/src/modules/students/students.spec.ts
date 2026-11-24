import { ErrorCode, Role } from '@onlinedars/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { CertificatesService } from '../certificates/certificates.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { CourseStateService } from '../progress/course-state.service';
import { createMockPrisma, type MockPrisma } from '../progress/testing/mock-prisma';
import { StudentsService, studentSearchWhere } from './students.service';

async function expectCode(p: Promise<unknown>, code: string, status?: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
  if (status) expect((err as AppException).getStatus()).toBe(status);
}

const student = {
  id: 's1',
  fullName: 'Ali',
  email: 'ali@x.uz',
  phone: null,
  isActive: true,
  createdAt: new Date(),
  lastLoginAt: null,
  _count: { enrollments: 1, certificates: 0 },
};
const meta = { actorId: 'admin1', ip: '1.2.3.4', userAgent: 'vitest' };

let mock: MockPrisma;
let svc: StudentsService;
let notifications: { create: ReturnType<typeof vi.fn>; deliver: ReturnType<typeof vi.fn> };

beforeEach(() => {
  const m = createMockPrisma();
  mock = m.mock;
  const state = {
    load: vi.fn(async () => ({
      progress: {
        completedLessons: 1,
        totalLessons: 2,
        completedRequired: 1,
        totalRequired: 2,
        percent: 50,
      },
    })),
  } as unknown as CourseStateService;
  notifications = {
    create: vi.fn(async () => ({ id: 'n1' })),
    deliver: vi.fn(async () => undefined),
  };
  svc = new StudentsService(
    m.prisma,
    state,
    { toItem: vi.fn() } as unknown as CertificatesService,
    notifications as unknown as NotificationsService,
  );
  mock.user.findFirst.mockResolvedValue(student);
  mock.course.findUnique.mockResolvedValue({ id: 'c1', title: 'Kurs', slug: 'kurs' });
});

describe('search', () => {
  it('only students; name/email/phone', () => {
    expect(studentSearchWhere(undefined)).toEqual({ role: Role.STUDENT });
    const w = studentSearchWhere(' +998 90 ');
    expect(w.role).toBe(Role.STUDENT);
    expect(w.OR).toHaveLength(3);
    expect(studentSearchWhere('Ali').OR).toHaveLength(2);
  });
});

describe('profile', () => {
  it('404 for a non-student id', async () => {
    mock.user.findFirst.mockResolvedValue(null);
    await expectCode(svc.get('admin1'), ErrorCode.NOT_FOUND, 404);
  });
  it('includes enrollments with progress', async () => {
    mock.enrollment.findMany.mockResolvedValue([
      {
        courseId: 'c1',
        source: 'ADMIN',
        enrolledAt: new Date(),
        revokedAt: null,
        completedAt: null,
        course: { title: 'Kurs' },
      },
    ]);
    const p = await svc.get('s1');
    expect(p.enrollments[0]).toMatchObject({ courseTitle: 'Kurs', progress: { percent: 50 } });
    expect(p.practiceStats).toEqual({ attempts: 0, passed: 0, avgPercent: null });
  });
});

describe('grant / revoke access (audited)', () => {
  it('grants a new enrollment with source ADMIN and writes an audit log', async () => {
    mock.enrollment.create.mockResolvedValue({
      id: 'e1',
      userId: 's1',
      courseId: 'c1',
      source: 'ADMIN',
      enrolledAt: new Date(),
      revokedAt: null,
    });
    await svc.grant('s1', { courseId: 'c1', reason: 'gift' }, meta);
    expect(mock.enrollment.create.mock.calls[0]![0].data).toMatchObject({ source: 'ADMIN' });
    expect(mock.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      actorId: 'admin1',
      action: 'ENROLLMENT_GRANTED',
      entityType: 'Enrollment',
      entityId: 'e1',
      reason: 'gift',
      ip: '1.2.3.4',
    });
  });

  it('closes an open access request and notifies the student', async () => {
    mock.enrollment.create.mockResolvedValue({
      id: 'e1',
      courseId: 'c1',
      source: 'ADMIN',
      enrolledAt: new Date(),
      revokedAt: null,
    });
    await svc.grant('s1', { courseId: 'c1' }, meta);
    expect(mock.accessRequest.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: 's1', courseId: 'c1', status: 'PENDING' },
      data: { status: 'APPROVED', decidedById: 'admin1' },
    });
    expect(notifications.create.mock.calls[0]![0]).toMatchObject({
      userId: 's1',
      type: 'ACCESS_GRANTED',
      data: { courseId: 'c1', courseSlug: 'kurs' },
    });
    expect(notifications.deliver).toHaveBeenCalledWith('n1');
  });

  it('restores a revoked enrollment', async () => {
    mock.enrollment.findUnique.mockResolvedValue({ id: 'e1', revokedAt: new Date() });
    mock.enrollment.update.mockResolvedValue({
      id: 'e1',
      courseId: 'c1',
      source: 'ADMIN',
      enrolledAt: new Date(),
      revokedAt: null,
    });
    await svc.grant('s1', { courseId: 'c1' }, meta);
    expect(mock.enrollment.update.mock.calls[0]![0].data).toEqual({
      revokedAt: null,
      source: 'ADMIN',
    });
  });

  it('409 ALREADY_ENROLLED for an active enrollment', async () => {
    mock.enrollment.findUnique.mockResolvedValue({ id: 'e1', revokedAt: null });
    await expectCode(svc.grant('s1', { courseId: 'c1' }, meta), ErrorCode.ALREADY_ENROLLED, 409);
    expect(mock.auditLog.create).not.toHaveBeenCalled();
  });

  it('revokes and audits; 404 if not enrolled', async () => {
    mock.enrollment.findUnique.mockResolvedValueOnce({ id: 'e1', revokedAt: null });
    mock.enrollment.update.mockResolvedValue({ id: 'e1', revokedAt: new Date() });
    await svc.revoke('s1', 'c1', meta);
    expect(mock.auditLog.create.mock.calls[0]![0].data.action).toBe('ENROLLMENT_REVOKED');
    mock.enrollment.findUnique.mockResolvedValueOnce(null);
    await expectCode(svc.revoke('s1', 'c1', meta), ErrorCode.NOT_ENROLLED, 404);
  });
});
