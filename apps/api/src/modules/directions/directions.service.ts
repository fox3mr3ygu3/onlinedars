import { Injectable } from '@nestjs/common';
import {
  type AdminDirection,
  type AdminListQuery,
  CourseStatus,
  type DirectionInput,
  type DirectionUpdateInput,
  type Paginated,
  type PublicDirection,
  type PublicListQuery,
} from '@onlinedars/shared';
import type { Direction, Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { paged, withContentErrors } from '../courses/content.utils';

type DirectionRow = Direction & { _count: { courses: number } };

const publishedCourses = {
  _count: { select: { courses: { where: { status: CourseStatus.PUBLISHED } } } },
} satisfies Prisma.DirectionInclude;
const allCourses = { _count: { select: { courses: true } } } satisfies Prisma.DirectionInclude;

export function toPublicDirection(d: DirectionRow): PublicDirection {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    description: d.description,
    icon: d.icon,
    position: d.position,
    courseCount: d._count.courses,
  };
}

export function toAdminDirection(d: DirectionRow): AdminDirection {
  return {
    ...toPublicDirection(d),
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

@Injectable()
export class DirectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: active directions only, with the number of published courses. */
  async listPublic({ page, pageSize }: PublicListQuery): Promise<Paginated<PublicDirection>> {
    const where = { isActive: true } satisfies Prisma.DirectionWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.direction.findMany({
        where,
        include: publishedCourses,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.direction.count({ where }),
    ]);
    return paged(rows.map(toPublicDirection), total, page, pageSize);
  }

  async listAdmin({ page, pageSize, search }: AdminListQuery): Promise<Paginated<AdminDirection>> {
    const where: Prisma.DirectionWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.direction.findMany({
        where,
        include: allCourses,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.direction.count({ where }),
    ]);
    return paged(rows.map(toAdminDirection), total, page, pageSize);
  }

  async get(id: string): Promise<AdminDirection> {
    const row = await this.prisma.direction.findUnique({ where: { id }, include: allCourses });
    if (!row) throw AppException.notFound();
    return toAdminDirection(row);
  }

  create(input: DirectionInput): Promise<AdminDirection> {
    return withContentErrors(async () =>
      toAdminDirection(await this.prisma.direction.create({ data: input, include: allCourses })),
    );
  }

  update(id: string, input: DirectionUpdateInput): Promise<AdminDirection> {
    return withContentErrors(async () =>
      toAdminDirection(
        await this.prisma.direction.update({ where: { id }, data: input, include: allCourses }),
      ),
    );
  }

  /** Courses in the direction keep existing; their directionId becomes null (FK SetNull). */
  async remove(id: string): Promise<void> {
    await withContentErrors(() => this.prisma.direction.delete({ where: { id } }));
  }
}
