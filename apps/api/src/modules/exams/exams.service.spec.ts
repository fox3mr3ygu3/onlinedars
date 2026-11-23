import { ErrorCode, ExamAttemptStatus, QuestionType } from '@onlinedars/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import type { CertificatesService } from '../certificates/certificates.service';
import type { CourseStateService } from '../progress/course-state.service';
import { createMockPrisma, type MockPrisma } from '../progress/testing/mock-prisma';
import { AdminExamsService } from './admin-exams.service';
import { ExamsService } from './exams.service';

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
const NOW = new Date('2026-11-23T10:00:00Z');

const exam = {
  id: 'e1',
  courseId: 'c1',
  title: 'Final',
  questionCount: 2,
  timeLimitMinutes: 20,
  passScore: 50,
  maxAttempts: 3,
  shuffleQuestions: false,
  isActive: true,
};

const q = (id: string, correct: string) => ({
  id,
  type: QuestionType.MULTIPLE_CHOICE,
  prompt: id,
  imageUrl: null,
  explanation: 'secret',
  isMultiple: false,
  points: 1,
  position: 1,
  options: [
    {
      id: `${id}-ok`,
      text: correct,
      imageUrl: null,
      isCorrect: true,
      matchText: null,
      blankIndex: null,
      position: 1,
    },
    {
      id: `${id}-no`,
      text: 'x',
      imageUrl: null,
      isCorrect: false,
      matchText: null,
      blankIndex: null,
      position: 2,
    },
  ],
});
const pool = [q('q1', 'A'), q('q2', 'B')];

function attempt(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    examId: 'e1',
    userId: USER,
    status: ExamAttemptStatus.IN_PROGRESS,
    questionIds: ['q1', 'q2'],
    answers: null,
    startedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 20 * 60_000),
    submittedAt: null,
    score: null,
    maxScore: null,
    percent: null,
    passed: null,
    exam,
    ...over,
  };
}

let mock: MockPrisma;
let exams: ExamsService;
let examUnlocked: boolean;
let issueForPass: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const m = createMockPrisma();
  mock = m.mock;
  examUnlocked = true;
  const state = {
    assertEnrolled: vi.fn(async () => undefined),
    load: vi.fn(async () => ({
      examUnlocked,
      progress: {
        completedLessons: 0,
        totalLessons: 0,
        completedRequired: 0,
        totalRequired: 0,
        percent: 0,
      },
    })),
  } as unknown as CourseStateService;
  issueForPass = vi.fn(async () => ({ id: 'cert1', publicId: 'OD-AAAA-BBBB-CCCC', created: true }));
  exams = new ExamsService(m.prisma, state, { issueForPass } as unknown as CertificatesService);
  mock.exam.findUnique.mockResolvedValue(exam);
  mock.examQuestion.findMany.mockImplementation(async (args: { select?: { options?: unknown } }) =>
    args.select?.options ? pool : pool.map((p) => ({ id: p.id })),
  );
  mock.examAttempt.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    ...attempt(),
    ...args.data,
    id: 'new',
  }));
});

afterEach(() => vi.useRealTimers());

