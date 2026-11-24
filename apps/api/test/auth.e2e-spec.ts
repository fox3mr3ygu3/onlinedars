/**
 * API e2e: register → login → me → refresh → logout, plus 401/403 and the DB-level 4×6 rule.
 * Needs a migrated Postgres at DATABASE_URL; the whole file is skipped when it is not set.
 */
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCode, OtpPurpose, REFRESH_COOKIE_NAME, Role } from '@onlinedars/shared';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { Roles } from '../src/common/decorators';
import { ConsoleSmsProvider } from '../src/modules/auth/sms/console-sms.provider';
import { SmsProvider } from '../src/modules/auth/sms/sms-provider';

/** Test-only routes to prove role checks on the real guard stack. */
@Controller('e2e-probe')
class ProbeController {
  @Roles(Role.ADMIN)
  @Get('admin')
  admin() {
    return { ok: true };
  }

  @Roles(Role.ADMIN, Role.CONTENT_MANAGER)
  @Get('content')
  content() {
    return { ok: true };
  }
}

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `e2e${Date.now()}`;
const email = (name: string) => `${name}.${RUN}@test.onlinedars.uz`;
const PASSWORD = 'Parol12345!';

function refreshCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = raw?.find((v) => v.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return c?.split(';')[0];
}

describe.skipIf(!hasDb)('auth e2e', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let sms: ConsoleSmsProvider;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    sms = new ConsoleSmsProvider();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(SmsProvider)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `${RUN}@test.onlinedars.uz` } } });
    await prisma.otpCode.deleteMany({ where: { phone: { startsWith: '+99899' } } });
    await prisma.$disconnect();
    await app?.close();
  });

  it('GET /api/v1/health → {status:"ok"}', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('serves the OpenAPI document', async () => {
    const res = await http.get('/api/docs/openapi.json').expect(200);
    expect(res.body.paths).toHaveProperty('/api/v1/auth/login');
  });

  describe('register → login → me → refresh → logout', () => {
    const user = { fullName: 'E2E Talaba', email: email('student'), password: PASSWORD };
    let access = '';
    let cookie = '';

    it('registers and sets an httpOnly refresh cookie scoped to /api/v1/auth', async () => {
      const res = await http.post('/api/v1/auth/register').send(user).expect(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.user).toMatchObject({ email: user.email, role: 'STUDENT' });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      const raw = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(raw).toMatch(/HttpOnly/i);
      expect(raw).toMatch(/Path=\/api\/v1\/auth/);
      expect(raw).toMatch(/SameSite=Lax/i);
    });

    it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
      const res = await http.post('/api/v1/auth/register').send(user).expect(409);
      expect(res.body.code).toBe(ErrorCode.EMAIL_TAKEN);
    });

    it('rejects an invalid body with 400 VALIDATION_FAILED', async () => {
      const res = await http
        .post('/api/v1/auth/register')
        .send({ fullName: 'x', email: 'bad', password: '1' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('logs in', async () => {
      const res = await http
        .post('/api/v1/auth/login')
        .send({ login: user.email.toUpperCase(), password: PASSWORD })
        .expect(200);
      access = res.body.accessToken;
      cookie = refreshCookie(res) ?? '';
      expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=`);
    });

    it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
      const res = await http
        .post('/api/v1/auth/login')
        .send({ login: user.email, password: 'wrong-password' })
        .expect(401);
      expect(res.body.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });

    it('GET /auth/me returns the caller', async () => {
      const res = await http
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${access}`)
        .expect(200);
      expect(res.body.email).toBe(user.email);
    });

    it('GET /auth/me without or with a bad token → 401', async () => {
      expect((await http.get('/api/v1/auth/me').expect(401)).body.code).toBe(
        ErrorCode.UNAUTHORIZED,
      );
      await http.get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });

    it('refresh rotates the cookie; replaying the old cookie revokes the session', async () => {
      const r1 = await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
      const next = refreshCookie(r1)!;
      expect(next).toBeTruthy();
      expect(next).not.toBe(cookie);

      const replay = await http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
      expect(replay.body.code).toBe(ErrorCode.REFRESH_TOKEN_REUSED);
      // Session is revoked: the newest cookie and the access token die too.
      await http.post('/api/v1/auth/refresh').set('Cookie', next).expect(401);
      await http
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${r1.body.accessToken}`)
        .expect(401);
    });

    it('logout revokes the session (refresh and access token stop working)', async () => {
      const login = await http
        .post('/api/v1/auth/login')
        .send({ login: user.email, password: PASSWORD })
        .expect(200);
      const c = refreshCookie(login)!;
      await http.post('/api/v1/auth/logout').set('Cookie', c).expect(204);
      await http.post('/api/v1/auth/refresh').set('Cookie', c).expect(401);
      await http
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(401);
    });

    it('refresh without a cookie → 401 REFRESH_TOKEN_INVALID', async () => {
      const res = await http.post('/api/v1/auth/refresh').expect(401);
      expect(res.body.code).toBe(ErrorCode.REFRESH_TOKEN_INVALID);
    });
  });

  describe('roles and own profile', () => {
    let studentToken = '';
    let managerToken = '';
    let adminToken = '';

    beforeAll(async () => {
      const s = await http
        .post('/api/v1/auth/register')
        .send({ fullName: 'Rol Talaba', email: email('rolestudent'), password: PASSWORD })
        .expect(201);
      studentToken = s.body.accessToken;

      for (const [name, role] of [
        ['manager', Role.CONTENT_MANAGER],
        ['admin', Role.ADMIN],
      ] as const) {
        await http
          .post('/api/v1/auth/register')
          .send({ fullName: `Rol ${name}`, email: email(name), password: PASSWORD })
          .expect(201);
        await prisma.user.update({ where: { email: email(name) }, data: { role } });
        const login = await http
          .post('/api/v1/auth/login')
          .send({ login: email(name), password: PASSWORD })
          .expect(200);
        if (role === Role.ADMIN) adminToken = login.body.accessToken;
        else managerToken = login.body.accessToken;
      }
    });

    it('STUDENT on an ADMIN route → 403 FORBIDDEN', async () => {
      const res = await http
        .get('/api/v1/e2e-probe/admin')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('CONTENT_MANAGER: content route OK, ADMIN-only route 403', async () => {
      await http
        .get('/api/v1/e2e-probe/content')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      await http
        .get('/api/v1/e2e-probe/admin')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });

    it('ADMIN passes', async () => {
      await http
        .get('/api/v1/e2e-probe/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('anonymous on a role route → 401', async () => {
      await http.get('/api/v1/e2e-probe/admin').expect(401);
    });

    it('a student updates their own profile; the response never leaks the hash', async () => {
      const res = await http
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ fullName: 'Yangi Ism' })
        .expect(200);
      expect(res.body.fullName).toBe('Yangi Ism');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('change password requires the current password', async () => {
      const res = await http
        .post('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ currentPassword: 'wrong', newPassword: 'YangiParol123' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.WRONG_PASSWORD);
    });
  });

  describe('phone sign-up with OTP', () => {
    const phone = `+99899${String(Date.now()).slice(-7)}`;

    it('rejects phone sign-up with a wrong code, accepts the SMS code', async () => {
      await http
        .post('/api/v1/auth/otp/request')
        .send({ phone, purpose: OtpPurpose.REGISTER })
        .expect(202);
      const code = /(\d{6})/.exec(sms.lastTo(phone) ?? '')?.[1];
      expect(code).toBeTruthy();
      const wrong = code === '000000' ? '111111' : '000000';
      const body = { fullName: 'Telefon Talaba', phone, password: PASSWORD, email: email('phone') };
      const bad = await http
        .post('/api/v1/auth/register')
        .send({ ...body, otpCode: wrong })
        .expect(400);
      expect(bad.body.code).toBe(ErrorCode.OTP_INVALID);
      const ok = await http
        .post('/api/v1/auth/register')
        .send({ ...body, otpCode: code })
        .expect(201);
      expect(ok.body.user).toMatchObject({ phone, phoneVerified: true });
    });
  });

  describe('DB-level 4×6 rule (triggers in migration 0001_init)', () => {
    it('rejects a 5th practice, a 7th question, and publishing an incomplete lesson', async () => {
      const course = await prisma.course.create({
        data: { slug: `rule-${RUN}`, title: 'Rule test' },
      });
      try {
        const mod = await prisma.module.create({
          data: { courseId: course.id, title: 'M', position: 1 },
        });
        const lesson = await prisma.lesson.create({
          data: { moduleId: mod.id, title: 'L', position: 1 },
        });

        await expect(
          prisma.lesson.update({ where: { id: lesson.id }, data: { isPublished: true } }),
        ).rejects.toThrow(/LESSON_INCOMPLETE/);

        const practices = [];
        for (let p = 1; p <= 4; p++) {
          practices.push(
            await prisma.practice.create({
              data: { lessonId: lesson.id, title: `P${p}`, position: p },
            }),
          );
        }
        await expect(
          prisma.practice.create({ data: { lessonId: lesson.id, title: 'P5', position: 5 } }),
        ).rejects.toThrow(/LESSON_PRACTICE_LIMIT/);

        for (const pr of practices) {
          for (let q = 1; q <= 6; q++) {
            await prisma.question.create({
              data: {
                practiceId: pr.id,
                type: 'TRUE_FALSE',
                prompt: `Q${q}`,
                position: q,
                options: {
                  create: [
                    { text: "To'g'ri", isCorrect: true, position: 1 },
                    { text: "Noto'g'ri", position: 2 },
                  ],
                },
              },
            });
          }
        }
        await expect(
          prisma.question.create({
            data: { practiceId: practices[0]!.id, type: 'TRUE_FALSE', prompt: 'Q7', position: 7 },
          }),
        ).rejects.toThrow(/PRACTICE_QUESTION_LIMIT/);

        const published = await prisma.lesson.update({
          where: { id: lesson.id },
          data: { isPublished: true },
        });
        expect(published.isPublished).toBe(true);
      } finally {
        await prisma.course.delete({ where: { id: course.id } });
      }
    });
  });
});
