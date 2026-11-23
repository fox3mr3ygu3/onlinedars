import { Injectable } from '@nestjs/common';
import type { AdminModule, ModuleInput, ModuleUpdateInput, Paginated } from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertSamePermutation,
  listOf,
  nextPosition,
  withContentErrors,
} from '../courses/content.utils';
import { lessonSummarySelect, toAdminLessonSummary } from '../lessons/lesson.mapper';

const moduleSelect = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  position: true,
  lessons: { orderBy: { position: 'asc' }, select: lessonSummarySelect },
} satisfies Prisma.ModuleSelect;

type ModuleRow = Prisma.ModuleGetPayload<{ select: typeof moduleSelect }>;

export function toAdminModule(m: ModuleRow): AdminModule {
  return {
    id: m.id,
    courseId: m.courseId,
    title: m.title,
    description: m.description,
    position: m.position,
    lessons: m.lessons.map(toAdminLessonSummary),
  };
}

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCourse(courseId: string): Promise<void> {
    const c = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!c) throw AppException.notFound();
  }

  async listForCourse(courseId: string): Promise<Paginated<AdminModule>> {
    await this.assertCourse(courseId);
    const rows = await this.prisma.module.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: moduleSelect,
    });
    return listOf(rows.map(toAdminModule));
  }

  /** Appends the module at the end of the course. */
  async create(courseId: string, input: ModuleInput): Promise<AdminModule> {
    await this.assertCourse(courseId);
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const max = await tx.module.aggregate({ where: { courseId }, _max: { position: true } });
        const row = await tx.module.create({
          data: { ...input, courseId, position: nextPosition(max._max.position) },
          select: moduleSelect,
        });
        return toAdminModule(row);
      }),
    );
  }

  update(id: string, input: ModuleUpdateInput): Promise<AdminModule> {
    return withContentErrors(async () =>
      toAdminModule(
        await this.prisma.module.update({ where: { id }, data: input, select: moduleSelect }),
      ),
    );
  }

  /** Deletes the module with its lessons (cascade). */
  async remove(id: string): Promise<void> {
    await withContentErrors(() => this.prisma.module.delete({ where: { id } }));
  }

  /** `ids` must be every module of the course, in the new order; positions become 1..n. */
  async reorder(courseId: string, ids: string[]): Promise<Paginated<AdminModule>> {
    await this.assertCourse(courseId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.module.findMany({ where: { courseId }, select: { id: true } });
      assertSamePermutation(
        current.map((m) => m.id),
        ids,
      );
      for (const [i, id] of ids.entries()) {
        await tx.module.update({ where: { id }, data: { position: i + 1 } });
      }
    });
    return this.listForCourse(courseId);
  }
}
