import { ErrorCode } from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asPrisma,
  createPrismaMock,
  errorOf,
  type PrismaMock,
} from '../courses/testing/prisma-mock';
import { PracticesService } from './practices.service';

const practiceRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  lessonId: 'l1',
  title: 'Amaliyot',
  description: null,
  position: 1,
  isRequired: true,
  passScore: 0,
  _count: { questions: 0 },
  ...over,
});

describe('PracticesService', () => {
  let prisma: PrismaMock;
  let service: PracticesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PracticesService(asPrisma(prisma));
    prisma.lesson.findUnique.mockResolvedValue({ id: 'l1' });
  });

  describe('create (max 4 per lesson)', () => {
    it('appends the 4th practice at position max+1', async () => {
      prisma.practice.aggregate.mockResolvedValue({ _count: { _all: 3 }, _max: { position: 3 } });
      prisma.practice.create.mockResolvedValue(practiceRow({ id: 'p4', position: 4 }));
      const p = await service.create('l1', {
        title: 'P4',
        isRequired: true,
        passScore: 0,
      });
      expect(prisma.practice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lessonId: 'l1', position: 4 }) }),
      );
      expect(p).toMatchObject({ id: 'p4', questionCount: 0, questionsRequired: 6 });
    });

    it('rejects a 5th practice with 409 LESSON_PRACTICE_LIMIT and does not insert', async () => {
      prisma.practice.aggregate.mockResolvedValue({ _count: { _all: 4 }, _max: { position: 4 } });
      const e = await errorOf(() =>
        service.create('l1', { title: 'P5', isRequired: true, passScore: 0 }),
      );
      expect(e.code).toBe(ErrorCode.LESSON_PRACTICE_LIMIT);
      expect(e.getStatus?.()).toBe(409);
      expect(prisma.practice.create).not.toHaveBeenCalled();
    });

    it('maps the DB trigger error (race past the service check) to LESSON_PRACTICE_LIMIT', async () => {
      prisma.practice.aggregate.mockResolvedValue({ _count: { _all: 3 }, _max: { position: 3 } });
      prisma.practice.create.mockRejectedValue(
        new Prisma.PrismaClientUnknownRequestError(
          'ERROR: LESSON_PRACTICE_LIMIT: lesson l1 already has 4 practices',
          { clientVersion: '6.19.3' },
        ),
      );
      const e = await errorOf(() =>
        service.create('l1', { title: 'P', isRequired: true, passScore: 0 }),
      );
      expect(e.code).toBe(ErrorCode.LESSON_PRACTICE_LIMIT);
    });

    it('404 for an unknown lesson', async () => {
      prisma.lesson.findUnique.mockResolvedValue(null);
      const e = await errorOf(() =>
        service.create('nope', { title: 'P', isRequired: true, passScore: 0 }),
      );
      expect(e.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('remove', () => {
    it('unpublishes a published lesson in the same transaction', async () => {
      prisma.practice.findUnique.mockResolvedValue({ lessonId: 'l1' });
      const order: string[] = [];
      prisma.lesson.updateMany.mockImplementation(async () => {
        expect(prisma.inTransaction).toBe(true);
        order.push('unpublish');
        return { count: 1 };
      });
      prisma.practice.delete.mockImplementation(async () => {
        expect(prisma.inTransaction).toBe(true);
        order.push('delete');
        return {};
      });
      const res = await service.remove('p1');
      expect(res).toEqual({ deleted: true, lessonUnpublished: true });
      expect(order).toEqual(['unpublish', 'delete']);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('reports lessonUnpublished=false for a draft lesson', async () => {
      prisma.practice.findUnique.mockResolvedValue({ lessonId: 'l1' });
      prisma.lesson.updateMany.mockResolvedValue({ count: 0 });
      prisma.practice.delete.mockResolvedValue({});
      expect(await service.remove('p1')).toEqual({ deleted: true, lessonUnpublished: false });
    });

    it('404 for an unknown practice', async () => {
      prisma.practice.findUnique.mockResolvedValue(null);
      expect((await errorOf(() => service.remove('x'))).code).toBe(ErrorCode.NOT_FOUND);
      expect(prisma.practice.delete).not.toHaveBeenCalled();
    });
  });

  it('get returns questions with correct answers for staff', async () => {
    prisma.practice.findUnique.mockResolvedValue({
      ...practiceRow({ _count: { questions: 1 } }),
      questions: [
        {
          id: 'q1',
          practiceId: 'p1',
          type: 'TRUE_FALSE',
          prompt: 'Yer yumaloqmi?',
          imageUrl: null,
          explanation: 'Ha',
          isMultiple: false,
          points: 1,
          position: 1,
          options: [
            {
              id: 'o1',
              text: "To'g'ri",
              imageUrl: null,
              isCorrect: true,
              matchText: null,
              blankIndex: null,
              position: 1,
            },
            {
              id: 'o2',
              text: "Noto'g'ri",
              imageUrl: null,
              isCorrect: false,
              matchText: null,
              blankIndex: null,
              position: 2,
            },
          ],
        },
      ],
    });
    const p = await service.get('p1');
    expect(p.questions[0]!.options.map((o) => o.isCorrect)).toEqual([true, false]);
  });

  it('reorder rejects ids that are not exactly the lesson practices', async () => {
    prisma.practice.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const e = await errorOf(() => service.reorder('l1', ['p1']));
    expect(e.code).toBe(ErrorCode.REORDER_MISMATCH);
    expect(prisma.practice.update).not.toHaveBeenCalled();
  });

  it('reorder writes positions 1..n', async () => {
    prisma.practice.findMany
      .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }])
      .mockResolvedValueOnce([]);
    await service.reorder('l1', ['p2', 'p1']);
    expect(prisma.practice.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'p2' },
      data: { position: 1 },
    });
    expect(prisma.practice.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'p1' },
      data: { position: 2 },
    });
  });
});
