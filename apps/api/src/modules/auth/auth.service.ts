import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AuthResponse,
  type AuthUser,
  ErrorCode,
  type ForgotPasswordInput,
  type LoginInput,
  type OtpRequestInput,
  OtpPurpose,
  parseLoginIdentifier,
  type RegisterInput,
  type ResetPasswordInput,
  Role,
} from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect, toAuthUser } from '../users/user.mapper';
import { OtpService, type OtpRequestResult } from './otp.service';
import { PasswordService } from './password.service';
import { type SessionMeta, TokenService } from './token.service';

/** Result of a sign-in: the body for the client + the refresh token for the httpOnly cookie. */
export interface AuthResult {
  body: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
  ) {}

  async register(input: RegisterInput, meta: SessionMeta): Promise<AuthResult> {
    const { email, phone } = input;
    if (email && (await this.prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
      throw AppException.conflict(ErrorCode.EMAIL_TAKEN);
    }
    if (phone && (await this.prisma.user.findUnique({ where: { phone }, select: { id: true } }))) {
      throw AppException.conflict(ErrorCode.PHONE_TAKEN);
    }
    if (phone) {
      // Schema guarantees otpCode is present for phone sign-up.
      await this.otp.verify(phone, OtpPurpose.REGISTER, input.otpCode ?? '');
    }

    const passwordHash = await this.passwords.hash(input.password);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: email ?? null,
          phone: phone ?? null,
          fullName: input.fullName,
          passwordHash,
          role: Role.STUDENT,
          phoneVerifiedAt: phone ? new Date() : null,
          lastLoginAt: new Date(),
        },
        select: publicUserSelect,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = String((e.meta as { target?: unknown } | undefined)?.target ?? '');
        throw AppException.conflict(
          target.includes('phone') ? ErrorCode.PHONE_TAKEN : ErrorCode.EMAIL_TAKEN,
        );
      }
      throw e;
    }
    return this.startSession(toAuthUser(user), meta);
  }

  async login(input: LoginInput, meta: SessionMeta): Promise<AuthResult> {
    const id = parseLoginIdentifier(input.login);
    const user = id
      ? await this.prisma.user.findUnique({
          where: id.kind === 'email' ? { email: id.email } : { phone: id.phone },
          select: { ...publicUserSelect, passwordHash: true, isActive: true },
        })
      : null;

    if (!user) {
      await this.passwords.verifyDummy(input.password);
      throw AppException.unauthorized(ErrorCode.INVALID_CREDENTIALS);
    }
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      throw AppException.unauthorized(ErrorCode.INVALID_CREDENTIALS);
    }
    if (!user.isActive) throw AppException.forbidden(ErrorCode.ACCOUNT_DISABLED);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.startSession(toAuthUser(user), meta);
  }

  async refresh(refreshToken: string | undefined, meta: SessionMeta): Promise<AuthResult> {
    const rotated = await this.tokens.rotate(refreshToken, meta);
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      select: { ...publicUserSelect, isActive: true },
    });
    if (!user || !user.isActive) {
      await this.tokens.revokeSession(rotated.sessionId, 'user_inactive');
      throw AppException.unauthorized(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    const accessToken = await this.tokens.signAccessToken(user.id, user.role, rotated.sessionId);
    return {
      body: { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user: toAuthUser(user) },
      refreshToken: rotated.refreshToken,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  async logout(refreshToken: string | undefined, sessionId?: string): Promise<void> {
    await this.tokens.revokeByRefreshToken(refreshToken);
    if (sessionId) await this.tokens.revokeSession(sessionId, 'logout');
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) throw AppException.unauthorized();
    return toAuthUser(user);
  }

  requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
    return this.otp.request(input.phone, input.purpose);
  }

  /**
   * Sends a reset code to the account's phone. Always answers the same way so the endpoint
   * can't be used to discover which logins exist. (Email delivery comes with the email provider.)
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.findByLogin(input.login);
    if (!user?.phone || !user.isActive) return;
    try {
      await this.otp.request(user.phone, OtpPurpose.RESET_PASSWORD);
    } catch (e) {
      if (e instanceof AppException && e.code === ErrorCode.OTP_RESEND_TOO_SOON) return;
      this.logger.error(`Password reset OTP failed: ${(e as Error).message}`);
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await this.findByLogin(input.login);
    if (!user?.phone) {
      throw new AppException(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST);
    }
    await this.otp.verify(user.phone, OtpPurpose.RESET_PASSWORD, input.code);
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(user.id, 'password_reset');
  }

  private findByLogin(login: string) {
    const id = parseLoginIdentifier(login);
    if (!id) return Promise.resolve(null);
    return this.prisma.user.findUnique({
      where: id.kind === 'email' ? { email: id.email } : { phone: id.phone },
      select: { id: true, phone: true, isActive: true },
    });
  }

  private async startSession(user: AuthUser, meta: SessionMeta): Promise<AuthResult> {
    const session = await this.tokens.createSession(user.id, meta);
    const accessToken = await this.tokens.signAccessToken(user.id, user.role, session.sessionId);
    return {
      body: { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user },
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }
}
