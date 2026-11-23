import { ErrorCode, type QuestionInput } from '@onlinedars/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asPrisma,
  createPrismaMock,
  errorOf,
  type PrismaMock,
} from '../courses/testing/prisma-mock';
import { optionRows, QuestionsService } from './questions.service';

const mc: QuestionInput = {
  type: 'MULTIPLE_CHOICE',
  prompt: '2 + 2 = ?',
  imageUrl: null,
  explanation: '2 + 2 = 4',
  isMultiple: false,
  points: 1,
  options: [
    { text: '3', isCorrect: false },
    { text: '4', isCorrect: true },
  ],
};

const storedRow = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  practiceId: 'p1',
  type: 'MULTIPLE_CHOICE',
  prompt: '2 + 2 = ?',
  imageUrl: null,
  explanation: null,
  isMultiple: false,
  points: 1,
  position: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  options: [
    {
      id: 'o1',
      questionId: 'q1',
      examQuestionId: null,
      text: '3',
      imageUrl: null,
      isCorrect: false,
      matchText: null,
      blankIndex: null,
      position: 1,
    },
    {
      id: 'o2',
      questionId: 'q1',
      examQuestionId: null,
      text: '4',
      imageUrl: null,
      isCorrect: true,
      matchText: null,
      blankIndex: null,
      position: 2,
    },
  ],
  ...over,
});

describe('QuestionsService', () => {
  let prisma: PrismaMock;
  let service: QuestionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new QuestionsService(asPrisma(prisma));
    prisma.practice.findUnique.mockResolvedValue({ id: 'p1' });
  });

  describe('create (max 6 per practice)', () => {
    it('creates the 6th question with ordered options', async () => {
      prisma.question.aggregate.mockResolvedValue({ _count: { _all: 5 }, _max: { position: 5 } });
      prisma.question.create.mockResolvedValue(storedRow({ position: 6 }));
      const q = await service.create('p1', mc);
      const data = prisma.question.create.mock.calls[0]![0].data;
      expect(data.position).toBe(6);
      expect(data.options.create.map((o: { position: number }) => o.position)).toEqual([1, 2]);
      expect(q.options[1]!.isCorrect).toBe(true);
    });

    it('rejects a 7th question with 409 PRACTICE_QUESTION_LIMIT', async () => {
      prisma.question.aggregate.mockResolvedValue({ _count: { _all: 6 }, _max: { position: 6 } });
      const e = await errorOf(() => service.create('p1', mc));
      expect(e.code).toBe(ErrorCode.PRACTICE_QUESTION_LIMIT);
      expect(e.getStatus?.()).toBe(409);
      expect(prisma.question.create).not.toHaveBeenCalled();
    });

    it('forces isMultiple=false for TRUE_FALSE', async () => {
      prisma.question.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _max: { position: null },
      });
      prisma.question.create.mockResolvedValue(storedRow());
      await service.create('p1', {
        ...mc,
        type: 'TRUE_FALSE',
        isMultiple: true,
        options: [
          { text: "To'g'ri", isCorrect: true },
          { text: "Noto'g'ri", isCorrect: false },
        ],
      });
      expect(prisma.question.create.mock.calls[0]![0].data.isMultiple).toBe(false);
    });
  });

  describe('update', () => {
    it('re-validates the merged question (making 2 options correct on a single-choice fails)', async () => {
      prisma.question.findUnique.mockResolvedValue(storedRow());
      const e = await errorOf(() =>
        service.update('q1', {
          options: [
            { text: '3', isCorrect: true },
            { text: '4', isCorrect: true },
          ],
        }),
      );
      expect(e.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(prisma.question.update).not.toHaveBeenCalled();
    });

    it('changing only the prompt keeps the options', async () => {
      prisma.question.findUnique.mockResolvedValue(storedRow());
      prisma.question.update.mockResolvedValue(storedRow({ prompt: '3 + 1 = ?' }));
      await service.update('q1', { prompt: '3 + 1 = ?' });
      expect(prisma.questionOption.deleteMany).not.toHaveBeenCalled();
      expect(prisma.question.update.mock.calls[0]![0].data.options).toBeUndefined();
    });

    it('sending options replaces all options inside one transaction', async () => {
      prisma.question.findUnique.mockResolvedValue(storedRow());
      prisma.questionOption.deleteMany.mockImplementation(async () => {
        expect(prisma.inTransaction).toBe(true);
        return { count: 2 };
      });
      prisma.question.update.mockResolvedValue(storedRow());
      await service.update('q1', {
        options: [
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false },
          { text: '6', isCorrect: false },
        ],
      });
      expect(prisma.questionOption.deleteMany).toHaveBeenCalledWith({
        where: { questionId: 'q1' },
      });
      expect(prisma.question.update.mock.calls[0]![0].data.options.create).toHaveLength(3);
    });
  });

  describe('remove', () => {
    it('unpublishes the published lesson in the same transaction', async () => {
      prisma.question.findUnique.mockResolvedValue({ practice: { lessonId: 'l1' } });
      prisma.lesson.updateMany.mockImplementation(async () => {
        expect(prisma.inTransaction).toBe(true);
        return { count: 1 };
      });
      prisma.question.delete.mockResolvedValue({});
      expect(await service.remove('q1')).toEqual({ deleted: true, lessonUnpublished: true });
      expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
        where: { id: 'l1', isPublished: true },
        data: { isPublished: false, publishedAt: null },
      });
    });
  });
});

describe('optionRows', () => {
  it('keeps matchText only for MATCHING and blankIndex only for FILL_BLANK', () => {
    const matching = optionRows({
      ...mc,
      type: 'MATCHING',
      options: [
        { text: 'A', matchText: '1', blankIndex: 0, isCorrect: false },
        { text: 'B', matchText: '2', isCorrect: false },
      ],
    });
    expect(matching.map((o) => [o.matchText, o.blankIndex])).toEqual([
      ['1', null],
      ['2', null],
    ]);
    const blanks = optionRows({
      ...mc,
      type: 'FILL_BLANK',
      prompt: 'Poytaxt {{0}}',
      options: [{ text: 'Toshkent', blankIndex: 0, matchText: 'x', isCorrect: true }],
    });
    expect(blanks[0]).toMatchObject({ blankIndex: 0, matchText: null, position: 1 });
  });
});