describe('start attempt', () => {
  it('403 EXAM_LOCKED until all required lessons are complete', async () => {
    examUnlocked = false;
    await expectCode(exams.startAttempt(USER, 'c1'), ErrorCode.EXAM_LOCKED, 403);
    expect(mock.examAttempt.create).not.toHaveBeenCalled();
  });

  it('404 EXAM_NOT_AVAILABLE without an active exam', async () => {
    mock.exam.findUnique.mockResolvedValue({ ...exam, isActive: false });
    await expectCode(exams.startAttempt(USER, 'c1'), ErrorCode.EXAM_NOT_AVAILABLE, 404);
  });

  it('creates a timed attempt; questions carry no answers', async () => {
    const view = await exams.startAttempt(USER, 'c1');
    const data = mock.examAttempt.create.mock.calls[0]![0].data;
    expect(data.questionIds).toEqual(['q1', 'q2']);
    expect(data.expiresAt.toISOString()).toBe('2026-11-23T10:20:00.000Z');
    expect(view.questions).toHaveLength(2);
    expect(JSON.stringify(view)).not.toContain('isCorrect');
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(mock.$executeRaw).toHaveBeenCalled(); // advisory lock against double start
  });

  it('resumes the running attempt instead of creating a second one', async () => {
    mock.examAttempt.findMany.mockResolvedValue([attempt()]);
    const view = await exams.startAttempt(USER, 'c1');
    expect(view.id).toBe('a1');
    expect(mock.examAttempt.create).not.toHaveBeenCalled();
  });

  it('403 EXAM_ATTEMPTS_EXHAUSTED after maxAttempts', async () => {
    const done = { status: ExamAttemptStatus.SUBMITTED, passed: false };
    mock.examAttempt.findMany.mockResolvedValue([attempt(done), attempt(done), attempt(done)]);
    await expectCode(exams.startAttempt(USER, 'c1'), ErrorCode.EXAM_ATTEMPTS_EXHAUSTED, 403);
  });

  it('409 EXAM_ALREADY_PASSED after a pass', async () => {
    mock.examAttempt.findMany.mockResolvedValue([
      attempt({ status: ExamAttemptStatus.SUBMITTED, passed: true }),
    ]);
    await expectCode(exams.startAttempt(USER, 'c1'), ErrorCode.EXAM_ALREADY_PASSED, 409);
  });
});

describe('submit', () => {
  it('grades on the server and issues the certificate on pass', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt());
    const res = await exams.submit(USER, 'a1', [
      { questionId: 'q1', selectedOptionIds: ['q1-ok'] },
      { questionId: 'q2', selectedOptionIds: ['q2-no'] },
    ]);
    expect(res).toMatchObject({
      score: 1,
      maxScore: 2,
      percent: 50,
      passed: true,
      status: 'SUBMITTED',
    });
    expect(issueForPass).toHaveBeenCalledWith({
      userId: USER,
      courseId: 'c1',
      examAttemptId: 'a1',
    });
    expect(res.certificate).toEqual({ id: 'cert1', publicId: 'OD-AAAA-BBBB-CCCC' });
    // compare-and-swap: only an IN_PROGRESS attempt is closed
    expect(mock.examAttempt.updateMany.mock.calls[0]![0].where).toEqual({
      id: 'a1',
      status: ExamAttemptStatus.IN_PROGRESS,
    });
    // no correct answers in the exam result
    expect(JSON.stringify(res)).not.toContain('q1-ok"]');
    expect(JSON.stringify(res)).not.toContain('explanation');
  });

  it('a failing score issues no certificate', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt());
    const res = await exams.submit(USER, 'a1', []);
    expect(res.passed).toBe(false);
    expect(issueForPass).not.toHaveBeenCalled();
  });

  it('accepts a submit inside the grace period', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt());
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60_000 + 10_000));
    await expect(exams.submit(USER, 'a1', [])).resolves.toMatchObject({ status: 'SUBMITTED' });
  });

  it('rejects a late submit (409 EXAM_TIME_OVER) and closes the attempt as EXPIRED with autosaved answers', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(
      attempt({ answers: [{ questionId: 'q1', selectedOptionIds: ['q1-ok'] }] }),
    );
    vi.setSystemTime(new Date(NOW.getTime() + 25 * 60_000));
    await expectCode(
      exams.submit(USER, 'a1', [
        { questionId: 'q1', selectedOptionIds: ['q1-ok'] },
        { questionId: 'q2', selectedOptionIds: ['q2-ok'] },
      ]),
      ErrorCode.EXAM_TIME_OVER,
      409,
    );
    const data = mock.examAttempt.updateMany.mock.calls[0]![0].data;
    expect(data.status).toBe(ExamAttemptStatus.EXPIRED);
    expect(data.score).toBe(1); // only the autosaved answer counted, not the late one
  });

  it('409 EXAM_ATTEMPT_CLOSED on a second submit', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt({ status: ExamAttemptStatus.SUBMITTED }));
    await expectCode(exams.submit(USER, 'a1', []), ErrorCode.EXAM_ATTEMPT_CLOSED, 409);
  });

  it('409 EXAM_ATTEMPT_CLOSED when a concurrent submit won the race', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt());
    mock.examAttempt.updateMany.mockResolvedValue({ count: 0 });
    await expectCode(exams.submit(USER, 'a1', []), ErrorCode.EXAM_ATTEMPT_CLOSED, 409);
    expect(issueForPass).not.toHaveBeenCalled();
  });

  it("another student's attempt is 404 (ownership)", async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt({ userId: 'someone-else' }));
    await expectCode(exams.submit(USER, 'a1', []), ErrorCode.NOT_FOUND, 404);
    await expectCode(exams.getAttempt(USER, 'a1'), ErrorCode.NOT_FOUND, 404);
    await expectCode(exams.autosave(USER, 'a1', []), ErrorCode.NOT_FOUND, 404);
  });
});

