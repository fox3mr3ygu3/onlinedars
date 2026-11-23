import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type ExamAttemptView,
  type ExamResultSummary,
  type ExamSubmitResult,
  ExamAttemptStatus,
  type Paginated,
  type PaginationQuery,
  type QuestionAnswer,
  type StudentExamStatus,
  type StudentResultItem,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import { CourseStateService } from '../progress/course-state.service';
import { gradeAll } from '../progress/grading/grading';
import {
  questionWithOptionsSelect,
  type StoredQuestion,
  toPublicQuestion,
} from '../progress/grading/public-question';
import {
  attemptsLeft,
  computeExpiresAt,
  drawQuestionIds,
  isExamPassed,
  isWithinDeadline,
  parseQuestionIds,
} from './exam.logic';

const examSelect = {
  id: true,
  courseId: true,
  title: true,
  questionCount: true,
  timeLimitMinutes: true,
  passScore: true,
  maxAttempts: true,
  shuffleQuestions: true,
  isActive: true,
} as const;

type ExamRow = {
  id: string;
  courseId: string;
  title: string;
  questionCount: number;
  timeLimitMinutes: number;
  passScore: number;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  isActive: boolean;
};

type AttemptRow = {
  id: string;
  examId: string;
  userId: string;
  status: ExamAttemptStatus;
  questionIds: unknown;
  answers: unknown;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
};

const attemptSelect = {
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
} as const;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toResultSummary(a: AttemptRow): ExamResultSummary {
  return {
    attemptId: a.id,
    status: a.status,
    startedAt: a.startedAt.toISOString(),
    submittedAt: iso(a.submittedAt),
    score: a.score,
    maxScore: a.maxScore,
    percent: a.percent,
    passed: a.passed,
  };
}

function parseAnswers(value: unknown): QuestionAnswer[] {
  return Array.isArray(value) ? (value as QuestionAnswer[]) : [];
}

/**
 * Student side of the final exam. All timing and grading happens here, on the server:
 * the client's timer is cosmetic. Submissions later than `expiresAt + grace` are rejected and
 * the attempt is closed as EXPIRED using its last autosaved answers.
 */
