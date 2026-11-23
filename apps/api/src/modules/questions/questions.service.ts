import { Injectable } from '@nestjs/common';
import {
  type AdminQuestion,
  ErrorCode,
  type Paginated,
  type QuestionInput,
  questionInputSchema,
  QuestionType,
  type QuestionUpdateInput,
  QUESTIONS_PER_PRACTICE,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertSamePermutation,
  type ContentDeleteResult,
  listOf,
  nextPosition,
  unpublishLessonIfPublished,
  withContentErrors,
} from '../courses/content.utils';
import { questionInclude, type QuestionRow, toAdminQuestion } from './question.mapper';

/** Only MULTIPLE_CHOICE and IMAGE_BASED can have several correct options. */
function normaliseMultiple(q: Pick<QuestionInput, 'type' | 'isMultiple'>): boolean {
  return (
    (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.IMAGE_BASED) && q.isMultiple
  );
}

/** Option rows in the given order; fields that don't apply to the type are cleared. */
export function optionRows(q: QuestionInput) {
  return q.options.map((o, i) => ({
    text: o.text,
    imageUrl: o.imageUrl ?? null,
    isCorrect: o.isCorrect,
    matchText: q.type === QuestionType.MATCHING ? (o.matchText ?? null) : null,
    blankIndex: q.type === QuestionType.FILL_BLANK ? (o.blankIndex ?? null) : null,
    position: i + 1,
  }));
}

/** Rebuilds the full create-shape of a stored question (for PATCH merging). */
export function toQuestionInput(q: QuestionRow): QuestionInput {
  return {
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    explanation: q.explanation,
    isMultiple: q.isMultiple,
    points: q.points,
    options: [...q.options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        text: o.text,
        imageUrl: o.imageUrl,
        isCorrect: o.isCorrect,
        matchText: o.matchText,
        blankIndex: o.blankIndex,
      })),
  };
}

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPractice(practiceId: string): Promise<Paginated<AdminQuestion>> {
    await this.assertPractice(practiceId);
    const rows = await this.prisma.question.findMany({
      where: { practiceId },
      orderBy: { position: 'asc' },
      include: questionInclude,
    });
    return listOf(rows.map(toAdminQuestion));
  }

  /** At most 6 questions per practice (409 PRACTICE_QUESTION_LIMIT; DB trigger as backstop). */
  async create(practiceId: string, input: QuestionInput): Promise<AdminQuestion> {
    await this.assertPractice(practiceId);
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const agg = await tx.question.aggregate({
          where: { practiceId },
          _count: { _all: true },
          _max: { position: true },
        });
        if (agg._count._all >= QUESTIONS_PER_PRACTICE) {
          throw AppException.conflict(ErrorCode.PRACTICE_QUESTION_LIMIT);
        }
        const row = await tx.question.create({
          data: {
            practiceId,
            type: input.type,
            prompt: input.prompt,
            imageUrl: input.imageUrl ?? null,
            explanation: input.explanation ?? null,
            isMultiple: normaliseMultiple(input),
            points: input.points,
            position: nextPosition(agg._max.position),
            options: { create: optionRows(input) },
          },
          include: questionInclude,
        });
        return toAdminQuestion(row);
      }),
    );
  }

  async get(id: string): Promise<AdminQuestion> {
    const row = await this.prisma.question.findUnique({ where: { id }, include: questionInclude });
    if (!row) throw AppException.notFound();
    return toAdminQuestion(row);
  }

  /**
   * Partial update. `options`, when sent, replace all options. The merged question must still
   * satisfy the per-type rules (validateQuestionShape) — otherwise 400 VALIDATION_FAILED.
   */
  async update(id: string, input: QuestionUpdateInput): Promise<AdminQuestion> {
    const current = await this.prisma.question.findUnique({
      where: { id },
      include: questionInclude,
    });
    if (!current) throw AppException.notFound();
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const parsed = questionInputSchema.safeParse({ ...toQuestionInput(current), ...patch });
    if (!parsed.success) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'Invalid question',
        parsed.error.issues,
      );
    }
    const q = parsed.data;
    // Changing the type re-shapes the options, so they are rewritten in that case too.
    const rewriteOptions = input.options !== undefined || q.type !== current.type;
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        if (rewriteOptions) await tx.questionOption.deleteMany({ where: { questionId: id } });
        const row = await tx.question.update({
          where: { id },
          data: {
            type: q.type,
            prompt: q.prompt,
            imageUrl: q.imageUrl ?? null,
            explanation: q.explanation ?? null,
            isMultiple: normaliseMultiple(q),
            points: q.points,
            ...(rewriteOptions ? { options: { create: optionRows(q) } } : {}),
          },
          include: questionInclude,
        });
        return toAdminQuestion(row);
      }),
    );
  }

  /** Deleting a question of a published lesson unpublishes the lesson in the same transaction. */
  remove(id: string): Promise<ContentDeleteResult> {
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const q = await tx.question.findUnique({
          where: { id },
          select: { practice: { select: { lessonId: true } } },
        });
        if (!q) throw AppException.notFound();
        const lessonUnpublished = await unpublishLessonIfPublished(tx, q.practice.lessonId);
        await tx.question.delete({ where: { id } });
        return { deleted: true as const, lessonUnpublished };
      }),
    );
  }

  async reorder(practiceId: string, ids: string[]): Promise<Paginated<AdminQuestion>> {
    await this.assertPractice(practiceId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.question.findMany({ where: { practiceId }, select: { id: true } });
      assertSamePermutation(
        current.map((q) => q.id),
        ids,
      );
      for (const [i, id] of ids.entries()) {
        await tx.question.update({ where: { id }, data: { position: i + 1 } });
      }
    });
    return this.listForPractice(practiceId);
  }

  private async assertPractice(id: string): Promise<void> {
    const p = await this.prisma.practice.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw AppException.notFound();
  }
}
