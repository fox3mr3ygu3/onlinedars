import { Injectable } from '@nestjs/common';
import { type CourseProgress, ErrorCode } from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeCourseProgress,
  computeLocks,
  flattenLessons,
  isExamUnlocked,
  type LockState,
  nextLessonId,
  type TreeModule,
} from './progress.logic';

export interface StateLesson {
  id: string;
  title: string;
  position: number;
  durationMinutes: number | null;
  isRequired: boolean;
  isCompleted: boolean;
  materialViewed: boolean;
  completedAt: Date | null;
  practicesTotal: number;
  practicesPassed: number;
}

export interface StateModule {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: StateLesson[];
}

export interface CourseState {
  course: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string | null;
    sequentialUnlock: boolean;
  };
  modules: StateModule[];
  locks: LockState;
  progress: CourseProgress;
  examUnlocked: boolean;
  nextLessonId: string | null;
  lastActivityAt: Date | null;
}

/**
 * Loads one student's view of a course: published lessons in order, completion, locks and
 * progress. Shared by the progress, exams and dashboard endpoints so the rules are applied
 * in exactly one place.
 */
@Injectable()
export class CourseStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  /** 403 NOT_ENROLLED unless the user has an active enrollment. */
  async assertEnrolled(userId: string, courseId: string): Promise<void> {
    if (!(await this.ownership.isEnrolled(userId, courseId))) {
      throw AppException.forbidden(ErrorCode.NOT_ENROLLED);
    }
  }

  async load(userId: string, courseId: string): Promise<CourseState> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImageUrl: true,
        sequentialUnlock: true,
        modules: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            position: true,
            lessons: {
              where: { isPublished: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                position: true,
                durationMinutes: true,
                isRequired: true,
                practices: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!course) throw AppException.notFound();

    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const [progressRows, passedRows, lastAttempt] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true, materialViewedAt: true, completedAt: true, updatedAt: true },
      }),
      this.prisma.practiceAttempt.findMany({
        where: { userId, passed: true, practice: { lessonId: { in: lessonIds } } },
        select: { practiceId: true },
        distinct: ['practiceId'],
      }),
      this.prisma.practiceAttempt.findFirst({
        where: { userId, practice: { lessonId: { in: lessonIds } } },
        orderBy: { startedAt: 'desc' },
        select: { submittedAt: true, startedAt: true },
      }),
    ]);
    const progressBy = new Map(progressRows.map((p) => [p.lessonId, p]));
    const passed = new Set(passedRows.map((p) => p.practiceId));

    const modules: StateModule[] = course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      position: m.position,
      lessons: m.lessons.map((l) => {
        const p = progressBy.get(l.id);
        return {
          id: l.id,
          title: l.title,
          position: l.position,
          durationMinutes: l.durationMinutes,
          isRequired: l.isRequired,
          isCompleted: Boolean(p?.completedAt),
          materialViewed: Boolean(p?.materialViewedAt),
          completedAt: p?.completedAt ?? null,
          practicesTotal: l.practices.length,
          practicesPassed: l.practices.filter((pr) => passed.has(pr.id)).length,
        };
      }),
    }));

    const tree: TreeModule[] = modules;
    const locks = computeLocks(tree, course.sequentialUnlock);
    const lessons = flattenLessons(tree);
    const activity = [
      ...progressRows.map((p) => p.updatedAt),
      lastAttempt?.submittedAt ?? lastAttempt?.startedAt,
    ].filter((d): d is Date => d instanceof Date);
    const lastActivityAt =
      activity.length > 0 ? new Date(Math.max(...activity.map((d) => d.getTime()))) : null;

    return {
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        coverImageUrl: course.coverImageUrl,
        sequentialUnlock: course.sequentialUnlock,
      },
      modules,
      locks,
      progress: computeCourseProgress(lessons),
      examUnlocked: isExamUnlocked(lessons),
      nextLessonId: nextLessonId(tree, locks),
      lastActivityAt,
    };
  }

  /** Throws LESSON_LOCKED (403) if the lesson is locked for this student. */
  assertLessonOpen(state: CourseState, lessonId: string): void {
    const locked = state.locks.lessonLocked.get(lessonId);
    if (locked === undefined) throw AppException.notFound();
    if (locked) throw AppException.forbidden(ErrorCode.LESSON_LOCKED);
  }
}
