import { z } from 'zod';
import { OTP_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants';
import { OtpPurpose, Role } from '../enums';
import { emailSchema, loginIdentifierSchema, phoneSchema } from './identity';

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: 'validation.passwordMin' })
  .max(PASSWORD_MAX_LENGTH, { message: 'validation.passwordMax' });

export const fullNameSchema = z.string().trim().min(2).max(120);

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^[0-9]{${OTP_LENGTH}}$`), { message: 'validation.otp' });

/**
 * Register with email and/or phone. A phone sign-up must carry the OTP code that was sent
 * to that phone (`POST /auth/otp/request` with purpose REGISTER).
 */
export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    otpCode: otpCodeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'validation.emailOrPhone' });
    }
    if (v.phone && !v.otpCode) {
      ctx.addIssue({ code: 'custom', path: ['otpCode'], message: 'validation.otpRequired' });
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  login: loginIdentifierSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum([OtpPurpose.REGISTER, OtpPurpose.VERIFY_PHONE]),
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const forgotPasswordSchema = z.object({ login: loginIdentifierSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  login: loginIdentifierSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  fullName: z.string(),
  role: z.enum(Role),
  avatarUrl: z.string().nullable(),
  phoneVerified: z.boolean(),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Body of login / register / refresh responses. The refresh token is only in the httpOnly cookie. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const otpRequestResponseSchema = z.object({
  sent: z.boolean(),
  expiresIn: z.number().int(),
  resendIn: z.number().int(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;
