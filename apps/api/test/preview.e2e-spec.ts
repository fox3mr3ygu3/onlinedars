/**
 * Course intro video + free preview lessons (docs/TASKS.md backlog): admins mark lessons as
 * preview and set an intro video; anyone can open a preview lesson's materials without signing
 * in; non-preview, unpublished or hidden-course lessons stay 404; no answers or practices leak.
 * Uses the seeded demo course and restores everything it changes.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CourseStatus, Role } from '@onlinedars/shared';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_COURSE } from '../prisma/seed-data';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `prv${Date.now()}`;
const PASSWORD = 'Parol12345!';
const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe.skipIf(!hasDb)('course preview e2e', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  let courseId = '';
  let lessonIds: string[] = [];
  let adminToken = '';
  let original: { introVideoUrl: string | null; previews: string[] } = {
    introVideoUrl: null,
    previews: [],
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    const course = await prisma.course.findUniqueOrThrow({
      where: { slug: DEMO_COURSE.slug },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: { lessons: { orderBy: { position: 'asc' } } },
        },
      },
    });
    courseId = course.id;
    lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    original = {
      introVideoUrl: course.introVideoUrl,
      previews: course.modules.flatMap((m) =>
        m.lessons.filter((l) => l.isPreview).map((l) => l.id),
      ),
    };

    const res = await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Preview Admin',
        email: `admin.${RUN}@test.onlinedars.uz`,
        password: PASSWORD,
      })
      .expect(201);
    await prisma.user.update({ where: { id: res.body.user.id }, data: { role: Role.ADMIN } });
    adminToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.course.update({
      where: { id: courseId },
      data: { introVideoUrl: original.introVideoUrl, status: CourseStatus.PUBLISHED },
    });
    await prisma.lesson.updateMany({
      where: { id: { in: lessonIds } },
      data: { isPreview: false },
    });
    if (original.previews.length) {
      await prisma.lesson.updateMany({
        where: { id: { in: original.previews } },
        data: { isPreview: true },
      });
    }
    await prisma.user.deleteMany({ where: { email: { endsWith: `${RUN}@test.onlinedars.uz` } } });
    await prisma.$disconnect();
    await app?.close();
  });

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  it('admin sets the intro video and marks the first lesson as a free preview', async () => {
    const course = await http
      .patch(`/api/v1/admin/courses/${courseId}`)
      .set(admin())
      .send({ introVideoUrl: VIDEO })
      .expect(200);
    expect(course.body.introVideoUrl).toBe(VIDEO);
    const lesson = await http
      .patch(`/api/v1/admin/lessons/${lessonIds[0]}`)
      .set(admin())
      .send({ isPreview: true })
      .expect(200);
    expect(lesson.body.isPreview).toBe(true);
    await http
      .patch(`/api/v1/admin/courses/${courseId}`)
      .set(admin())
      .send({ introVideoUrl: 'not a url' })
      .expect(400);
  });

  it('the public course page shows the intro video and which lessons are previews', async () => {
    const res = await http.get(`/api/v1/courses/${DEMO_COURSE.slug}`).expect(200);
    expect(res.body.introVideoUrl).toBe(VIDEO);
    const lessons = (
      res.body.modules as { lessons: { id: string; isPreview: boolean }[] }[]
    ).flatMap((m) => m.lessons);
    expect(lessons.find((l) => l.id === lessonIds[0])?.isPreview).toBe(true);
    expect(lessons.filter((l) => l.isPreview)).toHaveLength(1);
  });

  it('anyone opens a preview lesson (by slug or id): materials only, no answers', async () => {
    for (const key of [DEMO_COURSE.slug, courseId]) {
      const res = await http
        .get(`/api/v1/courses/${key}/lessons/${lessonIds[0]}/preview`)
        .expect(200);
      expect(res.body.course).toMatchObject({ id: courseId, slug: DEMO_COURSE.slug });
      expect(res.body.lesson.id).toBe(lessonIds[0]);
      expect(res.body.materials.length).toBeGreaterThan(0);
      const json = JSON.stringify(res.body);
      for (const leak of ['practices', 'questions', 'isCorrect', 'explanation', 'blankIndex']) {
        expect(json).not.toContain(leak);
      }
    }
  });

  it('a non-preview lesson, a lesson of another course and an unknown id are 404', async () => {
    await http
      .get(`/api/v1/courses/${DEMO_COURSE.slug}/lessons/${lessonIds[1]}/preview`)
      .expect(404);
    await http.get(`/api/v1/courses/some-other-course/lessons/${lessonIds[0]}/preview`).expect(404);
    await http.get(`/api/v1/courses/${DEMO_COURSE.slug}/lessons/nope/preview`).expect(404);
  });

  it('no preview while the lesson is unpublished or the course is hidden', async () => {
    const url = `/api/v1/courses/${courseId}/lessons/${lessonIds[0]}/preview`;
    await http.post(`/api/v1/admin/lessons/${lessonIds[0]}/unpublish`).set(admin()).expect(200);
    try {
      await http.get(url).expect(404);
    } finally {
      await http.post(`/api/v1/admin/lessons/${lessonIds[0]}/publish`).set(admin()).expect(200);
    }
    await prisma.course.update({ where: { id: courseId }, data: { status: CourseStatus.HIDDEN } });
    try {
      await http.get(url).expect(404);
    } finally {
      await prisma.course.update({
        where: { id: courseId },
        data: { status: CourseStatus.PUBLISHED },
      });
    }
    await http.get(url).expect(200);
  });
});
