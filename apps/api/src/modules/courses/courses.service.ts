import { Injectable } from '@nestjs/common';
import {
  CourseStatus,
  type Paginated,
  type PublicCourseCard,
  type PublicCourseDetail,
  type PublicCourseListQuery,
  type PublicLessonPreview,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { iso, paged } from './content.utils';

/**
 * Public catalog. Only PUBLISHED courses are visible; inside a course only published lessons
 * (and modules that contain at least one) are listed. Practices/questions are never loaded here,
 * so no answer data can leak through these responses.
 */
const cardInclude = {
  direction: { select: { id: true, slug: true, name: true } },
  teachers: {
    where: { isActive: true },
    select: { id: true, slug: true, fullName: true, title: true, photoUrl: true },
    orderBy: { position: 'asc' },
  },
  modules: {
    select: { lessons: { where: { isPublished: true }, select: { durationMinutes: true } } },
  },
} satisfies Prisma.CourseInclude;

const detailInclude = {
  direction: cardInclude.direction,
  teachers: cardInclude.teachers,
  exam: { select: { isActive: true } },
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
          summary: true,
          durationMinutes: true,
          position: true,
          isPreview: true,
        },
      },
    },
  },
} satisfies Prisma.CourseInclude;

type CardRow = Prisma.CourseGetPayload<{ include: typeof cardInclude }>;
type DetailRow = Prisma.CourseGetPayload<{ include: typeof detailInclude }>;

function card(
  c: CardRow | DetailRow,
  lessons: { durationMinutes: number | null }[][],
): PublicCourseCard {
  const nonEmpty = lessons.filter((l) => l.length > 0);
  const flat = nonEmpty.flat();
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    shortDescription: c.shortDescription,
    coverImageUrl: c.coverImageUrl,
    level: c.level,
    direction: c.direction,
    teachers: c.teachers,
    moduleCount: nonEmpty.length,
    lessonCount: flat.length,
    durationMinutes: flat.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    publishedAt: iso(c.publishedAt),
  };
}

export function toPublicCourseCard(c: CardRow): PublicCourseCard {
  return card(
    c,
    c.modules.map((m) => m.lessons),
  );
}

export function toPublicCourseDetail(c: DetailRow): PublicCourseDetail {
  const modules = c.modules.filter((m) => m.lessons.length > 0);
  return {
    ...card(
      c,
      modules.map((m) => m.lessons),
    ),
    description: c.description,
    goals: c.goals,
    sequentialUnlock: c.sequentialUnlock,
    hasExam: Boolean(c.exam?.isActive),
    introVideoUrl: c.introVideoUrl,
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      position: m.position,
      lessons: m.lessons,
    })),
  };
}

export function catalogWhere(q: PublicCourseListQuery): Prisma.CourseWhereInput {
  const search = q.search || q.q;
  return {
    status: CourseStatus.PUBLISHED,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { shortDescription: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(q.directionId ? { directionId: q.directionId } : {}),
    ...(q.direction ? { direction: { slug: q.direction } } : {}),
    ...(q.teacherId ? { teachers: { some: { id: q.teacherId } } } : {}),
    ...(q.level ? { level: q.level } : {}),
  };
}

export function catalogOrder(
  sort: PublicCourseListQuery['sort'],
): Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case 'popular':
      return [{ enrollments: { _count: 'desc' } }, { publishedAt: 'desc' }];
    case 'title':
      return [{ title: 'asc' }];
    case 'newest':
    default:
      return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
  }
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(q: PublicCourseListQuery): Promise<Paginated<PublicCourseCard>> {
    const where = catalogWhere(q);
    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: cardInclude,
        orderBy: catalogOrder(q.sort),
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);
    return paged(rows.map(toPublicCourseCard), total, q.page, q.pageSize);
  }

  /**
   * Course page by slug; also resolves by id (links may carry the course id, see
   * docs/api/ROUTES.md `GET /courses/:slugOrId`). Only PUBLISHED courses are visible.
   */
  async getPublicBySlug(slugOrId: string): Promise<PublicCourseDetail> {
    const row = await this.prisma.course.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }], status: CourseStatus.PUBLISHED },
      include: detailInclude,
    });
    if (!row) throw AppException.notFound();
    return toPublicCourseDetail(row);
  }

  /**
   * Free preview: the materials of one lesson, for anyone (no sign-in). Only a published lesson
   * marked `isPreview` in a PUBLISHED course; anything else is 404 (no hint that it exists).
   * Never returns practices, questions or answers, and records no progress.
   */
  async getLessonPreview(slugOrId: string, lessonId: string): Promise<PublicLessonPreview> {
    const row = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        isPreview: true,
        isPublished: true,
        module: {
          course: {
            OR: [{ slug: slugOrId }, { id: slugOrId }],
            status: CourseStatus.PUBLISHED,
          },
        },
      },
      select: {
        id: true,
        title: true,
        summary: true,
        durationMinutes: true,
        module: {
          select: {
            course: { select: { id: true, slug: true, title: true } },
          },
        },
        materials: {
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
        },
      },
    });
    if (!row) throw AppException.notFound();
    const { module, materials, ...lesson } = row;
    return { course: module.course, lesson, materials };
  }
}
