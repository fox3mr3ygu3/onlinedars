import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { type AuthPrincipal, ErrorCode, Role } from '@onlinedars/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppConfig } from '../../config/app-config';
import { parseEnv } from '../../config/env';
import type { PrismaService } from '../../prisma/prisma.service';
import { createFakePrisma, type FakePrisma } from '../../testing/fake-prisma';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { AppException } from '../errors/app.exception';
import { assertOwnerOrRoles, OwnershipService } from '../ownership/ownership.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const config = new AppConfig(
  parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
  }),
);

function handler() {}
class FakeController {}

function ctx(req: Record<string, unknown>, meta: Record<string, unknown> = {}): ExecutionContext {
  for (const [k, v] of Object.entries(meta)) Reflect.defineMetadata(k, v, handler);
  return {
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function clearMeta() {
  for (const k of [IS_PUBLIC_KEY, ROLES_KEY]) Reflect.deleteMetadata(k, handler);
}

async function errorOf(fn: () => unknown): Promise<AppException> {
  try {
    await fn();
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected an error');
}

const principal = (role: Role, id = 'u1'): AuthPrincipal => ({ id, role, sessionId: 's1' });

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  beforeEach(clearMeta);

  it('allows any signed-in user when no @Roles is set', () => {
    expect(guard.canActivate(ctx({ user: principal(Role.STUDENT) }))).toBe(true);
  });

  it('denies a STUDENT on an ADMIN route with 403 FORBIDDEN', async () => {
    const e = await errorOf(() =>
      guard.canActivate(ctx({ user: principal(Role.STUDENT) }, { [ROLES_KEY]: [Role.ADMIN] })),
    );
    expect(e.getStatus()).toBe(403);
    expect(e.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('denies a CONTENT_MANAGER on an ADMIN-only route (e.g. settings)', async () => {
    const e = await errorOf(() =>
      guard.canActivate(
        ctx({ user: principal(Role.CONTENT_MANAGER) }, { [ROLES_KEY]: [Role.ADMIN] }),
      ),
    );
    expect(e.getStatus()).toBe(403);
  });

  it('allows a listed role', () => {
    expect(
      guard.canActivate(
        ctx(
          { user: principal(Role.CONTENT_MANAGER) },
          { [ROLES_KEY]: [Role.ADMIN, Role.CONTENT_MANAGER] },
        ),
      ),
    ).toBe(true);
  });

  it('returns 401 when a role is required but nobody is signed in', async () => {
    const e = await errorOf(() => guard.canActivate(ctx({}, { [ROLES_KEY]: [Role.ADMIN] })));
    expect(e.getStatus()).toBe(401);
  });
});

describe('JwtAuthGuard', () => {
  let db: FakePrisma;
  let guard: JwtAuthGuard;
  const jwt = new JwtService();
  const sign = (claims: object, secret = config.env.JWT_ACCESS_SECRET) =>
    jwt.signAsync(claims, { secret, expiresIn: 900 });

  beforeEach(async () => {
    clearMeta();
    db = createFakePrisma();
    guard = new JwtAuthGuard(new Reflector(), jwt, db as unknown as PrismaService, config);
    await db.user.create({
      data: { id: 'u1', email: 'a@b.uz', role: Role.ADMIN, passwordHash: 'x', fullName: 'A' },
    });
    await db.session.create({
      data: {
        id: 's1',
        userId: 'u1',
        refreshTokenHash: 'h',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  });

  it('lets @Public routes through without a token', async () => {
    expect(await guard.canActivate(ctx({ headers: {} }, { [IS_PUBLIC_KEY]: true }))).toBe(true);
  });

  it('rejects a missing token with 401', async () => {
    const e = await errorOf(() => guard.canActivate(ctx({ headers: {} })));
    expect(e.getStatus()).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await sign({ sub: 'u1', role: Role.ADMIN, sid: 's1' }, 'x'.repeat(40));
    const e = await errorOf(() =>
      guard.canActivate(ctx({ headers: { authorization: `Bearer ${token}` } })),
    );
    expect(e.getStatus()).toBe(401);
  });

  it('attaches the principal with the role from the DB, not from the token', async () => {
    db.user.rows[0]!.role = Role.STUDENT; // demoted after the token was issued
    const token = await sign({ sub: 'u1', role: Role.ADMIN, sid: 's1' });
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    expect(await guard.canActivate(ctx(req))).toBe(true);
    expect(req.user).toEqual({ id: 'u1', role: Role.STUDENT, sessionId: 's1' });
  });

  it('rejects a token whose session was revoked (logout takes effect immediately)', async () => {
    db.session.rows[0]!.revokedAt = new Date();
    const token = await sign({ sub: 'u1', role: Role.ADMIN, sid: 's1' });
    const e = await errorOf(() =>
      guard.canActivate(ctx({ headers: { authorization: `Bearer ${token}` } })),
    );
    expect(e.getStatus()).toBe(401);
  });

  it('rejects a token whose sub does not own the session', async () => {
    const token = await sign({ sub: 'someone-else', role: Role.ADMIN, sid: 's1' });
    const e = await errorOf(() =>
      guard.canActivate(ctx({ headers: { authorization: `Bearer ${token}` } })),
    );
    expect(e.getStatus()).toBe(401);
  });

  it('returns 403 ACCOUNT_DISABLED for a disabled user', async () => {
    db.user.rows[0]!.isActive = false;
    const token = await sign({ sub: 'u1', role: Role.ADMIN, sid: 's1' });
    const e = await errorOf(() =>
      guard.canActivate(ctx({ headers: { authorization: `Bearer ${token}` } })),
    );
    expect(e.getStatus()).toBe(403);
    expect(e.code).toBe(ErrorCode.ACCOUNT_DISABLED);
  });
});

describe('ownership helpers', () => {
  it('lets a student read only their own data', () => {
    expect(() => assertOwnerOrRoles(principal(Role.STUDENT, 'u1'), 'u1')).not.toThrow();
    expect(() => assertOwnerOrRoles(principal(Role.STUDENT, 'u1'), 'u2')).toThrow(AppException);
  });

  it('lets an ADMIN read anyone, but not a CONTENT_MANAGER by default', () => {
    expect(() => assertOwnerOrRoles(principal(Role.ADMIN, 'a'), 'u2')).not.toThrow();
    expect(() => assertOwnerOrRoles(principal(Role.CONTENT_MANAGER, 'c'), 'u2')).toThrow(
      AppException,
    );
  });

  it('requires an active enrollment for students, not for staff', async () => {
    const db = createFakePrisma();
    const svc = new OwnershipService(db as unknown as PrismaService);
    await db.enrollment.create({ data: { userId: 'u1', courseId: 'c1', source: 'FREE' } });
    await db.enrollment.create({
      data: { userId: 'u3', courseId: 'c1', source: 'FREE', revokedAt: new Date() },
    });

    await expect(
      svc.assertCanAccessCourse(principal(Role.STUDENT, 'u1'), 'c1'),
    ).resolves.toBeUndefined();
    const e = await errorOf(() => svc.assertCanAccessCourse(principal(Role.STUDENT, 'u2'), 'c1'));
    expect(e.code).toBe(ErrorCode.NOT_ENROLLED);
    const revoked = await errorOf(() =>
      svc.assertCanAccessCourse(principal(Role.STUDENT, 'u3'), 'c1'),
    );
    expect(revoked.code).toBe(ErrorCode.NOT_ENROLLED);
    await expect(
      svc.assertCanAccessCourse(principal(Role.CONTENT_MANAGER, 'c'), 'c1'),
    ).resolves.toBeUndefined();
  });
});
