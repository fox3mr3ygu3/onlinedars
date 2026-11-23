import { z } from 'zod';
import { fullNameSchema, passwordSchema } from './auth';
import { emailSchema } from './identity';

export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: emailSchema.nullable().optional(),
    avatarUrl: z.url().max(2048).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'validation.empty' });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