@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CourseStateService,
    private readonly certificates: CertificatesService,
  ) {}

  private now(): Date {
    return new Date();
  }

  private async findExam(courseId: string): Promise<ExamRow | null> {
    return this.prisma.exam.findUnique({ where: { courseId }, select: examSelect });
  }

  async getStatus(userId: string, courseId: string): Promise<StudentExamStatus> {
    await this.state.assertEnrolled(userId, courseId);
    const s = await this.state.load(userId, courseId);
    const exam = await this.findExam(courseId);
    const certificate = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true, publicId: true, revokedAt: true },
    });
    const cert =
      certificate && !certificate.revokedAt
        ? { id: certificate.id, publicId: certificate.publicId }
        : null;

    if (!exam || !exam.isActive) {
      return {
        courseId,
        exam: null,
        isLocked: true,
        lockReason: 'NO_EXAM',
        progress: s.progress,
        attemptsUsed: 0,
        attemptsLeft: null,
        activeAttempt: null,
        lastResult: null,
        passed: false,
        certificate: cert,
      };
    }

    await this.expireOverdue(userId, exam);
    const attempts = (await this.prisma.examAttempt.findMany({
      where: { userId, examId: exam.id },
      orderBy: { startedAt: 'desc' },
      select: attemptSelect,
    })) as AttemptRow[];
    const active = attempts.find((a) => a.status === ExamAttemptStatus.IN_PROGRESS) ?? null;
    const finished = attempts.filter((a) => a.status !== ExamAttemptStatus.IN_PROGRESS);
    const passed = attempts.some((a) => a.passed === true);
    const left = attemptsLeft(exam.maxAttempts, attempts.length);

    let lockReason: StudentExamStatus['lockReason'] = null;
    if (passed) lockReason = 'PASSED';
    else if (!s.examUnlocked) lockReason = 'LESSONS_INCOMPLETE';
    else if (left === 0 && !active) lockReason = 'ATTEMPTS_EXHAUSTED';

    return {
      courseId,
      exam: {
        id: exam.id,
        title: exam.title,
        questionCount: exam.questionCount,
        timeLimitMinutes: exam.timeLimitMinutes,
        passScore: exam.passScore,
        maxAttempts: exam.maxAttempts,
      },
      isLocked: lockReason !== null,
      lockReason,
      progress: s.progress,
      attemptsUsed: attempts.length,
      attemptsLeft: left,
      activeAttempt: active ? { id: active.id, expiresAt: active.expiresAt.toISOString() } : null,
      lastResult: finished[0] ? toResultSummary(finished[0]) : null,
      passed,
      certificate: cert,
    };
  }

  /** Starts a timed attempt, or resumes the one already running. */
  async startAttempt(userId: string, courseId: string): Promise<ExamAttemptView> {
    await this.state.assertEnrolled(userId, courseId);
    const exam = await this.findExam(courseId);
    if (!exam || !exam.isActive) throw AppException.notFound(ErrorCode.EXAM_NOT_AVAILABLE);
    await this.expireOverdue(userId, exam);

    const s = await this.state.load(userId, courseId);
    if (!s.examUnlocked) throw AppException.forbidden(ErrorCode.EXAM_LOCKED);

    const attempt = await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent starts of the same student/exam (double click, two tabs).
      await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`exam:${exam.id}:${userId}`}))`;
      const existing = (await tx.examAttempt.findMany({
        where: { userId, examId: exam.id },
        select: attemptSelect,
      })) as AttemptRow[];
      const running = existing.find((a) => a.status === ExamAttemptStatus.IN_PROGRESS);
      if (running) return running;
      if (existing.some((a) => a.passed === true)) {
        throw AppException.conflict(ErrorCode.EXAM_ALREADY_PASSED);
      }
      if (attemptsLeft(exam.maxAttempts, existing.length) === 0) {
        throw AppException.forbidden(ErrorCode.EXAM_ATTEMPTS_EXHAUSTED);
      }
      const pool = await tx.examQuestion.findMany({
        where: { examId: exam.id },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      const questionIds = drawQuestionIds(
        pool.map((q) => q.id),
        exam.questionCount,
        exam.shuffleQuestions,
      );
      if (questionIds.length === 0) throw AppException.notFound(ErrorCode.EXAM_NOT_AVAILABLE);
      const startedAt = this.now();
      return (await tx.examAttempt.create({
        data: {
          examId: exam.id,
          userId,
          status: ExamAttemptStatus.IN_PROGRESS,
          questionIds,
          startedAt,
          expiresAt: computeExpiresAt(startedAt, exam.timeLimitMinutes),
        },
        select: attemptSelect,
      })) as AttemptRow;
    });
    return this.buildAttemptView(attempt, exam);
  }

  /** The caller's own attempt; another user's attempt is 404 (no existence leak). */
  private async ownAttempt(userId: string, attemptId: string) {
    const attempt = (await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { ...attemptSelect, exam: { select: examSelect } },
    })) as (AttemptRow & { exam: ExamRow }) | null;
    if (!attempt || attempt.userId !== userId) throw AppException.notFound();
    return attempt;
  }

  async getAttempt(userId: string, attemptId: string): Promise<ExamAttemptView | ExamSubmitResult> {
    let attempt = await this.ownAttempt(userId, attemptId);
    if (attempt.status === ExamAttemptStatus.IN_PROGRESS) {
      if (isWithinDeadline(this.now(), attempt.expiresAt)) {
        return this.buildAttemptView(attempt, attempt.exam);
      }
      await this.finalize(
        attempt,
        attempt.exam,
        parseAnswers(attempt.answers),
        ExamAttemptStatus.EXPIRED,
      );
      attempt = await this.ownAttempt(userId, attemptId);
    }
    return this.buildResult(attempt, attempt.exam);
  }

  /** Autosave (replaces saved answers). Rejected once the deadline + grace has passed. */
  async autosave(
    userId: string,
    attemptId: string,
    answers: QuestionAnswer[],
  ): Promise<{ savedAt: string }> {
    const attempt = await this.ownAttempt(userId, attemptId);
    if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
      throw AppException.conflict(ErrorCode.EXAM_ATTEMPT_CLOSED);
    }
    const now = this.now();
    if (!isWithinDeadline(now, attempt.expiresAt)) {
      await this.finalize(
        attempt,
        attempt.exam,
        parseAnswers(attempt.answers),
        ExamAttemptStatus.EXPIRED,
      );
      throw new AppException(ErrorCode.EXAM_TIME_OVER, HttpStatus.CONFLICT);
    }
    const ids = new Set(parseQuestionIds(attempt.questionIds));
    const kept = answers.filter((a) => ids.has(a.questionId));
    const res = await this.prisma.examAttempt.updateMany({
      where: { id: attempt.id, status: ExamAttemptStatus.IN_PROGRESS },
      data: { answers: kept as unknown as Prisma.InputJsonValue },
    });
    if (res.count === 0) throw AppException.conflict(ErrorCode.EXAM_ATTEMPT_CLOSED);
    return { savedAt: now.toISOString() };
  }

  async submit(
    userId: string,
    attemptId: string,
    answers: QuestionAnswer[],
  ): Promise<ExamSubmitResult> {
    const attempt = await this.ownAttempt(userId, attemptId);
    if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
      throw AppException.conflict(ErrorCode.EXAM_ATTEMPT_CLOSED);
    }
    if (!isWithinDeadline(this.now(), attempt.expiresAt)) {
      // Too late: close with what was autosaved before the deadline, then refuse.
      await this.finalize(
        attempt,
        attempt.exam,
        parseAnswers(attempt.answers),
        ExamAttemptStatus.EXPIRED,
      );
      throw new AppException(ErrorCode.EXAM_TIME_OVER, HttpStatus.CONFLICT, undefined, {
        attemptId: attempt.id,
      });
    }
    const result = await this.finalize(attempt, attempt.exam, answers, ExamAttemptStatus.SUBMITTED);
    if (!result) throw AppException.conflict(ErrorCode.EXAM_ATTEMPT_CLOSED);
    return result;
  }

  /**
   * Grades and closes an attempt exactly once (compare-and-swap on status). Issues the
   * certificate when passed. Returns null if another request closed it first.
   */
  private async finalize(
    attempt: AttemptRow,
    exam: ExamRow,
    answers: QuestionAnswer[],
    status: typeof ExamAttemptStatus.SUBMITTED | typeof ExamAttemptStatus.EXPIRED,
  ): Promise<ExamSubmitResult | null> {
    const questions = await this.loadQuestions(parseQuestionIds(attempt.questionIds));
    const graded = gradeAll(questions, answers);
    const passed = isExamPassed(graded.percent, exam.passScore);
    const submittedAt = this.now();
    const ids = new Set(questions.map((q) => q.id));
    const res = await this.prisma.examAttempt.updateMany({
      where: { id: attempt.id, status: ExamAttemptStatus.IN_PROGRESS },
      data: {
        status,
        answers: answers.filter((a) => ids.has(a.questionId)) as unknown as Prisma.InputJsonValue,
        submittedAt,
        score: graded.score,
        maxScore: graded.maxScore,
        percent: graded.percent,
        passed,
      },
    });
    if (res.count === 0) return null;

    const certificate = passed
      ? await this.certificates.issueForPass({
          userId: attempt.userId,
          courseId: exam.courseId,
          examAttemptId: attempt.id,
        })
      : null;

    return {
      attemptId: attempt.id,
      status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: submittedAt.toISOString(),
      score: graded.score,
      maxScore: graded.maxScore,
      percent: graded.percent,
      passed,
      passScore: exam.passScore,
      correctCount: graded.correctCount,
      totalCount: graded.totalCount,
      questions: graded.questions,
      certificate: certificate ? { id: certificate.id, publicId: certificate.publicId } : null,
    };
  }

  /** Closes this student's overdue IN_PROGRESS attempts (lazy expiry, no cron needed). */
  private async expireOverdue(userId: string, exam: ExamRow): Promise<void> {
    const overdue = (await this.prisma.examAttempt.findMany({
      where: { userId, examId: exam.id, status: ExamAttemptStatus.IN_PROGRESS },
      select: attemptSelect,
    })) as AttemptRow[];
    const now = this.now();
    for (const a of overdue) {
      if (!isWithinDeadline(now, a.expiresAt)) {
        await this.finalize(a, exam, parseAnswers(a.answers), ExamAttemptStatus.EXPIRED);
      }
    }
  }

  /** Questions in the attempt's order; deleted pool questions are skipped. */
  private async loadQuestions(ids: string[]): Promise<StoredQuestion[]> {
    if (ids.length === 0) return [];
    const rows = (await this.prisma.examQuestion.findMany({
      where: { id: { in: ids } },
      select: questionWithOptionsSelect,
    })) as unknown as StoredQuestion[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((q): q is StoredQuestion => Boolean(q));
  }

  private async buildAttemptView(attempt: AttemptRow, exam: ExamRow): Promise<ExamAttemptView> {
    const questions = await this.loadQuestions(parseQuestionIds(attempt.questionIds));
    return {
      id: attempt.id,
      examId: exam.id,
      courseId: exam.courseId,
      title: exam.title,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      serverTime: this.now().toISOString(),
      timeLimitMinutes: exam.timeLimitMinutes,
      questions: questions.map(toPublicQuestion),
      savedAnswers: parseAnswers(attempt.answers),
    };
  }

  /** Result of a closed attempt, re-graded from stored answers (no correct answers revealed). */
  private async buildResult(attempt: AttemptRow, exam: ExamRow): Promise<ExamSubmitResult> {
    const questions = await this.loadQuestions(parseQuestionIds(attempt.questionIds));
    const graded = gradeAll(questions, parseAnswers(attempt.answers));
    const cert = await this.prisma.certificate.findUnique({
      where: { examAttemptId: attempt.id },
      select: { id: true, publicId: true },
    });
    return {
      ...toResultSummary(attempt),
      passScore: exam.passScore,
      correctCount: graded.correctCount,
      totalCount: graded.totalCount,
      questions: graded.questions,
      certificate: cert,
    };
  }

  async listResults(userId: string, q: PaginationQuery): Promise<Paginated<StudentResultItem>> {
    const where = { userId, status: { not: ExamAttemptStatus.IN_PROGRESS } };
    const [rows, total] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          ...attemptSelect,
          exam: {
            select: { title: true, passScore: true, course: { select: { id: true, title: true } } },
          },
        },
      }),
      this.prisma.examAttempt.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        ...toResultSummary(r as AttemptRow),
        courseId: r.exam.course.id,
        courseTitle: r.exam.course.title,
        examTitle: r.exam.title,
        passScore: r.exam.passScore,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
}
