import { Global, Injectable, Module } from '@nestjs/common';
import { type AuthPrincipal, ErrorCode, Role } from '@onlinedars/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';

const STAFF: readonly Role[] = [Role.ADMIN, Role.CONTENT_MANAGER];

/** True if the principal is the owner of the resource. */
export function isOwner(principal: AuthPrincipal, ownerUserId: string): boolean {
  return principal.id === ownerUserId;
}

/**
 * Throws 403 unless the principal owns the resource or has one of `staffRoles`.
 * Use for every student-data read/write: "a student can only read their own data".
 */
export function assertOwnerOrRoles(
  principal: AuthPrincipal,
  ownerUserId: string,
  staffRoles: readonly Role[] = [Role.ADMIN],
): void {
  if (isOwner(principal, ownerUserId)) return;
  if (staffRoles.includes(principal.role)) return;
  throw AppException.forbidden();
}

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** True if the user has an active (non-revoked) enrollment in the course. */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { revokedAt: true },
    });
    return Boolean(enrollment && !enrollment.revokedAt);
  }

  /** Students must be enrolled; staff (ADMIN, CONTENT_MANAGER) may preview any course. */
  async assertCanAccessCourse(principal: AuthPrincipal, courseId: string): Promise<void> {
    if (STAFF.includes(principal.role)) return;
    if (!(await this.isEnrolled(principal.id, courseId))) {
      throw AppException.forbidden(ErrorCode.NOT_ENROLLED);
    }
  }
}

@Global()
@Module({ providers: [OwnershipService], exports: [OwnershipService] })
export class OwnershipModule {}
