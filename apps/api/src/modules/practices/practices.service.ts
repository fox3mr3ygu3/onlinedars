import { Injectable } from '@nestjs/common';
import {
  type AdminPractice,
  type AdminPracticeDetail,
  ErrorCode,
  type Paginated,
  type PracticeInput,
  PRACTICES_PER_LESSON,
  type PracticeUpdateInput,
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
import { questionInclude, toAdminQuestion } from '../questions/question.mapper';
import { practiceSelect, toAdminPractice } from './practice.mapper';

@Injectable()
export class PracticesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForLesson(lessonId: string): Promise<Paginated<AdminPractice>> {
    await this.assertLesson(lessonId);
    const rows = await this.prisma.practice.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
      select: practiceSelect,
    });
    return listOf(rows.map(toAdminPractice));
  }

  /** At most 4 practices per lesson (409 LESSON_PRACTICE_LIMIT; DB trigger as backstop). */
  async create(lessonId: string, input: PracticeInput): Promise<AdminPractice> {
    await this.assertLesson(lessonId);
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const agg = await tx.practice.aggregate({
          where: { lessonId },
          _count: { _all: true },
          _max: { position: true },
        });
        if (agg._count._all >= PRACTICES_PER_LESSON) {
          throw AppException.conflict(ErrorCode.LESSON_PRACTICE_LIMIT);
        }
        const row = await tx.practice.create({
          data: { ...input, lessonId, position: nextPosition(agg._max.position) },
          select: practiceSelect,
        });
        return toAdminPractice(row);
      }),
    );
  }

  /** Admin view with all questions and correct answers. */
  async get(id: string): Promise<AdminPracticeDetail> {
    const row = await this.prisma.practice.findUnique({
      where: { id },
      select: {
        ...practiceSelect,
        questions: { orderBy: { position: 'asc' }, include: questionInclude },
      },
    });
    if (!row) throw AppException.notFound();
    return { ...toAdminPractice(row), questions: row.questions.map(toAdminQuestion) };
  }

  update(id: string, input: PracticeUpdateInput): Promise<AdminPractice> {
    return withContentErrors(async () =>
      toAdminPractice(
        await this.prisma.practice.update({ where: { id }, data: input, select: practiceSelect }),
      ),
    );
  }

  /** Deleting a practice of a published lesson unpublishes the lesson in the same transaction. */
  remove(id: string): Promise<ContentDeleteResult> {
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const practice = await tx.practice.findUnique({
          where: { id },
          select: { lessonId: true },
        });
        if (!practice) throw AppException.notFound();
        const lessonUnpublished = await unpublishLessonIfPublished(tx, practice.lessonId);
        await tx.practice.delete({ where: { id } });
        return { deleted: true as const, lessonUnpublished };
      }),
    );
  }

  async reorder(lessonId: string, ids: string[]): Promise<Paginated<AdminPractice>> {
    await this.assertLesson(lessonId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.practice.findMany({ where: { lessonId }, select: { id: true } });
      assertSamePermutation(
        current.map((p) => p.id),
        ids,
      );
      for (const [i, id] of ids.entries()) {
        await tx.practice.update({ where: { id }, data: { position: i + 1 } });
      }
    });
    return this.listForLesson(lessonId);
  }

  private async assertLesson(id: string): Promise<void> {
    const l = await this.prisma.lesson.findUnique({ where: { id }, select: { id: true } });
    if (!l) throw AppException.notFound();
  }
}