describe('autosave', () => {
  it('stores only answers of questions in the attempt', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt());
    await exams.autosave(USER, 'a1', [
      { questionId: 'q1', selectedOptionIds: ['q1-ok'] },
      { questionId: 'other', selectedOptionIds: ['x'] },
    ]);
    expect(mock.examAttempt.updateMany.mock.calls[0]![0].data.answers).toEqual([
      { questionId: 'q1', selectedOptionIds: ['q1-ok'] },
    ]);
  });

  it('rejected after the deadline', async () => {
    mock.examAttempt.findUnique.mockResolvedValue(attempt());
    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60_000));
    await expectCode(exams.autosave(USER, 'a1', []), ErrorCode.EXAM_TIME_OVER, 409);
  });
});

describe('status', () => {
  it('reports lock reason and attempts', async () => {
    examUnlocked = false;
    const s = await exams.getStatus(USER, 'c1');
    expect(s).toMatchObject({ isLocked: true, lockReason: 'LESSONS_INCOMPLETE', attemptsLeft: 3 });
  });
  it('NO_EXAM when the course has none', async () => {
    mock.exam.findUnique.mockResolvedValue(null);
    expect((await exams.getStatus(USER, 'c1')).lockReason).toBe('NO_EXAM');
  });
  it('lazily expires an overdue running attempt', async () => {
    mock.examAttempt.findMany
      .mockResolvedValueOnce([attempt({ expiresAt: new Date(NOW.getTime() - 60 * 60_000) })])
      .mockResolvedValue([]);
    await exams.getStatus(USER, 'c1');
    expect(mock.examAttempt.updateMany.mock.calls[0]![0].data.status).toBe(
      ExamAttemptStatus.EXPIRED,
    );
  });
});

describe('admin exam config', () => {
  it('upserts config and reports pool size', async () => {
    const admin = new AdminExamsService(mock as never);
    mock.course.findUnique.mockResolvedValue({ id: 'c1' });
    mock.exam.findUnique.mockResolvedValue({ ...exam, updatedAt: NOW });
    mock.examQuestion.count.mockResolvedValue(1);
    const cfg = await admin.upsertConfig('c1', {
      title: 'Final',
      questionCount: 2,
      timeLimitMinutes: 20,
      passScore: 50,
      maxAttempts: null,
      shuffleQuestions: true,
      isActive: true,
    });
    expect(mock.exam.upsert).toHaveBeenCalled();
    expect(cfg).toMatchObject({ poolSize: 1, poolTooSmall: true });
  });

  it('404 for an unknown course', async () => {
    const admin = new AdminExamsService(mock as never);
    await expectCode(admin.getConfig('nope'), ErrorCode.NOT_FOUND, 404);
  });

  it('refuses to edit a question of another exam', async () => {
    const admin = new AdminExamsService(mock as never);
    mock.exam.findUnique.mockResolvedValue({ id: 'e1' });
    mock.examQuestion.findUnique.mockResolvedValue({ examId: 'e-other' });
    await expectCode(admin.deleteQuestion('c1', 'q9'), ErrorCode.NOT_FOUND, 404);
    expect(mock.examQuestion.delete).not.toHaveBeenCalled();
  });
});
