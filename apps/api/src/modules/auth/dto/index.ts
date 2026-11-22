import {
  authResponseSchema,
  authUserSchema,
  forgotPasswordSchema,
  loginSchema,
  otpRequestResponseSchema,
  otpRequestSchema,
  registerSchema,
  resetPasswordSchema,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class OtpRequestDto extends createZodDto(otpRequestSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class AuthResponseDto extends createZodDto(authResponseSchema) {}
export class AuthUserDto extends createZodDto(authUserSchema) {}
export class OtpRequestResponseDto extends createZodDto(otpRequestResponseSchema) {}
