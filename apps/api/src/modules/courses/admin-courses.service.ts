import { Injectable } from '@nestjs/common';
import {
  type AdminCourseDetail,
  type AdminCourseListItem,
  type AdminCourseListQuery,
  type AuthPrincipal,
  type CourseInput,
  CourseStatus,
  type CourseUpdateInput,
  ErrorCode,
  type Paginated,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { lessonSummarySelect, toAdminLessonSummary } from '../lessons/lesson.mapper';
import { iso, paged, withContentErrors } from './content.utils';

const listInclude = {
  direction: { select: { id: true, slug: true, name: true } },
  _count: { select: { modules: true, enrollments: true } },
  modules: { select: { lessons: { select: { isPublished: true } } } },
} satisfies Prisma.CourseInclude;

const detailInclude = {
  direction: listInclude.direction,
  _count: listInclude._count,
  teachers: { select: { id: true, slug: true, fullName: true }, orderBy: { position: 'asc' } },
  modules: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      position: true,
      lessons: { orderBy: { position: 'asc' }, select: lessonSummarySelect },
    },
  },
} satisfies Prisma.CourseInclude;

type ListRow = Prisma.CourseGetPayload<{ include: typeof listInclude }>;
type DetailRow = Prisma.CourseGetPayload<{ include: typeof detailInclude }>;

function baseItem(
  c: ListRow | DetailRow,
  lessons: { isPublished: boolean }[],
): AdminCourseListItem {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    status: c.status,
    level: c.level,
    isFree: c.isFree,
    price: c.price,
    currency: c.currency,
    sequentialUnlock: c.sequentialUnlock,
    coverImageUrl: c.coverImageUrl,
    direction: c.direction,
    moduleCount: c._count.modules,
    lessonCount: lessons.length,
    publishedLessonCount: lessons.filter((l) => l.isPublished).length,
    enrollmentCount: c._count.enrollments,
    publishedAt: iso(c.publishedAt),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toAdminCourseListItem(c: ListRow): AdminCourseListItem {
  return baseItem(
    c,
    c.modules.flatMap((m) => m.lessons),
  );
}

export function toAdminCourseDetail(c: DetailRow): AdminCourseDetail {
  return {
    ...baseItem(
      c,
      c.modules.flatMap((m) => m.lessons),
    ),
    introVideoUrl: c.introVideoUrl,
    shortDescription: c.shortDescription,
    description: c.description,
    goals: c.goals,
    directionId: c.directionId,
    certificateTemplateId: c.certificateTemplateId,
    teachers: c.teachers,
    modules: c.modules.map((m) => ({
      id: m.id,
      courseId: m.courseId,
      title: m.title,
      description: m.description,
      position: m.position,
      lessons: m.lessons.map(toAdminLessonSummary),
    })),
  };
}

/** Free courses cost 0; paid courses cost > 0 (also a DB CHECK). */
export function resolvePrice(
  current: { isFree: boolean; price: number },
  input: { isFree?: boolean; price?: number },
): { isFree: boolean; price: number } {
  const isFree = input.isFree ?? current.isFree;
  // Switching to free without a price resets the price to 0.
  const price = input.price ?? (input.isFree === true ? 0 : current.price);
  if (isFree && price !== 0) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Free course price must be 0', [
      { path: ['price'], message: 'validation.freeCoursePrice' },
    ]);
  }
  if (!isFree && price <= 0) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Paid course needs a price', [
      { path: ['price'], message: 'validation.paidCoursePrice' },
    ]);
  }
  return { isFree, price };
}

/**
 * A course may become PUBLISHED only when it has at least one lesson and every lesson is
 * published (and therefore 4×6 complete).
 */
export function assertCoursePublishable(lessons: { id: string; isPublished: boolean }[]): void {
  const unpublished = lessons.filter((l) => !l.isPublished).map((l) => l.id);
  if (lessons.length === 0 || unpublished.length > 0) {
    throw AppException.conflict(
      ErrorCode.COURSE_INCOMPLETE,
      lessons.length === 0 ? 'Course has no lessons' : 'Course has unpublished lessons',
    );
  }
}

