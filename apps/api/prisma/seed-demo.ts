/**
 * Demo seed (`pnpm db:seed:demo`, dev and staging only): fills every page with realistic data —
 * 10 courses (8 published, 1 draft, 1 hidden) across 5 directions, 6 teachers, FAQ, 30 students
 * with different progress, practice and exam attempts, certificates, access requests in every
 * status (pending, approved, rejected), notifications and audit-log entries, spread over the last
 * 60 days. Courses have no price: every enrolment was granted by an admin.
 *
 * Idempotent: courses are matched by slug and students by email; anything that already exists is
 * left alone (and a student's activity is only generated when the student is created), so running
 * it again adds nothing. Run `pnpm db:seed` first (admin, template, demo course).
 */
import { QuestionType } from '@onlinedars/shared';
import {
  AccessRequestStatus,
  CourseLevel,
  CourseStatus,
  EnrollmentSource,
  ExamAttemptStatus,
  LessonMaterialType,
  NotificationType,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { generateCertificatePublicId } from '../src/modules/certificates/certificate-id';
import {
  DEMO_COURSES,
  DEMO_DIRECTIONS,
  DEMO_FAQ,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  type DemoCourse,
} from './seed-demo-data';
import { buildPractices, buildQuestion, type LessonTopic, type SeedQuestion } from './seed-data';

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const EXAM_TYPES = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.MATCHING,
  QuestionType.FILL_BLANK,
  QuestionType.IMAGE_BASED,
];

/** Deterministic PRNG so every fresh database gets the same demo picture. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261123);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
/** A date `daysAgo` days back plus a random time of day, never in the future. */
const daysAgo = (d: number) =>
  new Date(Math.min(NOW - d * DAY + randInt(0, 10) * 3_600_000, NOW - 60_000));
const after = (base: Date, hours: number) =>
  new Date(Math.min(base.getTime() + hours * 3_600_000, NOW - 30_000));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function lessonHtml(topic: LessonTopic): string {
  return `<h2>${escapeHtml(topic.title)}</h2><p>${escapeHtml(topic.summary)}</p><ul>${topic.terms
    .map((t) => `<li><code>${escapeHtml(t.term)}</code> — ${escapeHtml(t.definition)}</li>`)
    .join('')}</ul>`;
}

interface CourseInfo {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  lessons: { id: string; practiceIds: string[]; questionsPerPractice: number }[];
  exam: {
    id: string;
    questionIds: string[];
    questionCount: number;
    timeLimitMinutes: number;
  } | null;
}

async function createCourse(c: DemoCourse, adminId: string, templateId: string): Promise<void> {
  const direction = await prisma.direction.findUniqueOrThrow({ where: { slug: c.direction } });
  const teachers = await prisma.teacher.findMany({ where: { slug: { in: c.teachers } } });
  const published = c.status !== 'DRAFT';
  const createdAt = daysAgo(randInt(70, 90));
  const course = await prisma.course.create({
    data: {
      slug: c.slug,
      title: c.title,
      shortDescription: c.shortDescription,
      description: c.description,
      goals: c.goals,
      coverImageUrl: `https://placehold.co/800x450/${c.color}/ffffff/png?text=${encodeURIComponent(c.title)}`,
      level: c.level as CourseLevel,
      sequentialUnlock: true,
      status: c.status as CourseStatus,
      publishedAt: published ? after(createdAt, 48) : null,
      createdAt,
      directionId: direction.id,
      certificateTemplateId: templateId,
      createdById: adminId,
      teachers: { connect: teachers.map((t) => ({ id: t.id })) },
    },
  });
  const topics: LessonTopic[] = [];
  for (const [mi, m] of c.modules.entries()) {
    const mod = await prisma.module.create({
      data: { courseId: course.id, title: m.title, description: m.description, position: mi + 1 },
    });
    for (const [li, topic] of m.lessons.entries()) {
      topics.push(topic);
      const withVideo = mi === 0 && li === 0 && ['python-asoslari', 'figma-ui-ux'].includes(c.slug);
      const lesson = await prisma.lesson.create({
        data: {
          moduleId: mod.id,
          title: topic.title,
          summary: topic.summary,
          durationMinutes: randInt(15, 40),
          position: li + 1,
          materials: {
            create: [
              ...(withVideo
                ? [
                    {
                      type: LessonMaterialType.VIDEO,
                      title: 'Dars videosi',
                      videoUrl: SAMPLE_VIDEO,
                      position: 1,
                    },
                  ]
                : []),
              {
                type: LessonMaterialType.TEXT,
                title: topic.title,
                content: lessonHtml(topic),
                position: withVideo ? 2 : 1,
              },
            ],
          },
        },
      });
      for (const [pi, p] of buildPractices(topic).entries()) {
        await prisma.practice.create({
          data: {
            lessonId: lesson.id,
            title: p.title,
            position: pi + 1,
            questions: { create: p.questions.map((q, qi) => questionCreate(q, qi + 1)) },
          },
        });
      }
      // The DB only allows publishing once 4 × 6 is complete (it is). Drafts stay unpublished.
      if (published) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { isPublished: true, publishedAt: after(createdAt, 24) },
        });
      }
    }
  }
  const pool = topics.flatMap((topic, ti) =>
    [0, 1, 2].map((k) =>
      buildQuestion(EXAM_TYPES[(ti * 3 + k) % EXAM_TYPES.length]!, topic, 100 + ti * 3 + k),
    ),
  );
  await prisma.exam.create({
    data: {
      courseId: course.id,
      title: 'Yakuniy imtihon',
      questionCount: Math.min(8, pool.length),
      timeLimitMinutes: 20,
      passScore: 60,
      maxAttempts: 3,
      questions: { create: pool.map((q, i) => questionCreate(q, i + 1)) },
    },
  });
}

