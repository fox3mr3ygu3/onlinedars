import { ErrorCode, QuestionType } from '@onlinedars/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { OwnershipService } from '../../common/ownership/ownership.service';
import { CourseStateService } from './course-state.service';
import { DashboardService } from './dashboard.service';
import { ProgressService } from './progress.service';
import { createMockPrisma, type MockPrisma } from './testing/mock-prisma';

async function expectCode(p: Promise<unknown>, code: string, status?: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
  if (status) expect((err as AppException).getStatus()).toBe(status);
}

const USER = 'u1';

/** Course c1: module m1 → lessons L1, L2 (L2 locked until L1 done), each with practices. */
function courseRow(sequentialUnlock = true) {
  return {
    id: 'c1',
    slug: 'demo',
    title: 'Demo',
    coverImageUrl: null,
    sequentialUnlock,
    modules: [
      {
        id: 'm1',
        title: 'M1',
        description: null,
        position: 1,
        lessons: [
          {
            id: 'L1',
            title: 'L1',
            position: 1,
            durationMinutes: 10,
            isRequired: true,
            practices: [{ id: 'p1' }],
          },
          {
            id: 'L2',
            title: 'L2',
            position: 2,
            durationMinutes: 10,
            isRequired: true,
            practices: [{ id: 'p2' }],
          },
        ],
      },
    ],
  };
}

const question = {
  id: 'q1',
  type: QuestionType.MULTIPLE_CHOICE,
  prompt: '2+2?',
  imageUrl: null,
  explanation: 'Because math',
  isMultiple: false,
  points: 1,
  position: 1,
  options: [
    {
      id: 'o1',
      text: '4',
      imageUrl: null,
      isCorrect: true,
      matchText: null,
      blankIndex: null,
      position: 1,
    },
    {
      id: 'o2',
      text: '5',
      imageUrl: null,
      isCorrect: false,
      matchText: null,
      blankIndex: null,
      position: 2,
    },
  ],
};

function practiceRow(id = 'p1', lessonId = 'L1', passScore = 50) {
  return {
    id,
    lessonId,
    title: 'Practice',
    description: null,
    passScore,
    isRequired: true,
    lesson: { isPublished: true, module: { courseId: 'c1' } },
    questions: [question],
  };
}

let mock: MockPrisma;
let enrolled: boolean;
let progress: ProgressService;
let dashboard: DashboardService;

beforeEach(() => {
  const m = createMockPrisma();
  mock = m.mock;
  enrolled = true;
  const ownership = { isEnrolled: vi.fn(async () => enrolled) } as unknown as OwnershipService;
  const state = new CourseStateService(m.prisma, ownership);
  progress = new ProgressService(m.prisma, state);
  dashboard = new DashboardService(m.prisma, state);
  mock.course.findUnique.mockResolvedValue(courseRow());
});

