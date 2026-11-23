import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  type OtpPurpose,
} from '@onlinedars/shared';
import { AppException } from '../../common/errors/app.exception';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { hmacSha256, randomDigits, safeEqual } from './crypto';
import { SmsProvider } from './sms/sms-provider';

export interface OtpRequestResult {
  expiresIn: number;
  resendIn: number;
}

/** Phone one-time codes: 6 digits, 5 minute TTL, 5 attempts, 60 s resend cooldown. */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsProvider,
    private readonly config: AppConfig,
  ) {}

  async request(phone: string, purpose: OtpPurpose): Promise<OtpRequestResult> {
    const now = Date.now();
    const last = await this.prisma.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (last && now - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new AppException(ErrorCode.OTP_RESEND_TOO_SOON, HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomDigits(OTP_LENGTH);
    // Only the newest code is valid.
    await this.prisma.otpCode.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date(now) },
    });
    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: this.hash(phone, purpose, code),
        expiresAt: new Date(now + OTP_TTL_SECONDS * 1000),
      },
    });
    await this.sms.send(phone, `OnlineDars tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`);
    return { expiresIn: OTP_TTL_SECONDS, resendIn: OTP_RESEND_COOLDOWN_SECONDS };
  }

  /** Verifies and consumes the newest code. Throws OTP_INVALID / OTP_EXPIRED / OTP_TOO_MANY_ATTEMPTS. */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, attempts: true, expiresAt: true },
    });
    if (!otp) throw otpError(ErrorCode.OTP_INVALID);
    if (otp.expiresAt.getTime() <= Date.now()) throw otpError(ErrorCode.OTP_EXPIRED);
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw otpError(ErrorCode.OTP_TOO_MANY_ATTEMPTS);

    if (!safeEqual(this.hash(phone, purpose, code), otp.codeHash)) {
      const attempts = otp.attempts + 1;
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts } });
      throw otpError(
        attempts >= OTP_MAX_ATTEMPTS ? ErrorCode.OTP_TOO_MANY_ATTEMPTS : ErrorCode.OTP_INVALID,
      );
    }

    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count !== 1) throw otpError(ErrorCode.OTP_INVALID);
  }

  hash(phone: string, purpose: OtpPurpose, code: string): string {
    return hmacSha256(this.config.env.JWT_REFRESH_SECRET, `otp:${purpose}:${phone}:${code}`);
  }
}

const otpError = (code: ErrorCode) => new AppException(code, HttpStatus.BAD_REQUEST);