async function loadCourse(slug: string): Promise<CourseInfo> {
  const c = await prisma.course.findUniqueOrThrow({
    where: { slug },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: 'asc' },
            include: {
              practices: {
                orderBy: { position: 'asc' },
                include: { _count: { select: { questions: true } } },
              },
            },
          },
        },
      },
      exam: { include: { questions: { select: { id: true }, orderBy: { position: 'asc' } } } },
    },
  });
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    status: c.status,
    lessons: c.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        practiceIds: l.practices.map((p) => p.id),
        questionsPerPractice: l.practices[0]?._count.questions ?? 6,
      })),
    ),
    exam: c.exam
      ? {
          id: c.exam.id,
          questionIds: c.exam.questions.map((q) => q.id),
          questionCount: c.exam.questionCount,
          timeLimitMinutes: c.exam.timeLimitMinutes,
        }
      : null,
  };
}

const counters = { requests: 0, certificates: 0, attempts: 0, enrollments: 0 };
let adminId = '';

/**
 * The student asked for the course and an admin approved it a few hours later: an APPROVED
 * access request, the enrolment (source ACCESS_REQUEST), an audit row and a notification.
 */
async function enrol(user: { id: string }, course: CourseInfo, at: Date): Promise<void> {
  const approvedAt = after(at, randInt(1, 20));
  const request = await prisma.accessRequest.create({
    data: {
      userId: user.id,
      courseId: course.id,
      status: AccessRequestStatus.APPROVED,
      message: rand() < 0.4 ? 'Kursga kirish berishingizni so‘rayman.' : null,
      decidedById: adminId,
      decidedAt: approvedAt,
      createdAt: at,
    },
  });
  counters.requests++;
  await prisma.enrollment.create({
    data: {
      userId: user.id,
      courseId: course.id,
      source: EnrollmentSource.ACCESS_REQUEST,
      enrolledAt: approvedAt,
    },
  });
  counters.enrollments++;
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: 'ACCESS_REQUEST_APPROVED',
      entityType: 'AccessRequest',
      entityId: request.id,
      before: { status: 'PENDING' },
      after: { status: 'APPROVED' },
      createdAt: approvedAt,
    },
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: NotificationType.ACCESS_GRANTED,
      title: 'Kursga kirish berildi',
      body: `"${course.title}" kursiga kirish ochildi.`,
      data: { courseId: course.id, courseTitle: course.title, courseSlug: course.slug },
      readAt: rand() < 0.7 ? after(approvedAt, randInt(1, 30)) : null,
      createdAt: approvedAt,
    },
  });
}

/** Completes the first `done` lessons (viewed + every practice passed) and views the next one. */
async function study(userId: string, course: CourseInfo, start: Date, done: number): Promise<Date> {
  let t = start;
  for (const [i, lesson] of course.lessons.entries()) {
    if (i > done) break;
    t = after(t, randInt(6, 60));
    const finished = i < done;
    await prisma.lessonProgress.create({
      data: {
        userId,
        lessonId: lesson.id,
        materialViewedAt: t,
        completedAt: finished ? after(t, 1) : null,
        createdAt: t,
      },
    });
    if (!finished) break;
    for (const practiceId of lesson.practiceIds) {
      const total = lesson.questionsPerPractice;
      const correct = randInt(Math.ceil(total * 0.6), total);
      await prisma.practiceAttempt.create({
        data: {
          userId,
          practiceId,
          score: correct,
          maxScore: total,
          correctCount: correct,
          totalCount: total,
          passed: true,
          startedAt: after(t, 0.2),
          submittedAt: after(t, 0.5),
        },
      });
      counters.attempts++;
    }
  }
  return t;
}