describe('course tree', () => {
  it('denies a student who is not enrolled (403 NOT_ENROLLED)', async () => {
    enrolled = false;
    await expectCode(progress.getCourseTree(USER, 'c1'), ErrorCode.NOT_ENROLLED, 403);
  });

  it('returns lock state: L1 open, L2 locked; exam locked', async () => {
    const tree = await progress.getCourseTree(USER, 'c1');
    const [l1, l2] = tree.modules[0]!.lessons;
    expect(l1!.isLocked).toBe(false);
    expect(l2!.isLocked).toBe(true);
    expect(tree.exam.isLocked).toBe(true);
    expect(tree.progress.percent).toBe(0);
    expect(tree.nextLessonId).toBe('L1');
  });

  it('unlocks L2 once L1 is complete; 50% progress', async () => {
    mock.lessonProgress.findMany.mockResolvedValue([
      {
        lessonId: 'L1',
        materialViewedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const tree = await progress.getCourseTree(USER, 'c1');
    expect(tree.modules[0]!.lessons[1]!.isLocked).toBe(false);
    expect(tree.progress.percent).toBe(50);
  });

  it('with sequentialUnlock off every lesson is open', async () => {
    mock.course.findUnique.mockResolvedValue(courseRow(false));
    const tree = await progress.getCourseTree(USER, 'c1');
    expect(tree.modules[0]!.lessons.every((l) => !l.isLocked)).toBe(true);
  });

  it('only queries progress rows of the caller', async () => {
    await progress.getCourseTree(USER, 'c1');
    expect(mock.lessonProgress.findMany.mock.calls[0]![0].where.userId).toBe(USER);
    expect(mock.practiceAttempt.findMany.mock.calls[0]![0].where.userId).toBe(USER);
  });
});

describe('lessons', () => {
  const lessonRow = (id: string, isPublished = true) => ({
    id,
    title: id,
    summary: null,
    durationMinutes: 10,
    isPublished,
    moduleId: 'm1',
    module: { courseId: 'c1' },
  });

  it('404 for an unpublished lesson', async () => {
    mock.lesson.findUnique.mockResolvedValue(lessonRow('L1', false));
    await expectCode(progress.getLesson(USER, 'L1'), ErrorCode.NOT_FOUND, 404);
  });

  it('403 LESSON_LOCKED for a locked lesson', async () => {
    mock.lesson.findUnique.mockResolvedValue(lessonRow('L2'));
    await expectCode(progress.getLesson(USER, 'L2'), ErrorCode.LESSON_LOCKED, 403);
  });

  it('403 NOT_ENROLLED before checking locks', async () => {
    enrolled = false;
    mock.lesson.findUnique.mockResolvedValue(lessonRow('L1'));
    await expectCode(progress.getLesson(USER, 'L1'), ErrorCode.NOT_ENROLLED, 403);
  });

  it('markViewed creates progress and completes the lesson when practices are passed', async () => {
    mock.lesson.findUnique.mockResolvedValue(lessonRow('L1'));
    mock.lessonProgress.findUnique
      .mockResolvedValueOnce(null) // existing row check
      .mockResolvedValue({ materialViewedAt: new Date(), completedAt: null });
    mock.practice.findMany.mockResolvedValue([{ id: 'p1', isRequired: true }]);
    mock.practiceAttempt.findMany.mockImplementation(
      async (args: { where: { passed?: boolean } }) =>
        args.where.passed ? [{ practiceId: 'p1' }] : [],
    );
    const res = await progress.markViewed(USER, 'L1');
    expect(mock.lessonProgress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER, lessonId: 'L1' }),
    });
    expect(mock.lessonProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { completedAt: expect.any(Date) } }),
    );
    expect(res.lesson.isCompleted).toBe(true);
  });

  it('markViewed does not complete the lesson while a required practice is not passed', async () => {
    mock.lesson.findUnique.mockResolvedValue(lessonRow('L1'));
    mock.lessonProgress.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ materialViewedAt: new Date(), completedAt: null });
    mock.practice.findMany.mockResolvedValue([{ id: 'p1', isRequired: true }]);
    const res = await progress.markViewed(USER, 'L1');
    expect(res.lesson.isCompleted).toBe(false);
    expect(res.lesson.materialViewed).toBe(true);
    expect(mock.lessonProgress.update).not.toHaveBeenCalled();
  });

  it('markViewed keeps the first view time (idempotent)', async () => {
    mock.lesson.findUnique.mockResolvedValue(lessonRow('L1'));
    const first = new Date('2026-01-01');
    mock.lessonProgress.findUnique.mockResolvedValue({
      id: 'lp',
      materialViewedAt: first,
      completedAt: null,
    });
    await progress.markViewed(USER, 'L1');
    const data = mock.lessonProgress.update.mock.calls[0]![0].data;
    expect(data.materialViewedAt).toBeUndefined();
  });
});

