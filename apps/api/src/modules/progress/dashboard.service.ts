import { Injectable } from '@nestjs/common';
import type {
  Paginated,
  PaginationQuery,
  StudentCourseItem,
  StudentDashboard,
} from '@onlinedars/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseStateService } from './course-state.service';

type LastActivity = NonNullable<StudentDashboard['lastActivity']>;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CourseStateService,
  ) {}

  /** All active enrollments of the student with progress, newest first. */
  async listCourseItems(userId: string): Promise<StudentCourseItem[]> {
    const [enrollments, certificates, passedAttempts] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId, revokedAt: null },
        orderBy: { enrolledAt: 'desc' },
        select: { courseId: true, enrolledAt: true },
      }),
      this.prisma.certificate.findMany({
        where: { userId, revokedAt: null },
        select: { id: true, courseId: true },
      }),
      this.prisma.examAttempt.findMany({
        where: { userId, passed: true },
        select: { exam: { select: { courseId: true } } },
      }),
    ]);
    const certBy = new Map(certificates.map((c) => [c.courseId, c.id]));
    const passedCourses = new Set(passedAttempts.map((a) => a.exam.courseId));

    const items: StudentCourseItem[] = [];
    for (const e of enrollments) {
      const s = await this.state.load(userId, e.courseId);
      items.push({
        id: s.course.id,
        slug: s.course.slug,
        title: s.course.title,
        coverImageUrl: s.course.coverImageUrl,
        enrolledAt: e.enrolledAt.toISOString(),
        progress: s.progress,
        lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
        nextLessonId: s.nextLessonId,
        examPassed: passedCourses.has(e.courseId),
        certificateId: certBy.get(e.courseId) ?? null,
      });
    }
    return items;
  }

  async listCourses(userId: string, q: PaginationQuery): Promise<Paginated<StudentCourseItem>> {
    const all = await this.listCourseItems(userId);
    const start = (q.page - 1) * q.pageSize;
    return {
      items: all.slice(start, start + q.pageSize),
      total: all.length,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async getDashboard(userId: string): Promise<StudentDashboard> {
    const [courses, practiceAttempts, completedLessons, certificates, lastActivity] =
      await Promise.all([
        this.listCourseItems(userId),
        this.prisma.practiceAttempt.count({ where: { userId } }),
        this.prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
        this.prisma.certificate.count({ where: { userId, revokedAt: null } }),
        this.lastActivity(userId),
      ]);
    const overallProgress =
      courses.length === 0
        ? 0
        : Math.floor(courses.reduce((s, c) => s + c.progress.percent, 0) / courses.length);
    // Activity first: the course the student touched last is the one to continue.
    const sorted = [...courses].sort(
      (a, b) =>
        (Date.parse(b.lastActivityAt ?? '') || 0) - (Date.parse(a.lastActivityAt ?? '') || 0),
    );
    return {
      stats: {
        enrolledCourses: courses.length,
        completedCourses: courses.filter((c) => c.examPassed).length,
        completedLessons,
        practiceAttempts,
        certificates,
        overallProgress,
      },
      courses: sorted,
      lastActivity,
    };
  }

  /** Latest of: lesson visit, practice submission, exam submission. */
  async lastActivity(userId: string): Promise<StudentDashboard['lastActivity']> {
    const lessonSel = {
      id: true,
      title: true,
      module: { select: { course: { select: { id: true, title: true } } } },
    } as const;
    const [lp, pa, ea] = await Promise.all([
      this.prisma.lessonProgress.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, lesson: { select: lessonSel } },
      }),
      this.prisma.practiceAttempt.findFirst({
        where: { userId, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        select: {
          submittedAt: true,
          practice: { select: { title: true, lesson: { select: lessonSel } } },
        },
      }),
      this.prisma.examAttempt.findFirst({
        where: { userId, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        select: {
          submittedAt: true,
          exam: { select: { title: true, course: { select: { id: true, title: true } } } },
        },
      }),
    ]);
    const candidates: LastActivity[] = [];
    if (lp) {
      candidates.push({
        type: 'LESSON_VIEWED',
        at: lp.updatedAt.toISOString(),
        courseId: lp.lesson.module.course.id,
        courseTitle: lp.lesson.module.course.title,
        lessonId: lp.lesson.id,
        title: lp.lesson.title,
      });
    }
    if (pa?.submittedAt) {
      candidates.push({
        type: 'PRACTICE_SUBMITTED',
        at: pa.submittedAt.toISOString(),
        courseId: pa.practice.lesson.module.course.id,
        courseTitle: pa.practice.lesson.module.course.title,
        lessonId: pa.practice.lesson.id,
        title: pa.practice.title,
      });
    }
    if (ea?.submittedAt) {
      candidates.push({
        type: 'EXAM_SUBMITTED',
        at: ea.submittedAt.toISOString(),
        courseId: ea.exam.course.id,
        courseTitle: ea.exam.course.title,
        lessonId: null,
        title: ea.exam.title,
      });
    }
    candidates.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return candidates[0] ?? null;
  }
}
