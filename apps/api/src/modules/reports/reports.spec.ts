import { describe, expect, it } from 'vitest';
import { createMockPrisma } from '../progress/testing/mock-prisma';
import {
  dayKey,
  daysBetween,
  fillDays,
  rangeBounds,
  rate,
  resolveRange,
  toCourseReportRow,
} from './reports.logic';
import { withoutMoney } from './reports.controller';
import { ReportsService } from './reports.service';

describe('report ranges', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  it('defaults to the last 30 days (inclusive)', () => {
    const r = resolveRange(undefined, undefined, now);
    expect(r).toEqual({ from: '2026-10-25', to: '2026-11-23' });
    expect(daysBetween(r.from, r.to)).toBe(30);
  });
  it('swapped bounds collapse to one day; long ranges are clamped to 366 days', () => {
    expect(resolveRange('2026-12-01', '2026-11-01', now)).toEqual({
      from: '2026-11-01',
      to: '2026-11-01',
    });
    const r = resolveRange('2020-01-01', '2026-11-23', now);
    expect(daysBetween(r.from, r.to)).toBe(366);
  });
  it('day keys and bounds use Tashkent time (UTC+5)', () => {
    expect(dayKey(new Date('2026-11-22T19:30:00Z'))).toBe('2026-11-23');
    const b = rangeBounds({ from: '2026-11-23', to: '2026-11-23' });
    expect(b.start.toISOString()).toBe('2026-11-22T19:00:00.000Z');
    expect(b.end.toISOString()).toBe('2026-11-23T19:00:00.000Z');
  });
  it('fillDays zero-fills missing days', () => {
    const days = fillDays(
      { from: '2026-11-01', to: '2026-11-03' },
      { practiceAttempts: new Map([['2026-11-02', 4]]) },
    );
    expect(days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(days.map((d) => d.practiceAttempts)).toEqual([0, 4, 0]);
    expect(days[1]!.lessonsCompleted).toBe(0);
  });
});

describe('course report math', () => {
  it('avg progress and completion rate', () => {
    const row = toCourseReportRow({
      courseId: 'c',
      title: 't',
      status: 'PUBLISHED',
      enrollments: 5,
      activeEnrollments: 4,
      requiredLessons: 10,
      lessonCompletions: 20,
      examPassed: 1,
      certificates: 1,
    });
    expect(row.avgProgress).toBe(50);
    expect(row.completionRate).toBe(25);
  });
  it('no division by zero', () => {
    expect(rate(3, 0)).toBe(0);
  });
});

describe('ReportsService', () => {
  it('dashboard aggregates totals and revenue (tiyin)', async () => {
    const { mock, prisma } = createMockPrisma();
    mock.user.count.mockResolvedValue(7);
    mock.order.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { amount: 150_000_00 } });
    mock.examAttempt.findMany.mockResolvedValue([
      {
        id: 'a1',
        percent: 80,
        passed: true,
        submittedAt: new Date('2026-11-23T00:00:00Z'),
        user: { id: 'u1', fullName: 'Ali' },
        exam: { course: { title: 'Kurs' } },
      },
    ]);
    const d = await new ReportsService(prisma).dashboard();
    expect(d).toMatchObject({ students: 7, paidOrders: 2, revenue: 15_000_000 });
    expect(d.recentResults[0]).toMatchObject({
      studentName: 'Ali',
      courseTitle: 'Kurs',
      percent: 80,
    });
  });

  it('courses report joins aggregates per course', async () => {
    const { mock, prisma } = createMockPrisma();
    mock.course.findMany.mockResolvedValue([{ id: 'c1', title: 'Kurs', status: 'PUBLISHED' }]);
    mock.enrollment.groupBy.mockResolvedValue([{ courseId: 'c1', _count: { _all: 2 } }]);
    mock.lesson.findMany.mockResolvedValue([
      { module: { courseId: 'c1' } },
      { module: { courseId: 'c1' } },
    ]);
    mock.$queryRaw.mockResolvedValue([{ courseId: 'c1', n: 2 }]);
    mock.examAttempt.findMany.mockResolvedValue([{ userId: 'u1', exam: { courseId: 'c1' } }]);
    mock.certificate.groupBy.mockResolvedValue([{ courseId: 'c1', _count: { _all: 1 } }]);
    const [row] = await new ReportsService(prisma).courses({});
    expect(row).toMatchObject({
      enrollments: 2,
      activeEnrollments: 2,
      requiredLessons: 2,
      lessonCompletions: 2,
      avgProgress: 50,
      examPassed: 1,
      certificates: 1,
      completionRate: 50,
    });
  });

  it('exams report computes pass rate over finished attempts', async () => {
    const { mock, prisma } = createMockPrisma();
    mock.exam.findMany.mockResolvedValue([
      { id: 'e1', title: 'F', courseId: 'c1', course: { title: 'K' } },
    ]);
    mock.examAttempt.groupBy
      .mockResolvedValueOnce([
        { examId: 'e1', status: 'SUBMITTED', _count: { _all: 3 } },
        { examId: 'e1', status: 'EXPIRED', _count: { _all: 1 } },
        { examId: 'e1', status: 'IN_PROGRESS', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ examId: 'e1', _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ examId: 'e1', _avg: { percent: 61.6 } }]);
    const r = await new ReportsService(prisma).exams({ from: '2026-11-01', to: '2026-11-23' });
    expect(r.items[0]).toMatchObject({
      attempts: 5,
      finished: 4,
      passed: 2,
      passRate: 50,
      avgPercent: 62,
    });
  });

  it('activity report returns one row per day', async () => {
    const { prisma } = createMockPrisma();
    const r = await new ReportsService(prisma).activity({ from: '2026-11-01', to: '2026-11-07' });
    expect(r.days).toHaveLength(7);
  });
});

describe('withoutMoney (dashboard for CONTENT_MANAGER)', () => {
  it('zeroes revenue and paid orders and keeps everything else', () => {
    const stats = {
      students: 5,
      newStudents30d: 2,
      activeCourses: 1,
      enrollments: 4,
      completedLessons: 9,
      practiceAttempts: 30,
      examAttempts: 3,
      examsPassed: 2,
      certificates: 2,
      paidOrders: 3,
      revenue: 150_000_000,
      recentResults: [],
    };
    expect(withoutMoney(stats)).toEqual({ ...stats, revenue: 0, paidOrders: 0 });
  });
});
