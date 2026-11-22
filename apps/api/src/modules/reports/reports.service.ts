import { Injectable } from '@nestjs/common';
import {
  type ActivityReportDay,
  type AdminDashboardStats,
  type CourseReportRow,
  CourseStatus,
  ExamAttemptStatus,
  type ExamReportRow,
  PaymentStatus,
  type ReportRangeQuery,
  Role,
} from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type ActivityMetric,
  fillDays,
  rangeBounds,
  rate,
  REPORT_TIMEZONE,
  resolveRange,
  toCourseReportRow,
} from './reports.logic';

type DayCount = { day: string; n: number };

/** Admin dashboard + reports (ADMIN). Read-only aggregates. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(now: Date = new Date()): Promise<AdminDashboardStats> {
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const [
      students,
      newStudents30d,
      activeCourses,
      enrollments,
      completedLessons,
      practiceAttempts,
      examAttempts,
      examsPassed,
      certificates,
      paid,
      recent,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.STUDENT, createdAt: { gte: since } } }),
      this.prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
      this.prisma.enrollment.count({ where: { revokedAt: null } }),
      this.prisma.lessonProgress.count({ where: { completedAt: { not: null } } }),
      this.prisma.practiceAttempt.count(),
      this.prisma.examAttempt.count({ where: { status: { not: ExamAttemptStatus.IN_PROGRESS } } }),
      this.prisma.examAttempt.count({ where: { passed: true } }),
      this.prisma.certificate.count({ where: { revokedAt: null } }),
      this.prisma.order.aggregate({
        where: { status: PaymentStatus.PAID },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.examAttempt.findMany({
        where: { status: { not: ExamAttemptStatus.IN_PROGRESS } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          percent: true,
          passed: true,
          submittedAt: true,
          user: { select: { id: true, fullName: true } },
          exam: { select: { course: { select: { title: true } } } },
        },
      }),
    ]);
    return {
      students,
      newStudents30d,
      activeCourses,
      enrollments,
      completedLessons,
      practiceAttempts,
      examAttempts,
      examsPassed,
      certificates,
      paidOrders: paid._count._all,
      revenue: paid._sum.amount ?? 0,
      recentResults: recent.map((r) => ({
        attemptId: r.id,
        studentId: r.user.id,
        studentName: r.user.fullName,
        courseTitle: r.exam.course.title,
        percent: r.percent,
        passed: r.passed,
        submittedAt: r.submittedAt?.toISOString() ?? null,
      })),
    };
  }

  async courses(q: ReportRangeQuery): Promise<CourseReportRow[]> {
    const courseWhere = q.courseId ? { id: q.courseId } : {};
    const [courses, enrollAll, enrollActive, lessons, completions, passed, certs] =
      await Promise.all([
        this.prisma.course.findMany({
          where: courseWhere,
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, status: true },
        }),
        this.prisma.enrollment.groupBy({ by: ['courseId'], _count: { _all: true } }),
        this.prisma.enrollment.groupBy({
          by: ['courseId'],
          where: { revokedAt: null },
          _count: { _all: true },
        }),
        this.prisma.lesson.findMany({
          where: { isPublished: true, isRequired: true },
          select: { module: { select: { courseId: true } } },
        }),
        this.prisma.$queryRaw<{ courseId: string; n: number }[]>`
        SELECT m."courseId", COUNT(*)::int AS n
        FROM "LessonProgress" lp
        JOIN "Lesson" l ON l.id = lp."lessonId"
        JOIN "Module" m ON m.id = l."moduleId"
        WHERE lp."completedAt" IS NOT NULL AND l."isPublished" AND l."isRequired"
        GROUP BY m."courseId"`,
        this.prisma.examAttempt.findMany({
          where: { passed: true },
          select: { userId: true, exam: { select: { courseId: true } } },
          distinct: ['userId', 'examId'],
        }),
        this.prisma.certificate.groupBy({
          by: ['courseId'],
          where: { revokedAt: null },
          _count: { _all: true },
        }),
      ]);
    const countMap = (rows: { courseId: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.courseId, r._count._all]));
    const all = countMap(enrollAll);
    const active = countMap(enrollActive);
    const certMap = countMap(certs);
    const reqLessons = new Map<string, number>();
    for (const l of lessons) {
      reqLessons.set(l.module.courseId, (reqLessons.get(l.module.courseId) ?? 0) + 1);
    }
    const compMap = new Map(completions.map((c) => [c.courseId, Number(c.n)]));
    const passMap = new Map<string, number>();
    for (const p of passed) passMap.set(p.exam.courseId, (passMap.get(p.exam.courseId) ?? 0) + 1);

    return courses.map((c) =>
      toCourseReportRow({
        courseId: c.id,
        title: c.title,
        status: c.status,
        enrollments: all.get(c.id) ?? 0,
        activeEnrollments: active.get(c.id) ?? 0,
        requiredLessons: reqLessons.get(c.id) ?? 0,
        lessonCompletions: compMap.get(c.id) ?? 0,
        examPassed: passMap.get(c.id) ?? 0,
        certificates: certMap.get(c.id) ?? 0,
      }),
    );
  }

  async exams(q: ReportRangeQuery): Promise<{ from: string; to: string; items: ExamReportRow[] }> {
    const range = resolveRange(q.from, q.to);
    const { start, end } = rangeBounds(range);
    const exams = await this.prisma.exam.findMany({
      where: q.courseId ? { courseId: q.courseId } : {},
      select: { id: true, title: true, courseId: true, course: { select: { title: true } } },
    });
    const attemptWhere = { startedAt: { gte: start, lt: end } };
    const [byStatus, byPassed, avg] = await Promise.all([
      this.prisma.examAttempt.groupBy({
        by: ['examId', 'status'],
        where: attemptWhere,
        _count: { _all: true },
      }),
      this.prisma.examAttempt.groupBy({
        by: ['examId'],
        where: { ...attemptWhere, passed: true },
        _count: { _all: true },
      }),
      this.prisma.examAttempt.groupBy({
        by: ['examId'],
        where: { ...attemptWhere, status: { not: ExamAttemptStatus.IN_PROGRESS } },
        _avg: { percent: true },
      }),
    ]);
    const items = exams.map((e) => {
      const rows = byStatus.filter((r) => r.examId === e.id);
      const attempts = rows.reduce((s, r) => s + r._count._all, 0);
      const finished = rows
        .filter((r) => r.status !== ExamAttemptStatus.IN_PROGRESS)
        .reduce((s, r) => s + r._count._all, 0);
      const passedN = byPassed.find((r) => r.examId === e.id)?._count._all ?? 0;
      const avgPercent = avg.find((r) => r.examId === e.id)?._avg.percent ?? null;
      return {
        examId: e.id,
        courseId: e.courseId,
        courseTitle: e.course.title,
        title: e.title,
        attempts,
        finished,
        passed: passedN,
        passRate: rate(passedN, finished),
        avgPercent: avgPercent == null ? null : Math.round(avgPercent),
      };
    });
    return { ...range, items };
  }

  async activity(
    q: ReportRangeQuery,
  ): Promise<{ from: string; to: string; days: ActivityReportDay[] }> {
    const range = resolveRange(q.from, q.to);
    const { start, end } = rangeBounds(range);
    const tz = REPORT_TIMEZONE;
    const day = (col: string) =>
      Prisma.raw(`to_char(("${col}" AT TIME ZONE 'UTC') AT TIME ZONE '${tz}', 'YYYY-MM-DD')`);
    const count = (table: string, col: string, extra = '') =>
      this.prisma.$queryRaw<DayCount[]>`
        SELECT ${day(col)} AS day, COUNT(*)::int AS n
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE ${Prisma.raw(`"${col}"`)} >= ${start} AND ${Prisma.raw(`"${col}"`)} < ${end}
        ${Prisma.raw(extra)}
        GROUP BY 1`;
    const [lessons, practices, exams, enrollments, students] = await Promise.all([
      count('LessonProgress', 'completedAt'),
      count('PracticeAttempt', 'startedAt'),
      count('ExamAttempt', 'startedAt'),
      count('Enrollment', 'enrolledAt'),
      count('User', 'createdAt', `AND "role" = 'STUDENT'`),
    ]);
    const toMap = (rows: DayCount[]) => new Map(rows.map((r) => [r.day, Number(r.n)]));
    const counts: Partial<Record<ActivityMetric, Map<string, number>>> = {
      lessonsCompleted: toMap(lessons),
      practiceAttempts: toMap(practices),
      examAttempts: toMap(exams),
      enrollments: toMap(enrollments),
      newStudents: toMap(students),
    };
    return { ...range, days: fillDays(range, counts) };
  }
}
