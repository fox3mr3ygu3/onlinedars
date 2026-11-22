import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokenClaims,
  ErrorCode,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  OtpPurpose,
} from '@onlinedars/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config';
import { parseEnv } from '../../config/env';
import type { PrismaService } from '../../prisma/prisma.service';
import { createFakePrisma, type FakePrisma } from '../../testing/fake-prisma';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { TokenService } from './token.service';

const config = new AppConfig(
  parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
  }),
);

async function expectCode(p: Promise<unknown>, code: ErrorCode, status?: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppException);
  expect((err as AppException).code).toBe(code);
  if (status) expect((err as AppException).getStatus()).toBe(status);
}

function setup() {
  const db: FakePrisma = createFakePrisma();
  const prisma = db as unknown as PrismaService;
  const jwt = new JwtService();
  const passwords = new PasswordService();
  const tokens = new TokenService(jwt, prisma, config);
  const sms = new ConsoleSmsProvider();
  const otp = new OtpService(prisma, sms, config);
  const auth = new AuthService(prisma, passwords, tokens, otp);
  const lastCode = (phone: string) => /(\d{6})/.exec(sms.lastTo(phone) ?? '')?.[1] ?? '';
  return { db, jwt, passwords, tokens, sms, otp, auth, lastCode };
}

const meta = { userAgent: 'vitest', ip: '127.0.0.1' };
const register = (auth: AuthService, email = 'ali@example.uz', password = 'Parol12345') =>
  auth.register({ fullName: 'Ali Valiyev', email, password }, meta);

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with argon2id and never stores plaintext', async () => {
    const hash = await passwords.hash('Parol12345');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Parol12345');
    expect(await passwords.verify(hash, 'Parol12345')).toBe(true);
    expect(await passwords.verify(hash, 'wrong-password')).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    expect(await passwords.hash('same')).not.toBe(await passwords.hash('same'));
  });

  it('treats a malformed hash as a failed verify', async () => {
    expect(await passwords.verify('not-a-hash', 'x')).toBe(false);
  });
});

