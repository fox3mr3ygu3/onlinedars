import type { AuthUser } from '@onlinedars/shared';
import type { User } from '@prisma/client';

export type PublicUserFields = Pick<
  User,
  'id' | 'email' | 'phone' | 'fullName' | 'role' | 'avatarUrl' | 'phoneVerifiedAt' | 'createdAt'
>;

export const publicUserSelect = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  role: true,
  avatarUrl: true,
  phoneVerifiedAt: true,
  createdAt: true,
} as const;

/** The only user shape that leaves the API. Never includes passwordHash. */
export function toAuthUser(u: PublicUserFields): AuthUser {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    fullName: u.fullName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    phoneVerified: u.phoneVerifiedAt !== null,
    createdAt: u.createdAt.toISOString(),
  };
}
