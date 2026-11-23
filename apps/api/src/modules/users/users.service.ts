import { Injectable } from '@nestjs/common';
import {
  type AuthPrincipal,
  type AuthUser,
  type ChangePasswordInput,
  ErrorCode,
  type UpdateProfileInput,
} from '@onlinedars/shared';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { publicUserSelect, toAuthUser } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /** Always scoped to the caller: there is no userId parameter to tamper with. */
  async getOwnProfile(principal: AuthPrincipal): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
      select: publicUserSelect,
    });
    if (!user) throw AppException.notFound();
    return toAuthUser(user);
  }

  async updateOwnProfile(principal: AuthPrincipal, input: UpdateProfileInput): Promise<AuthUser> {
    if (input.email) {
      const other = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (other && other.id !== principal.id) throw AppException.conflict(ErrorCode.EMAIL_TAKEN);
    }
    try {
      const user = await this.prisma.user.update({
        where: { id: principal.id },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.email !== undefined ? { email: input.email, emailVerifiedAt: null } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        },
        select: publicUserSelect,
      });
      return toAuthUser(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw AppException.conflict(ErrorCode.EMAIL_TAKEN);
      }
      throw e;
    }
  }

  /** Changes the password and signs out every other device. */
  async changeOwnPassword(principal: AuthPrincipal, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
      select: { passwordHash: true },
    });
    if (!user) throw AppException.notFound();
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw AppException.badRequest(ErrorCode.WRONG_PASSWORD);
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.user.update({ where: { id: principal.id }, data: { passwordHash } });
    await this.tokens.revokeAllForUser(principal.id, 'password_change', principal.sessionId);
  }
}
