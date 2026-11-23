import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthPrincipal, Role } from '@onlinedars/shared';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Opt a route out of the global JwtAuthGuard. Use only for genuinely public endpoints. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict a route (or controller) to the given roles. Checked by the global RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthedRequest = Request & { user?: AuthPrincipal };

/** Injects the authenticated principal (`{ id, role, sessionId }`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal | undefined =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
