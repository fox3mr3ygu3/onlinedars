import { Injectable } from '@nestjs/common';
import {
  type AccessRequestStatus as AccessRequestStatusT,
  type AdminAccessRequest,
  type AdminAccessRequestList,
  type AdminAccessRequestsQuery,
  AccessRequestStatus,
  type AuthPrincipal,
  type CourseAccessState,
  CourseStatus,
  type CreateAccessRequestInput,
  EnrollmentSource,
  ErrorCode,
  type MyAccessRequest,
  type RejectAccessRequestInput,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  accessGrantedNotification,
  accessRejectedNotification,
  NotificationsService,
} from '../notifications/notifications.service';

export interface AuditMeta {
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
}

interface RequestRow {
  id: string;
  userId: string;
  courseId: string;
  status: AccessRequestStatusT;
  message: string | null;
  decisionReason: string | null;
  decidedById: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  course?: { title: string; slug: string } | null;
  user?: { id: string; fullName: string; email: string | null; phone: string | null } | null;
  decidedBy?: { id: string; fullName: string } | null;
}

const include = {
  course: { select: { title: true, slug: true } },
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  decidedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AccessRequestInclude;

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export function toMyAccessRequest(r: RequestRow): MyAccessRequest {
  return {
    id: r.id,
    courseId: r.courseId,
    courseTitle: r.course?.title ?? '',
    courseSlug: r.course?.slug ?? '',
    status: r.status,
    message: r.message,
    decisionReason: r.decisionReason,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toAdminAccessRequest(r: RequestRow): AdminAccessRequest {
  return {
    ...toMyAccessRequest(r),
    student: {
      id: r.user?.id ?? r.userId,
      fullName: r.user?.fullName ?? '',
      email: r.user?.email ?? null,
      phone: r.user?.phone ?? null,
    },
    decidedBy: r.decidedBy ? { id: r.decidedBy.id, fullName: r.decidedBy.fullName } : null,
  };
}

/** Admin search over the student (name / email / phone) and the course title. */
export function accessRequestWhere(q: AdminAccessRequestsQuery): Prisma.AccessRequestWhereInput {
  const where: Prisma.AccessRequestWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.courseId ? { courseId: q.courseId } : {}),
  };
  const s = q.search?.trim();
  if (s) {
    where.OR = [
      { user: { fullName: { contains: s, mode: 'insensitive' } } },
      { user: { email: { contains: s.toLowerCase() } } },
      { user: { phone: { contains: s.replace(/[^\d+]/g, '') || s } } },
      { course: { title: { contains: s, mode: 'insensitive' } } },
    ];
  }
  return where;
}

/**
 * Course access is never bought or self-served: a student asks, an admin approves (which
 * grants the enrollment) or rejects. One row per (student, course); asking again after a
 * rejection or a revoked enrollment reopens it. Decisions are audited and notify the student.
 */
@Injectable()
export class AccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── student ──

  async request(
    principal: AuthPrincipal,
    input: CreateAccessRequestInput,
  ): Promise<MyAccessRequest> {
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, status: true },
    });
    if (!course) throw AppException.notFound(ErrorCode.NOT_FOUND, 'Course not found');
    if (course.status !== CourseStatus.PUBLISHED) {
      throw AppException.badRequest(ErrorCode.COURSE_NOT_AVAILABLE);
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: principal.id, courseId: course.id } },
      select: { revokedAt: true },
    });
    if (enrollment && !enrollment.revokedAt) {
      throw AppException.conflict(ErrorCode.ALREADY_ENROLLED);
    }

    const message = input.message?.trim() || null;
    const existing = await this.prisma.accessRequest.findUnique({
      where: { userId_courseId: { userId: principal.id, courseId: course.id } },
      select: { id: true, status: true },
    });
    if (existing?.status === AccessRequestStatus.PENDING) {
      throw AppException.conflict(ErrorCode.ACCESS_REQUEST_PENDING);
    }
    const id = existing
      ? (
          await this.prisma.accessRequest.update({
            where: { id: existing.id },
            data: {
              status: AccessRequestStatus.PENDING,
              message,
              decisionReason: null,
              decidedById: null,
              decidedAt: null,
              createdAt: new Date(),
            },
            select: { id: true },
          })
        ).id
      : (
          await this.prisma.accessRequest.create({
            data: { userId: principal.id, courseId: course.id, message },
            select: { id: true },
          })
        ).id;
    return toMyAccessRequest(await this.load(id));
  }

  /** What the course page shows a signed-in student: enrolled, or the state of their request. */
  async courseAccess(principal: AuthPrincipal, courseId: string): Promise<CourseAccessState> {
    const [enrollment, request] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: principal.id, courseId } },
        select: { revokedAt: true },
      }),
      this.prisma.accessRequest.findUnique({
        where: { userId_courseId: { userId: principal.id, courseId } },
        include,
      }),
    ]);
    return {
      enrolled: Boolean(enrollment && !enrollment.revokedAt),
      request: request ? toMyAccessRequest(request) : null,
    };
  }

  async listOwn(principal: AuthPrincipal): Promise<MyAccessRequest[]> {
    const rows = await this.prisma.accessRequest.findMany({
      where: { userId: principal.id },
      orderBy: { updatedAt: 'desc' },
      include,
    });
    return rows.map(toMyAccessRequest);
  }

  // ── admin ──

  async list(q: AdminAccessRequestsQuery): Promise<AdminAccessRequestList> {
    const where = accessRequestWhere(q);
    const [rows, total, pendingCount] = await Promise.all([
      this.prisma.accessRequest.findMany({
        where,
        orderBy: { createdAt: q.status === AccessRequestStatus.PENDING ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include,
      }),
      this.prisma.accessRequest.count({ where }),
      this.prisma.accessRequest.count({ where: { status: AccessRequestStatus.PENDING } }),
    ]);
    return {
      items: rows.map(toAdminAccessRequest),
      total,
      page: q.page,
      pageSize: q.pageSize,
      pendingCount,
    };
  }

  /** Approves a pending request: grants (or restores) the enrollment. Audited; notifies. */
  async approve(id: string, meta: AuditMeta): Promise<AdminAccessRequest> {
    const notificationId = await this.prisma.$transaction(async (tx) => {
      const before = await this.pending(tx, id);
      const enrollment = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: before.userId, courseId: before.courseId } },
      });
      if (!enrollment) {
        await tx.enrollment.create({
          data: {
            userId: before.userId,
            courseId: before.courseId,
            source: EnrollmentSource.ACCESS_REQUEST,
          },
        });
      } else if (enrollment.revokedAt) {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { revokedAt: null, source: EnrollmentSource.ACCESS_REQUEST },
        });
      }
      const after = await tx.accessRequest.update({
        where: { id },
        data: {
          status: AccessRequestStatus.APPROVED,
          decisionReason: null,
          decidedById: meta.actorId,
          decidedAt: new Date(),
        },
      });
      await this.audit(tx, 'ACCESS_REQUEST_APPROVED', before, after, null, meta);
      const course = await tx.course.findUnique({
        where: { id: before.courseId },
        select: { title: true, slug: true },
      });
      const n = await this.notifications.create(
        accessGrantedNotification({
          userId: before.userId,
          courseId: before.courseId,
          courseTitle: course?.title ?? '',
          courseSlug: course?.slug ?? '',
        }),
        tx,
      );
      return n.id;
    });
    await this.notifications.deliver(notificationId);
    return toAdminAccessRequest(await this.load(id));
  }

  /** Rejects a pending request with a reason the student sees. Audited; notifies. */
  async reject(
    id: string,
    input: RejectAccessRequestInput,
    meta: AuditMeta,
  ): Promise<AdminAccessRequest> {
    const reason = input.reason.trim();
    const notificationId = await this.prisma.$transaction(async (tx) => {
      const before = await this.pending(tx, id);
      const after = await tx.accessRequest.update({
        where: { id },
        data: {
          status: AccessRequestStatus.REJECTED,
          decisionReason: reason,
          decidedById: meta.actorId,
          decidedAt: new Date(),
        },
      });
      await this.audit(tx, 'ACCESS_REQUEST_REJECTED', before, after, reason, meta);
      const course = await tx.course.findUnique({
        where: { id: before.courseId },
        select: { title: true, slug: true },
      });
      const n = await this.notifications.create(
        accessRejectedNotification({
          userId: before.userId,
          courseId: before.courseId,
          courseTitle: course?.title ?? '',
          courseSlug: course?.slug ?? '',
          reason,
        }),
        tx,
      );
      return n.id;
    });
    await this.notifications.deliver(notificationId);
    return toAdminAccessRequest(await this.load(id));
  }

  /**
   * Called when an admin grants access directly from the student page: an open request for
   * the same course is closed as approved, so it doesn't linger in the queue.
   */
  static async closeOpenRequest(
    tx: Prisma.TransactionClient,
    userId: string,
    courseId: string,
    actorId: string,
  ): Promise<void> {
    await tx.accessRequest.updateMany({
      where: { userId, courseId, status: AccessRequestStatus.PENDING },
      data: { status: AccessRequestStatus.APPROVED, decidedById: actorId, decidedAt: new Date() },
    });
  }

  // ── helpers ──

  private async load(id: string): Promise<RequestRow> {
    const row = await this.prisma.accessRequest.findUnique({ where: { id }, include });
    if (!row) throw AppException.notFound(ErrorCode.ACCESS_REQUEST_NOT_FOUND);
    return row;
  }

  private async pending(tx: Prisma.TransactionClient, id: string) {
    const row = await tx.accessRequest.findUnique({ where: { id } });
    if (!row) throw AppException.notFound(ErrorCode.ACCESS_REQUEST_NOT_FOUND);
    if (row.status !== AccessRequestStatus.PENDING) {
      throw AppException.conflict(ErrorCode.ACCESS_REQUEST_DECIDED);
    }
    return row;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: string,
    before: unknown,
    after: { id: string },
    reason: string | null,
    meta: AuditMeta,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: meta.actorId,
        action,
        entityType: 'AccessRequest',
        entityId: after.id,
        before: json(before),
        after: json(after),
        reason,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
  }
}
