import { Injectable } from '@nestjs/common';
import {
  type AdminStudentListItem,
  type AdminStudentProfile,
  type AdminStudentsQuery,
  EnrollmentSource,
  ErrorCode,
  ExamAttemptStatus,
  type GrantEnrollmentInput,
  type Paginated,
  Role,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CertificatesService, itemSelect } from '../certificates/certificates.service';
import { toResultSummary } from '../exams/exams.service';
import { CourseStateService } from '../progress/course-state.service';
import { percentOf } from '../progress/grading/grading';

export interface AuditMeta {
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
}

const listSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  _count: { select: { enrollments: true, certificates: true } },
} as const;

type ListRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  _count: { enrollments: number; certificates: number };
};

const toListItem = (u: ListRow): AdminStudentListItem => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  phone: u.phone,
  isActive: u.isActive,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  enrollments: u._count.enrollments,
  certificates: u._count.certificates,
});

/** Builds the `where` for the student search (name, email, phone; case-insensitive). */
export function studentSearchWhere(search: string | undefined): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: Role.STUDENT };
  const s = search?.trim();
  if (s) {
    const digits = s.replace(/[^\d+]/g, '');
    where.OR = [
      { fullName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s.toLowerCase() } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ];
  }
  return where;
}

/** Admin students: list, profile with progress/results, grant/revoke access (ADMIN). */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CourseStateService,
    private readonly certificates: CertificatesService,
  ) {}

  async list(q: AdminStudentsQuery): Promise<Paginated<AdminStudentListItem>> {
    const where = studentSearchWhere(q.search);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: listSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toListItem), total, page: q.page, pageSize: q.pageSize };
  }

  private async findStudent(id: string): Promise<ListRow> {
    const u = await this.prisma.user.findFirst({
      where: { id, role: Role.STUDENT },
      select: listSelect,
    });
    if (!u) throw AppException.notFound();
    return u;
  }

  async get(id: string): Promise<AdminStudentProfile> {
    const student = await this.findStudent(id);
    const [enrollments, attempts, certs, practice] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId: id },
        orderBy: { enrolledAt: 'desc' },
        select: {
          courseId: true,
          source: true,
          enrolledAt: true,
          revokedAt: true,
          completedAt: true,
          course: { select: { title: true } },
        },
      }),
      this.prisma.examAttempt.findMany({
        where: { userId: id, status: { not: ExamAttemptStatus.IN_PROGRESS } },
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          examId: true,
          userId: true,
          status: true,
          questionIds: true,
          answers: true,
          startedAt: true,
          expiresAt: true,
          submittedAt: true,
          score: true,
          maxScore: true,
          percent: true,
          passed: true,
          exam: {
            select: { title: true, passScore: true, course: { select: { id: true, title: true } } },
          },
        },
      }),
      this.prisma.certificate.findMany({
        where: { userId: id },
        orderBy: { issuedAt: 'desc' },
        select: itemSelect,
      }),
      this.prisma.practiceAttempt.findMany({
        where: { userId: id },
        select: { score: true, maxScore: true, passed: true },
      }),
    ]);

    const withProgress = [];
    for (const e of enrollments) {
      const s = await this.state.load(id, e.courseId);
      withProgress.push({
        courseId: e.courseId,
        courseTitle: e.course.title,
        source: e.source,
        enrolledAt: e.enrolledAt.toISOString(),
        revokedAt: e.revokedAt?.toISOString() ?? null,
        completedAt: e.completedAt?.toISOString() ?? null,
        progress: s.progress,
      });
    }
    const avg =
      practice.length === 0
        ? null
        : Math.round(
            practice.reduce((s, p) => s + percentOf(p.score, p.maxScore), 0) / practice.length,
          );

    return {
      student: toListItem(student),
      enrollments: withProgress,
      results: attempts.map((a) => ({
        ...toResultSummary(a),
        courseId: a.exam.course.id,
        courseTitle: a.exam.course.title,
        examTitle: a.exam.title,
        passScore: a.exam.passScore,
      })),
      certificates: certs.map((c) => this.certificates.toItem(c)),
      practiceStats: {
        attempts: practice.length,
        passed: practice.filter((p) => p.passed).length,
        avgPercent: avg,
      },
    };
  }

  /** Grants access (source ADMIN) or restores a revoked enrollment. Audited. */
  async grant(studentId: string, input: GrantEnrollmentInput, meta: AuditMeta) {
    await this.findStudent(studentId);
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true },
    });
    if (!course) throw AppException.notFound();

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: studentId, courseId: input.courseId } },
      });
      if (before && !before.revokedAt) throw AppException.conflict(ErrorCode.ALREADY_ENROLLED);
      const after = before
        ? await tx.enrollment.update({
            where: { id: before.id },
            data: { revokedAt: null, source: EnrollmentSource.ADMIN },
          })
        : await tx.enrollment.create({
            data: { userId: studentId, courseId: input.courseId, source: EnrollmentSource.ADMIN },
          });
      await tx.auditLog.create({
        data: {
          actorId: meta.actorId,
          action: 'ENROLLMENT_GRANTED',
          entityType: 'Enrollment',
          entityId: after.id,
          before: before
            ? (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue)
            : undefined,
          after: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue,
          reason: input.reason ?? null,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      return {
        courseId: after.courseId,
        enrolledAt: after.enrolledAt.toISOString(),
        source: after.source,
      };
    });
  }

  /** Revokes access (keeps progress and certificates). Audited. */
  async revoke(studentId: string, courseId: string, meta: AuditMeta): Promise<void> {
    await this.findStudent(studentId);
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: studentId, courseId } },
      });
      if (!before || before.revokedAt) throw AppException.notFound(ErrorCode.NOT_ENROLLED);
      const after = await tx.enrollment.update({
        where: { id: before.id },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: meta.actorId,
          action: 'ENROLLMENT_REVOKED',
          entityType: 'Enrollment',
          entityId: after.id,
          before: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
          after: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    });
  }
}
