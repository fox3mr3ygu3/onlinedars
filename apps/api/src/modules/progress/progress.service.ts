import { Injectable } from '@nestjs/common';
import type {
  LessonProgressState,
  LessonViewedResult,
  PracticeAttemptSummary,
  PracticeResult,
  PracticeSubmitInput,
  QuestionType,
  StudentCourseTree,
  StudentLessonView,
  StudentPracticeView,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseStateService, type CourseState } from './course-state.service';
import { correctAnswerOf, gradeAll, indexAnswers, percentOf } from './grading/grading';
import {
  questionWithOptionsSelect,
  type StoredQuestion,
  toPublicQuestion,
} from './grading/public-question';
import { isLessonComplete, isPracticePassed, type PracticeOutcome } from './progress.logic';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CourseStateService,
  ) {}

  // ───────────── course tree ─────────────

  async getCourseTree(userId: string, courseId: string): Promise<StudentCourseTree> {
    await this.state.assertEnrolled(userId, courseId);
    const s = await this.state.load(userId, courseId);
    const [exam, certificate] = await Promise.all([
      this.prisma.exam.findUnique({
        where: { courseId },
        select: { id: true, isActive: true },
      }),
      this.prisma.certificate.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true, publicId: true, revokedAt: true },
      }),
    ]);
    const examPassed = exam
      ? (await this.prisma.examAttempt.count({
          where: { examId: exam.id, userId, passed: true },
        })) > 0
      : false;
    return {
      ...s.course,
      progress: s.progress,
      nextLessonId: s.nextLessonId,
      modules: s.modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        position: m.position,
        isLocked: s.locks.moduleLocked.get(m.id) ?? false,
        completedLessons: m.lessons.filter((l) => l.isCompleted).length,
        totalLessons: m.lessons.length,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          position: l.position,
          durationMinutes: l.durationMinutes,
          isRequired: l.isRequired,
          isLocked: s.locks.lessonLocked.get(l.id) ?? false,
          materialViewed: l.materialViewed,
          isCompleted: l.isCompleted,
          completedAt: iso(l.completedAt),
          practicesTotal: l.practicesTotal,
          practicesPassed: l.practicesPassed,
        })),
      })),
      exam: {
        exists: Boolean(exam?.isActive),
        isLocked: !s.examUnlocked,
        passed: examPassed,
      },
      certificate:
        certificate && !certificate.revokedAt
          ? { id: certificate.id, publicId: certificate.publicId }
          : null,
    };
  }

  // ───────────── lessons ─────────────

  /** Lesson + its course state; 404 for unknown/unpublished, 403 if not enrolled or locked. */
  private async openLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        summary: true,
        durationMinutes: true,
        isPublished: true,
        moduleId: true,
        module: { select: { courseId: true } },
      },
    });
    if (!lesson || !lesson.isPublished) throw AppException.notFound();
    const courseId = lesson.module.courseId;
    await this.state.assertEnrolled(userId, courseId);
    const s = await this.state.load(userId, courseId);
    this.state.assertLessonOpen(s, lessonId);
    return { lesson, courseId, state: s };
  }

  async getLesson(userId: string, lessonId: string): Promise<StudentLessonView> {
    const { lesson, courseId, state } = await this.openLesson(userId, lessonId);
    const [materials, practices, attempts, progress] = await Promise.all([
      this.prisma.lessonMaterial.findMany({
        where: { lessonId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          fileUrl: true,
          mimeType: true,
          sizeBytes: true,
          videoUrl: true,
          position: true,
        },
      }),
      this.prisma.practice.findMany({
        where: { lessonId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          isRequired: true,
          passScore: true,
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.practiceAttempt.findMany({
        where: { userId, practice: { lessonId } },
        select: { practiceId: true, score: true, maxScore: true, passed: true },
      }),
      this.lessonProgressState(userId, lessonId),
    ]);

    const ordered = state.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const idx = ordered.indexOf(lessonId);
    const neighbour = (i: number) => {
      const id = ordered[i];
      return id && !state.locks.lessonLocked.get(id) ? id : null;
    };

    return {
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      durationMinutes: lesson.durationMinutes,
      courseId,
      moduleId: lesson.moduleId,
      materials,
      practices: practices.map((p) => {
        const mine = attempts.filter((a) => a.practiceId === p.id);
        const best = mine.reduce<number | null>(
          (b, a) => Math.max(b ?? 0, percentOf(a.score, a.maxScore)),
          null,
        );
        return {
          id: p.id,
          title: p.title,
          description: p.description,
          position: p.position,
          isRequired: p.isRequired,
          passScore: p.passScore,
          questionCount: p._count.questions,
          attempts: mine.length,
          bestPercent: best,
          passed: mine.some((a) => a.passed),
        };
      }),
      progress,
      prevLessonId: idx > 0 ? neighbour(idx - 1) : null,
      nextLessonId: idx >= 0 ? neighbour(idx + 1) : null,
    };
  }

  async markViewed(userId: string, lessonId: string): Promise<LessonViewedResult> {
    const { courseId } = await this.openLesson(userId, lessonId);
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { id: true, materialViewedAt: true },
    });
    if (!existing) {
      await this.prisma.lessonProgress.create({
        data: { userId, lessonId, materialViewedAt: new Date() },
      });
    } else if (!existing.materialViewedAt) {
      await this.prisma.lessonProgress.update({
        where: { id: existing.id },
        data: { materialViewedAt: new Date() },
      });
    } else {
      // Touch updatedAt so "last activity" reflects the visit.
      await this.prisma.lessonProgress.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
    }
    const lesson = await this.recomputeLesson(userId, lessonId);
    const s = await this.state.load(userId, courseId);
    return { lesson, course: s.progress };
  }

  /** Current progress of one lesson (no writes). */
  async lessonProgressState(userId: string, lessonId: string): Promise<LessonProgressState> {
    return (await this.loadLessonOutcomes(userId, lessonId)).state;
  }

  private async loadLessonOutcomes(userId: string, lessonId: string) {
    const [progress, practices, passed] = await Promise.all([
      this.prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { materialViewedAt: true, completedAt: true },
      }),
      this.prisma.practice.findMany({
        where: { lessonId },
        select: { id: true, isRequired: true },
      }),
      this.prisma.practiceAttempt.findMany({
        where: { userId, passed: true, practice: { lessonId } },
        select: { practiceId: true },
        distinct: ['practiceId'],
      }),
    ]);
    const passedIds = new Set(passed.map((p) => p.practiceId));
    const outcomes: PracticeOutcome[] = practices.map((p) => ({
      isRequired: p.isRequired,
      passed: passedIds.has(p.id),
    }));
    const required = outcomes.filter((o) => o.isRequired);
    const state: LessonProgressState = {
      lessonId,
      materialViewed: Boolean(progress?.materialViewedAt),
      isCompleted: Boolean(progress?.completedAt),
      completedAt: iso(progress?.completedAt),
      requiredPractices: required.length,
      passedRequiredPractices: required.filter((o) => o.passed).length,
    };
    return { state, outcomes };
  }

  /**
   * Sets LessonProgress.completedAt the first time the lesson becomes complete. Completion is
   * sticky: later failed attempts never un-complete a lesson.
   */
  async recomputeLesson(userId: string, lessonId: string): Promise<LessonProgressState> {
    const { state, outcomes } = await this.loadLessonOutcomes(userId, lessonId);
    if (state.isCompleted || !isLessonComplete(state.materialViewed, outcomes)) return state;
    const completedAt = new Date();
    await this.prisma.lessonProgress.update({
      where: { userId_lessonId: { userId, lessonId } },
      data: { completedAt },
    });
    return { ...state, isCompleted: true, completedAt: completedAt.toISOString() };
  }

  // ───────────── practices ─────────────

  private async openPractice(userId: string, practiceId: string) {
    const practice = await this.prisma.practice.findUnique({
      where: { id: practiceId },
      select: {
        id: true,
        lessonId: true,
        title: true,
        description: true,
        passScore: true,
        isRequired: true,
        lesson: { select: { isPublished: true, module: { select: { courseId: true } } } },
        questions: { orderBy: { position: 'asc' }, select: questionWithOptionsSelect },
      },
    });
    if (!practice || !practice.lesson.isPublished) throw AppException.notFound();
    const courseId = practice.lesson.module.courseId;
    await this.state.assertEnrolled(userId, courseId);
    const s: CourseState = await this.state.load(userId, courseId);
    this.state.assertLessonOpen(s, practice.lessonId);
    const questions = practice.questions as unknown as StoredQuestion[];
    return { practice, questions, courseId };
  }

  async getPractice(userId: string, practiceId: string): Promise<StudentPracticeView> {
    const { practice, questions, courseId } = await this.openPractice(userId, practiceId);
    const attempts = await this.prisma.practiceAttempt.findMany({
      where: { userId, practiceId },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: attemptSummarySelect,
    });
    return {
      id: practice.id,
      lessonId: practice.lessonId,
      courseId,
      title: practice.title,
      description: practice.description,
      passScore: practice.passScore,
      isRequired: practice.isRequired,
      questions: questions.map(toPublicQuestion),
      attempts: attempts.map(toAttemptSummary),
    };
  }

  async submitPractice(
    userId: string,
    practiceId: string,
    input: PracticeSubmitInput,
  ): Promise<PracticeResult> {
    const { practice, questions, courseId } = await this.openPractice(userId, practiceId);
    const graded = gradeAll(questions, input.answers);
    const passed = isPracticePassed(graded.percent, practice.passScore);
    const byId = indexAnswers(questions, input.answers);
    const now = new Date();

    const attempt = await this.prisma.practiceAttempt.create({
      data: {
        userId,
        practiceId,
        score: graded.score,
        maxScore: graded.maxScore,
        correctCount: graded.correctCount,
        totalCount: graded.totalCount,
        passed,
        startedAt: now,
        submittedAt: now,
        answers: {
          create: graded.questions.map((g) => ({
            questionId: g.questionId,
            answer: (byId.get(g.questionId) ?? {
              questionId: g.questionId,
            }) as unknown as Prisma.InputJsonValue,
            isCorrect: g.isCorrect,
            pointsAwarded: g.pointsAwarded,
          })),
        },
      },
      select: attemptSummarySelect,
    });

    const lesson = await this.recomputeLesson(userId, practice.lessonId);
    const s = await this.state.load(userId, courseId);
    const qById = new Map(questions.map((q) => [q.id, q]));

    return {
      attempt: toAttemptSummary(attempt),
      questions: graded.questions.map((g) => {
        const q = qById.get(g.questionId) as StoredQuestion;
        return {
          ...g,
          type: q.type as QuestionType,
          answer: byId.get(g.questionId) ?? null,
          correctAnswer: correctAnswerOf(q),
          explanation: q.explanation,
        };
      }),
      lesson,
      course: s.progress,
    };
  }
}

const attemptSummarySelect = {
  id: true,
  score: true,
  maxScore: true,
  correctCount: true,
  totalCount: true,
  passed: true,
  submittedAt: true,
} as const;

function toAttemptSummary(a: {
  id: string;
  score: number;
  maxScore: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  submittedAt: Date | null;
}): PracticeAttemptSummary {
  return {
    id: a.id,
    score: a.score,
    maxScore: a.maxScore,
    percent: percentOf(a.score, a.maxScore),
    correctCount: a.correctCount,
    totalCount: a.totalCount,
    passed: a.passed,
    submittedAt: iso(a.submittedAt),
  };
}
