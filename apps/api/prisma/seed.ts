/**
 * Idempotent dev/CI seed: safe to run repeatedly (`pnpm db:seed`).
 * Creates an admin, a content manager, a student and one complete, published demo course
 * (every lesson has 4 practices × 6 questions across all 5 question types) with a final exam.
 */
import { EnrollmentSource, Role } from '@onlinedars/shared';
import { CourseStatus, type Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  buildDemoModules,
  buildExamQuestions,
  DEFAULT_CERTIFICATE_HTML,
  DEMO_COURSE,
  type SeedQuestion,
} from './seed-data';

const prisma = new PrismaClient();

function seedPassword(): string {
  const fromEnv = process.env.SEED_PASSWORD;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed production without SEED_PASSWORD');
  }
  return 'Parol12345!';
}

function questionCreate(q: SeedQuestion, position: number) {
  return {
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl ?? null,
    explanation: q.explanation ?? null,
    isMultiple: q.isMultiple ?? false,
    position,
    options: {
      create: q.options.map((o, i) => ({
        text: o.text,
        isCorrect: o.isCorrect ?? false,
        matchText: o.matchText ?? null,
        blankIndex: o.blankIndex ?? null,
        imageUrl: o.imageUrl ?? null,
        position: i + 1,
      })),
    },
  };
}

async function upsertUser(
  email: string,
  fullName: string,
  role: Role,
  passwordHash: string,
  phone?: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { role, fullName, isActive: true },
    create: {
      email,
      phone: phone ?? null,
      fullName,
      role,
      passwordHash,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: phone ? new Date() : null,
    },
  });
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(seedPassword(), { type: argon2.argon2id });

  const admin = await upsertUser('admin@onlinedars.uz', 'Administrator', Role.ADMIN, passwordHash);
  await upsertUser('content@onlinedars.uz', 'Kontent Menejer', Role.CONTENT_MANAGER, passwordHash);
  const student = await upsertUser(
    'student@onlinedars.uz',
    'Talaba Demo',
    Role.STUDENT,
    passwordHash,
    '+998901234567',
  );

  const direction = await prisma.direction.upsert({
    where: { slug: 'dasturlash' },
    update: {},
    create: {
      slug: 'dasturlash',
      name: 'Dasturlash',
      description: "Veb, mobil va backend dasturlash bo'yicha kurslar.",
      icon: 'code',
      position: 1,
    },
  });
  await prisma.direction.upsert({
    where: { slug: 'dizayn' },
    update: {},
    create: {
      slug: 'dizayn',
      name: 'Dizayn',
      description: 'UI/UX va grafik dizayn.',
      icon: 'palette',
      position: 2,
    },
  });

  const teacher = await prisma.teacher.upsert({
    where: { slug: 'aziz-karimov' },
    update: {},
    create: {
      slug: 'aziz-karimov',
      fullName: 'Aziz Karimov',
      title: 'Frontend dasturchi',
      bio: '8 yillik tajribaga ega frontend dasturchi va mentor.',
      position: 1,
    },
  });

  let template = await prisma.certificateTemplate.findFirst({ where: { isDefault: true } });
  template ??= await prisma.certificateTemplate.create({
    data: { name: 'Standart shablon', html: DEFAULT_CERTIFICATE_HTML, isDefault: true },
  });

  const existing = await prisma.course.findUnique({ where: { slug: DEMO_COURSE.slug } });
  const course =
    existing ??
    (await prisma.course.create({
      data: {
        ...DEMO_COURSE,
        status: CourseStatus.PUBLISHED,
        sequentialUnlock: true,
        publishedAt: new Date(),
        directionId: direction.id,
        certificateTemplateId: template.id,
        createdById: admin.id,
        teachers: { connect: [{ id: teacher.id }] },
      },
    }));

  if (!existing) {
    const modules = buildDemoModules();
    for (const [mi, m] of modules.entries()) {
      const mod = await prisma.module.create({
        data: { courseId: course.id, title: m.title, description: m.description, position: mi + 1 },
      });
      for (const [li, l] of m.lessons.entries()) {
        const lesson = await prisma.lesson.create({
          data: {
            moduleId: mod.id,
            title: l.title,
            summary: l.summary,
            durationMinutes: l.durationMinutes,
            position: li + 1,
            materials: {
              create: l.materials.map((mat, i) => ({ ...mat, position: i + 1 })),
            },
          },
        });
        for (const [pi, p] of l.practices.entries()) {
          await prisma.practice.create({
            data: {
              lessonId: lesson.id,
              title: p.title,
              position: pi + 1,
              questions: { create: p.questions.map((q, qi) => questionCreate(q, qi + 1)) },
            },
          });
        }
        // Publishing is only allowed once 4×6 is complete (DB trigger enforces it too).
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { isPublished: true, publishedAt: new Date() },
        });
      }
    }

    const examQuestions = buildExamQuestions();
    await prisma.exam.create({
      data: {
        courseId: course.id,
        title: 'Yakuniy imtihon',
        questionCount: 10,
        timeLimitMinutes: 20,
        passScore: 60,
        questions: {
          create: examQuestions.map((q, i) => questionCreate(q, i + 1)),
        },
      },
    });
  }

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: { userId: student.id, courseId: course.id, source: EnrollmentSource.ADMIN },
  });

  const faqs = [
    {
      question: 'Kursga qanday yozilaman?',
      answer:
        "Kurs sahifasida «Kirish so'rash» tugmasini bosing. Administrator so'rovingizni tasdiqlagach, kurs kabinetingizda paydo bo'ladi.",
    },
    {
      question: 'Sertifikat qachon beriladi?',
      answer:
        "Barcha darslarni tugatib, yakuniy imtihondan o'tganingizdan so'ng sertifikat avtomatik beriladi.",
    },
    {
      question: 'Sertifikatni qanday tekshirish mumkin?',
      answer: 'Sertifikatdagi ID orqali /verify sahifasida haqiqiyligini tekshirish mumkin.',
    },
  ];
  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({ data: faqs.map((f, i) => ({ ...f, position: i + 1 })) });
  }

  const settings: Record<string, Prisma.InputJsonValue> = {
    'platform.name': 'OnlineDars',
    'platform.supportPhone': '+998 71 000 00 00',
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  const lessons = await prisma.lesson.count({ where: { module: { courseId: course.id } } });
  const questions = await prisma.question.count({
    where: { practice: { lesson: { module: { courseId: course.id } } } },
  });
  console.log(
    `Seed OK: course "${course.title}" — ${lessons} lessons, ${questions} practice questions. Users: admin@, content@, student@onlinedars.uz`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
