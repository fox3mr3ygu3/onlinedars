import { Injectable } from '@nestjs/common';
import {
  type AdminListQuery,
  type AdminTeacher,
  CourseStatus,
  type Paginated,
  type PublicListQuery,
  type PublicTeacher,
  type TeacherInput,
  type TeacherUpdateInput,
} from '@onlinedars/shared';
import type { Prisma, Teacher } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { paged, withContentErrors } from '../courses/content.utils';

type TeacherRow = Teacher & { _count: { courses: number } };

const publishedCourses = {
  _count: { select: { courses: { where: { status: CourseStatus.PUBLISHED } } } },
} satisfies Prisma.TeacherInclude;
const allCourses = { _count: { select: { courses: true } } } satisfies Prisma.TeacherInclude;

export function toPublicTeacher(t: TeacherRow): PublicTeacher {
  return {
    id: t.id,
    slug: t.slug,
    fullName: t.fullName,
    title: t.title,
    bio: t.bio,
    photoUrl: t.photoUrl,
    position: t.position,
    courseCount: t._count.courses,
  };
}

export function toAdminTeacher(t: TeacherRow): AdminTeacher {
  return {
    ...toPublicTeacher(t),
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic({ page, pageSize }: PublicListQuery): Promise<Paginated<PublicTeacher>> {
    const where = { isActive: true } satisfies Prisma.TeacherWhereInput;
    const [rows, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        include: publishedCourses,
        orderBy: [{ position: 'asc' }, { fullName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.teacher.count({ where }),
    ]);
    return paged(rows.map(toPublicTeacher), total, page, pageSize);
  }

  async listAdmin({ page, pageSize, search }: AdminListQuery): Promise<Paginated<AdminTeacher>> {
    const where: Prisma.TeacherWhereInput = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        include: allCourses,
        orderBy: [{ position: 'asc' }, { fullName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.teacher.count({ where }),
    ]);
    return paged(rows.map(toAdminTeacher), total, page, pageSize);
  }

  async get(id: string): Promise<AdminTeacher> {
    const row = await this.prisma.teacher.findUnique({ where: { id }, include: allCourses });
    if (!row) throw AppException.notFound();
    return toAdminTeacher(row);
  }

  create(input: TeacherInput): Promise<AdminTeacher> {
    return withContentErrors(async () =>
      toAdminTeacher(await this.prisma.teacher.create({ data: input, include: allCourses })),
    );
  }

  update(id: string, input: TeacherUpdateInput): Promise<AdminTeacher> {
    return withContentErrors(async () =>
      toAdminTeacher(
        await this.prisma.teacher.update({ where: { id }, data: input, include: allCourses }),
      ),
    );
  }

  /** Removes the teacher and their course links (implicit many-to-many rows). */
  async remove(id: string): Promise<void> {
    await withContentErrors(() => this.prisma.teacher.delete({ where: { id } }));
  }
}
