import { Injectable } from '@nestjs/common';
import {
  type AdminLessonDetail,
  type AdminLessonMaterial,
  type AdminLessonSummary,
  ErrorCode,
  type LessonCompletenessResponse,
  type LessonInput,
  type LessonMaterialInput,
  lessonMaterialInputSchema,
  type LessonMaterialUpdateInput,
  LessonMaterialType,
  type LessonUpdateInput,
  type Paginated,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertSamePermutation,
  completenessSelect,
  computeCompleteness,
  listOf,
  nextPosition,
  withContentErrors,
} from '../courses/content.utils';
import { toAdminPractice } from '../practices/practice.mapper';
import { lessonSummarySelect, toAdminLessonSummary, toAdminMaterial } from './lesson.mapper';
import { sanitizeRichText } from './sanitize';

type Tx = Prisma.TransactionClient;

const detailSelect = {
  ...lessonSummarySelect,
  module: { select: { courseId: true } },
  materials: { orderBy: { position: 'asc' } },
  practices: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      lessonId: true,
      title: true,
      description: true,
      position: true,
      isRequired: true,
      passScore: true,
      _count: { select: { questions: true } },
    },
  },
} satisfies Prisma.LessonSelect;

/** Normalises a material before storage: only the fields of its type, sanitised HTML. */
export function materialData(m: LessonMaterialInput) {
  return {
    type: m.type,
    title: m.title ?? null,
    content: m.type === LessonMaterialType.TEXT && m.content ? sanitizeRichText(m.content) : null,
    fileKey:
      m.type === LessonMaterialType.IMAGE || m.type === LessonMaterialType.FILE
        ? (m.fileKey ?? null)
        : null,
    fileUrl:
      m.type === LessonMaterialType.IMAGE || m.type === LessonMaterialType.FILE
        ? (m.fileUrl ?? null)
        : null,
    mimeType: m.mimeType ?? null,
    sizeBytes: m.sizeBytes ?? null,
    videoUrl: m.type === LessonMaterialType.VIDEO ? (m.videoUrl ?? null) : null,
  };
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- lessons ----------

  async listForModule(moduleId: string): Promise<Paginated<AdminLessonSummary>> {
    await this.assertModule(moduleId);
    const rows = await this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
      select: lessonSummarySelect,
    });
    return listOf(rows.map(toAdminLessonSummary));
  }

  /** Lessons start unpublished and are appended at the end of the module. */
  async create(moduleId: string, input: LessonInput): Promise<AdminLessonSummary> {
    await this.assertModule(moduleId);
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const max = await tx.lesson.aggregate({ where: { moduleId }, _max: { position: true } });
        const row = await tx.lesson.create({
          data: {
            ...input,
            moduleId,
            position: nextPosition(max._max.position),
            isPublished: false,
          },
          select: lessonSummarySelect,
        });
        return toAdminLessonSummary(row);
      }),
    );
  }

  async get(id: string): Promise<AdminLessonDetail> {
    const row = await this.prisma.lesson.findUnique({ where: { id }, select: detailSelect });
    if (!row) throw AppException.notFound();
    const summary = toAdminLessonSummary(row);
    return {
      ...summary,
      courseId: row.module.courseId,
      materials: row.materials.map(toAdminMaterial),
      practices: row.practices.map(toAdminPractice),
      completeness: computeCompleteness({
        id: row.id,
        isPublished: row.isPublished,
        practices: row.practices,
      }),
    };
  }

  update(id: string, input: LessonUpdateInput): Promise<AdminLessonSummary> {
    return withContentErrors(async () =>
      toAdminLessonSummary(
        await this.prisma.lesson.update({
          where: { id },
          data: input,
          select: lessonSummarySelect,
        }),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    await withContentErrors(() => this.prisma.lesson.delete({ where: { id } }));
  }

  async reorder(moduleId: string, ids: string[]): Promise<Paginated<AdminLessonSummary>> {
    await this.assertModule(moduleId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findMany({ where: { moduleId }, select: { id: true } });
      assertSamePermutation(
        current.map((l) => l.id),
        ids,
      );
      for (const [i, id] of ids.entries()) {
        await tx.lesson.update({ where: { id }, data: { position: i + 1 } });
      }
    });
    return this.listForModule(moduleId);
  }

  // ---------- 4×6 completeness & publishing ----------

  async completeness(
    id: string,
    tx: Tx | PrismaService = this.prisma,
  ): Promise<LessonCompletenessResponse> {
    const row = await tx.lesson.findUnique({ where: { id }, select: completenessSelect });
    if (!row) throw AppException.notFound();
    return computeCompleteness(row);
  }

  /**
   * Publishes the lesson only if it has exactly 4 practices × 6 questions (409 LESSON_INCOMPLETE
   * with the counters in `details`). The DB trigger enforces the same rule as a backstop.
   */
  publish(id: string): Promise<LessonCompletenessResponse> {
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const c = await this.completeness(id, tx);
        if (!c.ready) {
          throw new AppException(
            ErrorCode.LESSON_INCOMPLETE,
            409,
            'Lesson needs 4 practices × 6 questions',
            c,
          );
        }
        if (!c.isPublished) {
          await tx.lesson.update({
            where: { id },
            data: { isPublished: true, publishedAt: new Date() },
          });
        }
        return { ...c, isPublished: true };
      }),
    );
  }

  async unpublish(id: string): Promise<LessonCompletenessResponse> {
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const c = await this.completeness(id, tx);
        if (c.isPublished) {
          await tx.lesson.update({
            where: { id },
            data: { isPublished: false, publishedAt: null },
          });
        }
        return { ...c, isPublished: false };
      }),
    );
  }

  // ---------- materials ----------

  async listMaterials(lessonId: string): Promise<Paginated<AdminLessonMaterial>> {
    await this.assertLesson(lessonId);
    const rows = await this.prisma.lessonMaterial.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
    });
    return listOf(rows.map(toAdminMaterial));
  }

  async createMaterial(lessonId: string, input: LessonMaterialInput): Promise<AdminLessonMaterial> {
    await this.assertLesson(lessonId);
    return withContentErrors(() =>
      this.prisma.$transaction(async (tx) => {
        const max = await tx.lessonMaterial.aggregate({
          where: { lessonId },
          _max: { position: true },
        });
        const row = await tx.lessonMaterial.create({
          data: { ...materialData(input), lessonId, position: nextPosition(max._max.position) },
        });
        return toAdminMaterial(row);
      }),
    );
  }

  /** The merged material is re-validated, so a type change must bring its required field. */
  async updateMaterial(id: string, input: LessonMaterialUpdateInput): Promise<AdminLessonMaterial> {
    const current = await this.prisma.lessonMaterial.findUnique({ where: { id } });
    if (!current) throw AppException.notFound();
    const merged = lessonMaterialInputSchema.safeParse({
      type: current.type,
      title: current.title,
      content: current.content,
      fileKey: current.fileKey,
      fileUrl: current.fileUrl,
      mimeType: current.mimeType,
      sizeBytes: current.sizeBytes,
      videoUrl: current.videoUrl,
      ...stripUndefined(input),
    });
    if (!merged.success) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_FAILED,
        'Invalid material',
        merged.error.issues,
      );
    }
    return withContentErrors(async () =>
      toAdminMaterial(
        await this.prisma.lessonMaterial.update({ where: { id }, data: materialData(merged.data) }),
      ),
    );
  }

  async removeMaterial(id: string): Promise<void> {
    await withContentErrors(() => this.prisma.lessonMaterial.delete({ where: { id } }));
  }

  async reorderMaterials(lessonId: string, ids: string[]): Promise<Paginated<AdminLessonMaterial>> {
    await this.assertLesson(lessonId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.lessonMaterial.findMany({
        where: { lessonId },
        select: { id: true },
      });
      assertSamePermutation(
        current.map((m) => m.id),
        ids,
      );
      for (const [i, id] of ids.entries()) {
        await tx.lessonMaterial.update({ where: { id }, data: { position: i + 1 } });
      }
    });
    return this.listMaterials(lessonId);
  }

  // ---------- helpers ----------

  private async assertModule(id: string): Promise<void> {
    const m = await this.prisma.module.findUnique({ where: { id }, select: { id: true } });
    if (!m) throw AppException.notFound();
  }

  private async assertLesson(id: string): Promise<void> {
    const l = await this.prisma.lesson.findUnique({ where: { id }, select: { id: true } });
    if (!l) throw AppException.notFound();
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