async function examAttempt(
  user: { id: string; fullName: string },
  course: CourseInfo,
  at: Date,
  percent: number,
  templateId: string,
): Promise<boolean> {
  const exam = course.exam;
  if (!exam) return false;
  const questionIds = [...exam.questionIds].sort(() => rand() - 0.5).slice(0, exam.questionCount);
  const max = questionIds.length;
  const score = Math.round((percent / 100) * max);
  const passed = Math.round((score / max) * 100) >= 60;
  const attempt = await prisma.examAttempt.create({
    data: {
      examId: exam.id,
      userId: user.id,
      status: ExamAttemptStatus.SUBMITTED,
      questionIds,
      answers: [],
      startedAt: at,
      expiresAt: new Date(at.getTime() + exam.timeLimitMinutes * 60_000),
      submittedAt: after(at, 0.2),
      score,
      maxScore: max,
      percent: Math.round((score / max) * 100),
      passed,
    },
  });
  if (passed) {
    const cert = await prisma.certificate.create({
      data: {
        publicId: generateCertificatePublicId(),
        userId: user.id,
        courseId: course.id,
        examAttemptId: attempt.id,
        templateId,
        fullName: user.fullName,
        courseTitle: course.title,
        issuedAt: after(at, 0.25),
        createdAt: after(at, 0.25),
      },
    });
    counters.certificates++;
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      data: { completedAt: after(at, 0.25) },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.CERTIFICATE_ISSUED,
        title: 'certificateIssued',
        body: cert.publicId,
        data: { certificateId: cert.id, publicId: cert.publicId, courseId: course.id },
        readAt: rand() < 0.5 ? after(at, 2) : null,
        createdAt: after(at, 0.25),
      },
    });
  }
  return passed;
}