@Injectable()
export class AdminCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AdminCourseListQuery): Promise<Paginated<AdminCourseListItem>> {
    const where: Prisma.CourseWhereInput = {
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { slug: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.directionId ? { directionId: q.directionId } : {}),
      ...(q.level ? { level: q.level } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: listInclude,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);
    return paged(rows.map(toAdminCourseListItem), total, q.page, q.pageSize);
  }

  async get(id: string): Promise<AdminCourseDetail> {
    const row = await this.prisma.course.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw AppException.notFound();
    return toAdminCourseDetail(row);
  }

  /** New courses always start as DRAFT. */
  async create(input: CourseInput, actor: AuthPrincipal): Promise<AdminCourseDetail> {
    const { teacherIds, directionId, certificateTemplateId, ...rest } = input;
    const { isFree, price } = resolvePrice({ isFree: false, price: 0 }, input);
    return withContentErrors(async () => {
      const row = await this.prisma.course.create({
        data: {
          ...rest,
          isFree,
          price,
          status: CourseStatus.DRAFT,
          ...(directionId ? { direction: { connect: { id: directionId } } } : {}),
          ...(certificateTemplateId
            ? { certificateTemplate: { connect: { id: certificateTemplateId } } }
            : {}),
          createdBy: { connect: { id: actor.id } },
          teachers: { connect: teacherIds.map((id) => ({ id })) },
        },
        include: detailInclude,
      });
      return toAdminCourseDetail(row);
    });
  }

  async update(id: string, input: CourseUpdateInput): Promise<AdminCourseDetail> {
    const current = await this.prisma.course.findUnique({
      where: { id },
      select: { isFree: true, price: true },
    });
    if (!current) throw AppException.notFound();
    const {
      teacherIds,
      directionId,
      certificateTemplateId,
      isFree: _f,
      price: _p,
      ...rest
    } = input;
    const pricing =
      input.isFree !== undefined || input.price !== undefined ? resolvePrice(current, input) : {};
    return withContentErrors(async () => {
      const row = await this.prisma.course.update({
        where: { id },
        data: {
          ...rest,
          ...pricing,
          ...(directionId !== undefined
            ? { direction: directionId ? { connect: { id: directionId } } : { disconnect: true } }
            : {}),
          ...(certificateTemplateId !== undefined
            ? {
                certificateTemplate: certificateTemplateId
                  ? { connect: { id: certificateTemplateId } }
                  : { disconnect: true },
              }
            : {}),
          ...(teacherIds !== undefined
            ? { teachers: { set: teacherIds.map((t) => ({ id: t })) } }
            : {}),
        },
        include: detailInclude,
      });
      return toAdminCourseDetail(row);
    });
  }

  /**
   * DRAFT / PUBLISHED / HIDDEN / ARCHIVED. Publishing requires every lesson to be published.
   * HIDDEN and ARCHIVED remove the course from the public catalog; enrolled students keep access
   * (enforced by backend-learning).
   */
  async setStatus(id: string, status: CourseStatus): Promise<AdminCourseDetail> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id },
        select: {
          status: true,
          publishedAt: true,
          modules: { select: { lessons: { select: { id: true, isPublished: true } } } },
        },
      });
      if (!course) throw AppException.notFound();
      if (status === CourseStatus.PUBLISHED) {
        assertCoursePublishable(course.modules.flatMap((m) => m.lessons));
      }
      const row = await tx.course.update({
        where: { id },
        data: {
          status,
          ...(status === CourseStatus.PUBLISHED && !course.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
        include: detailInclude,
      });
      return toAdminCourseDetail(row);
    });
  }

  /**
   * Only courses nobody has bought, enrolled in or been certified for can be deleted;
   * otherwise archive them (409 COURSE_NOT_DELETABLE).
   */
  async remove(id: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { _count: { select: { enrollments: true, orders: true, certificates: true } } },
    });
    if (!course) throw AppException.notFound();
    const { enrollments, orders, certificates } = course._count;
    if (enrollments + orders + certificates > 0) {
      throw AppException.conflict(ErrorCode.COURSE_NOT_DELETABLE);
    }
    await withContentErrors(async () => {
      try {
        await this.prisma.course.delete({ where: { id } });
      } catch (e) {
        // A concurrent order/certificate (FK Restrict) also means "not deletable".
        if ((e as { code?: string }).code === 'P2003') {
          throw AppException.conflict(ErrorCode.COURSE_NOT_DELETABLE);
        }
        throw e;
      }
    });
  }
}