describe('practices', () => {
  it('GET returns questions without correct answers or explanations', async () => {
    mock.practice.findUnique.mockResolvedValue(practiceRow());
    const view = await progress.getPractice(USER, 'p1');
    const json = JSON.stringify(view.questions);
    expect(json).not.toContain('isCorrect');
    expect(json).not.toContain('Because math');
  });

  it('403 LESSON_LOCKED for a practice of a locked lesson', async () => {
    mock.practice.findUnique.mockResolvedValue(practiceRow('p2', 'L2'));
    await expectCode(progress.getPractice(USER, 'p2'), ErrorCode.LESSON_LOCKED, 403);
    await expectCode(
      progress.submitPractice(USER, 'p2', { answers: [] }),
      ErrorCode.LESSON_LOCKED,
      403,
    );
    expect(mock.practiceAttempt.create).not.toHaveBeenCalled();
  });

  it('submit grades on the server, stores attempt + answers, reveals explanation', async () => {
    mock.practice.findUnique.mockResolvedValue(practiceRow());
    mock.practiceAttempt.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'att1',
        ...args.data,
      }),
    );
    const res = await progress.submitPractice(USER, 'p1', {
      answers: [{ questionId: 'q1', selectedOptionIds: ['o1'] }],
    });
    const data = mock.practiceAttempt.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      userId: USER,
      practiceId: 'p1',
      score: 1,
      maxScore: 1,
      passed: true,
    });
    expect(data.answers.create).toEqual([
      expect.objectContaining({ questionId: 'q1', isCorrect: true, pointsAwarded: 1 }),
    ]);
    expect(res.attempt.percent).toBe(100);
    expect(res.questions[0]).toMatchObject({
      isCorrect: true,
      explanation: 'Because math',
      correctAnswer: { selectedOptionIds: ['o1'] },
    });
  });

  it('a wrong answer below passScore is stored as not passed', async () => {
    mock.practice.findUnique.mockResolvedValue(practiceRow('p1', 'L1', 50));
    mock.practiceAttempt.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'att1',
        ...args.data,
      }),
    );
    const res = await progress.submitPractice(USER, 'p1', {
      answers: [{ questionId: 'q1', selectedOptionIds: ['o2'] }],
    });
    expect(res.attempt.passed).toBe(false);
    expect(res.attempt.score).toBe(0);
  });

  it('client-supplied correctness is ignored (only option ids count)', async () => {
    mock.practice.findUnique.mockResolvedValue(practiceRow());
    mock.practiceAttempt.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'att1',
        ...args.data,
      }),
    );
    const forged = { questionId: 'q1', selectedOptionIds: ['o2'], isCorrect: true } as never;
    const res = await progress.submitPractice(USER, 'p1', { answers: [forged] });
    expect(res.attempt.score).toBe(0);
  });
});

describe('dashboard', () => {
  it('aggregates enrolled courses and stats for the caller only', async () => {
    mock.enrollment.findMany.mockResolvedValue([{ courseId: 'c1', enrolledAt: new Date() }]);
    mock.practiceAttempt.count.mockResolvedValue(3);
    const d = await dashboard.getDashboard(USER);
    expect(d.stats.enrolledCourses).toBe(1);
    expect(d.stats.practiceAttempts).toBe(3);
    expect(d.courses[0]!.progress.totalLessons).toBe(2);
    expect(mock.enrollment.findMany.mock.calls[0]![0].where).toEqual({
      userId: USER,
      revokedAt: null,
    });
    expect(d.lastActivity).toBeNull();
  });

  it('paginates my courses', async () => {
    mock.enrollment.findMany.mockResolvedValue([
      { courseId: 'c1', enrolledAt: new Date() },
      { courseId: 'c1', enrolledAt: new Date() },
    ]);
    const page = await dashboard.listCourses(USER, { page: 2, pageSize: 1 });
    expect(page).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(page.items).toHaveLength(1);
  });
});
