import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  type AuthPrincipal,
  type AuthResponse,
  type AuthUser,
  REFRESH_COOKIE_NAME,
} from '@onlinedars/shared';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { AppConfig } from '../../config/app-config';
import { type AuthResult, AuthService } from './auth.service';
import {
  AuthResponseDto,
  AuthUserDto,
  ForgotPasswordDto,
  LoginDto,
  OtpRequestDto,
  OtpRequestResponseDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';
import type { SessionMeta } from './token.service';

/** Path the refresh cookie is scoped to: only auth endpoints ever receive it. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.register(dto, meta(req)));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.login(dto, meta(req)));
  }

  /** Rotates the refresh cookie and returns a new access token. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      return this.withCookie(res, await this.auth.refresh(readRefreshCookie(req), meta(req)));
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
      throw e;
    }
  }

  /** Public so an expired access token can still log out; uses the refresh cookie. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req), undefined);
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOkResponse({ type: AuthUserDto })
  me(@CurrentUser() user: AuthPrincipal): Promise<AuthUser> {
    return this.auth.me(user.id);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ type: OtpRequestResponseDto })
  async requestOtp(@Body() dto: OtpRequestDto) {
    const r = await this.auth.requestOtp(dto);
    return { sent: true, ...r };
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ sent: true }> {
    await this.auth.forgotPassword(dto);
    return { sent: true };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.resetPassword(dto);
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private withCookie(res: Response, result: AuthResult): AuthResponse {
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.refreshExpiresAt,
    });
    return result.body;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    };
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}

function meta(req: Request): SessionMeta {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}
