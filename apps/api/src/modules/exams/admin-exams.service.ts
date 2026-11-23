import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type ExamConfigInput,
  type Paginated,
  type PaginationQuery,
  type QuestionInput,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  questionWithOptionsSelect,
  type StoredQuestion,
} from '../progress/grading/public-question';

export interface AdminExamConfig {
  courseId: string;
  exam: {
    id: string;
    title: string;
    questionCount: number;
    timeLimitMinutes: number;
    passScore: number;
    maxAttempts: number | null;
    shuffleQuestions: boolean;
    isActive: boolean;
    updatedAt: string;
  } | null;
  /** Number of questions in the exam's pool. */
  poolSize: number;
  /** True when the pool has fewer questions than `questionCount` (attempts get the whole pool). */
  poolTooSmall: boolean;
  attempts: number;
}

/** Admin question view: includes correct answers (staff only). */
export type AdminExamQuestion = StoredQuestion;

const examSelect = {
  id: true,
  title: true,
  questionCount: true,
  timeLimitMinutes: true,
  passScore: true,
  maxAttempts: true,
  shuffleQuestions: true,
  isActive: true,
  updatedAt: true,
} as const;

function optionRows(input: QuestionInput) {
  return input.options.map((o, i) => ({
    text: o.text,
    imageUrl: o.imageUrl ?? null,
    isCorrect: o.isCorrect,
    matchText: o.matchText ?? null,
    blankIndex: o.blankIndex ?? null,
    position: i + 1,
  }));
}

/** Final-exam configuration and question pool (ADMIN + CONTENT_MANAGER). */
@Injectable()
export class AdminExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourse(courseId: string): Promise<void> {
    const c = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!c) throw AppException.notFound();
  }

  private async examIdOf(courseId: string): Promise<string> {
    const exam = await this.prisma.exam.findUnique({ where: { courseId }, select: { id: true } });
    if (!exam)
      throw AppException.notFound(ErrorCode.EXAM_NOT_AVAILABLE, 'Configure the exam first');
    return exam.id;
  }

  async getConfig(courseId: string): Promise<AdminExamConfig> {
    await this.assertCourse(courseId);
    const exam = await this.prisma.exam.findUnique({ where: { courseId }, select: examSelect });
    if (!exam) return { courseId, exam: null, poolSize: 0, poolTooSmall: false, attempts: 0 };
    const [poolSize, attempts] = await Promise.all([
      this.prisma.examQuestion.count({ where: { examId: exam.id } }),
      this.prisma.examAttempt.count({ where: { examId: exam.id } }),
    ]);
    return {
      courseId,
      exam: { ...exam, updatedAt: exam.updatedAt.toISOString() },
      poolSize,
      poolTooSmall: poolSize < exam.questionCount,
      attempts,
    };
  }

  /** Creates or updates the course's exam. Running attempts keep their own deadline. */
  async upsertConfig(courseId: string, input: ExamConfigInput): Promise<AdminExamConfig> {
    await this.assertCourse(courseId);
    const data = {
      title: input.title,
      questionCount: input.questionCount,
      timeLimitMinutes: input.timeLimitMinutes,
      passScore: input.passScore,
      maxAttempts: input.maxAttempts ?? null,
      shuffleQuestions: input.shuffleQuestions,
      isActive: input.isActive,
    };
    await this.prisma.exam.upsert({
      where: { courseId },
      create: { courseId, ...data },
      update: data,
    });
    return this.getConfig(courseId);
  }

  async listQuestions(courseId: string, q: PaginationQuery): Promise<Paginated<AdminExamQuestion>> {
    const examId = await this.examIdOf(courseId);
    const [items, total] = await Promise.all([
      this.prisma.examQuestion.findMany({
        where: { examId },
        orderBy: { position: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: questionWithOptionsSelect,
      }),
      this.prisma.examQuestion.count({ where: { examId } }),
    ]);
    return {
      items: items as unknown as AdminExamQuestion[],
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async createQuestion(courseId: string, input: QuestionInput): Promise<AdminExamQuestion> {
    const examId = await this.examIdOf(courseId);
    const last = await this.prisma.examQuestion.findFirst({
      where: { examId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const row = await this.prisma.examQuestion.create({
      data: {
        examId,
        type: input.type,
        prompt: input.prompt,
        imageUrl: input.imageUrl ?? null,
        explanation: input.explanation ?? null,
        isMultiple: input.isMultiple,
        points: input.points,
        position: (last?.position ?? 0) + 1,
        options: { create: optionRows(input) },
      },
      select: questionWithOptionsSelect,
    });
    return row as unknown as AdminExamQuestion;
  }

  private async assertQuestion(courseId: string, questionId: string): Promise<void> {
    const examId = await this.examIdOf(courseId);
    const q = await this.prisma.examQuestion.findUnique({
      where: { id: questionId },
      select: { examId: true },
    });
    if (!q || q.examId !== examId) throw AppException.notFound();
  }

  /**
   * Replaces the question and its options. Option ids change, so answers autosaved by a
   * running attempt for this question will no longer match (edit pools between sittings).
   */
  async updateQuestion(
    courseId: string,
    questionId: string,
    input: QuestionInput,
  ): Promise<AdminExamQuestion> {
    await this.assertQuestion(courseId, questionId);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.questionOption.deleteMany({ where: { examQuestionId: questionId } });
      return tx.examQuestion.update({
        where: { id: questionId },
        data: {
          type: input.type,
          prompt: input.prompt,
          imageUrl: input.imageUrl ?? null,
          explanation: input.explanation ?? null,
          isMultiple: input.isMultiple,
          points: input.points,
          options: { create: optionRows(input) },
        },
        select: questionWithOptionsSelect,
      });
    });
    return row as unknown as AdminExamQuestion;
  }

  async deleteQuestion(courseId: string, questionId: string): Promise<void> {
    await this.assertQuestion(courseId, questionId);
    await this.prisma.examQuestion.delete({ where: { id: questionId } });
  }
}