describe('AuthService', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('register & login', () => {
    it('registers a student by email, stores only a hash, and opens a session', async () => {
      const r = await register(s.auth);
      expect(r.body.user.role).toBe('STUDENT');
      expect(r.body.expiresIn).toBe(ACCESS_TOKEN_TTL_SECONDS);
      expect(r.refreshToken).toContain('.');
      const stored = s.db.user.rows[0]!;
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
      expect(r.body.user).not.toHaveProperty('passwordHash');
      expect(s.db.session.rows).toHaveLength(1);
      expect(s.db.session.rows[0]!.refreshTokenHash).not.toContain(r.refreshToken.split('.')[1]);
    });

    it('rejects a duplicate email', async () => {
      await register(s.auth);
      await expectCode(register(s.auth), ErrorCode.EMAIL_TAKEN, 409);
    });

    it('issues an access token with sub, role, sid and a 15 minute expiry', async () => {
      const r = await register(s.auth);
      const claims = await s.jwt.verifyAsync<AccessTokenClaims & { iat: number; exp: number }>(
        r.body.accessToken,
        { secret: config.env.JWT_ACCESS_SECRET },
      );
      expect(claims.sub).toBe(r.body.user.id);
      expect(claims.role).toBe('STUDENT');
      expect(claims.sid).toBe(s.db.session.rows[0]!.id);
      expect(claims.exp - claims.iat).toBe(15 * 60);
    });

    it('logs in by email (case-insensitive) with the right password', async () => {
      await register(s.auth);
      const r = await s.auth.login({ login: 'ALI@example.uz', password: 'Parol12345' }, meta);
      expect(r.body.user.email).toBe('ali@example.uz');
    });

    it('rejects a wrong password and an unknown login with the same error', async () => {
      await register(s.auth);
      await expectCode(
        s.auth.login({ login: 'ali@example.uz', password: 'nope-nope' }, meta),
        ErrorCode.INVALID_CREDENTIALS,
        401,
      );
      await expectCode(
        s.auth.login({ login: 'ghost@example.uz', password: 'Parol12345' }, meta),
        ErrorCode.INVALID_CREDENTIALS,
        401,
      );
    });

    it('blocks a disabled account', async () => {
      await register(s.auth);
      s.db.user.rows[0]!.isActive = false;
      await expectCode(
        s.auth.login({ login: 'ali@example.uz', password: 'Parol12345' }, meta),
        ErrorCode.ACCOUNT_DISABLED,
        403,
      );
    });
  });

  describe('refresh token rotation', () => {
    it('rotates: each refresh returns a new token and the old one stops working', async () => {
      const first = await register(s.auth);
      const second = await s.auth.refresh(first.refreshToken, meta);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.refreshToken.split('.')[0]).toBe(first.refreshToken.split('.')[0]);
      const third = await s.auth.refresh(second.refreshToken, meta);
      expect(third.body.accessToken).toBeTruthy();
    });

    it('detects reuse of a rotated token and revokes the whole session', async () => {
      const first = await register(s.auth);
      const second = await s.auth.refresh(first.refreshToken, meta);

      await expectCode(
        s.auth.refresh(first.refreshToken, meta),
        ErrorCode.REFRESH_TOKEN_REUSED,
        401,
      );
      expect(s.db.session.rows[0]!.revokedAt).toBeInstanceOf(Date);
      // The legitimate latest token is now dead too (the session was stolen).
      await expectCode(
        s.auth.refresh(second.refreshToken, meta),
        ErrorCode.REFRESH_TOKEN_INVALID,
        401,
      );
    });

    it('rejects a token for a revoked session (after logout)', async () => {
      const r = await register(s.auth);
      await s.auth.logout(r.refreshToken);
      expect(s.db.session.rows[0]!.revokedAt).toBeInstanceOf(Date);
      await expectCode(s.auth.refresh(r.refreshToken, meta), ErrorCode.REFRESH_TOKEN_INVALID, 401);
    });

    it('rejects missing, malformed and expired tokens', async () => {
      await expectCode(s.auth.refresh(undefined, meta), ErrorCode.REFRESH_TOKEN_INVALID);
      await expectCode(s.auth.refresh('garbage', meta), ErrorCode.REFRESH_TOKEN_INVALID);
      await expectCode(
        s.auth.refresh('unknown-session.secret', meta),
        ErrorCode.REFRESH_TOKEN_INVALID,
      );
      const r = await register(s.auth);
      s.db.session.rows[0]!.expiresAt = new Date(Date.now() - 1000);
      await expectCode(s.auth.refresh(r.refreshToken, meta), ErrorCode.REFRESH_TOKEN_INVALID);
    });

    it('logout with a forged secret does not revoke the session', async () => {
      const r = await register(s.auth);
      const [sid] = r.refreshToken.split('.');
      await s.auth.logout(`${sid}.forged`);
      expect(s.db.session.rows[0]!.revokedAt).toBeNull();
    });
  });

  describe('OTP', () => {
    const phone = '+998901112233';

    it('sends a 6-digit code and verifies it exactly once', async () => {
      await s.otp.request(phone, OtpPurpose.REGISTER);
      const code = s.lastCode(phone);
      expect(code).toMatch(/^\d{6}$/);
      expect(s.db.otpCode.rows[0]!.codeHash).not.toContain(code);
      await s.otp.verify(phone, OtpPurpose.REGISTER, code);
      await expectCode(s.otp.verify(phone, OtpPurpose.REGISTER, code), ErrorCode.OTP_INVALID);
    });

    it('does not accept a code issued for another purpose', async () => {
      await s.otp.request(phone, OtpPurpose.REGISTER);
      await expectCode(
        s.otp.verify(phone, OtpPurpose.RESET_PASSWORD, s.lastCode(phone)),
        ErrorCode.OTP_INVALID,
      );
    });

    it('expires after the TTL', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      await s.otp.request(phone, OtpPurpose.REGISTER);
      const code = s.lastCode(phone);
      vi.setSystemTime(Date.now() + OTP_TTL_SECONDS * 1000 + 1);
      await expectCode(s.otp.verify(phone, OtpPurpose.REGISTER, code), ErrorCode.OTP_EXPIRED);
    });

    it(`locks after ${OTP_MAX_ATTEMPTS} wrong attempts, even for the right code`, async () => {
      await s.otp.request(phone, OtpPurpose.REGISTER);
      const code = s.lastCode(phone);
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
        await expectCode(s.otp.verify(phone, OtpPurpose.REGISTER, wrong), ErrorCode.OTP_INVALID);
      }
      await expectCode(
        s.otp.verify(phone, OtpPurpose.REGISTER, wrong),
        ErrorCode.OTP_TOO_MANY_ATTEMPTS,
      );
      await expectCode(
        s.otp.verify(phone, OtpPurpose.REGISTER, code),
        ErrorCode.OTP_TOO_MANY_ATTEMPTS,
      );
    });

    it('enforces the resend cooldown, and a new code replaces the old one', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      await s.otp.request(phone, OtpPurpose.REGISTER);
      const oldCode = s.lastCode(phone);
      await expectCode(
        s.otp.request(phone, OtpPurpose.REGISTER),
        ErrorCode.OTP_RESEND_TOO_SOON,
        429,
      );
      vi.setSystemTime(Date.now() + 61_000);
      await s.otp.request(phone, OtpPurpose.REGISTER);
      const newCode = s.lastCode(phone);
      if (oldCode !== newCode) {
        await expectCode(s.otp.verify(phone, OtpPurpose.REGISTER, oldCode), ErrorCode.OTP_INVALID);
      }
      await s.otp.verify(phone, OtpPurpose.REGISTER, newCode);
    });

    it('phone sign-up requires a valid OTP and marks the phone verified', async () => {
      const input = { fullName: 'Vali', phone, password: 'Parol12345' };
      await s.otp.request(phone, OtpPurpose.REGISTER);
      await expectCode(
        s.auth.register(
          { ...input, otpCode: '999999' === s.lastCode(phone) ? '888888' : '999999' },
          meta,
        ),
        ErrorCode.OTP_INVALID,
      );
      const r = await s.auth.register({ ...input, otpCode: s.lastCode(phone) }, meta);
      expect(r.body.user.phone).toBe(phone);
      expect(r.body.user.phoneVerified).toBe(true);
    });
  });

  describe('password reset', () => {
    it('resets via phone OTP and signs out every session', async () => {
      const phone = '+998935556677';
      await s.otp.request(phone, OtpPurpose.REGISTER);
      const r = await s.auth.register(
        { fullName: 'Vali', phone, password: 'Parol12345', otpCode: s.lastCode(phone) },
        meta,
      );
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 61_000);

      await s.auth.forgotPassword({ login: '93 555 66 77' });
      await s.auth.resetPassword({
        login: phone,
        code: s.lastCode(phone),
        newPassword: 'YangiParol1',
      });

      await expectCode(s.auth.refresh(r.refreshToken, meta), ErrorCode.REFRESH_TOKEN_INVALID);
      await expectCode(
        s.auth.login({ login: phone, password: 'Parol12345' }, meta),
        ErrorCode.INVALID_CREDENTIALS,
      );
      const ok = await s.auth.login({ login: phone, password: 'YangiParol1' }, meta);
      expect(ok.body.user.phone).toBe(phone);
    });

    it('forgot-password is silent for unknown logins', async () => {
      await expect(s.auth.forgotPassword({ login: 'ghost@example.uz' })).resolves.toBeUndefined();
      expect(s.sms.outbox).toHaveLength(0);
    });
  });
});
