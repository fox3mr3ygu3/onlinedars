import {
  emailSchema,
  fullNameSchema,
  loginIdentifierSchema,
  otpCodeSchema,
  passwordSchema,
  phoneSchema,
} from '@onlinedars/shared';
import { z } from 'zod';

/*
 * Form-step schemas built from the shared field schemas (the shared registerSchema validates the
 * final request; these split it into UI steps).
 */

export const emailRegisterFormSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const phoneRegisterFormSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const otpFormSchema = z.object({ code: otpCodeSchema });

export const forgotFormSchema = z.object({ login: loginIdentifierSchema });

export const resetFormSchema = z.object({ code: otpCodeSchema, newPassword: passwordSchema });
