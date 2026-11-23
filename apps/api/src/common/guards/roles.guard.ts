import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@onlinedars/shared';
import { type AuthedRequest, IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { AppException } from '../errors/app.exception';

/**
 * Global guard (runs after JwtAuthGuard). If a route/controller has @Roles(...), the
 * authenticated user's role must be one of them. Without @Roles any signed-in user passes;
 * services must still check ownership for student data.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw AppException.unauthorized();
    if (!roles.includes(user.role)) throw AppException.forbidden();
    return true;
  }
}
