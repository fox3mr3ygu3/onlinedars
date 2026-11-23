import { CourseStatus, ErrorCode } from '@onlinedars/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AdminCoursesService,
  assertCoursePublishable,
  resolvePrice,
} from './admin-courses.service';
import { catalogOrder, catalogWhere, CoursesService } from './courses.service';
import {
  allKeys,
  asPrisma,
  createPrismaMock,
  errorOf,
  type PrismaMock,
} from './testing/prisma-mock';

const query = (over: Record<string, unknown> = {}) => ({
  page: 1,
  pageSize: 20,
  sort: 'newest' as const,
  ...over,
});

const courseRow = () => ({
  id: 'c1',
  slug: 'python',
  title: 'Python',
  shortDescription: 'Qisqa',
  description: 'Uzun',
  goals: ['Maqsad'],
  coverImageUrl: null,
  level: 'BEGINNER',
  status: 'PUBLISHED',
  isFree: false,
  price: 50_000_00,
  currency: 'UZS',
  sequentialUnlock: true,
  directionId: 'd1',
  certificateTemplateId: null,
  createdById: null,
  publishedAt: new Date('2026-11-01T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  direction: { id: 'd1', slug: 'it', name: 'IT' },
  teachers: [{ id: 't1', slug: 'ali', fullName: 'Ali', title: null, photoUrl: null }],
  exam: { isActive: true },
  modules: [
    {
      id: 'm1',
      title: 'Kirish',
      description: null,
      position: 1,
      lessons: [
        { id: 'l1', title: 'Dars 1', summary: null, durationMinutes: 10, position: 1 },
        { id: 'l2', title: 'Dars 2', summary: null, durationMinutes: null, position: 2 },
      ],
    },
    // Module with no published lessons is hidden from the program.
    { id: 'm2', title: 'Bo‘sh', description: null, position: 2, lessons: [] },
  ],
});

describe('public catalog', () => {
  let prisma: PrismaMock;
  let service: CoursesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CoursesService(asPrisma(prisma));
  });

  it('only ever queries PUBLISHED courses, whatever the filters', () => {
    for (const q of [query(), query({ search: 'py', isFree: true, directionId: 'd1' })]) {
      expect(catalogWhere(q).status).toBe(CourseStatus.PUBLISHED);
    }
  });

  it('builds search + filters (search or q alias, direction slug, teacher, level, isFree)', () => {
    const w = catalogWhere(
      query({ q: 'web', direction: 'it', teacherId: 't1', level: 'ADVANCED', isFree: false }),
    );
    expect(w).toMatchObject({
      OR: [
        { title: { contains: 'web', mode: 'insensitive' } },
        { shortDescription: { contains: 'web', mode: 'insensitive' } },
      ],
      direction: { slug: 'it' },
      teachers: { some: { id: 't1' } },
      level: 'ADVANCED',
      isFree: false,
    });
    expect(catalogWhere(query({ search: 'a', q: 'b' })).OR?.[0]).toEqual({
      title: { contains: 'a', mode: 'insensitive' },
    });
  });

  it('orders by the requested sort', () => {
    expect(catalogOrder('priceAsc')[0]).toEqual({ price: 'asc' });
    expect(catalogOrder('popular')[0]).toEqual({ enrollments: { _count: 'desc' } });
  });

  it('lists with pagination envelope and counters', async () => {
    prisma.course.findMany.mockResolvedValue([courseRow()]);
    prisma.course.count.mockResolvedValue(41);
    const res = await service.listPublic(query({ page: 3, pageSize: 20 }));
    expect(prisma.course.findMany.mock.calls[0]![0]).toMatchObject({ skip: 40, take: 20 });
    expect(res).toMatchObject({ total: 41, page: 3, pageSize: 20 });
    expect(res.items[0]).toMatchObject({
      lessonCount: 2,
      moduleCount: 1,
      durationMinutes: 10,
      price: 5_000_000,
      publishedAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('course detail: program of published lessons, never any practice/answer data', async () => {
    prisma.course.findFirst.mockResolvedValue(courseRow());
    const d = await service.getPublicBySlug('python');
    expect(prisma.course.findFirst.mock.calls[0]![0].where).toEqual({
      OR: [{ slug: 'python' }, { id: 'python' }],
      status: CourseStatus.PUBLISHED,
    });
    expect(d.modules.map((m) => m.id)).toEqual(['m1']);
    expect(d.hasExam).toBe(true);
    const keys = allKeys(d);
    for (const k of ['practices', 'questions', 'options', 'isCorrect', 'matchText', 'blankIndex']) {
      expect(keys.has(k)).toBe(false);
    }
    // The Prisma query itself must not load practices either.
    expect(JSON.stringify(prisma.course.findFirst.mock.calls[0]![0])).not.toContain('practices');
  });

  it('course detail also resolves by id (checkout passes the course id), still PUBLISHED only', async () => {
    prisma.course.findFirst.mockResolvedValue(courseRow());
    const d = await service.getPublicBySlug('c1');
    expect(d.id).toBe('c1');
    expect(prisma.course.findFirst.mock.calls[0]![0].where).toEqual({
      OR: [{ slug: 'c1' }, { id: 'c1' }],
      status: CourseStatus.PUBLISHED,
    });
  });

  it('404 for a course that is not published', async () => {
    prisma.course.findFirst.mockResolvedValue(null);
    expect((await errorOf(() => service.getPublicBySlug('draft'))).code).toBe(ErrorCode.NOT_FOUND);
  });
});

describe('admin course rules', () => {
  it('resolvePrice: free = 0, paid > 0, switching to free resets price', async () => {
    expect(resolvePrice({ isFree: false, price: 100 }, { isFree: true })).toEqual({
      isFree: true,
      price: 0,
    });
    expect(resolvePrice({ isFree: true, price: 0 }, { isFree: false, price: 500 })).toEqual({
      isFree: false,
      price: 500,
    });
    expect(
      (await errorOf(() => resolvePrice({ isFree: true, price: 0 }, { price: 10 }))).code,
    ).toBe(ErrorCode.VALIDATION_FAILED);
    expect(
      (await errorOf(() => resolvePrice({ isFree: true, price: 0 }, { isFree: false }))).code,
    ).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('assertCoursePublishable needs ≥1 lesson and all lessons published', async () => {
    expect(() =>
      assertCoursePublishable([
        { id: 'a', isPublished: true },
        { id: 'b', isPublished: true },
      ]),
    ).not.toThrow();
    for (const lessons of [
      [],
      [
        { id: 'a', isPublished: true },
        { id: 'b', isPublished: false },
      ],
    ]) {
      const e = await errorOf(() => assertCoursePublishable(lessons));
      expect(e.code).toBe(ErrorCode.COURSE_INCOMPLETE);
      expect(e.getStatus?.()).toBe(409);
    }
  });

  describe('AdminCoursesService', () => {
    let prisma: PrismaMock;
    let service: AdminCoursesService;

    beforeEach(() => {
      prisma = createPrismaMock();
      service = new AdminCoursesService(asPrisma(prisma));
    });

    it('setStatus(PUBLISHED) is refused while a lesson is unpublished', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'DRAFT',
        publishedAt: null,
        modules: [{ lessons: [{ id: 'l1', isPublished: false }] }],
      });
      const e = await errorOf(() => service.setStatus('c1', CourseStatus.PUBLISHED));
      expect(e.code).toBe(ErrorCode.COURSE_INCOMPLETE);
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('setStatus(PUBLISHED) stamps publishedAt the first time; HIDDEN needs no checks', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'DRAFT',
        publishedAt: null,
        modules: [{ lessons: [{ id: 'l1', isPublished: true }] }],
      });
      prisma.course.update.mockResolvedValue({
        ...courseRow(),
        _count: { modules: 1, enrollments: 0 },
        teachers: [],
        modules: [],
      });
      await service.setStatus('c1', CourseStatus.PUBLISHED);
      expect(prisma.course.update.mock.calls[0]![0].data).toEqual({
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      });

      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        modules: [],
      });
      await service.setStatus('c1', CourseStatus.HIDDEN);
      expect(prisma.course.update.mock.calls[1]![0].data).toEqual({ status: 'HIDDEN' });
    });

    it('create always starts as DRAFT and records the creator', async () => {
      prisma.course.create.mockResolvedValue({
        ...courseRow(),
        status: 'DRAFT',
        _count: { modules: 0, enrollments: 0 },
        teachers: [],
        modules: [],
      });
      await service.create(
        {
          slug: 'yangi',
          title: 'Yangi kurs',
          shortDescription: '',
          description: '',
          goals: [],
          level: 'BEGINNER',
          isFree: true,
          price: 0,
          sequentialUnlock: true,
          teacherIds: ['t1'],
        },
        { id: 'admin1', role: 'ADMIN', sessionId: 's' },
      );
      const data = prisma.course.create.mock.calls[0]![0].data;
      expect(data).toMatchObject({
        status: 'DRAFT',
        createdBy: { connect: { id: 'admin1' } },
        teachers: { connect: [{ id: 't1' }] },
      });
    });

    it('delete is refused for a course with enrollments or orders', async () => {
      prisma.course.findUnique.mockResolvedValue({
        _count: { enrollments: 1, orders: 0, certificates: 0 },
      });
      const e = await errorOf(() => service.remove('c1'));
      expect(e.code).toBe(ErrorCode.COURSE_NOT_DELETABLE);
      expect(prisma.course.delete).not.toHaveBeenCalled();
    });

    it('delete works for an untouched course', async () => {
      prisma.course.findUnique.mockResolvedValue({
        _count: { enrollments: 0, orders: 0, certificates: 0 },
      });
      prisma.course.delete.mockResolvedValue({});
      await service.remove('c1');
      expect(prisma.course.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });
});
