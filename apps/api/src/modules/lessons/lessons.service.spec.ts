import { ErrorCode } from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asPrisma,
  createPrismaMock,
  errorOf,
  type PrismaMock,
} from '../courses/testing/prisma-mock';
import { LessonsService, materialData } from './lessons.service';
import { sanitizeRichText } from './sanitize';

const lessonWith = (counts: number[], isPublished = false) => ({
  id: 'l1',
  isPublished,
  practices: counts.map((n, i) => ({
    id: `p${i}`,
    title: `P${i}`,
    position: i + 1,
    _count: { questions: n },
  })),
});

describe('LessonsService publish rules', () => {
  let prisma: PrismaMock;
  let service: LessonsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new LessonsService(asPrisma(prisma));
  });

  it('completeness returns the counters', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonWith([6, 6, 5]));
    const c = await service.completeness('l1');
    expect(c).toMatchObject({ practices: 3, required: 4, totalQuestions: 17, ready: false });
    expect(c.questionsPerPractice.map((p) => p.questions)).toEqual([6, 6, 5]);
  });

  it.each([[[6, 6, 6]], [[6, 6, 6, 5]], [[]]])(
    'refuses to publish %j with 409 LESSON_INCOMPLETE and the counters in details',
    async (counts) => {
      prisma.lesson.findUnique.mockResolvedValue(lessonWith(counts));
      const e = await errorOf(() => service.publish('l1'));
      expect(e.code).toBe(ErrorCode.LESSON_INCOMPLETE);
      expect(e.getStatus?.()).toBe(409);
      expect(e.details).toMatchObject({ ready: false, practices: counts.length });
      expect(prisma.lesson.update).not.toHaveBeenCalled();
    },
  );

  it('publishes a complete 4×6 lesson', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonWith([6, 6, 6, 6]));
    prisma.lesson.update.mockResolvedValue({});
    const c = await service.publish('l1');
    expect(c).toMatchObject({ ready: true, isPublished: true, totalQuestions: 24 });
    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { isPublished: true, publishedAt: expect.any(Date) },
    });
  });

  it('maps the DB publish trigger (LESSON_INCOMPLETE) if a race slips past the check', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonWith([6, 6, 6, 6]));
    prisma.lesson.update.mockRejectedValue(
      new Prisma.PrismaClientUnknownRequestError(
        'ERROR: LESSON_INCOMPLETE: lesson l1 needs 4 practices x 6 questions to be published',
        { clientVersion: '6.19.3' },
      ),
    );
    expect((await errorOf(() => service.publish('l1'))).code).toBe(ErrorCode.LESSON_INCOMPLETE);
  });

  it('publishing an already published lesson is a no-op', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonWith([6, 6, 6, 6], true));
    await service.publish('l1');
    expect(prisma.lesson.update).not.toHaveBeenCalled();
  });

  it('unpublish clears isPublished/publishedAt', async () => {
    prisma.lesson.findUnique.mockResolvedValue(lessonWith([6, 6, 6, 6], true));
    const c = await service.unpublish('l1');
    expect(c.isPublished).toBe(false);
    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { isPublished: false, publishedAt: null },
    });
  });

  it('404 for an unknown lesson', async () => {
    prisma.lesson.findUnique.mockResolvedValue(null);
    expect((await errorOf(() => service.publish('x'))).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('create always starts unpublished at the end of the module', async () => {
    prisma.module.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.lesson.aggregate.mockResolvedValue({ _max: { position: 2 } });
    prisma.lesson.create.mockResolvedValue({
      id: 'l3',
      moduleId: 'm1',
      title: 'Dars',
      summary: null,
      durationMinutes: null,
      position: 3,
      isRequired: true,
      isPublished: false,
      publishedAt: null,
      practices: [],
    });
    const l = await service.create('m1', { title: 'Dars', isRequired: true });
    expect(prisma.lesson.create.mock.calls[0]![0].data).toMatchObject({
      position: 3,
      isPublished: false,
    });
    expect(l).toMatchObject({ practiceCount: 0, questionCount: 0, ready: false });
  });
});

describe('lesson materials', () => {
  let prisma: PrismaMock;
  let service: LessonsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new LessonsService(asPrisma(prisma));
  });

  it('materialData keeps only the fields of the type and sanitises TEXT', () => {
    expect(
      materialData({
        type: 'TEXT',
        content: '<p onclick="x()">Salom</p><script>alert(1)</script>',
        videoUrl: 'https://youtu.be/x',
      }),
    ).toMatchObject({ content: '<p>Salom</p>', videoUrl: null, fileUrl: null });
    expect(
      materialData({ type: 'VIDEO', videoUrl: 'https://youtu.be/x', content: 'ignored' }),
    ).toMatchObject({ content: null, videoUrl: 'https://youtu.be/x' });
  });

  it('updateMaterial re-validates the merged material (VIDEO without url fails)', async () => {
    prisma.lessonMaterial.findUnique.mockResolvedValue({
      id: 'm1',
      lessonId: 'l1',
      type: 'TEXT',
      title: null,
      content: '<p>x</p>',
      fileKey: null,
      fileUrl: null,
      mimeType: null,
      sizeBytes: null,
      videoUrl: null,
      position: 1,
    });
    const e = await errorOf(() => service.updateMaterial('m1', { type: 'VIDEO' }));
    expect(e.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(prisma.lessonMaterial.update).not.toHaveBeenCalled();
  });

  it('createMaterial appends at the end', async () => {
    prisma.lesson.findUnique.mockResolvedValue({ id: 'l1' });
    prisma.lessonMaterial.aggregate.mockResolvedValue({ _max: { position: 1 } });
    prisma.lessonMaterial.create.mockImplementation(async ({ data }) => ({ id: 'm2', ...data }));
    const m = await service.createMaterial('l1', {
      type: 'FILE',
      fileUrl: 'http://localhost:4000/api/v1/files/2026/11/abc.pdf',
      fileKey: 'uploads/2026/11/abc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
    expect(m).toMatchObject({ position: 2, type: 'FILE', content: null });
  });
});

describe('sanitizeRichText', () => {
  it.each([
    ['<p>ok</p><script>bad()</script>', '<p>ok</p>'],
    ['<img src="x.png" onerror="bad()">', '<img src="x.png">'],
    ['<a href="javascript:bad()">x</a>', '<a>x</a>'],
    ["<a href='JaVaScRiPt:bad()'>x</a>", '<a>x</a>'],
    ['<iframe src="https://evil"></iframe><b>b</b>', '<b>b</b>'],
    ['<style>body{}</style><i>i</i>', '<i>i</i>'],
    ['<img src="data:text/html;base64,xx">', '<img>'],
    ['<p>Oddiy <strong>matn</strong></p>', '<p>Oddiy <strong>matn</strong></p>'],
  ])('%s → %s', (input, out) => {
    expect(sanitizeRichText(input)).toBe(out);
  });
});
