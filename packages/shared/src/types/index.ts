import type { Role } from '../enums';

/** The authenticated principal attached to `req.user` by the API's JwtAuthGuard. */
export interface AuthPrincipal {
  id: string;
  role: Role;
  sessionId: string;
}

/** Claims inside the JWT access token. */
export interface AccessTokenClaims {
  sub: string;
  role: Role;
  sid: string;
}