/** A request that did not (yet) grant access: waiting in the admin queue, or rejected. */
async function openRequest(
  userId: string,
  course: CourseInfo,
  status: typeof AccessRequestStatus.PENDING | typeof AccessRequestStatus.REJECTED,
  at: Date,
): Promise<void> {
  const rejected = status === AccessRequestStatus.REJECTED;
  const request = await prisma.accessRequest.create({
    data: {
      userId,
      courseId: course.id,
      status,
      message: rand() < 0.5 ? 'Shu kursni o‘qimoqchiman.' : null,
      decisionReason: rejected ? 'Guruh to‘lgan, keyingi oqimda qayta so‘rang (demo).' : null,
      decidedById: rejected ? adminId : null,
      decidedAt: rejected ? after(at, 6) : null,
      createdAt: at,
    },
  });
  counters.requests++;
  if (rejected) {
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ACCESS_REQUEST_REJECTED',
        entityType: 'AccessRequest',
        entityId: request.id,
        before: { status: 'PENDING' },
        after: { status: 'REJECTED' },
        reason: request.decisionReason,
        createdAt: after(at, 6),
      },
    });
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ACCESS_REJECTED,
        title: "Kursga kirish so'rovi rad etildi",
        body: `"${course.title}": ${request.decisionReason}`,
        data: {
          courseId: course.id,
          courseTitle: course.title,
          courseSlug: course.slug,
          reason: request.decisionReason,
        },
        createdAt: after(at, 6),
      },
    });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to load demo data with NODE_ENV=production');
  }
  const admin = await prisma.user.findUnique({ where: { email: 'admin@onlinedars.uz' } });
  const template = await prisma.certificateTemplate.findFirst({ where: { isDefault: true } });
  if (!admin || !template)
    throw new Error('Run `pnpm db:seed` first (admin + certificate template)');
  adminId = admin.id;

  for (const [i, d] of DEMO_DIRECTIONS.entries()) {
    await prisma.direction.upsert({
      where: { slug: d.slug },
      update: {},
      create: { ...d, position: i + 1 },
    });
  }
  for (const [i, t] of DEMO_TEACHERS.entries()) {
    await prisma.teacher.upsert({
      where: { slug: t.slug },
      update: {},
      create: { ...t, position: i + 2 },
    });
  }

  let createdCourses = 0;
  for (const c of DEMO_COURSES) {
    if (await prisma.course.findUnique({ where: { slug: c.slug } })) continue;
    await createCourse(c, admin.id, template.id);
    createdCourses++;
  }

  const faqCount = await prisma.faq.count();
  for (const [i, f] of DEMO_FAQ.entries()) {
    if (!(await prisma.faq.findFirst({ where: { question: f.question } }))) {
      await prisma.faq.create({ data: { ...f, position: faqCount + i + 1 } });
    }
  }

  const slugs = [
    'veb-dasturlash-asoslari',
    ...DEMO_COURSES.filter((c) => c.status === 'PUBLISHED').map((c) => c.slug),
  ];
  const courses = await Promise.all(slugs.map(loadCourse));
  const hidden = await loadCourse('jquery-eski');
  const passwordHash = await argon2.hash(process.env.SEED_PASSWORD || 'Parol12345!', {
    type: argon2.argon2id,
  });

  let createdStudents = 0;
  for (const [i, s] of DEMO_STUDENTS.entries()) {
    if (await prisma.user.findUnique({ where: { email: s.email } })) continue;
    const joined = daysAgo(60 - i * 2);
    const user = await prisma.user.create({
      data: {
        ...s,
        role: Role.STUDENT,
        passwordHash,
        emailVerifiedAt: joined,
        phoneVerifiedAt: joined,
        createdAt: joined,
        lastLoginAt: after(joined, randInt(24, 24 * 20)),
      },
    });
    createdStudents++;

    // 1–3 courses each; progress levels cycle so every state is represented.
    const mine = [...courses].sort(() => rand() - 0.5).slice(0, randInt(1, 3));
    for (const [k, course] of mine.entries()) {
      const at = after(joined, randInt(1, 72) + k * 24);
      await enrol(user, course, at);
      const profile = (i + k) % 5; // 0 not started, 1 started, 2 midway, 3 finished (failed exam), 4 finished + passed
      const lessons = course.lessons.length;
      const done =
        profile === 0
          ? -1
          : profile === 1
            ? 0
            : profile === 2
              ? Math.max(1, Math.floor(lessons / 2))
              : lessons;
      if (done < 0) continue;
      const last = await study(user.id, course, at, done);
      if (profile === 3)
        await examAttempt(user, course, after(last, 2), randInt(25, 50), template.id);
      if (profile === 4) {
        if (rand() < 0.4)
          await examAttempt(user, course, after(last, 2), randInt(30, 55), template.id);
        await examAttempt(user, course, after(last, 26), randInt(70, 100), template.id);
      }
    }

    // Requests that did not grant access, on a course the student does not have.
    const other = courses.find((c) => !mine.includes(c));
    if (other && i % 3 === 0) {
      const status = (i / 3) % 2 === 0 ? AccessRequestStatus.PENDING : AccessRequestStatus.REJECTED;
      await openRequest(
        user.id,
        other,
        status,
        status === AccessRequestStatus.PENDING ? daysAgo(randInt(0, 2)) : after(joined, 5),
      );
    }

    // A few special cases for the admin pages.
    if (i === 4 && other) {
      // Access granted, then revoked by an admin (progress is kept), recorded in the audit log.
      await enrol(user, other, after(joined, 3));
      const revokedAt = after(joined, 8);
      const enr = await prisma.enrollment.update({
        where: { userId_courseId: { userId: user.id, courseId: other.id } },
        data: { revokedAt },
      });
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'ENROLLMENT_REVOKED',
          entityType: 'Enrollment',
          entityId: enr.id,
          before: { revokedAt: null },
          after: { revokedAt: revokedAt.toISOString() },
          createdAt: revokedAt,
        },
      });
    }
    if (i === 7 || i === 11) {
      // Hidden course: still studied by students who were granted access by an admin.
      const grantedAt = after(joined, 2);
      const enr = await prisma.enrollment.create({
        data: {
          userId: user.id,
          courseId: hidden.id,
          source: EnrollmentSource.ADMIN,
          enrolledAt: grantedAt,
        },
      });
      counters.enrollments++;
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'ENROLLMENT_GRANTED',
          entityType: 'Enrollment',
          entityId: enr.id,
          after: JSON.parse(JSON.stringify(enr)) as Prisma.InputJsonValue,
          reason: 'Hamkorlik dasturi (demo)',
          createdAt: grantedAt,
        },
      });
      await study(user.id, hidden, grantedAt, 1);
    }
  }

  console.log(
    `Demo seed OK: +${createdCourses} courses, +${createdStudents} students, ` +
      `${counters.enrollments} enrolments, ${counters.requests} access requests, ` +
      `${counters.attempts} practice attempts, ${counters.certificates} certificates. ` +
      `Students: talaba01…talaba30@demo.onlinedars.uz (same password as the base seed).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
