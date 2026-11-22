import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokenClaims,
  ErrorCode,
  REFRESH_TOKEN_TTL_DAYS,
  type Role,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { hmacSha256, randomSecret, safeEqual } from './crypto';

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedRefresh {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RotatedSession extends IssuedRefresh {
  userId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Access tokens: short-lived HS256 JWTs (15 min) with `sub`, `role`, `sid`.
 * Refresh tokens: opaque `<sessionId>.<secret>`, rotated on every use. Only an HMAC of the
 * current secret is stored, so a DB leak doesn't leak usable tokens. Presenting a secret that
 * is no longer current means the token was copied — the whole session is revoked.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  signAccessToken(userId: string, role: Role, sessionId: string): Promise<string> {
    const claims: AccessTokenClaims = { sub: userId, role, sid: sessionId };
    return this.jwt.signAsync(claims, {
      secret: this.config.env.JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
    });
  }

  hashSecret(secret: string): string {
    return hmacSha256(this.config.env.JWT_REFRESH_SECRET, secret);
  }

  async createSession(userId: string, meta: SessionMeta = {}): Promise<IssuedRefresh> {
    const secret = randomSecret();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * DAY_MS);
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.hashSecret(secret),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        ip: meta.ip ?? null,
      },
      select: { id: true },
    });
    return { sessionId: session.id, refreshToken: `${session.id}.${secret}`, expiresAt };
  }

  /** Validates a refresh token and replaces its secret. Throws 401 on any problem. */
  async rotate(refreshToken: string | undefined, meta: SessionMeta = {}): Promise<RotatedSession> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw invalid();

    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      select: { id: true, userId: true, refreshTokenHash: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw invalid();

    const presentedHash = this.hashSecret(parsed.secret);
    if (!safeEqual(presentedHash, session.refreshTokenHash)) {
      await this.revokeSession(session.id, 'refresh_token_reuse');
      throw reused();
    }

    const nextSecret = randomSecret();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * DAY_MS);
    // Compare-and-swap on the old hash: if two requests race with the same token, only one wins.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
      data: {
        refreshTokenHash: this.hashSecret(nextSecret),
        expiresAt,
        lastUsedAt: new Date(),
        ...(meta.ip ? { ip: meta.ip } : {}),
      },
    });
    if (count !== 1) {
      await this.revokeSession(session.id, 'refresh_token_reuse');
      throw reused();
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      refreshToken: `${session.id}.${nextSecret}`,
      expiresAt,
    };
  }

  /** Revokes the session a refresh token belongs to, if the token is valid. Never throws. */
  async revokeByRefreshToken(refreshToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) return;
    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      select: { refreshTokenHash: true },
    });
    if (session && safeEqual(this.hashSecret(parsed.secret), session.refreshTokenHash)) {
      await this.revokeSession(parsed.sessionId, 'logout');
    }
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
}

export function parseRefreshToken(
  token: string | undefined | null,
): { sessionId: string; secret: string } | null {
  if (!token || token.length > 200) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
}

const invalid = () =>
  new AppException(
    ErrorCode.REFRESH_TOKEN_INVALID,
    HttpStatus.UNAUTHORIZED,
    'Invalid refresh token',
  );
const reused = () =>
  new AppException(
    ErrorCode.REFRESH_TOKEN_REUSED,
    HttpStatus.UNAUTHORIZED,
    'Refresh token reuse detected; session revoked',
  );
